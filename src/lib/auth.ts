import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// 한 요청 안에서 여러 서버 컴포넌트(레이아웃/피드 레이아웃/페이지)가 각자
// supabase.auth.getUser()를 부르던 걸 요청 단위로 1회만 왕복하도록 memoize한다.
// React cache()는 렌더 요청 스코프라 요청이 끝나면 자동 폐기된다.
// (미들웨어 src/proxy.ts는 별도 런타임이라 여기 캐시가 닿지 않는다 — 그쪽은 그대로 1회.)
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// (app) 레이아웃/피드에서 공통으로 필요한 내 users 행 — 이름·상태·알림 기준시각.
// getCurrentUser와 마찬가지로 요청당 1회.
export const getMyUserRow = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, status, role, needs_onboarding, notifications_seen_at")
    .eq("id", user.id)
    .single();
  return data;
});
