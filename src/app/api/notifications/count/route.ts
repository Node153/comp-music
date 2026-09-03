import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeUnseenNotificationCount } from "@/lib/notificationCount";

// 상단/하단 네비 안읽음 뱃지 숫자. (app)/layout.tsx에서 동기로 돌던 계산을 여기로 옮겨
// 페이지 첫 페인트를 막지 않게 했다 — NotificationCountProvider가 마운트 후 호출한다.
// 세션 createClient라 RLS가 그대로 적용되고, 별도 권한 검사는 하지 않는다.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("notifications_seen_at")
    .eq("id", user.id)
    .single();

  const seenAt = me?.notifications_seen_at ?? new Date(0).toISOString();
  const count = await computeUnseenNotificationCount(supabase, user.id, seenAt);

  return NextResponse.json({ count });
}
