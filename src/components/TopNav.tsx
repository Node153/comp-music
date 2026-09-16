"use client";

// 데스크톱 웹 기준 상단바 — 이제 DEMO/memo 피드 탭만 남는다(2026-09-16, 사용자 요청 —
// "탭을 제외하고 메뉴들 왼쪽 사이드바로 이동, 인스타처럼 구성"). 로고/검색/Drop(업로드)/
// Chat(메시지)/Alerts(알림)/Help/Me는 전부 NavSidebar로 옮겼다. 모바일(md 미만)에서는
// MobileTopBar+BottomNav가 그대로 대신 노출됨(변경 없음).
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { beginThemeTransitionWithSound } from "@/lib/theme";

// 전체공개(Demo, 노출시간 영구·설정불가) / 비공개(Complex, 노출시간 설정 필수 — 팔로워공개 또는
// 특정인 초대) 두 피드 탭.
// 아직 UI만 있고 실제 필터링·업로드 연동은 데이터 연결 단계에서 진행 예정.
const FEED_TABS = [
  { value: "completion", label: "DEMO", icon: "☀" },
  { value: "complex", label: "memo", icon: "☾" },
];

export function TopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";
  // 피드(/feed)는 캔버스가 흰색(PageCanvas)이라 흰 상단바가 자연스럽지만, 그 외 화면(업로드·
  // 프로필 등)은 캔버스가 그레이(canvas-gray)라 흰 상단바만 붕 떠 보였다(사용자 제보). 캔버스 위
  // 최상위 박스는 main-gray를 쓴다는 그레이 컬러 시스템 규칙(globals.css)을 상단바에도 맞춘다.
  const isFeed = pathname === "/feed" || pathname?.startsWith("/feed/");

  return (
    <header
      className={`sticky top-0 z-30 hidden h-14 items-center justify-center gap-2 border-b px-4 md:flex ${
        isFeed
          ? "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#1c1c1e]"
          : "border-box-gray bg-main-gray"
      }`}
    >
      <nav className="flex h-full items-center gap-1">
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
                  : "Companion 공개 게시물 · 노출 시간 설정 필수"
              }
              className={`flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-bold transition ${
                isActive
                  ? tab.value === "complex"
                    ? "border-violet-500 text-violet-600 dark:text-violet-300"
                    : "border-demo-gold text-demo-gold"
                  : isFeed
                    ? "border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
                    : "border-transparent text-black hover:bg-box-gray/40"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
