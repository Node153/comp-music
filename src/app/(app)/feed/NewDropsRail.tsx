import { createClient } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/r2/storage";
import { NewDropsRailList, type NewDrop } from "./NewDropsRailList";

// PEAK 유력 후보(0081, 2026-09-25 사용자 요청 — 예전 "첫 반응을 기다리는 Drop"(0076)을 대체) —
// DEMO 피드 맨 위 가로 목록. 아직 PEAK이 아닌 남의 글 중 PEAK 점수(조회수 + 좋아요×10 + Kick×100)가
// 기준(1000)에 가까운 순으로 보여주고, 카드마다 "PEAK까지 몇 %"와 내가 보탤 수 있는 반응(좋아요/Kick)을
// 알려줘서 반응을 모아 PEAK에 올리도록 유도한다. 항상 3장(0082, 사용자 요청) — 좋은 후보가 모자라면
// 점수 0인 글 → 내가 Kick한 글 → 내 글 순으로 채운다(peak_candidates가 우선순위대로 정렬해 줌).
const RAIL_SIZE = 3;
export async function NewDropsRail({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("peak_candidates", { p_limit: RAIL_SIZE });
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const authorIds = [...new Set(rows.map((r) => r.post.user_id))];
  const { data: authors } = await supabase.from("public_post_authors").select("id, display_name").in("id", authorIds);
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  const drops: NewDrop[] = await Promise.all(
    rows.map(async ({ post, score, my_liked, my_kicked, is_mine }) => ({
      id: post.id,
      title: post.title || post.caption || "새 Drop",
      authorId: post.user_id,
      authorName: nameById.get(post.user_id) ?? "알 수 없음",
      // 이미지 글(후보가 모자랄 때 채우는 용도)은 썸네일이 없으면 이미지 자체를 쓴다.
      posterSrc: await (async () => {
        const key = post.thumbnail_url ?? (post.media_type === "image" ? post.image_url : null);
        return key ? resolveMediaUrl(key, 60 * 60).catch(() => null) : null;
      })(),
      mediaType: post.media_type === "image" ? "image" : post.media_type === "video" ? "video" : "audio",
      publishedAt: post.published_at ?? post.created_at,
      score,
      myLiked: my_liked,
      myKicked: my_kicked,
      isMine: is_mine,
    })),
  );

  return <NewDropsRailList drops={drops} userId={userId} />;
}
