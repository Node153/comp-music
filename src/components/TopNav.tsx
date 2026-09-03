"use client";

// 데스크톱 웹 기준 상단 네비게이션(링크드인 참고). 모바일(md 미만)에서는 BottomNav가 대신 노출됨.
// 좌: 로고 · 우: Drop(업로드)/Chat(메시지)/Alerts(알림)/Me/Help 클러스터.
// Messages/Notifications는 각각 Chat/Alerts로 축약 — Drop과 첫 글자가 겹치는 DM은 피했다.
// 안읽음 뱃지는 원래 Me 아바타에 있었는데, /notifications 알림 목록 페이지가 생기면서
// 그 전용 아이콘으로 옮김(좋아요/댓글만 1단계 — Companion 신청·Peak·공동창작 신청은 다음 단계).
// 우측 사이드바의 mock DM 위젯을 걷어내면서 메시지를 상단 메뉴 1급 항목으로 승격 — 실제
// /messages 라우트(Realtime)로 바로 연결.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { useNotificationCount } from "@/components/NotificationCountContext";
import { PlusIcon, ChatIcon, BellIcon, HelpIcon, SearchIcon } from "@/components/icons";

// 전체공개(Demo, 노출시간 영구·설정불가) / 비공개(Complex, 노출시간 설정 필수 — 팔로워공개 또는
// 특정인 초대) 두 피드 탭.
// 아직 UI만 있고 실제 필터링·업로드 연동은 데이터 연결 단계에서 진행 예정.
const FEED_TABS = [
  { value: "completion", label: "DEMO", icon: "☀" },
  { value: "complex", label: "memo", icon: "☾" },
];

export function TopNav({
  currentUserId,
  userName,
}: {
  currentUserId: string;
  userName: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";
  const search = useSearchOverlay();
  const unseenNotifications = useNotificationCount();

  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-[#1c1c1e] md:flex">
      <div className="flex flex-1 items-center gap-2">
        <Link href="/feed" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-xs font-bold text-white dark:bg-white dark:text-black">
            Comp
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Comp</span>
        </Link>
      </div>

      <nav className="flex h-full items-center gap-1">
        {FEED_TABS.map((tab) => {
          const isActive = pathname === "/feed" && activeFeedTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/feed?feed=${tab.value}`}
              title={
                tab.value === "completion"
                  ? "전체공개 게시물 · 노출 시간 영구"
                  : "Companion 공개 게시물 · 노출 시간 설정 필수"
              }
              className={`flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-bold transition ${
                isActive
                  ? tab.value === "complex"
                    ? "border-violet-500 text-violet-600 dark:text-violet-300"
                    : "border-demo-gold text-demo-gold"
                  : "border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          type="button"
          onClick={search.open}
          title="검색"
          aria-label="검색"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            search.isOpen
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <SearchIcon />
        </button>
        <Link
          href="/upload"
          title="Drop"
          aria-label="Drop"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            pathname === "/upload"
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <PlusIcon />
        </Link>
        <Link
          href="/messages"
          title="Chat"
          aria-label="Chat"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            pathname.startsWith("/messages")
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <ChatIcon />
        </Link>
        <Link
          href="/notifications"
          title="Alerts"
          aria-label="Alerts"
          className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
            pathname === "/notifications"
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
        </Link>
        <ProfileMenu userId={currentUserId} userName={userName} />
        <Link
          href="/help"
          title="Help"
          aria-label="Help"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            pathname === "/help"
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <HelpIcon />
        </Link>
      </div>
    </header>
  );
}
