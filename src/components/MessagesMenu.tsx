"use client";

// NavSidebar 메시지 패널(NotificationsMenu와 동일한 클릭-토글+바깥클릭-닫기 패턴, 알림 패널과
// 완전히 같은 구성 — 사용자 요청 "메시지 탭도 알림탭과 같은 방식으로") — Chat 아이콘을 눌러
// 곧장 /messages로 이동하던 걸, 최근 대화 몇 개를 바로 훑어보는 패널로 바꿨다.
// 대화를 클릭해도 더는 /messages/[id]로 페이지 이동하지 않는다(2026-09-16 재요청 — "메시지도
// 페이지 이동 없이 사이드바 자체적으로 채팅화면으로 전환") — 패널 안에서 목록(list) ↔ 대화창
// (thread) 두 화면을 전환하며, 대화창은 실제 /messages/[id] 페이지가 쓰는 ConversationView/
// MarkMessagesRead를 그대로 재사용한다(실시간 수신·발신·읽음 처리 전부 동일). 초기 데이터만
// 서버 컴포넌트 대신 /api/messages/[id]에서 받아온다(패널은 클라이언트 컴포넌트라 서버 전용
// 쿼리를 직접 못 써서).
// 작은 드롭다운이 아니라 화면 높이(사운드바 위까지)를 채우는 도킹 패널이고, 사이드바
// 오른쪽에 그림자 없이 딱 붙어서 "사이드바 자체가 메시지탭으로 바뀐" 것처럼 보인다 —
// NotificationsMenu.tsx의 상세 주석 참고(같은 이유로 md:left-[72px]/md:bottom-16 사용).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ChatIcon, EditIcon, MailIcon, XIcon, BackArrowIcon } from "@/components/icons";
import { timeAgo } from "@/lib/timeAgo";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { navRowClass, navLabelClass } from "@/components/ui/styles";
import type { ConversationItem } from "@/lib/conversationList";
import type { PresenceStatus } from "@/lib/presence";
import { MarkMessagesRead } from "@/app/(app)/messages/[conversationId]/MarkMessagesRead";
import { ConversationView } from "@/app/(app)/messages/[conversationId]/ConversationView";

type ThreadData = {
  otherUserId: string;
  otherUserName: string;
  otherUserStatus: PresenceStatus;
  messages: { id: string; sender_id: string; content: string; created_at: string; read_at: string | null }[];
};

export function MessagesMenu({
  currentUserId,
  isFeed,
  expanded,
  onOpenChange,
}: {
  currentUserId: string;
  isFeed: boolean;
  expanded: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const search = useSearchOverlay();
  const [open, setOpen] = useState(false);
  // null = 이번에 열고 나서 아직 못 받아옴(로딩 중) — 열 때마다 toggleOpen에서 초기화해서 매번 새로 불러온다.
  const [conversations, setConversations] = useState<ConversationItem[] | null>(null);
  const loading = open && conversations === null;

  // 목록(list) ↔ 대화창(thread) — 대화 클릭 시 페이지 이동 대신 이 패널 안에서 전환한다.
  const [view, setView] = useState<"list" | "thread">("list");
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const threadLoading = view === "thread" && threadData === null;

  function close() {
    setOpen(false);
    onOpenChange?.(false);
    setView("list");
    setActiveConversation(null);
    setThreadData(null);
  }

  function toggleOpen() {
    // onOpenChange(부모 NavSidebar의 setState)를 setOpen 업데이터 함수 안에서 부르면 "다른
    // 컴포넌트를 렌더링 중 업데이트" 경고가 뜬다(React가 업데이터를 렌더 단계에서 실행할 수
    // 있어서) — 이벤트 핸들러 최상위에서 순서대로 호출하도록 뺐다(2026-09-16).
    const next = !open;
    setOpen(next);
    if (next) setConversations(null);
    onOpenChange?.(next);
  }

  function openThread(c: ConversationItem) {
    setActiveConversation(c);
    setView("thread");
    setThreadData(null);
  }

  function backToList() {
    setView("list");
    setActiveConversation(null);
    setThreadData(null);
    // 목록으로 돌아왔을 때 방금 대화에서 바뀐 안읽음/마지막 메시지를 반영하려 다시 불러온다.
    setConversations(null);
  }

  useEffect(() => {
    if (!open || view !== "list") return;
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
  }, [open, view]);

  useEffect(() => {
    if (view !== "thread" || !activeConversation) return;
    let cancelled = false;
    fetch(`/api/messages/${activeConversation.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ThreadData | null) => {
        if (!cancelled && data) setThreadData(data);
      });
    return () => {
      cancelled = true;
    };
  }, [view, activeConversation]);

  const presenceForHeader = threadData?.otherUserStatus ?? activeConversation?.presence ?? "offline";

  return (
    <div className="relative">
      <button onClick={toggleOpen} title="Chat" aria-label="Chat" className={navRowClass(open, isFeed, expanded)}>
        <ChatIcon className="h-6 w-6 shrink-0" />
        <span className={navLabelClass(expanded)}>메시지</span>
      </button>

      {open && (
        <>
          <button aria-label="메시지 닫기" onClick={close} className="fixed inset-0 z-40 cursor-default" />
          {/* NotificationsMenu.tsx의 패널과 완전히 동일한 위치/크기 규칙(md:left-[72px]/
              md:bottom-16/그림자 없음) — 데스크톱은 사이드바 오른쪽에 그림자 없이 이어붙는
              도킹 패널, 모바일은 없음(모바일은 BottomNav "메시지" 탭이 /messages로 바로 이동
              — 이 패널은 데스크톱 NavSidebar 전용이라 compact 모드가 필요 없다). */}
          <div className="fixed inset-0 z-50 flex w-full flex-col bg-white md:inset-y-auto md:top-0 md:bottom-16 md:left-[72px] md:right-auto md:w-[420px] md:max-w-[calc(100vw-72px)] md:border-r md:border-gray-200 dark:bg-gray-950 md:dark:border-gray-800">
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              {view === "thread" && activeConversation ? (
                <>
                  <button
                    onClick={backToList}
                    aria-label="목록으로"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
                  >
                    <BackArrowIcon className="h-4 w-4" />
                  </button>
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <Avatar
                      userId={activeConversation.otherUserId}
                      name={activeConversation.otherName}
                      className="h-8 w-8 text-xs"
                    />
                    {presenceForHeader !== "offline" && (
                      <span
                        className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-950 ${
                          presenceForHeader === "online" ? "bg-emerald-500" : "bg-amber-400"
                        }`}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {activeConversation.otherName}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-lg font-bold text-gray-900 dark:text-gray-100">메시지</span>
              )}
              <div className="flex items-center gap-3">
                {view === "list" && (
                  <button
                    onClick={() => {
                      close();
                      search.open();
                    }}
                    title="새 대화 시작"
                    aria-label="새 대화 시작"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={close}
                  aria-label="메시지 패널 닫기"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {view === "thread" ? (
              <div className="flex flex-1 flex-col overflow-hidden px-4 py-3 text-black dark:text-white">
                {threadLoading || !threadData || !activeConversation ? (
                  <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
                ) : (
                  <>
                    <MarkMessagesRead conversationId={activeConversation.id} currentUserId={currentUserId} />
                    <ConversationView
                      conversationId={activeConversation.id}
                      currentUserId={currentUserId}
                      otherUserId={threadData.otherUserId}
                      otherUserName={threadData.otherUserName}
                      initialMessages={threadData.messages}
                      initialSourcePostId={null}
                    />
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-2 py-2">
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
                        <button
                          key={c.id}
                          onClick={() => openThread(c)}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-gray-900"
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
                              className={
                                c.unread
                                  ? "font-semibold text-gray-900 dark:text-gray-100"
                                  : "text-gray-800 dark:text-gray-200"
                              }
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
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 px-2 py-2 dark:border-gray-800">
                  <Link
                    href="/messages"
                    onClick={close}
                    className="block rounded-lg px-2 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
                  >
                    전체 메시지 보기
                  </Link>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
