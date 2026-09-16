"use client";

// 알림 패널(ProfileMenu와 동일한 클릭-토글+바깥클릭-닫기 패턴 재사용) — 인스타그램 알림탭 참고
// (2026-09-16, 사용자 요청 — "굳이 전체 알림보기로 페이지 이동하지 말고 사이드바에서 알림정보
// 다 볼 수 있게"): 작은 드롭다운 대신 패널로 펼쳐지고, 오늘/어제/이번 주/이번 달/이전 활동으로
// 묶어서 보여준다. 이어서 "/notifications 페이지 자체를 제거해달라"는 요청을 받아 그 페이지를
// 지우고(2026-09-16), 그 페이지가 갖고 있던 카테고리 필터(전체/좋아요·댓글/신청/PEAK)와 댓글
// 미리보기까지 이 패널로 옮겨왔다 — 이제 알림 정보 전부가 여기 하나에서만 보인다.
// 데스크톱(NavSidebar, compact=false)은 사이드바 오른쪽에 딱 붙는 도킹 패널, 모바일
// (MobileTopBar, compact=true)은 화면 전체를 덮는 풀스크린 패널 — 같은 컴포넌트를 반응형
// 클래스(md:)로 나눠 재사용한다.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BellIcon, FlameIcon, XIcon } from "@/components/icons";
import { timeAgo } from "@/lib/timeAgo";
import { useNotificationCount, useMarkNotificationsSeen } from "@/components/NotificationCountContext";
import { navRowClass, navLabelClass, topBarIconClass } from "@/components/ui/styles";
import type { NotificationItem } from "@/lib/notificationList";

// 옛 /notifications 페이지의 카테고리 필터 그대로(2026-09-16 이전엔 URL ?type=으로 했지만,
// 이제 페이지가 아니라 패널이라 로컬 상태로 바꿨다).
type CategoryFilter = "all" | "engagement" | "request" | "peak";
const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "engagement", label: "좋아요·댓글" },
  { value: "request", label: "신청" },
  { value: "peak", label: "PEAK" },
];
function matchesCategory(item: NotificationItem, filter: CategoryFilter) {
  if (filter === "all") return true;
  if (filter === "engagement") return item.type === "like" || item.type === "comment";
  if (filter === "request") return item.type === "companion_request" || item.type === "knock";
  return item.type === "peak";
}

// 인스타그램 알림탭과 같은 시간 구간 묶음. 알림이 createdAt 내림차순으로 이미 정렬돼 오므로
// 순서대로 훑으면서 구간이 바뀔 때만 새 섹션을 만들면 된다(별도 정렬/버킷 배열 불필요).
function sectionLabel(createdAt: string, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(new Date(createdAt))) / 86_400_000);
  if (diffDays <= 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays <= 7) return "이번 주";
  const created = new Date(createdAt);
  if (created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()) return "이번 달";
  return "이전 활동";
}

function groupBySection(items: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const now = new Date();
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const label = sectionLabel(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

export function NotificationsMenu({
  userId,
  isFeed,
  compact = false,
  expanded = false,
  onOpenChange,
}: {
  userId: string;
  isFeed: boolean;
  compact?: boolean;
  expanded?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const unseenNotifications = useNotificationCount();
  const markSeen = useMarkNotificationsSeen();
  const [open, setOpen] = useState(false);
  // null = 이번에 열고 나서 아직 못 받아옴(로딩 중) — 열 때마다 toggleOpen에서 초기화해서 매번 새로 불러온다.
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const loading = open && items === null;

  function close() {
    setOpen(false);
    onOpenChange?.(false);
  }

  function toggleOpen() {
    // onOpenChange(부모 NavSidebar의 setState)를 setOpen 업데이터 함수 안에서 부르면 "다른
    // 컴포넌트를 렌더링 중 업데이트" 경고가 뜬다 — 이벤트 핸들러 최상위에서 순서대로 호출
    // (2026-09-16).
    const next = !open;
    setOpen(next);
    if (next) setItems(null);
    onOpenChange?.(next);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/notifications/list")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: NotificationItem[] }) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    void markSeen(userId);
    return () => {
      cancelled = true;
    };
  }, [open, userId, markSeen]);

  const filteredItems = useMemo(
    () => (items ?? []).filter((item) => matchesCategory(item, category)),
    [items, category],
  );

  return (
    <div className="relative">
      {compact ? (
        <button
          onClick={toggleOpen}
          aria-label="알림"
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${topBarIconClass(open, isFeed)}`}
        >
          <BellIcon className="h-5 w-5" />
          {unseenNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
              {unseenNotifications}
            </span>
          )}
        </button>
      ) : (
        // 뱃지를 아이콘 모서리에 고정(행 끝이 아니라)해서, 사이드바가 접혀 라벨이 사라진
        // 상태에서도(navLabelClass) 뱃지 위치가 안 바뀌고 계속 보인다.
        <button onClick={toggleOpen} title="Alerts" aria-label="Alerts" className={navRowClass(open, isFeed, expanded)}>
          <span className="relative shrink-0">
            <BellIcon className="h-6 w-6" />
            {unseenNotifications > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                {unseenNotifications}
              </span>
            )}
          </span>
          <span className={navLabelClass(expanded)}>알림</span>
        </button>
      )}

      {open && (
        <>
          <button aria-label="알림 닫기" onClick={close} className="fixed inset-0 z-40 cursor-default" />
          {/* 데스크톱: 사이드바 오른쪽에 딱 붙어 화면 전체 높이로 펼쳐진다(left-[72px]는
              NavSidebar의 접힌 기본 폭 — 사이드바는 호버로만 넓어지고 본문/이 패널은 항상
              접힌 폭 기준으로 고정돼 있다). 모바일: 화면 전체를 덮는 풀스크린 패널(md 미만엔
              사이드바가 없어서 도킹시킬 기준점이 없다). */}
          <div className="fixed inset-0 z-50 flex w-full flex-col bg-white md:inset-y-0 md:left-[72px] md:right-auto md:w-[420px] md:max-w-[calc(100vw-72px)] md:border-r md:border-gray-200 md:shadow-xl dark:bg-gray-950 md:dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">알림</span>
              <div className="flex items-center gap-3">
                <Link
                  href="/notifications/settings"
                  onClick={close}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  알림 설정
                </Link>
                <button
                  onClick={close}
                  aria-label="알림 패널 닫기"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCategory(option.value)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                    category === option.value
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
              ) : filteredItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">아직 알림이 없어요</p>
              ) : (
                groupBySection(filteredItems).map((group) => (
                  <div key={group.label} className="mb-2">
                    <p className="px-2 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => (
                        <Link
                          key={`${item.type}-${item.id}`}
                          href={item.href}
                          onClick={close}
                          className={`flex items-start gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-gray-100 dark:hover:bg-gray-900 ${
                            item.unread ? "bg-gray-50 dark:bg-gray-900/60" : ""
                          }`}
                        >
                          {item.type === "peak" ? (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-500 dark:bg-gray-600">
                              <FlameIcon className="h-4 w-4 text-white" />
                            </span>
                          ) : (
                            <Avatar userId={item.actorId} name={item.actorName} className="h-9 w-9 shrink-0 text-sm" />
                          )}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-gray-800 dark:text-gray-200">
                              {item.type === "peak" ? (
                                "회원님의 게시물이 PEAK에 도달했어요"
                              ) : (
                                <>
                                  <span className="font-semibold">{item.actorName}</span>
                                  {item.type === "like" && "님이 회원님의 게시물을 좋아합니다"}
                                  {item.type === "comment" && "님이 댓글을 남겼습니다"}
                                  {item.type === "companion_request" && "님이 Companion을 신청했어요"}
                                  {item.type === "knock" && "님이 비공개 게시물에 노크했어요"}
                                </>
                              )}
                            </span>
                            {item.type === "comment" && (
                              <span className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                                “{item.content}”
                              </span>
                            )}
                            <span className="mt-0.5 text-xs text-gray-400">{timeAgo(item.createdAt)}</span>
                          </span>
                          {item.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
