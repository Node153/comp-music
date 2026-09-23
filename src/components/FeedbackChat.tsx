"use client";

// /help의 "피드백" — 예전엔 1:1 제출 폼(feedback 테이블)이었는데, 승인 회원 전원이 함께
// 보는 실시간 단체 채팅으로 바뀌었다(0047_feedback_group_chat). DM(ConversationView)과 같은
// Supabase Realtime(postgres_changes) 패턴 — INSERT/UPDATE/DELETE 신호만으로 로컬 상태를
// 갱신하고 서버 왕복은 없다(단, realtime payload엔 닉네임이 없어서 처음 보는 user_id는 닉네임을
// 한 번 조회해 캐시한다).
//
// 표시는 무조건 닉네임(users.nickname) + 동명이인 구분용 #태그. 실명은 절대 안 보여준다.
//
// 0062 — 메시지마다 유형(버그/불편/아이디어/좋아요, 선택)과 공개 범위를 고른다. "운영자에게만"
// (is_private)은 RLS로 작성자 본인+관리자만 조회되고, realtime INSERT도 같은 RLS를 따라 다른
// 회원에겐 전달되지 않는다. 불만·버그를 편하게 남기도록 기본값은 비공개.
//
// 0063 — 관리자가 /admin/feedback에서 단 처리 상태·답변을 말풍선 아래에 보여준다(realtime UPDATE로
// 즉시 반영). 상태 뱃지는 유형을 고른 메시지·비공개 메시지·상태가 바뀐 메시지에만 — 일반 잡담엔 안 붙인다.
//
// 0065 — 공개 피드백에 "나도 👍"(feedback_reactions, 남의 공개 글에만), 스크린샷 1장 첨부
// (feedback-images 비공개 버킷 → 표시할 때 signed URL). 입력창에 이미지를 붙여넣어도 첨부된다.
//
// 0068 — announcement_id가 있는 메시지는 관리자가 반영 공지를 등록할 때 자동으로 올라온 "반영
// 소식"이라 일반 말풍선 대신 강조 카드로 보여준다(바로가기는 공지의 link_url, 없으면 업데이트 소식).
// 각 메시지에 id="fb-…" 앵커 — 상단 "지금 만드는 중"에서 해당 의견으로 바로 스크롤한다.
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/timeAgo";
import { ComperBadge } from "@/components/ComperBadge";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABEL,
  FEEDBACK_STATUS_LABEL,
  type FeedbackCategory,
  type FeedbackStatus,
} from "@/lib/feedback";
import { FeedbackCategoryIcon, FeedbackStatusIcon } from "@/components/FeedbackIcons";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CornerDownRightIcon,
  GlobeIcon,
  ImageIcon,
  LockIcon,
  PinIcon,
  ThumbsUpIcon,
  XIcon,
} from "@/components/icons";

export type FeedbackChatMessage = {
  id: string;
  userId: string;
  nickname: string;
  nicknameTag: string;
  isComper: boolean;
  content: string;
  isPrivate: boolean;
  category: FeedbackCategory | null;
  status: FeedbackStatus;
  adminReply: string | null;
  imagePath: string | null;
  announcementId: string | null;
  // "나도 👍" 누른 사람 user_id — 개수/내가 눌렀는지 둘 다 여기서. 추가·제거가 멱등이라
  // 낙관적 반영과 realtime 이벤트가 겹쳐도 안전하다.
  likers: string[];
  createdAt: string;
};

type FeedbackRow = {
  id: string;
  user_id: string;
  content: string;
  is_private: boolean;
  category: FeedbackCategory | null;
  status: FeedbackStatus;
  admin_reply: string | null;
  image_path: string | null;
  announcement_id: string | null;
  created_at: string;
};

type Nick = { nickname: string; nicknameTag: string; isComper: boolean };

const MAX_LEN = 2000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // feedback-images 버킷 file_size_limit과 동일
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ROW_COLUMNS =
  "id, user_id, content, is_private, category, status, admin_reply, image_path, announcement_id, created_at";

function toMessage(row: FeedbackRow, nick: Nick): FeedbackChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: nick.nickname,
    nicknameTag: nick.nicknameTag,
    isComper: nick.isComper,
    content: row.content,
    isPrivate: row.is_private,
    category: row.category,
    status: row.status,
    adminReply: row.admin_reply,
    imagePath: row.image_path,
    announcementId: row.announcement_id,
    likers: [],
    createdAt: row.created_at,
  };
}

// 비공개 버킷 이미지 — 마운트 시 1시간짜리 signed URL을 받아 보여준다. 누르면 원본을 새 탭으로.
export function FeedbackImage({ path }: { path: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("feedback-images")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, path]);
  if (!url) return <span className="block h-24 w-32 animate-pulse rounded-lg bg-box-gray" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL이라 next/image 최적화 대상 아님 */}
      <img src={url} alt="첨부 이미지" className="max-h-60 max-w-full rounded-lg object-contain" />
    </a>
  );
}

export function FeedbackChat({
  currentUserId,
  isAdmin,
  initialMessages,
  announcementLinks = {},
}: {
  currentUserId: string;
  isAdmin: boolean;
  initialMessages: FeedbackChatMessage[];
  // 반영 소식 카드의 "보러 가기" — 공지 id → link_url(내부 경로). 없으면 업데이트 소식(#updates)으로.
  announcementLinks?: Record<string, string | null>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<FeedbackChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [isPrivate, setIsPrivate] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imagePreview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // 입력 높이 자동 조절 — 한 줄에서 시작해 최대 약 6줄(144px)까지 늘고 그 이상은 내부 스크롤.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // 비었으면 rows=1 기본 높이로 — 레이아웃 폭이 바뀌는 도중 잰 높이가 남아 커져 있는 것 방지.
    if (!text) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  // user_id → 닉네임 캐시. 초기 목록으로 seed, realtime에서 처음 보는 사람만 조회.
  const nickCache = useRef<Map<string, Nick>>(
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

  function setLiked(feedbackId: string, userId: string, liked: boolean) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== feedbackId) return m;
        const has = m.likers.includes(userId);
        if (liked === has) return m;
        return { ...m, likers: liked ? [...m.likers, userId] : m.likers.filter((u) => u !== userId) };
      }),
    );
  }

  useEffect(() => {
    const channel = supabase
      .channel("feedback-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback_messages" },
        async (payload) => {
          const row = payload.new as FeedbackRow;
          const nick = await resolveNick(row.user_id);
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, toMessage(row, nick)]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "feedback_messages" },
        (payload) => {
          const row = payload.new as FeedbackRow;
          setMessages((prev) =>
            prev.map((m) => (m.id === row.id ? { ...m, status: row.status, adminReply: row.admin_reply } : m)),
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback_reactions" },
        (payload) => {
          const row = payload.new as { feedback_id: string; user_id: string };
          setLiked(row.feedback_id, row.user_id, true);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "feedback_reactions" },
        (payload) => {
          // DELETE payload엔 PK 컬럼만 온다 — (feedback_id, user_id)가 PK라 충분.
          const old = payload.old as { feedback_id?: string; user_id?: string };
          if (old.feedback_id && old.user_id) setLiked(old.feedback_id, old.user_id, false);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // resolveNick/setLiked는 마운트 시점 함수 참조로 충분(내부 캐시는 ref, 상태는 함수형 업데이트).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    // scrollIntoView는 채팅 목록뿐 아니라 페이지 전체까지 끌어내려서(모바일에서 제목이 잘린 채
    // 열림) 목록 컨테이너 자체의 scrollTop만 움직인다. 첫 진입은 즉시, 이후 새 메시지는 부드럽게.
    const el = listRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: didInitialScroll.current ? "smooth" : "auto" });
      didInitialScroll.current = true;
    }
    // 새 메시지가 붙을 때만 — 관리자 답변(UPDATE)/👍로 목록이 바뀔 땐 스크롤을 건드리지 않는다.
  }, [messages.length]);

  function pickImage(file: File | null | undefined) {
    setImageError(null);
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError("PNG·JPG·WEBP·GIF 이미지만 첨부할 수 있어요");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("5MB 이하 이미지만 첨부할 수 있어요");
      return;
    }
    setImage(file);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !image) || sending) return;
    setSending(true);
    setImageError(null);

    let imagePath: string | null = null;
    if (image) {
      const ext = image.type.split("/")[1] === "jpeg" ? "jpg" : image.type.split("/")[1];
      imagePath = `${currentUserId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("feedback-images")
        .upload(imagePath, image, { contentType: image.type });
      if (uploadError) {
        setSending(false);
        setImageError("이미지 업로드에 실패했어요. 다시 시도해 주세요.");
        return;
      }
    }

    const { data, error } = await supabase
      .from("feedback_messages")
      .insert({
        user_id: currentUserId,
        content: trimmed.slice(0, MAX_LEN),
        is_private: isPrivate,
        category,
        image_path: imagePath,
      })
      .select(ROW_COLUMNS)
      .single();
    setSending(false);
    if (error || !data) return;
    const me = await resolveNick(currentUserId);
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, toMessage(data, me)]));
    setText("");
    setCategory(null);
    setImage(null);
  }

  async function toggleLike(m: FeedbackChatMessage) {
    const liked = m.likers.includes(currentUserId);
    setLiked(m.id, currentUserId, !liked);
    const { error } = liked
      ? await supabase.from("feedback_reactions").delete().eq("feedback_id", m.id).eq("user_id", currentUserId)
      : await supabase.from("feedback_reactions").insert({ feedback_id: m.id, user_id: currentUserId });
    if (error) setLiked(m.id, currentUserId, liked);
  }

  const placeholder =
    (category ? FEEDBACK_CATEGORIES.find((c) => c.value === category)?.placeholder : null) ??
    (isPrivate ? "운영자에게만 보내기" : "메시지 보내기 (전체 회원에게 공개)");

  async function handleDelete(id: string) {
    if (!window.confirm("이 메시지를 삭제할까요?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("feedback_messages").delete().eq("id", id);
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl bg-box-gray">
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* 고정 안내 — 빈 채팅방은 먼저 말 꺼내기 어려워서, 운영자가 구체적인 질문을 먼저 던져둔다. */}
        <div className="flex flex-col items-start gap-0.5">
          <span className="flex items-center gap-1.5 px-1 text-[11px] text-active-gray">
            <span className="font-medium text-black">Compmusic</span>
            <ComperBadge />
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <PinIcon className="h-3 w-3" /> 고정
            </span>
          </span>
          <span className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-main-gray px-3.5 py-2 text-sm text-black">
            {"요즘 Compmusic을 쓰면서 가장 불편했던 점 하나만 알려주세요.\n짧게 한 줄이어도 좋아요. “운영자에게만”으로 보내면 다른 회원에게는 보이지 않아요.\n화면 캡처를 붙여넣으면 스크린샷도 같이 보낼 수 있어요."}
          </span>
        </div>
        {messages.map((m) => {
          const isMe = m.userId === currentUserId;
          const canDelete = isMe || isAdmin;
          const likedByMe = m.likers.includes(currentUserId);
          if (m.announcementId) {
            const href = announcementLinks[m.announcementId] ?? "#updates";
            return (
              <div key={m.id} id={`fb-${m.id}`} className="flex flex-col items-start gap-0.5">
                <span className="flex items-center gap-1.5 px-1 text-[11px] text-active-gray">
                  <span className="font-medium text-black">{m.nickname}</span>
                  <ComperBadge />
                  <span>·</span>
                  <span>{timeAgo(m.createdAt)}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="text-active-gray transition hover:text-red-500"
                      title="삭제"
                      aria-label="삭제"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                </span>
                <a
                  href={href}
                  className="flex max-w-[85%] items-center gap-3 rounded-2xl border border-black bg-main-gray px-3.5 py-2.5 text-sm text-black transition hover:bg-demo-bg"
                >
                  <CheckCircleIcon className="h-5 w-5 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[11px] font-semibold text-active-gray">여러분 의견이 반영됐어요</span>
                    <span className="font-semibold">{m.content}</span>
                  </span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0" />
                </a>
              </div>
            );
          }
          return (
            <div
              key={m.id}
              id={`fb-${m.id}`}
              className={`flex scroll-mt-4 flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              <span className="flex items-center gap-1.5 px-1 text-[11px] text-active-gray">
                {/* 태그번호(#0038)는 피드백 채팅에서 노출하지 않음 (사용자 요청) — 닉네임만. */}
                <span className="font-medium text-black">{m.nickname}</span>
                {m.isComper && <ComperBadge />}
                <span>·</span>
                <span>{timeAgo(m.createdAt)}</span>
                {m.isPrivate && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-main-gray px-1.5 py-px text-[10px] text-active-gray"
                    title="작성자와 운영자만 볼 수 있어요"
                  >
                    <LockIcon className="h-2.5 w-2.5" /> 운영자에게만
                  </span>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-active-gray transition hover:text-red-500"
                    title="삭제"
                    aria-label="삭제"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </span>
              <span
                className={`flex max-w-[85%] flex-col gap-1.5 whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                  isMe ? "bg-demo-bg text-black" : "bg-main-gray text-black"
                } ${m.isPrivate ? "border border-dashed border-active-gray" : ""}`}
              >
                {m.category && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-active-gray">
                    <FeedbackCategoryIcon category={m.category} className="h-3 w-3" />
                    {FEEDBACK_CATEGORY_LABEL[m.category]}
                  </span>
                )}
                {m.imagePath && <FeedbackImage path={m.imagePath} />}
                {m.content && <span>{m.content}</span>}
              </span>
              <span className="flex items-center gap-2 px-1 text-[11px]">
                {(m.category || m.isPrivate || m.status !== "received") && (
                  <span
                    className={`inline-flex items-center gap-1 ${m.status === "done" ? "font-semibold text-black" : "text-active-gray"}`}
                  >
                    <FeedbackStatusIcon status={m.status} className="h-3 w-3" />
                    {FEEDBACK_STATUS_LABEL[m.status]}
                  </span>
                )}
                {/* 나도 👍 — 공개 피드백만. 본인 글엔 버튼 대신 공감 수만 보여준다. */}
                {!m.isPrivate &&
                  (isMe ? (
                    m.likers.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-active-gray">
                        <ThumbsUpIcon className="h-3 w-3" /> {m.likers.length}명이 공감해요
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      aria-pressed={likedByMe}
                      onClick={() => toggleLike(m)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition ${
                        likedByMe ? "bg-black text-white" : "bg-main-gray text-black hover:bg-demo-bg"
                      }`}
                    >
                      <ThumbsUpIcon className="h-3 w-3" filled={likedByMe} />
                      나도{m.likers.length > 0 ? ` ${m.likers.length}` : ""}
                    </button>
                  ))}
              </span>
              {m.adminReply && (
                <div
                  className={`mt-0.5 flex max-w-[85%] flex-col gap-0.5 rounded-2xl border border-main-gray bg-box-gray px-3 py-2 text-sm ${
                    isMe ? "items-end text-right" : "items-start"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] text-active-gray">
                    <CornerDownRightIcon className="h-3 w-3" />
                    <span className="font-medium text-black">운영자 답변</span>
                    <ComperBadge />
                  </span>
                  <span className="whitespace-pre-wrap break-words text-black">{m.adminReply}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-main-gray px-2.5 pt-2.5">
        {FEEDBACK_CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? null : c.value)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition ${
                active ? "bg-black text-white" : "bg-main-gray text-black hover:bg-demo-bg"
              }`}
            >
              <FeedbackCategoryIcon category={c.value} className="h-3.5 w-3.5" />
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
          className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
            isPrivate
              ? "border-violet-500 text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30"
              : "border-demo-gold text-demo-gold hover:bg-demo-gold/10"
          }`}
        >
          {isPrivate ? <LockIcon className="h-3.5 w-3.5" /> : <GlobeIcon className="h-3.5 w-3.5" />}
          {isPrivate ? "운영자에게만" : "전체 공개"}
        </button>
      </div>
      {(imagePreview || imageError) && (
        <div className="flex items-center gap-2 px-2.5 pt-2">
          {imagePreview && (
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 blob 미리보기 */}
              <img src={imagePreview} alt="첨부할 이미지" className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label="첨부 취소"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-white"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          )}
          {imageError && <span className="text-xs text-red-500">{imageError}</span>}
        </div>
      )}
      <form onSubmit={handleSend} className="flex items-end gap-2 p-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            pickImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="스크린샷 첨부"
          title="스크린샷 첨부 (붙여넣기도 가능)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-main-gray text-black transition hover:bg-demo-bg"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // 화면 캡처(Cmd+Shift+Ctrl+4 등)를 바로 붙여넣으면 첨부로 받는다.
          onPaste={(e) => {
            const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
            if (file) {
              e.preventDefault();
              pickImage(file);
            }
          }}
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
          disabled={sending || (!text.trim() && !image)}
          className="shrink-0 rounded-full bg-demo-bg px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "보내는 중" : "전송"}
        </button>
      </form>
    </div>
  );
}
