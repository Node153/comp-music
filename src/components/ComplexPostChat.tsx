"use client";

// Complex 게시물 전용 — 좋아요/댓글 대신 Discord 스타일 실시간 채팅으로 구성.
// 영상/이미지/오디오/텍스트 무엇이든 "작업물"로 올릴 수 있고, 올릴 때마다 원본(1차)을 이어받은
// 재창작물(2차, 3차...)로 취급해 스택처럼 쌓아 보여준다. 가벼운 잡담(채팅)과는 구분됨.
// 0012_complex_access_and_chat로 실제 DB(post_chat_messages) 연동됨 — Realtime 구독은 이번
// 범위에서 보류(전송/새로고침 시에만 반영). 파일 업로드는 기존 R2 파이프라인(uploadFileToR2)을
// 그대로 재사용.
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import type { MediaType } from "@/types/database";

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
  originalMediaType,
  initialMessages,
  collabAvailable,
  mediaSlot,
}: {
  postId: string;
  currentUserId: string;
  currentUserName: string;
  originalMediaType: MediaType;
  initialMessages: ChatMessage[];
  // 협업 구함(post.collab_available)이 켜진 게시물에서만 이미지/오디오 작업물 업로드 버튼을 쓸 수
  // 있음(video/text는 항상 허용) — RLS(post_chat_messages_insert_participant)에서도 동일하게
  // 강제되므로 여기 disabled는 UX 힌트일 뿐, 실제 보안 경계는 서버에 있음.
  collabAvailable: boolean;
  // 음원 게시물 전용 — 부모가 미디어(SoundbarPlayer)를 여기로 넘기면 재창작물 스택을 그 옆에
  // 작은 목록형으로 붙여서 보여준다(없으면 기존처럼 큰 카드형 스택을 미디어 아래에 그대로 둠).
  mediaSlot?: React.ReactNode;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const workMessages = messages.filter((m) => m.isWork);

  // 스택 카드 목록 — 원본(1차)을 맨 아래, 이후 올라온 작업물을 위로 쌓아 최신 것이 맨 위에 오도록.
  const stackCards = [
    { generation: 1, work: null as ChatMessage | null },
    ...workMessages.map((m, i) => ({ generation: i + 2, work: m })),
  ].reverse();

  async function sendText(asWork: boolean) {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("post_chat_messages")
      .insert({ post_id: postId, sender_id: currentUserId, type: "text", content: text, is_work: asWork })
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
        isWork: asWork,
        createdAt: data.created_at,
      },
    ]);
    setDraft("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video" | "audio") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || sending) return;
    setSending(true);
    try {
      const fileKey = await uploadFileToR2(file);
      const { data, error } = await supabase
        .from("post_chat_messages")
        .insert({ post_id: postId, sender_id: currentUserId, type, file_key: fileKey, is_work: true })
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
          isWork: true,
          createdAt: data.created_at,
        },
      ]);
    } finally {
      setSending(false);
    }
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

  function renderWorkContent(work: ChatMessage | null) {
    if (!work) {
      return <span className="truncate text-xs text-gray-400 dark:text-gray-500">원곡</span>;
    }
    if (work.type === "video" && work.fileUrl) {
      return <video src={work.fileUrl} controls className="max-h-40 w-full max-w-xs rounded-lg" />;
    }
    if (work.type === "image" && work.fileUrl) {
      return (
        <img
          src={work.fileUrl}
          alt={work.fileName ?? "첨부 이미지"}
          className="max-h-40 max-w-xs rounded-lg object-cover"
        />
      );
    }
    if (work.type === "audio" && work.fileUrl) {
      return <audio src={work.fileUrl} controls className="h-8 w-full max-w-xs" />;
    }
    return <span className="truncate text-xs text-gray-600 dark:text-gray-300">{work.content}</span>;
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
      {mediaSlot ? (
        <div className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">{mediaSlot}</div>
          <div className="flex w-44 shrink-0 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">재창작물 스택</span>
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
            <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
              {stackCards.map((card, i) => (
                <div
                  key={card.generation}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                    i === 0
                      ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30"
                      : "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40"
                  }`}
                >
                  <span className="shrink-0 text-sm">
                    {card.work ? WORK_TYPE_LABEL[card.work.type] : WORK_TYPE_LABEL[originalMediaType]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[11px] font-semibold ${
                        i === 0 ? "text-violet-600 dark:text-violet-300" : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {card.generation === 1 ? "1차 (원본)" : `${card.generation}차 창작물`}
                    </p>
                    <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
                      {card.work?.senderName ?? "작성자"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">재창작물 스택</span>
            <button
              type="button"
              onClick={refreshMessages}
              disabled={refreshing}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50 dark:text-gray-500 dark:hover:text-gray-200"
            >
              {refreshing ? "새로고침 중..." : "🔄 새로고침"}
            </button>
          </div>
          <div className="flex flex-col gap-2 px-4 py-3">
            {stackCards.map((card, i) => (
              <div
                key={card.generation}
                className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                  i === 0
                    ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30"
                    : "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40"
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl ${
                    i === 0 ? "bg-violet-100 dark:bg-violet-900/50" : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  {card.work ? WORK_TYPE_LABEL[card.work.type] : WORK_TYPE_LABEL[originalMediaType]}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span
                    className={`text-xs font-semibold ${
                      i === 0 ? "text-violet-600 dark:text-violet-300" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {card.generation === 1
                      ? "🎼 1차 (원본)"
                      : `${WORK_TYPE_LABEL[card.work!.type]} ${card.generation}차 창작물`}{" "}
                    · {card.work?.senderName ?? "작성자"}
                  </span>
                  {renderWorkContent(card.work)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-gray-100 dark:border-gray-800" />

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-4 py-3">
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
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText(false);
        }}
        className="flex items-center gap-1.5 border-t border-gray-100 p-2 dark:border-gray-800"
      >
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e, "video")}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!collabAvailable}
          onChange={(e) => handleFile(e, "image")}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav"
          className="hidden"
          disabled={!collabAvailable}
          onChange={(e) => handleFile(e, "audio")}
        />
        <button
          type="button"
          title="영상 작업물 올리기"
          disabled={sending}
          onClick={() => videoInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          🎬
        </button>
        <button
          type="button"
          disabled={!collabAvailable || sending}
          title={collabAvailable ? "이미지 작업물 올리기" : "협업 구함 게시물에서만 이미지를 올릴 수 있어요"}
          onClick={() => imageInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-800"
        >
          🖼️
        </button>
        <button
          type="button"
          disabled={!collabAvailable || sending}
          title={collabAvailable ? "오디오 작업물 올리기" : "협업 구함 게시물에서만 오디오를 올릴 수 있어요"}
          onClick={() => audioInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-800"
        >
          🎵
        </button>
        <button
          type="button"
          title="입력한 텍스트를 작업물로 남기기"
          disabled={sending}
          onClick={() => sendText(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          ✍️
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
