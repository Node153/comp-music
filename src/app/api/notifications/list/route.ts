import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNotificationItems } from "@/lib/notificationList";

// NavSidebar 알림 패널(NotificationsMenu)이 마운트가 아니라 패널을 열 때 호출한다.
// 전체 알림 페이지(/notifications)와 같은 조립 로직을 쓴다. 패널이 이제 작은 미리보기가 아니라
// 화면 전체 높이로 펼쳐지는 본 목록이라(2026-09-16, "사이드바에서 알림정보 다 볼 수 있게"),
// /notifications 페이지와 같은 개수(50)까지 내려준다.
const DROPDOWN_LIMIT = 50;

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
