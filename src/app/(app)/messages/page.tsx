import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, pageCard } from "@/components/ui/styles";

// S12 DM 목록 (DM-02)
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
      ? await supabase.from("users").select("id, name").in("id", otherUserIds)
      : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));

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
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
                  {otherName.slice(0, 1)}
                </span>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className={`text-sm ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                    {otherName}
                  </span>
                  <span className="truncate text-xs text-gray-500">
                    {lastMessage?.content ?? "대화를 시작해보세요"}
                  </span>
                </div>
                {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
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
