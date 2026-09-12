"use client";

// TopNav 메시지 드롭다운(NotificationsMenu와 동일한 클릭-토글+바깥클릭-닫기 패턴 재사용) — Chat
// 아이콘을 눌러 곧장 /messages로 이동하던 걸, 최근 대화 몇 개를 바로 훑어보다가 특정 대화를
// 클릭했을 때만 그 대화방(/messages/[id])으로 이동하는 드롭다운으로 바꿨다.
// 열릴 때마다 /api/messages/list를 불러온다(알림 드롭다운과 같은 지연-로드 원칙). 안읽음
// 처리는 여전히 대화방 진입 시 MarkMessagesRead가 담당 — 여기서는 건드리지 않는다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ChatIcon, EditIcon, MailIcon } from "@/components/icons";
import { timeAgo } from "@/lib/timeAgo";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import type { ConversationItem } from "@/lib/conversationList";

export function MessagesMenu() {
  const search = useSearchOverlay();
  const [open, setOpen] = useState(false);
  // null = 이번에 열고 나서 아직 못 받아옴(로딩 중) — 열 때마다 toggleOpen에서 초기화해서 매번 새로 불러온다.
  const [conversations, setConversations] = useState<ConversationItem[] | null>(null);
  const loading = open && conversations === null;

  function close() {
    setOpen(false);
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) setConversations(null);
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/messages/list")
      .then((res) => (res.ok ? res.json() : { conversations: [] }))
      .then((data: { conversations?: ConversationItem[] }) => {
        if (!cancelled) setConversations(data.conversations ?? []);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        title="Chat"
        aria-label="Chat"
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
          open
            ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        <ChatIcon />
      </button>

      {open && (
        <>
          <button aria-label="메시지 닫기" onClick={close} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 z-50 mt-2 flex max-h-[28rem] w-80 flex-col rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">메시지</span>
              <button
                onClick={() => {
                  close();
                  search.open();
                }}
                title="새 대화 시작"
                aria-label="새 대화 시작"
                className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-900"
              >
                <EditIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
              ) : !conversations || conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <MailIcon className="h-6 w-6 text-gray-300" />
                  <p className="text-sm text-gray-400">아직 대화가 없어요</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {conversations.map((c) => (
                    <Link
                      key={c.id}
                      href={c.href}
                      onClick={close}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-gray-100 dark:hover:bg-gray-900"
                    >
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                        <Avatar userId={c.otherUserId} name={c.otherName} className="h-9 w-9 text-sm" />
                        {c.presence !== "offline" && (
                          <span
                            className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-950 ${
                              c.presence === "online" ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                          />
                        )}
                      </span>
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <span
                          className={c.unread ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-800 dark:text-gray-200"}
                        >
                          {c.otherName}
                        </span>
                        <span className="truncate text-xs text-gray-500">
                          {c.lastMessage?.content ?? "대화를 시작해보세요"}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {c.lastMessage && (
                          <span className="text-[11px] text-gray-400">{timeAgo(c.lastMessage.createdAt)}</span>
                        )}
                        {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-black dark:bg-white" />}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-1 border-t border-gray-100 pt-1 dark:border-gray-800">
              <Link
                href="/messages"
                onClick={close}
                className="block rounded-lg px-2 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
              >
                전체 메시지 보기
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
