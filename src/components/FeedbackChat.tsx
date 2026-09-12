"use client";

// /help의 "피드백" — 예전엔 1:1 제출 폼(feedback 테이블)이었는데, 승인 회원 전원이 함께
// 보는 실시간 단체 채팅으로 바뀌었다(0047_feedback_group_chat). DM(ConversationView)과 같은
// Supabase Realtime(postgres_changes) 패턴 — 텍스트 전용이라 INSERT/DELETE 신호만으로
// 로컬 상태를 갱신하고 서버 왕복은 없다(단, realtime payload엔 닉네임이 없어서 처음 보는
// user_id는 닉네임을 한 번 조회해 캐시한다).
//
// 표시는 무조건 닉네임(users.nickname) + 동명이인 구분용 #태그. 실명은 절대 안 보여준다.
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/timeAgo";
import { ComperBadge } from "@/components/ComperBadge";

export type FeedbackChatMessage = {
  id: string;
  userId: string;
  nickname: string;
  nicknameTag: string;
  isComper: boolean;
  content: string;
  createdAt: string;
};

const MAX_LEN = 2000;

export function FeedbackChat({
  currentUserId,
  isAdmin,
  initialMessages,
}: {
  currentUserId: string;
  isAdmin: boolean;
  initialMessages: FeedbackChatMessage[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<FeedbackChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // user_id → 닉네임 캐시. 초기 목록으로 seed, realtime에서 처음 보는 사람만 조회.
  const nickCache = useRef<Map<string, { nickname: string; nicknameTag: string; isComper: boolean }>>(
    new Map(
      initialMessages.map((m) => [
        m.userId,
        { nickname: m.nickname, nicknameTag: m.nicknameTag, isComper: m.isComper },
      ]),
    ),
  );

  async function resolveNick(userId: string) {
    const cached = nickCache.current.get(userId);
    if (cached) return cached;
    const { data } = await supabase
      .from("users")
      .select("nickname, nickname_tag, role")
      .eq("id", userId)
      .single();
    const resolved = {
      nickname: data?.nickname ?? "탈퇴한 사용자",
      nicknameTag: data?.nickname_tag ?? "",
      isComper: data?.role === "admin",
    };
    nickCache.current.set(userId, resolved);
    return resolved;
  }

  useEffect(() => {
    const channel = supabase
      .channel("feedback-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback_messages" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            content: string;
            created_at: string;
          };
          const nick = await resolveNick(row.user_id);
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    userId: row.user_id,
                    nickname: nick.nickname,
                    nicknameTag: nick.nicknameTag,
                    isComper: nick.isComper,
                    content: row.content,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "feedback_messages" },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // resolveNick은 마운트 시점 함수 참조로 충분(내부 캐시는 ref) — 재구독 유발 안 함.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("feedback_messages")
      .insert({ user_id: currentUserId, content: trimmed.slice(0, MAX_LEN) })
      .select("id, user_id, content, created_at")
      .single();
    setSending(false);
    if (error || !data) return;
    const me = await resolveNick(currentUserId);
    setMessages((prev) =>
      prev.some((m) => m.id === data.id)
        ? prev
        : [
            ...prev,
            {
              id: data.id,
              userId: data.user_id,
              nickname: me.nickname,
              nicknameTag: me.nicknameTag,
              isComper: me.isComper,
              content: data.content,
              createdAt: data.created_at,
            },
          ],
    );
    setText("");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("이 메시지를 삭제할까요?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("feedback_messages").delete().eq("id", id);
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl bg-box-gray">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-active-gray">
            아직 대화가 없어요. 하고 싶은 말을 편하게 남겨보세요.
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.userId === currentUserId;
          const canDelete = isMe || isAdmin;
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
              <span className="flex items-center gap-1.5 px-1 text-[11px] text-active-gray">
                {/* 태그번호(#0038)는 피드백 채팅에서 노출하지 않음 (사용자 요청) — 닉네임만. */}
                <span className="font-medium text-black">{m.nickname}</span>
                {m.isComper && <ComperBadge />}
                <span>·</span>
                <span>{timeAgo(m.createdAt)}</span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-active-gray transition hover:text-red-500"
                    title="삭제"
                  >
                    ✕
                  </button>
                )}
              </span>
              <span
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                  isMe ? "bg-demo-bg text-black" : "bg-main-gray text-black"
                }`}
              >
                {m.content}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-box-gray p-2.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_LEN}
          placeholder="메시지 보내기 (전체 회원에게 공개)"
          className="flex-1 rounded-full border border-transparent bg-main-gray px-3.5 py-2 text-sm text-black placeholder:text-black focus:border-active-gray focus:outline-none focus:ring-1 focus:ring-active-gray"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="shrink-0 rounded-full bg-demo-bg px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
        >
          전송
        </button>
      </form>
    </div>
  );
}
