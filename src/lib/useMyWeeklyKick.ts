"use client";

// 내 이번 주 Kick(0071) 사용 여부 — 게시물 카드마다가 아니라 "사람당 주 1회"라서 화면의 모든
// KickButton이 같은 값을 봐야 한다(한 카드에서 Kick하면 나머지 카드가 즉시 "이미 사용" 상태로).
// 그래서 PostEngagementContext(카드 단위)가 아니라 모듈 전역 스토어 + useSyncExternalStore로
// 둔다. 서버가 초기값을 내려주지 않고, 처음 쓰는 KickButton이 한 번만 조회한다.
import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentKickWeekStart } from "@/lib/feedConstants";

type WeeklyKick = { userId: string; weekStart: string; postId: string | null };

let state: WeeklyKick | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadMyWeeklyKick(userId: string, force = false): Promise<void> {
  const weekStart = currentKickWeekStart();
  if (!force && state && state.userId === userId && state.weekStart === weekStart) return Promise.resolve();
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data } = await createClient()
      .from("kicks")
      .select("post_id")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();
    state = { userId, weekStart, postId: data?.post_id ?? null };
    inflight = null;
    emit();
  })();
  return inflight;
}

// 이벤트 핸들러에서 await loadMyWeeklyKick() 직후의 최신 값을 읽을 때(훅 값은 다음 렌더에야 바뀜).
export function getMyWeeklyKickPostId(userId: string): string | null {
  return state && state.userId === userId && state.weekStart === currentKickWeekStart() ? state.postId : null;
}

export function markMyWeeklyKick(userId: string, postId: string) {
  state = { userId, weekStart: currentKickWeekStart(), postId };
  emit();
}

// loaded=false인 동안은 아직 모름 — 버튼은 "사용 가능"처럼 그리되 누르면 조회를 기다린다.
export function useMyWeeklyKick(userId: string) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );

  useEffect(() => {
    void loadMyWeeklyKick(userId);
  }, [userId]);

  const current = snapshot && snapshot.userId === userId && snapshot.weekStart === currentKickWeekStart() ? snapshot : null;
  return { loaded: current !== null, kickedPostId: current?.postId ?? null };
}
