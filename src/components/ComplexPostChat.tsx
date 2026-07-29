"use client";

// Complex 게시물 전용 — 좋아요/댓글 대신 Discord 스타일 실시간 채팅으로 구성.
// 영상/이미지/오디오/텍스트 무엇이든 "작업물"로 올릴 수 있고, 올릴 때마다 원본(1차)을 이어받은
// 재창작물(2차, 3차...)로 취급해 스택처럼 쌓아 보여준다. 가벼운 잡담(채팅)과는 구분됨.
// 아직 로컬 state만 쓰는 UI 목업 — 실제 Realtime/Storage 연동은 이후 작업.
import { useRef, useState } from "react";

type ChatMessage = {
  id: string;
  author: string;
  isMe: boolean;
  type: "text" | "image" | "video" | "audio";
  text?: string;
  fileName?: string;
  objectUrl?: string;
  isWork?: boolean; // 작업물 스택에 들어가는 메시지인지 여부 — 잡담 채팅과 구분
  generation?: number; // isWork일 때만 사용 — 2차, 3차...
};

const AUTO_REPLIES = ["오 이거 좋은데요?", "저도 껴도 돼요?", "ㅋㅋㅋ 미쳤다", "이 버전 저장할게요"];

const WORK_TYPE_LABEL: Record<ChatMessage["type"], string> = {
  text: "✍️",
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
};

let nextId = 1;

export function ComplexPostChat({
  postId,
  authorName,
  participants,
  originalGradient,
  originalEmoji,
  collabAvailable,
}: {
  postId: string;
  authorName: string;
  participants: string[];
  originalGradient: string;
  originalEmoji: string;
  // 협업 구함(post.collab_available)이 켜진 게시물에서만 이미지/오디오 작업물 업로드 버튼을 쓸 수 있음.
  // 이 컴포넌트는 실제 로그인 사용자 구분 없이 채팅 참여자를 전부 "나"로 취급하는 목업이라
  // "작성자 본인은 항상 가능" 같은 작성자 예외는 없음 — 꺼져 있으면 채팅 참여자 전원(작성자 시점 포함) 업로드 불가.
  collabAvailable: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: `seed-${postId}`,
      author: participants[0] ?? authorName,
      isMe: false,
      type: "text",
      text: "우와 이거 듣자마자 아이디어 떠올랐어요 ㅋㅋ",
    },
  ]);
  const [draft, setDraft] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const workMessages = messages.filter((m) => m.isWork);
  const generationCount = workMessages.length;

  // 스택 카드 목록 — 원본(1차)을 맨 아래, 이후 올라온 작업물(영상/이미지/오디오/텍스트)을 위로 쌓아
  // 최신 것이 맨 위에 오도록 구성.
  const stackCards = [
    { generation: 1, author: authorName, work: null as ChatMessage | null },
    ...workMessages.map((m) => ({ generation: m.generation ?? 2, author: m.author, work: m })),
  ].reverse();

  function pushAutoReply() {
    const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    const replyAuthor = participants[Math.floor(Math.random() * participants.length)] ?? authorName;
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `${nextId++}`, author: replyAuthor, isMe: false, type: "text", text: reply },
      ]);
    }, 1000 + Math.random() * 800);
  }

  function sendText() {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: `${nextId++}`, author: "나", isMe: true, type: "text", text }]);
    setDraft("");
    pushAutoReply();
  }

  function sendTextAsWork() {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `${nextId++}`,
        author: "나",
        isMe: true,
        type: "text",
        text,
        isWork: true,
        generation: generationCount + 2,
      },
    ]);
    setDraft("");
    pushAutoReply();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video" | "audio") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setMessages((prev) => [
      ...prev,
      {
        id: `${nextId++}`,
        author: "나",
        isMe: true,
        type,
        fileName: file.name,
        objectUrl,
        isWork: true,
        generation: generationCount + 2,
      },
    ]);
    pushAutoReply();
  }

  function renderWorkContent(work: ChatMessage | null) {
    if (!work) {
      return (
        <span className="truncate text-xs text-gray-400 dark:text-gray-500">원곡</span>
      );
    }
    if (work.type === "video" && work.objectUrl) {
      // eslint-disable-next-line jsx-a11y/media-has-caption
      return <video src={work.objectUrl} controls className="max-h-40 w-full max-w-xs rounded-lg" />;
    }
    if (work.type === "image" && work.objectUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={work.objectUrl}
          alt={work.fileName ?? "첨부 이미지"}
          className="max-h-40 max-w-xs rounded-lg object-cover"
        />
      );
    }
    if (work.type === "audio" && work.objectUrl) {
      // eslint-disable-next-line jsx-a11y/media-has-caption
      return <audio src={work.objectUrl} controls className="h-8 w-full max-w-xs" />;
    }
    return <span className="truncate text-xs text-gray-600 dark:text-gray-300">{work.text}</span>;
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
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
            {card.work ? (
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl ${
                  i === 0 ? "bg-violet-100 dark:bg-violet-900/50" : "bg-gray-100 dark:bg-gray-800"
                }`}
              >
                {WORK_TYPE_LABEL[card.work.type]}
              </div>
            ) : (
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xl ${originalGradient}`}
              >
                {originalEmoji}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={`text-xs font-semibold ${
                  i === 0 ? "text-violet-600 dark:text-violet-300" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {card.generation === 1 ? "🎼 1차 (원본)" : `${WORK_TYPE_LABEL[card.work!.type]} ${card.generation}차 창작물`}{" "}
                · {card.author}
              </span>
              {renderWorkContent(card.work)}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800" />

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col gap-0.5 ${m.isMe ? "items-end" : "items-start"}`}>
            <span className="text-[11px] text-gray-400">{m.author}</span>
            {m.type === "text" && (
              <span
                className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                  m.isMe
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                }`}
              >
                {m.isWork && <span className="mr-1 text-xs text-violet-300">✍️ {m.generation}차</span>}
                {m.text}
              </span>
            )}
            {m.type === "image" && m.objectUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.objectUrl}
                alt={m.fileName ?? "첨부 이미지"}
                className="max-h-48 max-w-[70%] rounded-xl object-cover"
              />
            )}
            {m.type === "video" && m.objectUrl && (
              <div className="flex flex-col gap-1 rounded-xl bg-violet-50 p-2 dark:bg-violet-950/30">
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-300">
                  🎬 {m.generation}차 창작물 · {m.fileName}
                </span>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={m.objectUrl} controls className="max-h-48 w-64 rounded-lg" />
              </div>
            )}
            {m.type === "audio" && m.objectUrl && (
              <div className="flex flex-col gap-1 rounded-xl bg-violet-50 p-2 dark:bg-violet-950/30">
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-300">
                  🎵 {m.generation}차 창작물 · {m.fileName}
                </span>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio src={m.objectUrl} controls className="h-8 w-56" />
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
        className="flex items-center gap-1.5 border-t border-gray-100 p-2 dark:border-gray-800"
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e, "image")}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e, "video")}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav"
          className="hidden"
          onChange={(e) => handleFile(e, "audio")}
        />
        <button
          type="button"
          title="영상 작업물 올리기"
          onClick={() => videoInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          🎬
        </button>
        <button
          type="button"
          disabled={!collabAvailable}
          title={collabAvailable ? "이미지 작업물 올리기" : "협업 구함 게시물에서만 이미지를 올릴 수 있어요"}
          onClick={() => imageInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-800"
        >
          🖼️
        </button>
        <button
          type="button"
          disabled={!collabAvailable}
          title={collabAvailable ? "오디오 작업물 올리기" : "협업 구함 게시물에서만 오디오를 올릴 수 있어요"}
          onClick={() => audioInputRef.current?.click()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-800"
        >
          🎵
        </button>
        <button
          type="button"
          title="입력한 텍스트를 작업물로 남기기"
          onClick={sendTextAsWork}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-gray-100 dark:hover:bg-gray-800"
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
