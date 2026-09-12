"use client";

// TopNav 알림 드롭다운(ProfileMenu와 동일한 클릭-토글+바깥클릭-닫기 패턴 재사용) — 종/모/벨 아이콘을
// 눌러 /notifications 페이지로 이동하던 걸, 최근 알림 몇 개를 바로 훑어볼 수 있는 드롭다운으로 바꿨다.
// 열릴 때마다 /api/notifications/list를 불러오고(뱃지 숫자와 같은 지연-로드 원칙), 동시에
// markSeen으로 읽음 처리해서 뱃지를 즉시 0으로 내린다. 전체 목록/필터는 여전히 /notifications
// 페이지가 담당 — 드롭다운 맨 아래 "전체 알림 보기"로 연결.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { BellIcon, FlameIcon } from "@/components/icons";
import { timeAgo } from "@/lib/timeAgo";
import { useNotificationCount, useMarkNotificationsSeen } from "@/components/NotificationCountContext";
import type { NotificationItem } from "@/lib/notificationList";

export function NotificationsMenu({ userId }: { userId: string }) {
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
      <button
        onClick={toggleOpen}
        title="Alerts"
        aria-label="Alerts"
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
          open
            ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        <BellIcon />
        {unseenNotifications > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {unseenNotifications}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-label="알림 닫기" onClick={close} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 z-50 mt-2 flex max-h-[28rem] w-80 flex-col rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">알림</span>
              <Link
                href="/notifications/settings"
                onClick={close}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                알림 설정
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-400">불러오는 중…</p>
              ) : !items || items.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">아직 알림이 없어요</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => (
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
              )}
            </div>

            <div className="mt-1 border-t border-gray-100 pt-1 dark:border-gray-800">
              <Link
                href="/notifications"
                onClick={close}
                className="block rounded-lg px-2 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
              >
                전체 알림 보기
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
