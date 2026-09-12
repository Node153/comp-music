import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNotificationItems } from "@/lib/notificationList";

// TopNav 알림 드롭다운(NotificationsMenu)이 마운트가 아니라 드롭다운을 열 때 호출한다.
// 전체 알림 페이지(/notifications)와 같은 조립 로직을 쓰고 최근 몇 개만 잘라서 내려준다.
const DROPDOWN_LIMIT = 8;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const { items } = await getNotificationItems(supabase, user.id);
  return NextResponse.json({ items: items.slice(0, DROPDOWN_LIMIT) });
}
