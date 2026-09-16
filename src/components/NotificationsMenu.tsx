"use client";

// NavSidebar 알림 패널(ProfileMenu와 동일한 클릭-토글+바깥클릭-닫기 패턴 재사용) — 인스타그램
// 알림탭 참고(2026-09-16, 사용자 요청 — "굳이 전체 알림보기로 페이지 이동하지 말고 사이드바에서
// 알림정보 다 볼 수 있게"): 작은 드롭다운 대신 화면 전체 높이의 패널로 펼쳐지고, 오늘/어제/
// 이번 주/이번 달/이전 활동으로 묶어서 보여준다 — /notifications 페이지로 이동할 필요 없이
// 여기서 전체 목록을 다 볼 수 있어서 "전체 알림 보기" 링크는 없앴다(그 페이지 자체는 카테고리
// 필터가 있어 남겨두되, 여기서 굳이 유도하지 않음).
// 열릴 때마다 /api/notifications/list를 불러오고(뱃지 숫자와 같은 지연-로드 원칙), 동시에
// markSeen으로 읽음 처리해서 뱃지를 즉시 0으로 내린다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BellIcon, FlameIcon, XIcon } from "@/components/icons";
import { timeAgo } from "@/lib/timeAgo";
import { useNotificationCount, useMarkNotificationsSeen } from "@/components/NotificationCountContext";
import { navRowClass } from "@/components/ui/styles";
import type { NotificationItem } from "@/lib/notificationList";

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

export function NotificationsMenu({ userId, isFeed }: { userId: string; isFeed: boolean }) {
  const unseenNotifications = useNotificationCount();
  const markSeen = useMarkNotificationsSeen();
  const [open, setOpen] = useState(false);
  // null = 이번에 열고 나서 아직 못 받아옴(로딩 중) — 열 때마다 toggleOpen에서 초기화해서 매번 새로 불러온다.
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const loading = open && items === null;

  function close() {
    setOpen(false);
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) setItems(null);
      return next;
    });
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

  return (
    <div className="relative">
      <button onClick={toggleOpen} title="Alerts" aria-label="Alerts" className={navRowClass(open, isFeed)}>
        <BellIcon className="h-6 w-6" />
        <span className="flex-1 text-left">알림</span>
        {unseenNotifications > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {unseenNotifications}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-label="알림 닫기" onClick={close} className="fixed inset-0 z-40 cursor-default" />
          {/* 인스타그램처럼 사이드바 오른쪽에 딱 붙어 화면 전체 높이로 펼쳐진다(위아래로 뜨는
              작은 드롭다운이 아님) — left-60은 NavSidebar의 고정 폭(w-60)과 같은 값. */}
          <div className="fixed inset-y-0 left-60 z-50 flex w-[420px] max-w-[calc(100vw-15rem)] flex-col border-r border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950">
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

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
              ) : !items || items.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">아직 알림이 없어요</p>
              ) : (
                groupBySection(items).map((group) => (
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
