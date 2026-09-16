"use client";

// 모바일(md 미만) 전용 상단바. TopNav는 md 이상에서만 보이는데(hidden md:flex), 그동안
// 모바일에는 알림·DEMO/memo 피드 전환으로 갈 방법이 BottomNav 5탭(피드/검색/메시지/업로드/
// 프로필) 어디에도 없었다 — 안읽음 뱃지만 프로필 탭에 얹혀있어서 눌러도 알림함으로 못 갔다.
// 인스타/디스코드처럼 모바일에서도 항상 떠 있는 얇은 바 하나로 이 두 가지(피드 전환·알림)만
// 보충한다. 검색/DM/업로드는 이미 BottomNav에 있어 여기 안 넣음.
// 알림 벨은 예전엔 /notifications 페이지로 이동하는 링크였는데, 그 페이지 자체를 없애고
// (2026-09-16, 사용자 요청) NotificationsMenu를 compact 모드로 재사용 — 눌리면 화면 전체를
// 덮는 풀스크린 패널이 뜬다(NavSidebar가 쓰는 도킹 패널의 모바일 버전, 같은 컴포넌트).
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { beginThemeTransitionWithSound } from "@/lib/theme";

const FEED_TABS = [
  { value: "completion", label: "DEMO", icon: "☀" },
  { value: "complex", label: "memo", icon: "☾" },
];

export function MobileTopBar({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";
  // TopNav와 같은 이유 — 피드 밖 화면은 캔버스가 canvas-gray라 흰 상단바 대신 main-gray를 쓴다.
  const isFeed = pathname === "/feed" || pathname?.startsWith("/feed/");

  return (
    <header
      className={`sticky top-0 z-40 flex h-12 items-center gap-2 border-b px-3 md:hidden ${
        isFeed
          ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1c1c1e]"
          : "border-box-gray bg-main-gray"
      }`}
    >
      <Link href="/feed" className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">
        Comp
      </Link>

      <nav className="flex flex-1 items-center justify-center gap-1">
        {FEED_TABS.map((tab) => {
          const isActive = pathname === "/feed" && activeFeedTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/feed?feed=${tab.value}`}
              onClick={() => beginThemeTransitionWithSound(tab.value === "complex")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                isActive
                  ? tab.value === "complex"
                    ? "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                    : "bg-demo-gold/15 text-demo-gold"
                  : isFeed
                    ? "text-gray-400"
                    : "text-black"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <NotificationsMenu userId={currentUserId} isFeed={isFeed} compact />
    </header>
  );
}
