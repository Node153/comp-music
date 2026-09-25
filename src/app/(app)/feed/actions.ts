"use server";

import { loadFeedChunk } from "./feedChunk";
import type { FeedState } from "./feedQuery";

// 무한 스크롤 다음 페이지(FeedInfiniteList) — 카드 JSX를 그대로 돌려준다. state는 클라이언트가
// 들고 있던 걸 그대로 받으므로 모양만 검사한다(접근 제어는 feed_candidates가 auth.uid()로 판단).
export async function loadMoreFeed(state: FeedState) {
  const uuid = /^[0-9a-f-]{36}$/i;
  const valid =
    state &&
    state.scope === "demo" &&
    (state.phase === "unplayed" || state.phase === "played") &&
    (state.tag === null || (typeof state.tag === "string" && state.tag.length <= 50)) &&
    Array.isArray(state.carry) && state.carry.length <= 50 && state.carry.every((id) => uuid.test(id)) &&
    Array.isArray(state.exclude) && state.exclude.length <= 200 && state.exclude.every((id) => uuid.test(id)) &&
    (state.cursor === null || (uuid.test(state.cursor.id) && !Number.isNaN(Date.parse(state.cursor.ts))));
  if (!valid) return { nodes: [], next: null };
  const { nodes, next } = await loadFeedChunk(state, false);
  return { nodes, next };
}
