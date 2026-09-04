"use client";

// Complex 게시물 전용 — 좋아요/댓글 대신 Discord 스타일 실시간 채팅으로 구성.
// memo는 이제 음원(mp3/wav)만 주고받는 공간으로 좁혀서 채팅의 이미지 업로드 버튼은 없앴다
// (0016_allow_image_chat_messages로 한때 허용했었지만 UI에서 제거 — 과거에 올라간 이미지
// 메시지는 renderMessages에서 계속 보여준다, 업로드만 막음). 재창작물(작업물)은 원래부터
// 음원 파일만 올릴 수 있었고(0015_work_uploads_audio_only) 올릴 때마다 원본(1차)을 이어받은
// 재창작물(2차, 3차...)로 취급해 스택처럼 쌓아 보여준다. 일반 텍스트 채팅과는 구분됨(텍스트는
// 항상 잡담일 뿐 재창작물이 될 수 없음).
// 0012_complex_access_and_chat로 실제 DB(post_chat_messages) 연동됨. Realtime은 처음엔 이번
// 범위에서 보류하고 새로고침 버튼(🔄)에만 의존했었는데, 0036에서 DM(messages 테이블)과
// 동일하게 켰다 — INSERT/DELETE 신호를 받으면 /api/complex/chat로 다시 받아온다(file_key
// → signed URL 변환이 서버 전용이라 realtime payload만으로는 파일을 못 그림). 새로고침
// 버튼은 실시간이 늦거나 놓쳤을 때 수동으로도 맞출 수 있게 그대로 남겨둠. 파일 업로드는
// 기존 R2 파이프라인(uploadFileToR2)을 그대로 재사용.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import { usePostFocused } from "@/components/PostFocusContext";
import { XIcon, UploadIcon } from "@/components/icons";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  type: "text" | "image" | "video" | "audio";
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  // 삭제 시 R2 오브젝트도 같이 지우려면 signed URL이 아니라 원본 키가 필요하다.
  fileKey?: string | null;
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
  // 집중 모드가 아니면(피드에 카드로 떠 있을 때) 채팅·재창작물 스택은 숨기고 파일만
  // 가운데에 보여준다 — 확대해야만(집중 모드) 미디어|채팅 반반 분할이 나타난다(사용자 요청).
  const focused = usePostFocused();
  const canUploadWork = collabAvailable || isOwnPost;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stackOpen, setStackOpen] = useState(true);
  const audioInputRef = useRef<HTMLInputElement>(null);

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

  // 재창작물(음원)은 항상 is_work=true — RLS(0015_work_uploads_audio_only)에서도 음원만 허용.
  async function sendAudioFile(file: File) {
    if (sending) return;
    setSending(true);
    try {
      const fileKey = await uploadFileToR2(file);
      const { data, error } = await supabase
        .from("post_chat_messages")
        .insert({ post_id: postId, sender_id: currentUserId, type: "audio", file_key: fileKey, is_work: true })
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
          type: "audio",
          fileUrl: localUrl,
          fileName: file.name,
          fileKey,
          isWork: true,
          createdAt: data.created_at,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleAudioFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void sendAudioFile(file);
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

  // 실시간 반영(0036) — INSERT/DELETE 둘 다 신호로만 쓰고, 실제 최신 목록은 매번
  // /api/complex/chat로 다시 받아온다. file_key → signed URL 변환이 서버 전용이라
  // realtime payload(원본 row)만으로는 재창작물 파일을 바로 못 그리기 때문.
  useEffect(() => {
    const channel = supabase
      .channel(`post-chat:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_chat_messages", filter: `post_id=eq.${postId}` },
        () => {
          void refreshMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function deleteMessage(m: ChatMessage) {
    if (!window.confirm("메시지를 삭제할까요?")) return;
    setMessages((prev) => prev.filter((msg) => msg.id !== m.id));
    await supabase.from("post_chat_messages").delete().eq("id", m.id);
    if (m.fileKey) {
      await fetch("/api/storage/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: m.fileKey }),
      });
    }
  }

  function renderMessages() {
    return (
      <>
        {messages.map((m) => {
          const isMe = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                {m.senderName}
                {isMe && (
                  <button
                    type="button"
                    onClick={() => deleteMessage(m)}
                    title="삭제"
                    className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </span>
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

  // 메시지 입력 폼 — 접힌 뷰(하단 채팅 절반)와 집중 모드(우측 채팅 컬럼) 둘 다에서 그대로
  // 재사용한다(사용자 요청: 확대 전에도 입력창이 채팅 영역 안에 있어야 함).
  const messageForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sendText();
      }}
      className="flex shrink-0 items-center gap-1.5 border-t border-gray-100 p-2 dark:border-gray-800"
    >
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav"
        className="hidden"
        disabled={!canUploadWork}
        onChange={handleAudioFileInput}
      />
      <button
        type="button"
        disabled={!canUploadWork || sending}
        title={canUploadWork ? "음원 작업물 올리기" : "공동창작 게시물에서만 방장 외 사용자가 음원을 올릴 수 있어요"}
        onClick={() => audioInputRef.current?.click()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <UploadIcon className="h-4 w-4" />
      </button>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="메시지 보내기..."
        className="w-full flex-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-violet-700"
      />
      <button
        type="submit"
        disabled={sending}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
      >
        ➤
      </button>
    </form>
  );

  // 집중 모드가 아니면 위(파일)/아래(채팅)로 화면을 정확히 반 나눈다(사용자 요청) —
  // flex-1 두 개를 flex-col에 넣으면 남는 세로 공간을 50:50으로 나눠 갖는다. 아래쪽
  // 메시지 목록만 자체 스크롤(min-h-0 + overflow-y-auto)하고, 재창작물 스택·새로고침
  // 버튼처럼 덜 중요한 건 확대해야 보이는 채로 남긴다.
  if (!focused) {
    return (
      <div className="flex min-h-0 grow shrink-0 flex-col border-t border-gray-100 dark:border-gray-800">
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">{mediaSlot}</div>
        <div className="flex min-h-0 flex-1 flex-col border-t border-gray-100 dark:border-gray-800">
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">{renderMessages()}</div>
          {messageForm}
        </div>
      </div>
    );
  }

  return (
    // grow + shrink-0: 부모(article/집중모드 패널)가 flex-col이고 남는 세로 공간이 있으면
    // 그 공간을 이 블록이 다 흡수하고, justify-between으로 미디어+채팅 영역과 입력창
    // 사이에 몰아줘서 입력창이 항상 프레임 맨 아래에 붙는다(사용자 요청). shrink-0이라
    // 채팅이 길어서 프레임보다 커지면 압축되지 않고 그대로 부모의 overflow-y-auto가
    // 전체를 스크롤한다 — 이 블록 안에서 따로 스크롤이 생기지 않는다.
    <div className="flex grow shrink-0 flex-col justify-between border-t border-gray-100 dark:border-gray-800">
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

      {messageForm}
    </div>
  );
}
