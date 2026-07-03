"use client";

// DM-01/DM-03: 메시지 발신/수신, Supabase Realtime으로 새 메시지 즉시 반영
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export function ConversationView({
  conversationId,
  currentUserId,
  initialMessages,
  initialSourcePostId,
}: {
  conversationId: string;
  currentUserId: string;
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
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
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
      .select("id, sender_id, content, created_at")
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

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-2 flex ${m.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                m.sender_id === currentUserId ? "bg-black text-white" : "bg-gray-100"
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="mt-2 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지 보내기"
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </>
  );
}
