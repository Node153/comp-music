"use client";

// 로그인 전 방문자용 상단바(TopNav 게스트 버전) — /feed DEMO 미리보기 전용(0024).
// 로고+피드탭은 TopNav와 동일하게 두고, Drop/Chat/Alerts/Me/Help 클러스터 대신
// 로그인/가입하기 링크만 보여준다. memo 탭을 눌러도 feed/page.tsx가 자물쇠 화면으로
// 막아주니 여기서 탭 자체를 숨기거나 막을 필요는 없다 — 오히려 눌러보게 두는 게
// "가입하면 이것도 볼 수 있다"는 유인이 된다.
// 2026-09-23(사용자 요청) — 예전엔 md:flex라 모바일에서 이 바 자체가 아예 안 보였다(로그인
// 유저용 MobileTopBar/BottomNav도 게스트 화면엔 안 붙어서 모바일 게스트는 상하단 UI가
// 하나도 없이 콘텐츠만 덩그러니 스크롤됐음). 좁은 화면에서도 한 줄에 다 들어가게 패딩만
// 줄이고 "Compmusic" 글자는 sm 미만에서 숨긴다(로고만 남김).
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { beginThemeTransitionWithSound } from "@/lib/theme";
import { SunIcon, MoonIcon } from "@/components/icons";

const FEED_TABS = [
  { value: "completion", label: "DEMO", Icon: SunIcon },
  { value: "complex", label: "memo", Icon: MoonIcon },
];

export function GuestTopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-gray-200 bg-white px-2 dark:border-gray-800 dark:bg-[#1c1c1e] sm:gap-2 sm:px-4">
      <div className="flex flex-1 items-center gap-2">
        <Link href="/feed" className="flex shrink-0 items-center gap-2">
          <img
            src="/brand-cat.png"
            alt="Compmusic"
            className="h-9 w-9 rounded-full object-cover"
          />
          <span className="hidden text-lg font-bold text-gray-900 dark:text-gray-100 sm:inline">Compmusic</span>
        </Link>
      </div>

      <nav className="flex h-full items-center">
        {FEED_TABS.map((tab) => {
          const isActive = pathname === "/feed" && activeFeedTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/feed?feed=${tab.value}`}
              onClick={() => beginThemeTransitionWithSound(tab.value === "complex")}
              title={
                tab.value === "completion"
                  ? "전체공개 게시물 · 노출 시간 영구"
                  : "가입하고 Companion을 만들면 볼 수 있어요"
              }
              className={`flex h-full shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-1.5 text-xs font-bold transition sm:gap-1.5 sm:px-4 sm:text-sm ${
                isActive
                  ? tab.value === "complex"
                    ? "border-violet-500 text-violet-600 dark:text-violet-300"
                    : "border-demo-gold text-demo-gold"
                  : "border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              <tab.Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
        <Link
          href="/login"
          className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 sm:px-3.5 sm:text-sm"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-black px-2 text-xs font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black sm:px-3.5 sm:text-sm dark:hover:bg-gray-200"
        >
          가입하기
        </Link>
      </div>
    </header>
  );
}
