"use client";

// 데스크톱 웹 기준 상단 네비게이션(페이스북 참고). 모바일(md 미만)에서는 BottomNav가 대신 노출됨.
// 좌: 로고+검색(장식용, SEARCH는 Phase1) · 우: Drop(업로드)/Me/Away 클러스터.
// Push(알림) 버튼은 프로필 링크·뱃지가 Me 드롭다운과 중복이라 제거하고, 안읽음 알림 뱃지는 Me 아바타로 옮김.
// DM은 자리를 Away(공지사항+피드백, 0021_announcements_and_feedback)에 내줬다 — 메시지 자체는
// /messages 라우트로 여전히 접근 가능(대화 중인 상대 프로필의 "메시지 보내기" 버튼 등).
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
        <div className="relative ml-2 w-full max-w-md">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-gray-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Comp 검색"
            disabled
            title="검색 기능은 준비 중이에요"
            className="w-full rounded-full bg-gray-100 py-3 pl-11 pr-4 text-base text-gray-600 placeholder:text-gray-400 disabled:cursor-not-allowed dark:bg-gray-900 dark:text-gray-300"
          />
        </div>
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
        <ProfileMenu userId={currentUserId} userName={userName} unseenCount={unseenNotifications} />
        <Link
          href="/away"
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
            pathname === "/away"
              ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <span className="text-base">☁</span>
          Away
        </Link>
      </div>
    </header>
  );
}
