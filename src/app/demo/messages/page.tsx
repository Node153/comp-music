"use client";

// 메시지 UI("다정한 말풍선" 톤) 미리보기 전용 데모 페이지 — 실제 대화 데이터 없이 스타일만
// 바로 확인하기 위한 정적 목업. 실제 화면은 messages/page.tsx + messages/[conversationId]에
// 있고, 여기 쓰인 클래스/구조는 그 두 파일과 동일하다(실제 화면 미리보기가 목적이므로).
import Link from "next/link";
import { useState } from "react";
import { avatarColorFor } from "@/lib/presence";

type MockConversation = {
  id: string;
  name: string;
  status: "online" | "away" | "offline";
  lastMessage: string;
  time: string;
  unread: boolean;
};

const MOCK_CONVERSATIONS: MockConversation[] = [
  { id: "1", name: "김하늘", status: "online", lastMessage: "저도 오늘 녹음했어요, 한번 들어보실래요?", time: "3분 전", unread: true },
  { id: "2", name: "박서준", status: "away", lastMessage: "네 좋아요, 내일 봬요", time: "1시간 전", unread: false },
  { id: "3", name: "이지민", status: "offline", lastMessage: "감사합니다 :)", time: "어제", unread: false },
];

type MockMessage = { id: string; from: "me" | "them"; text: string; time: string; read?: boolean };

const INITIAL_THREAD: MockMessage[] = [
  { id: "m1", from: "them", text: "안녕하세요! 데모 트랙 잘 들었어요", time: "오후 2:14" },
  { id: "m2", from: "them", text: "혹시 편곡 파일도 있으신가요?", time: "오후 2:14" },
  { id: "m3", from: "me", text: "네 있어요! 잠시만요", time: "오후 2:16" },
  { id: "m4", from: "me", text: "여기 보내드릴게요 🎵", time: "오후 2:16", read: true },
  { id: "m5", from: "them", text: "우와 감사합니다! 저도 오늘 녹음했어요, 한번 들어보실래요?", time: "오후 2:20" },
];

const OTHER_NAME = "김하늘";
const OTHER_ID = "demo-other-user";

export default function MessagesDemoPage() {
  const [thread, setThread] = useState(INITIAL_THREAD);
  const [text, setText] = useState("");

  function send() {
    if (!text.trim()) return;
    setThread((prev) => [...prev, { id: `local-${Date.now()}`, from: "me", text: text.trim(), time: "지금" }]);
    setText("");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">메시지 UI 미리보기</h1>
          <p className="text-sm text-gray-500">
            실제 대화 없이 디자인만 확인하는 데모 페이지예요 — 왼쪽은 목록, 오른쪽은 대화창.
          </p>
        </div>
        <Link href="/messages" className="text-sm font-medium text-blue-600 hover:underline">
          실제 메시지함으로
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:grid-cols-[280px_1fr]">
        {/* 왼쪽: 대화 목록 (messages/page.tsx와 동일한 구조) */}
        <ul className="flex flex-col border-r border-gray-100 p-2">
          {MOCK_CONVERSATIONS.map((c) => (
            <li key={c.id}>
              <div className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-gray-50">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold text-white ${avatarColorFor(c.id)}`}
                  >
                    {c.name.slice(0, 1)}
                  </span>
                  {c.status !== "offline" && (
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                        c.status === "online" ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                  )}
                </span>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className={`text-sm ${c.unread ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                    {c.name}
                  </span>
                  <span className="truncate text-xs text-gray-500">{c.lastMessage}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-gray-400">{c.time}</span>
                  {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* 오른쪽: 대화창 (ConversationView.tsx와 동일한 구조 — 묶음 마지막 줄에만 아바타/시간/읽음) */}
        <div className="flex h-[520px] flex-col p-4">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColorFor(OTHER_ID)}`}
              >
                {OTHER_NAME.slice(0, 1)}
              </span>
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-gray-900">{OTHER_NAME}</span>
              <span className="text-xs text-gray-400">온라인</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-3">
            {thread.map((m, i) => {
              const isMe = m.from === "me";
              const isLastInGroup = i === thread.length - 1 || thread[i + 1].from !== m.from;
              return (
                <div key={m.id} className={`mb-1 flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                  {!isMe &&
                    (isLastInGroup ? (
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColorFor(OTHER_ID)}`}
                      >
                        {OTHER_NAME.slice(0, 1)}
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
                      {m.text}
                    </span>
                    {isLastInGroup && (
                      <span className="px-1 text-[11px] text-gray-400">
                        {m.time}
                        {isMe && m.read && " · 읽음"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t border-gray-100 pt-3"
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메시지 보내기 (여기 쳐서 눌러보세요)"
              className="flex-1 rounded-full border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
            <button
              type="submit"
              className="rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              전송
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
