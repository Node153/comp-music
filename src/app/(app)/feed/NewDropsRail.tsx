import { createClient } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/r2/storage";
import { NewDropsRailList, type NewDrop } from "./NewDropsRailList";

// 새 글 부스트(0076) — DEMO 피드 맨 위 "첫 반응을 기다리는 Drop" 가로 목록. 파일럿 초기엔 새 글이
// 반응 0개로 묻히면 올린 사람이 다시 안 올리기 때문에, 최근 48시간 안에 올라온 남의 글 중 반응이
// 적은 것(다른 사람 좋아요+댓글 3개 미만)을 반응 적은 순으로 먼저 보여준다. 내가 이미 반응한
// 글은 빠진다(awaiting_first_reactions). 누르면 바로 재생 — 5초 들으면 작성자에게 청취 알림이 간다.
export async function NewDropsRail() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("awaiting_first_reactions", { p_limit: 8 });
  const rows = (data ?? []).filter((r) => r.post.media_type === "audio" || r.post.media_type === "video");
  if (rows.length === 0) return null;

  const authorIds = [...new Set(rows.map((r) => r.post.user_id))];
  const { data: authors } = await supabase.from("public_post_authors").select("id, display_name").in("id", authorIds);
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  const drops: NewDrop[] = await Promise.all(
    rows.map(async ({ post, reaction_count }) => ({
      id: post.id,
      title: post.title || post.caption || "새 Drop",
      authorId: post.user_id,
      authorName: nameById.get(post.user_id) ?? "알 수 없음",
      posterSrc: post.thumbnail_url ? await resolveMediaUrl(post.thumbnail_url, 60 * 60).catch(() => null) : null,
      mediaType: post.media_type === "video" ? "video" : "audio",
      publishedAt: post.published_at ?? post.created_at,
      reactionCount: reaction_count,
    })),
  );

  return <NewDropsRailList drops={drops} />;
}
