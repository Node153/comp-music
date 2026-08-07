"use client";

// 데스크톱 웹 기준 상단 네비게이션(링크드인 참고). 모바일(md 미만)에서는 BottomNav가 대신 노출됨.
// 좌: 로고 · 우: Drop(업로드)/Messages/Me/Help 클러스터.
// Push(알림) 버튼은 프로필 링크·뱃지가 Me 드롭다운과 중복이라 제거하고, 안읽음 알림 뱃지는 Me 아바타로 옮김.
// 우측 사이드바의 mock DM 위젯을 걷어내면서 메시지를 상단 메뉴 1급 항목으로 승격 — 실제
// /messages 라우트(Realtime)로 바로 연결.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ProfileMenu } from "@/components/ProfileMenu";

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
  unseenNotifications = 0,
}: {
  currentUserId: string;
  userName: string;
  unseenNotifications?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";

  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-black md:flex">
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
                    : "border-yellow-400 text-yellow-600 dark:text-yellow-300"
                  : "border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-3">
        <Link
          href="/upload"
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
            pathname === "/upload"
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <span className="text-base">☂</span>
          Drop
        </Link>
        <Link
          href="/messages"
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
            pathname.startsWith("/messages")
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <span className="text-base">✉</span>
          Messages
        </Link>
        <ProfileMenu userId={currentUserId} userName={userName} unseenCount={unseenNotifications} />
        <Link
          href="/help"
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
            pathname === "/help"
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <span className="text-base">☁</span>
          Help
        </Link>
      </div>
    </header>
  );
}
