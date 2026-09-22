import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 메시지탭 안읽음 뱃지 숫자 — 안읽은 메시지가 있는 대화 수(conversationList.ts의 unread
// boolean과 동일 기준). /api/notifications/count와 같은 패턴으로 MessageCountProvider가
// 마운트 후 호출한다.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
  const conversationIds = (conversations ?? []).map((c) => c.id);

  if (conversationIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const { data: unreadRows } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const count = new Set((unreadRows ?? []).map((r) => r.conversation_id)).size;

  return NextResponse.json({ count });
}
