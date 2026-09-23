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
import { FeedbackIcon, SunIcon, MoonIcon } from "@/components/icons";
import { beginThemeTransitionWithSound } from "@/lib/theme";
import { useUpdatesStatus } from "@/components/UpdatesStatusContext";

const FEED_TABS = [
  { value: "completion", label: "DEMO", Icon: SunIcon },
  { value: "complex", label: "memo", Icon: MoonIcon },
];

export function MobileTopBar({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const { unseen: updatesUnseen } = useUpdatesStatus();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";
  // TopNav와 같은 이유 — 피드 밖 화면은 캔버스가 canvas-gray라 흰 상단바 대신 main-gray를 쓴다.
  const isFeed = pathname === "/feed" || pathname?.startsWith("/feed/");

  return (
    // 3열 그리드(1fr · auto · 1fr): 좌우 열 폭이 항상 같아서 가운데 탭이 화면 정중앙에 온다.
    // 예전 flex(로고 · flex-1 탭 · 아이콘들)는 로고와 우측 아이콘 폭이 달라서 탭이 오른쪽으로
    // 치우쳐 보였다(2026-09-23 제보).
    <header
      className={`sticky top-0 z-40 grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b px-3 md:hidden ${
        isFeed
          ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1c1c1e]"
          : "border-box-gray bg-main-gray"
      }`}
    >
      <Link href="/feed" className="justify-self-start text-sm font-bold text-gray-900 dark:text-gray-100">
        Compmusic
      </Link>

      <nav className="flex h-full items-center gap-1">
        {FEED_TABS.map((tab) => {
          const isActive = pathname === "/feed" && activeFeedTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/feed?feed=${tab.value}`}
              onClick={() => beginThemeTransitionWithSound(tab.value === "complex")}
              className={`flex h-full items-center gap-1 border-b-2 px-3 text-xs font-bold transition ${
                isActive
                  ? tab.value === "complex"
                    ? "border-violet-500 text-violet-600 dark:text-violet-300"
                    : "border-demo-gold text-demo-gold"
                  : isFeed
                    ? "border-transparent text-gray-400"
                    : "border-transparent text-black"
              }`}
            >
              <tab.Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Help가 하단 탭(BottomNav)에서 빠지면서(2026-09, 사용자 요청 — 하단 탭 맨 앞은
          "홈"이어야 해서 자리 재배치) 모바일에서 갈 곳이 없어지지 않도록 여기로 옮겨왔다. */}
      <div className="flex items-center gap-2 justify-self-end">
        <Link
          href="/help"
          aria-label="피드백"
          className={`relative shrink-0 ${isFeed ? "text-gray-500 dark:text-gray-400" : "text-black"}`}
        >
          <FeedbackIcon className="h-5 w-5" />
          {updatesUnseen && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />}
        </Link>
        <NotificationsMenu userId={currentUserId} isFeed={isFeed} compact />
      </div>
    </header>
  );
}
