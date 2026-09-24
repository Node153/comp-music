import { createClient } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/r2/storage";
import { NewDropsRailList, type NewDrop } from "./NewDropsRailList";

// PEAK 유력 후보(0081, 2026-09-25 사용자 요청 — 예전 "첫 반응을 기다리는 Drop"(0076)을 대체) —
// DEMO 피드 맨 위 가로 목록. 아직 PEAK이 아닌 남의 글 중 PEAK 점수(조회수 + 좋아요×10 + Kick×100)가
// 기준(1000)에 가까운 순으로 보여주고, 카드마다 "PEAK까지 몇 %"와 내가 보탤 수 있는 반응(좋아요/Kick)을
// 알려줘서 반응을 모아 PEAK에 올리도록 유도한다. 내가 이미 Kick한 글은 빠진다(peak_candidates).
export async function NewDropsRail({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("peak_candidates", { p_limit: 8 });
  const rows = (data ?? []).filter((r) => r.post.media_type === "audio" || r.post.media_type === "video");
  if (rows.length === 0) return null;

  const authorIds = [...new Set(rows.map((r) => r.post.user_id))];
  const { data: authors } = await supabase.from("public_post_authors").select("id, display_name").in("id", authorIds);
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  const drops: NewDrop[] = await Promise.all(
    rows.map(async ({ post, score, my_liked }) => ({
      id: post.id,
      title: post.title || post.caption || "새 Drop",
      authorId: post.user_id,
      authorName: nameById.get(post.user_id) ?? "알 수 없음",
      posterSrc: post.thumbnail_url ? await resolveMediaUrl(post.thumbnail_url, 60 * 60).catch(() => null) : null,
      mediaType: post.media_type === "video" ? "video" : "audio",
      publishedAt: post.published_at ?? post.created_at,
      score,
      myLiked: my_liked,
    })),
  );

  return <NewDropsRailList drops={drops} userId={userId} />;
}
