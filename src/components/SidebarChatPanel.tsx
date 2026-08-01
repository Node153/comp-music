"use client";

// 우측 사이드바의 미니 메시지 패널 — 기본은 아이콘 한 줄로 숨김 처리, 클릭하면 펼쳐짐.
// 게시물을 보며 대화창을 안 벗어나도 되게 하는 목적. 아직 실제 DM(메시지 페이지의
// Realtime)과 연결되지 않은 목업 UI. 열림/선택된 상대는 상위(RightSidebar)에서 제어해서
// 접속자 목록의 DM 버튼을 누르면 바로 해당 상대와의 채팅 세션이 열리게 한다.
import { useState } from "react";

type Message = { from: "me" | "them"; text: string };

export type ChatContact = {
  id: string;
  name: string;
  meta: string;
  initialMessages?: Message[];
};

const AUTO_REPLIES = ["ㅋㅋㅋ 맞아요", "오 좋은데요?", "넵 확인했어요!", "잠시만요, 확인 중"];
const UNREAD_COUNT = 2;

export function SidebarChatPanel({
  contacts,
  open,
  onOpenChange,
  selectedId,
  onSelectedIdChange,
}: {
  contacts: ChatContact[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}) {
  const [messagesByContact, setMessagesByContact] = useState<Record<string, Message[]>>(() =>
    Object.fromEntries(contacts.map((c) => [c.id, c.initialMessages ?? []])),
  );
  const [draft, setDraft] = useState("");

  const selected = contacts.find((c) => c.id === selectedId) ?? null;
  const messages = selectedId ? (messagesByContact[selectedId] ?? []) : [];

  function sendMessage() {
    if (!selectedId) return;
    const text = draft.trim();
    if (!text) return;
    setMessagesByContact((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] ?? []), { from: "me", text }],
    }));
    setDraft("");

    const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
    setTimeout(() => {
      setMessagesByContact((prev) => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] ?? []), { from: "them", text: reply }],
      }));
    }, 1200);
  }

  return (
    <section>
      <button
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-gray-200/60 dark:hover:bg-gray-900"
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs dark:bg-gray-900">
          💬
          {UNREAD_COUNT > 0 && !open && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {UNREAD_COUNT}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-gray-600 dark:text-gray-300">DM</span>
        <span className="shrink-0 text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-1 flex h-96 w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                <button
                  onClick={() => onSelectedIdChange(null)}
                  aria-label="목록으로"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  ←
                </button>
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {selected.name.slice(0, 1)}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-950" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selected.name}
                  </span>
                  <span className="text-xs text-gray-400">{selected.meta}</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">아직 대화가 없어요</p>
                ) : (
                  messages.map((m, i) => (
                    <span
                      key={i}
                      className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                        m.from === "me"
                          ? "self-end bg-black text-white dark:bg-white dark:text-black"
                          : "self-start bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {m.text}
                    </span>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex items-center gap-2 border-t border-gray-100 p-2 dark:border-gray-800"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="메시지 보내기..."
                  className="w-full flex-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 dark:bg-gray-800 dark:text-gray-200"
                />
                <button
                  type="submit"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200"
                >
                  ➤
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => onSelectedIdChange(contact.id)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-900"
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {contact.name.slice(0, 1)}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-950" />
                  </span>
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                      {contact.name}
                    </span>
                    <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {(messagesByContact[contact.id] ?? []).at(-1)?.text ?? contact.meta}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
