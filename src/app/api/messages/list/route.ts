import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConversationList } from "@/lib/conversationList";

// TopNav 메시지 드롭다운(MessagesMenu)이 열릴 때마다 호출한다.
// 전체 메시지 페이지(/messages)와 같은 조립 로직을 쓰고 최근 대화 몇 개만 잘라서 내려준다.
const DROPDOWN_LIMIT = 8;

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
