import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { timeAgo } from "@/lib/timeAgo";
import { Avatar } from "@/components/Avatar";
import { pageTitle, pageCard } from "@/components/ui/styles";
import { getNotificationItems, type NotificationItem } from "@/lib/notificationList";
import { FlameIcon } from "@/components/icons";

// 알림 목록 — 좋아요·댓글(1단계) + Companion 신청·PEAK(2단계) + 노크(3단계). 공동창작 신청은 다음 단계.
// 별도 notifications 테이블 없이 기존 테이블(likes/comments/companions/post_access)과 PEAK 판정
// 로직(EngagementMeter와 동일 기준 — 이번 주 좋아요 수 ≥ 승인 회원 수/3)을 그대로 재사용해서 조립한다.
// 조립 자체는 getNotificationItems(TopNav 알림 드롭다운과 공유)가 담당하고, 이 페이지는
// 카테고리 필터 + 전체 목록 렌더링만 맡는다.
// 노크(post_access status='pending')는 원래 본인 게시물을 직접 열어야만 보이던 걸, 좋아요/댓글처럼
// 여기서도 놓치지 않게 추가했다(사용자 피드백: "노크도 알림에 떠야 할 것 같은데").
// 인스타그램 알림탭 참고 — 줄마다 붙던 ❤️/💬/🤝 아이콘이 좌측 사이드바 장르필터 아이콘과
// 겹쳐서 혼란스럽다는 피드백으로, 아이콘 대신 상대방 아바타(메시지/RightSidebar와 동일한
// avatarColorFor)를 앞세우고, 카테고리 필터 탭으로 종류를 구분한다.
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

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const activeCategory: CategoryFilter = CATEGORY_OPTIONS.some((o) => o.value === typeParam)
    ? (typeParam as CategoryFilter)
    : "all";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { items: allItems } = await getNotificationItems(supabase, user.id);
  const items = allItems.filter((item) => matchesCategory(item, activeCategory)).slice(0, 50);

  return (
    <main className={pageCard}>
      <MarkNotificationsSeen userId={user.id} />
      <div className="flex items-center justify-between">
        <h1 className={pageTitle}>알림</h1>
        <Link href="/notifications/settings" className="text-sm text-gray-400 hover:text-gray-600">
          알림 설정
        </Link>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto">
        {CATEGORY_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "all" ? "/notifications" : `/notifications?type=${option.value}`}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              activeCategory === option.value
                ? "border-black bg-black text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">아직 알림이 없어요</p>
        ) : (
          items.map((item) => {
            const avatar =
              item.type === "peak" ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-500 text-base dark:bg-gray-600">
                  <FlameIcon className="h-4 w-4 text-white" />
                </span>
              ) : (
                <Avatar userId={item.actorId} name={item.actorName} className="h-9 w-9 text-sm" />
              );
            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.href}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:bg-gray-50 ${
                  item.unread ? "border-gray-300 bg-gray-50" : "border-gray-200"
                }`}
              >
                {avatar}
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-sm text-gray-800">
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
                  </p>
                  {item.type === "comment" && (
                    <p className="mt-0.5 truncate text-sm text-gray-500">“{item.content}”</p>
                  )}
                  <span className="mt-1 text-xs text-gray-400">{timeAgo(item.createdAt)}</span>
                </div>
                {item.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
