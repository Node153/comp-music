import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { presenceStatus, type PresenceStatus } from "@/lib/presence";

// DM 목록 조립 — 원래 (app)/messages/page.tsx 안에만 있던 로직을 여기로 옮겨
// 전체 메시지 페이지와 TopNav 메시지 드롭다운(/api/messages/list)이 같이 쓴다.
// href/unread/presence를 미리 계산해서 내려주면 두 소비처가 렌더링에만 집중할 수 있다.
export type ConversationItem = {
  id: string;
  otherUserId: string;
  otherName: string;
  lastMessage: { content: string; createdAt: string } | null;
  unread: boolean;
  presence: PresenceStatus;
  href: string;
};

// last_message_at 기준 최신순 전체 목록을 돌려준다 — 자르기는 호출하는 쪽(페이지는 전체,
// 드롭다운은 최근 몇 개)이 각자 한다.
export async function getConversationList(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConversationItem[]> {
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, user_a_id, user_b_id, last_message_at")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const conversationIds = (conversations ?? []).map((c) => c.id);
  const otherUserIds = (conversations ?? []).map((c) => (c.user_a_id === userId ? c.user_b_id : c.user_a_id));

  const { data: users } =
    otherUserIds.length > 0
      ? await supabase.from("user_display").select("id, display_name").in("id", otherUserIds)
      : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));

  // 온라인 상태는 실명 공개 정책과 무관하게(DM은 Companion 여부와 상관없이 아무하고나 가능)
  // last_seen_at을 users에서 직접 조회한다 — RLS(users_select_self_or_approved_peers)가
  // 승인 사용자끼리는 서로 조회를 허용하므로 문제없다.
  const { data: presenceRows } =
    otherUserIds.length > 0
      ? await supabase.from("users").select("id, last_seen_at").in("id", otherUserIds)
      : { data: [] };
  const presenceMap = new Map((presenceRows ?? []).map((u) => [u.id, presenceStatus(u.last_seen_at)]));

  const { data: lastMessages } =
    conversationIds.length > 0
      ? await supabase
          .from("messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : { data: [] };
  const lastMessageMap = new Map<string, { content: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!lastMessageMap.has(m.conversation_id)) lastMessageMap.set(m.conversation_id, m);
  }

  const { data: unreadRows } =
    conversationIds.length > 0
      ? await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", conversationIds)
          .neq("sender_id", userId)
          .is("read_at", null)
      : { data: [] };
  const unreadSet = new Set((unreadRows ?? []).map((r) => r.conversation_id));

  return (conversations ?? []).map((c): ConversationItem => {
    const otherUserId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
    const lastMessage = lastMessageMap.get(c.id);
    return {
      id: c.id,
      otherUserId,
      otherName: userMap.get(otherUserId) ?? "알 수 없음",
      lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.created_at } : null,
      unread: unreadSet.has(c.id),
      presence: presenceMap.get(otherUserId) ?? "offline",
      href: `/messages/${c.id}`,
    };
  });
}
