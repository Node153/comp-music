"use client";

// DM-01/DM-03: 메시지 발신/수신, Supabase Realtime으로 새 메시지 즉시 반영
// "다정한 말풍선" 톤(인스타그램/메신저 참고) — 상대방 메시지 묶음의 마지막 줄에만 아바타를
// 보여주고(연속 메시지는 스페이서로 정렬만 맞춤), 각 묶음 끝에 시간과(내 메시지면) 읽음 표시를 곁들인다.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { avatarColorFor } from "@/lib/presence";
import { timeAgo } from "@/lib/timeAgo";

type MessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export function ConversationView({
  conversationId,
  currentUserId,
  otherUserId,
  otherUserName,
  initialMessages,
  initialSourcePostId,
}: {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  initialMessages: MessageRow[];
  initialSourcePostId: string | null;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingSourcePostId, setPendingSourcePostId] = useState(initialSourcePostId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MessageRow;
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === "UPDATE") {
            // 상대가 읽으면 read_at이 채워져서 내가 보낸 말풍선에 "읽음"이 뜨게 반영.
            const row = payload.new as MessageRow;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: text.trim(),
        source_post_id: pendingSourcePostId,
      })
      .select("id, sender_id, content, created_at, read_at")
      .single();

    if (!error && data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
      setText("");
      setPendingSourcePostId(null);
    }

    setSending(false);
  }

  // 연속된 같은 사람 메시지는 한 묶음으로 취급 — 묶음의 마지막 메시지에만 아바타/시간/읽음을 붙인다.
  const lastMineIndex = messages.reduce(
    (acc, m, i) => (m.sender_id === currentUserId ? i : acc),
    -1,
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">첫 메시지를 보내보세요</p>
        )}
        {messages.map((m, i) => {
          const isMe = m.sender_id === currentUserId;
          const isLastInGroup = i === messages.length - 1 || messages[i + 1].sender_id !== m.sender_id;
          return (
            <div key={m.id} className={`mb-1 flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
              {!isMe &&
                (isLastInGroup ? (
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColorFor(otherUserId)}`}
                  >
                    {otherUserName.slice(0, 1)}
                  </span>
                ) : (
                  <span className="w-7 shrink-0" />
                ))}
              <div className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                <span
                  className={`max-w-[240px] rounded-3xl px-4 py-2 text-sm ${
                    isMe ? "bg-black text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.content}
                </span>
                {isLastInGroup && (
                  <span className="px-1 text-[11px] text-gray-400">
                    {timeAgo(m.created_at)}
                    {isMe && i === lastMineIndex && m.read_at && " · 읽음"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-gray-100 pt-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지 보내기"
          className="flex-1 rounded-full border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </>
  );
}
