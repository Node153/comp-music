import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConversationList } from "@/lib/conversationList";

// NavSidebar 메시지 패널(MessagesMenu)이 열릴 때마다 호출한다.
// 전체 메시지 페이지(/messages)와 같은 조립 로직을 쓴다. 패널이 이제 작은 미리보기가 아니라
// "전체 메시지 보기" 링크를 없애고 이 패널 자체가 본 목록이 됐으므로(2026-09-16), 알림
// 패널과 같은 개수(50)까지 내려준다.
const DROPDOWN_LIMIT = 50;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ conversations: [] });
  }

  const conversations = await getConversationList(supabase, user.id);
  return NextResponse.json({ conversations: conversations.slice(0, DROPDOWN_LIMIT) });
}
