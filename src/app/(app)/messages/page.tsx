import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-sm p-6 pb-20">
      <h1 className="text-xl font-semibold">메시지</h1>
      <ul className="mt-4 flex flex-col gap-1">
        {(conversations ?? []).map((c) => {
          const otherUserId = c.user_a_id === currentUser.id ? c.user_b_id : c.user_a_id;
          const lastMessage = lastMessageMap.get(c.id);
          const isUnread = unreadSet.has(c.id);
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center justify-between rounded px-2 py-3 hover:bg-gray-50"
              >
                <div className="flex flex-col">
                  <span className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                    {userMap.get(otherUserId) ?? "알 수 없음"}
                  </span>
                  <span className="max-w-[220px] truncate text-xs text-gray-500">
                    {lastMessage?.content ?? "대화를 시작해보세요"}
                  </span>
                </div>
                {isUnread && <span className="h-2 w-2 rounded-full bg-red-500" />}
              </Link>
            </li>
          );
        })}
        {(conversations ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">대화가 없습니다</p>
        )}
      </ul>
    </main>
  );
}
