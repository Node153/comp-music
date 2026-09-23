"use client";

// /help의 "피드백" — 예전엔 1:1 제출 폼(feedback 테이블)이었는데, 승인 회원 전원이 함께
// 보는 실시간 단체 채팅으로 바뀌었다(0047_feedback_group_chat). DM(ConversationView)과 같은
// Supabase Realtime(postgres_changes) 패턴 — 텍스트 전용이라 INSERT/DELETE 신호만으로
// 로컬 상태를 갱신하고 서버 왕복은 없다(단, realtime payload엔 닉네임이 없어서 처음 보는
// user_id는 닉네임을 한 번 조회해 캐시한다).
//
// 표시는 무조건 닉네임(users.nickname) + 동명이인 구분용 #태그. 실명은 절대 안 보여준다.
//
// 0062 — 메시지마다 유형(버그/불편/아이디어/좋아요, 선택)과 공개 범위를 고른다. "운영자에게만"
// (is_private)은 RLS로 작성자 본인+관리자만 조회되고, realtime INSERT도 같은 RLS를 따라 다른
// 회원에겐 전달되지 않는다. 불만·버그를 편하게 남기도록 기본값은 비공개.
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
  isPrivate: boolean;
  category: FeedbackCategory | null;
  createdAt: string;
};

export type FeedbackCategory = "bug" | "inconvenience" | "idea" | "praise";

const CATEGORIES: { value: FeedbackCategory; label: string; placeholder: string }[] = [
  { value: "bug", label: "🐞 버그", placeholder: "어디서 무엇을 했더니 어떻게 됐나요?" },
  { value: "inconvenience", label: "😣 불편", placeholder: "어떤 점이 불편했나요? 어떻게 되면 좋을까요?" },
  { value: "idea", label: "💡 아이디어", placeholder: "있었으면 하는 기능이나 바뀌었으면 하는 점을 알려주세요" },
  { value: "praise", label: "❤️ 좋아요", placeholder: "마음에 들었던 점을 알려주세요" },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<
  FeedbackCategory,
  string
>;

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
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [isPrivate, setIsPrivate] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 입력 높이 자동 조절 — 한 줄에서 시작해 최대 약 6줄(144px)까지 늘고 그 이상은 내부 스크롤.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

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
            is_private: boolean;
            category: FeedbackCategory | null;
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
                    isPrivate: row.is_private,
                    category: row.category,
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
      .insert({ user_id: currentUserId, content: trimmed.slice(0, MAX_LEN), is_private: isPrivate, category })
      .select("id, user_id, content, is_private, category, created_at")
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
              isPrivate: data.is_private,
              category: data.category,
              createdAt: data.created_at,
            },
          ],
    );
    setText("");
    setCategory(null);
  }

  const placeholder =
    (category ? CATEGORIES.find((c) => c.value === category)?.placeholder : null) ??
    (isPrivate ? "운영자에게만 보내기" : "메시지 보내기 (전체 회원에게 공개)");

  async function handleDelete(id: string) {
    if (!window.confirm("이 메시지를 삭제할까요?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("feedback_messages").delete().eq("id", id);
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl bg-box-gray">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* 고정 안내 — 빈 채팅방은 먼저 말 꺼내기 어려워서, 운영자가 구체적인 질문을 먼저 던져둔다. */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="flex items-center gap-1.5 px-1 text-[11px] text-active-gray">
            <span className="font-medium text-black">Compmusic</span>
            <ComperBadge />
            <span>·</span>
            <span>📌 고정</span>
          </span>
          <span className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-main-gray px-3.5 py-2 text-sm text-black">
            {"요즘 Compmusic을 쓰면서 가장 불편했던 점 하나만 알려주세요 🙏\n짧게 한 줄이어도 좋아요. 🔒 운영자에게만 보내면 다른 회원에게는 보이지 않아요."}
          </span>
        </div>
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
                {m.isPrivate && (
                  <span className="rounded-full bg-main-gray px-1.5 py-px text-[10px] text-active-gray" title="작성자와 운영자만 볼 수 있어요">
                    🔒 운영자에게만
                  </span>
                )}
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
                } ${m.isPrivate ? "border border-dashed border-active-gray" : ""}`}
              >
                {m.category && (
                  <span className="mb-0.5 block text-[11px] font-semibold text-active-gray">
                    {CATEGORY_LABEL[m.category]}
                  </span>
                )}
                {m.content}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-main-gray px-2.5 pt-2.5">
        {CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? null : c.value)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                active ? "bg-black text-white" : "bg-main-gray text-black hover:bg-demo-bg"
              }`}
            >
              {c.label}
            </button>
          );
        })}
        <button
          type="button"
          role="switch"
          aria-checked={isPrivate}
          onClick={() => setIsPrivate((v) => !v)}
          title={isPrivate ? "작성자와 운영자만 볼 수 있어요" : "전체 회원이 볼 수 있어요"}
          className="ml-auto rounded-full border border-active-gray px-2.5 py-1 text-xs text-black transition hover:bg-main-gray"
        >
          {isPrivate ? "🔒 운영자에게만" : "🌐 전체 공개"}
        </button>
      </div>
      <form onSubmit={handleSend} className="flex items-end gap-2 p-2.5">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Enter 전송 · Shift+Enter 줄바꿈. 한글 조합 중(isComposing) Enter는 글자 확정이라 무시.
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={MAX_LEN}
          placeholder={placeholder}
          className="max-h-36 flex-1 resize-none rounded-2xl border border-transparent bg-main-gray px-3.5 py-2 text-sm leading-5 text-black placeholder:text-black focus:border-active-gray focus:outline-none focus:ring-1 focus:ring-active-gray"
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
