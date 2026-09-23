import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/r2/storage";
import { peakScore } from "@/lib/feedConstants";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;
const PEAK_POSTS_VISIBLE_LIMIT = 3;

// RightSidebar(클라이언트 컴포넌트)는 브라우저에서 바로 supabase를 쓰지만, 썸네일
// (thumbnail_url)이 R2 key인 경우 resolveMediaUrl이 AWS 자격증명을 쓰는 "server-only"
// 함수라 브라우저에서 못 부른다(track-url 라우트와 같은 이유) — 그래서 여기서 서버 쪽에서
// signed URL까지 만들어 내려준다.
//
// PEAK 여부 자체는 더 이상 여기서 조회수+좋아요로 재계산하지 않는다 — 0056 마이그레이션 이후
// posts.peaked_at이 한 번 찍히면 영구 고정(좋아요를 취소해도 유지)이라 peaked_at is not null만
// 걸러내면 된다. 노출 순서만 참고삼아 현재 점수(peakScore) 내림차순으로 정렬한다.
export async function GET() {
  const supabase = await createClient();

  const { data: rawPosts } = await supabase
    .from("posts")
    .select("id, user_id, caption, title, thumbnail_url, published_at, view_count")
    .eq("visibility", "public")
    .eq("status", "published")
    .not("peaked_at", "is", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("view_count", { ascending: false })
    .limit(50);

  const posts = rawPosts ?? [];
  if (posts.length === 0) {
    return NextResponse.json({ posts: [] });
  }

  const postIds = posts.map((p) => p.id);
  const [{ data: likeRows }, { data: kickRows }] = await Promise.all([
    supabase.from("likes").select("post_id").in("post_id", postIds),
    supabase.from("kicks").select("post_id").in("post_id", postIds),
  ]);
  const likeCountMap = new Map<string, number>();
  for (const row of likeRows ?? []) {
    likeCountMap.set(row.post_id, (likeCountMap.get(row.post_id) ?? 0) + 1);
  }
  const kickCountMap = new Map<string, number>();
  for (const row of kickRows ?? []) {
    kickCountMap.set(row.post_id, (kickCountMap.get(row.post_id) ?? 0) + 1);
  }

  const topPosts = posts
    .map((p) => ({ ...p, score: peakScore(p.view_count, likeCountMap.get(p.id) ?? 0, kickCountMap.get(p.id) ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, PEAK_POSTS_VISIBLE_LIMIT);

  // PEAK는 항상 demo(공개) 게시물이라 뷰어가 작성자의 Companion이어도 닉네임만 보여준다
  // (사용자 요청) — public_post_authors(0024)는 애초에 닉네임만 내려준다.
  const authorIds = [...new Set(topPosts.map((p) => p.user_id))];
  const { data: authors } = await supabase
    .from("public_post_authors")
    .select("id, display_name")
    .in("id", authorIds);
  const authorMap = new Map((authors ?? []).map((u) => [u.id, u.display_name]));

  const result = await Promise.all(
    topPosts.map(async (p) => ({
      postId: p.id,
      authorId: p.user_id,
      authorName: authorMap.get(p.user_id) ?? "알 수 없음",
      caption: p.title || p.caption,
      publishedAt: p.published_at ?? new Date().toISOString(),
      thumbnailUrl: p.thumbnail_url ? await resolveMediaUrl(p.thumbnail_url, SIGNED_URL_EXPIRY_SECONDS) : null,
    })),
  );

  return NextResponse.json({ posts: result });
}
