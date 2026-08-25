import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, pageCard } from "@/components/ui/styles";
import { presenceStatus } from "@/lib/presence";
import { Avatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/timeAgo";

// S12 DM 목록 (DM-02)
// "다정한 말풍선" 톤(인스타그램/메신저 참고)으로 개편 — RightSidebar와 같은 색상 아바타 +
// 온라인 상태 점을 여기서도 써서 앱 전체에서 "이 사람 지금 접속해있나"가 같은 방식으로 보이게 한다.
export default async function MessagesPage() {
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) redirect("/login");

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, user_a_id, user_b_id, last_message_at")
    .or(`user_a_id.eq.${currentUser.id},user_b_id.eq.${currentUser.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const conversationIds = (conversations ?? []).map((c) => c.id);
  const otherUserIds = (conversations ?? []).map((c) =>
    c.user_a_id === currentUser.id ? c.user_b_id : c.user_a_id,
  );

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
          .neq("sender_id", currentUser.id)
          .is("read_at", null)
      : { data: [] };
  const unreadSet = new Set((unreadRows ?? []).map((r) => r.conversation_id));

  return (
    <main className={pageCard}>
      <h1 className={pageTitle}>메시지</h1>
      <ul className="mt-4 flex flex-col">
        {(conversations ?? []).map((c) => {
          const otherUserId = c.user_a_id === currentUser.id ? c.user_b_id : c.user_a_id;
          const otherName = userMap.get(otherUserId) ?? "알 수 없음";
          const lastMessage = lastMessageMap.get(c.id);
          const isUnread = unreadSet.has(c.id);
          const status = presenceMap.get(otherUserId) ?? "offline";
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50"
              >
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                  <Avatar userId={otherUserId} name={otherName} className="h-12 w-12 text-base" />
                  {status !== "offline" && (
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                        status === "online" ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                  )}
                </span>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className={`text-sm ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                    {otherName}
                  </span>
                  <span className="truncate text-xs text-gray-500">
                    {lastMessage?.content ?? "대화를 시작해보세요"}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {lastMessage && (
                    <span className="text-[11px] text-gray-400">{timeAgo(lastMessage.created_at)}</span>
                  )}
                  {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                </div>
              </Link>
            </li>
          );
        })}
        {(conversations ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">대화가 없습니다</p>
        )}
      </ul>
    </main>
  );
}
