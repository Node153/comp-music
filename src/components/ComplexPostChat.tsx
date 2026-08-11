"use client";

// Complex 게시물 전용 — 좋아요/댓글 대신 Discord 스타일 실시간 채팅으로 구성.
// 재창작물(작업물)은 음원 파일만 올릴 수 있다(0015_work_uploads_audio_only) — 올릴 때마다
// 원본(1차)을 이어받은 재창작물(2차, 3차...)로 취급해 스택처럼 쌓아 보여준다. 일반 텍스트
// 채팅과는 구분됨(텍스트는 항상 잡담일 뿐 재창작물이 될 수 없음).
// 이미지는 재창작물로는 못 쓰지만 일반 채팅 메시지(is_work=false)로는 업로드 가능
// (0016_allow_image_chat_messages) — 협업 구함 여부와 무관하게 참여자 누구나.
// 0012_complex_access_and_chat로 실제 DB(post_chat_messages) 연동됨 — Realtime 구독은 이번
// 범위에서 보류(전송/새로고침 시에만 반영). 파일 업로드는 기존 R2 파이프라인(uploadFileToR2)을
// 그대로 재사용.
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  type: "text" | "image" | "video" | "audio";
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  isWork: boolean;
  createdAt: string;
};

const WORK_TYPE_LABEL: Record<ChatMessage["type"], string> = {
  text: "✍️",
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
};

export function ComplexPostChat({
  postId,
  currentUserId,
  currentUserName,
  isOwnPost,
  initialMessages,
  collabAvailable,
  mediaSlot,
}: {
  postId: string;
  currentUserId: string;
  currentUserName: string;
  // 방장(작성자)은 협업 구함 여부와 무관하게 언제나 음원 작업물을 올릴 수 있다 —
  // 협업 구함은 "방장 외" 참여자에게만 적용되는 게이트(0013_owner_can_always_upload_work).
  isOwnPost: boolean;
  initialMessages: ChatMessage[];
  // 협업 구함(post.collab_available)이 켜진 게시물에서만 방장 외 사용자가 음원 작업물 업로드
  // 버튼을 쓸 수 있음 — RLS(post_chat_messages_insert_participant)에서도 동일하게 강제되므로
  // 여기 disabled는 UX 힌트일 뿐, 실제 보안 경계는 서버에 있음.
  collabAvailable: boolean;
  // 부모(feed/page.tsx, ComplexAccessGate)가 미디어(사운드바/영상/이미지)를 렌더해서 넘겨준다 —
  // 1차(원본)는 이 미디어 자체로 보여지고, 그 아래 2차+ 재창작물 스택(접기 가능), 오른쪽엔
  // 실시간 채팅이 나란히 배치된다.
  mediaSlot: React.ReactNode;
}) {
  const supabase = createClient();
  const canUploadWork = collabAvailable || isOwnPost;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stackOpen, setStackOpen] = useState(true);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const workMessages = messages.filter((m) => m.isWork);

  // 1차(원본)는 mediaSlot 자체로 이미 보여지니 2차+만 스택에 담는다.
  const secondaryStack = workMessages.map((m, i) => ({ generation: i + 2, work: m })).reverse();

  async function sendText() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("post_chat_messages")
      .insert({ post_id: postId, sender_id: currentUserId, type: "text", content: text, is_work: false })
      .select("id, created_at")
      .single();
    setSending(false);
    if (error || !data) return;
    setMessages((prev) => [
      ...prev,
      {
        id: data.id,
        senderId: currentUserId,
        senderName: currentUserName,
        type: "text",
        content: text,
        isWork: false,
        createdAt: data.created_at,
      },
    ]);
    setDraft("");
  }

  // 음원은 재창작물(is_work=true), 이미지는 일반 채팅(is_work=false) — RLS(0016)에서도 동일하게 강제.
  async function sendFile(file: File, type: "audio" | "image") {
    if (sending) return;
    setSending(true);
    try {
      const isWork = type === "audio";
      const fileKey = await uploadFileToR2(file);
      const { data, error } = await supabase
        .from("post_chat_messages")
        .insert({ post_id: postId, sender_id: currentUserId, type, file_key: fileKey, is_work: isWork })
        .select("id, created_at")
        .single();
      if (error || !data) return;
      // 방금 올린 파일은 이미 로컬에 있으니 signed URL 왕복 없이 blob URL로 바로 미리보기.
      const localUrl = URL.createObjectURL(file);
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          senderId: currentUserId,
          senderName: currentUserName,
          type,
          fileUrl: localUrl,
          fileName: file.name,
          isWork,
          createdAt: data.created_at,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleFileInput(type: "audio" | "image") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) void sendFile(file, type);
    };
  }

  async function refreshMessages() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/complex/chat?postId=${postId}`);
      if (res.ok) {
        const { messages: fetched } = (await res.json()) as { messages: ChatMessage[] };
        setMessages(fetched);
      }
    } finally {
      setRefreshing(false);
    }
  }

  function renderMessages() {
    return (
      <>
        {messages.map((m) => {
          const isMe = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
              <span className="text-[11px] text-gray-400">{m.senderName}</span>
              {m.type === "text" && (
                <span
                  className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                    isMe
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                >
                  {m.isWork && <span className="mr-1 text-xs text-violet-300">✍️ 작업물</span>}
                  {m.content}
                </span>
              )}
              {m.type === "image" && m.fileUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.fileUrl}
                  alt={m.fileName ?? "첨부 이미지"}
                  className="max-h-48 max-w-[70%] rounded-xl object-cover"
                />
              )}
              {m.type === "video" && m.fileUrl && (
                <div className="flex flex-col gap-1 rounded-xl bg-violet-50 p-2 dark:bg-violet-950/30">
                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-300">
                    🎬 {m.fileName}
                  </span>
                  <video src={m.fileUrl} controls className="max-h-48 w-64 rounded-lg" />
                </div>
              )}
              {m.type === "audio" && m.fileUrl && (
                <div className="flex flex-col gap-1 rounded-xl bg-violet-50 p-2 dark:bg-violet-950/30">
                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-300">
                    🎵 {m.fileName}
                  </span>
                  <audio src={m.fileUrl} controls className="h-8 w-56" />
                </div>
              )}
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
            아직 채팅이 없어요. 첫 메시지를 남겨보세요.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
      {/* 왼쪽: 미디어(1차) + 재창작물 스택(2차+, 접기 가능) · 오른쪽: 실시간 채팅. */}
      <div className="flex divide-x divide-gray-100 dark:divide-gray-800">
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          {mediaSlot}
          {secondaryStack.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setStackOpen((v) => !v)}
                className="flex items-center justify-between px-0.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <span>재창작물 스택 ({secondaryStack.length})</span>
                <span>{stackOpen ? "▲" : "▼"}</span>
              </button>
              {stackOpen && (
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
                  {secondaryStack.map((card) => (
                    <div
                      key={card.generation}
                      className="flex flex-col gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-900/40"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 text-sm">{WORK_TYPE_LABEL[card.work.type]}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            {card.generation}차 창작물
                          </p>
                          <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
                            {card.work.senderName}
                          </p>
                        </div>
                        {card.work.fileUrl && (
                          <a
                            href={card.work.fileUrl}
                            download={card.work.fileName ?? undefined}
                            title="다운로드"
                            className="shrink-0 rounded-full p-1 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          >
                            ⬇
                          </a>
                        )}
                      </div>
                      {card.work.fileUrl && (
                        <audio src={card.work.fileUrl} controls className="h-8 w-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">채팅</span>
            <button
              type="button"
              onClick={refreshMessages}
              disabled={refreshing}
              title="새로고침"
              className="text-[11px] text-gray-400 hover:text-gray-700 disabled:opacity-50 dark:text-gray-500 dark:hover:text-gray-200"
            >
              🔄
            </button>
          </div>
          <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">{renderMessages()}</div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
        className="flex items-center gap-1.5 border-t border-gray-100 p-2 dark:border-gray-800"
      >
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav"
          className="hidden"
          disabled={!canUploadWork}
          onChange={handleFileInput("audio")}
        />
        <button
          type="button"
          disabled={!canUploadWork || sending}
          title={canUploadWork ? "음원 작업물 올리기" : "공동창작 게시물에서만 방장 외 사용자가 음원을 올릴 수 있어요"}
          onClick={() => audioInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-800"
        >
          🎵
        </button>
        {/* 이미지는 재창작물이 아닌 일반 채팅이라 협업 구함 게이트(canUploadWork) 없이 누구나. */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInput("image")}
        />
        <button
          type="button"
          disabled={sending}
          title="이미지 올리기 (일반 채팅 — 재창작물 아님)"
          onClick={() => imageInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          🖼️
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="메시지 보내기..."
          className="w-full flex-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-200"
        />
        <button
          type="submit"
          disabled={sending}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
