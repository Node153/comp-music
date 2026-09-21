import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presenceStatus } from "@/lib/presence";

// 대화가 쌓일수록 패널을 열 때마다 전체 이력을 매번 다시 읽어오던 걸 막기 위해 최근 메시지만
// 가져온다(오래된 메시지를 더 불러오는 기능은 아직 없음 — 우선 무제한 조회부터 막는 범위).
const MESSAGE_PAGE_SIZE = 100;

// NavSidebar 메시지 패널이 대화방을 열 때 호출한다 — /messages/[conversationId]/page.tsx와
// 같은 조립 로직(상대방 이름/온라인 상태 + 전체 메시지)이지만, 패널은 클라이언트 컴포넌트라
// 서버 전용 쿼리를 직접 못 써서 API로 뺐다(2026-09-16, 사용자 요청 — "메시지도 페이지 이동
// 없이 사이드바 자체적으로 채팅화면으로 전환"). 게시물에서 시작된 대화의 고정 미리보기는
// 페이지 쪽에만 남겨둠(패널은 대화 자체에 집중).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, user_a_id, user_b_id")
    .eq("id", conversationId)
    .single();

  if (!conversation || (conversation.user_a_id !== user.id && conversation.user_b_id !== user.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const otherUserId = conversation.user_a_id === user.id ? conversation.user_b_id : conversation.user_a_id;

  const [{ data: otherUserRow }, { data: presenceRow }, { data: recentMessages }] = await Promise.all([
    supabase.from("user_display").select("display_name").eq("id", otherUserId).single(),
    supabase.from("users").select("last_seen_at").eq("id", otherUserId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, content, created_at, read_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE),
  ]);

  return NextResponse.json({
    conversationId,
    otherUserId,
    otherUserName: otherUserRow?.display_name ?? "알 수 없음",
    otherUserStatus: presenceStatus(presenceRow?.last_seen_at ?? null),
    messages: (recentMessages ?? []).slice().reverse(),
  });
}
