import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyUserRow } from "@/lib/auth";
import { buildFeedPage, type FeedState } from "./feedQuery";
import { FeedCaughtUpDivider, renderFeedPosts, type FeedPostRow } from "./feedRender";

// 피드 한 페이지(게시물 선택 + 카드 렌더) — 첫 페이지(page.tsx)와 무한 스크롤(actions.ts)
// 공용. nodes는 그대로 목록에 이어 붙이면 되는 카드/구분선 배열.
export async function loadFeedChunk(state: FeedState, isFirstPage: boolean) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const isComplex = state.scope === "memo";
  if (isComplex && !currentUser) return { nodes: [] as React.ReactNode[], next: null, postCount: 0 };

  const [me, { data: companionRows }, page] = await Promise.all([
    currentUser ? getMyUserRow() : Promise.resolve(null),
    currentUser && isComplex
      ? supabase
          .from("companions")
          .select("requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
      : Promise.resolve({ data: [] as { requester_id: string; addressee_id: string }[] }),
    buildFeedPage(supabase, state, currentUser?.id ?? null, isFirstPage),
  ]);
  const myCompanionIds = new Set(
    (companionRows ?? []).map((r) => (r.requester_id === currentUser?.id ? r.addressee_id : r.requester_id)),
  );

  const posts = page.items.flatMap((i) => (i.kind === "post" ? [i.post] : [])) as FeedPostRow[];
  const cards = await renderFeedPosts(posts, {
    supabase,
    currentUser,
    currentUserName: me?.name || "나",
    isComplex,
    myCompanionIds,
  });
  let n = 0;
  const nodes = page.items.map((i) =>
    i.kind === "post" ? cards[n++] : <FeedCaughtUpDivider key="feed-caught-up" />,
  );
  return { nodes, next: page.next, postCount: posts.length };
}
