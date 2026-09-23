"use client";

// 승인된 사용자 화면 전반(S6/S8/S9/S12)에서 공통으로 쓰는 하단 탭바.
// 미승인/가입/관리자 화면에서는 노출하지 않는다 ((app) 라우트 그룹의 layout에서만 렌더링).
// 순서: 홈 · 검색 · 업로드(가운데) · 메시지 · 프로필(2026-09, 사용자 요청 — 인스타/스레드처럼
// 하단 탭 맨 왼쪽은 항상 "홈"이어야 하는데 우리는 그 자리가 검색이었다). 인스타/스레드
// 순서(홈·검색·만들기·활동·프로필)에 맞춰 업로드를 가운데로 오게 재배치.
// Help는 레퍼런스 3곳(인스타/스레드/페이스북) 다 하단 탭에 상시 노출 안 하는 유틸리티
// 성격이라 하단 탭에서 빼고 상단바(MobileTopBar)로 옮겼다 — 5탭 유지.
// "검색"만 페이지 이동이 아니라 오버레이를 여는 버튼 — /goal 검색 UX 논의 참고
// (SearchOverlay.tsx 주석).
// 2026-09-23: "홈" 탭을 뺐다가(MobileTopBar 로고 중복 이유) 그 자리에 사운드바 접기/펼치기
// "재생목록" 토글을 넣은 적이 있는데, 같은 날 둘 다 사용자 요청으로 되돌렸다 — 홈은 다시
// 맨 앞으로, 재생목록 토글은 제거(그 유일한 진입점이 없어지면 GlobalPlayerBar의 접힘 상태
// 자체가 켜질 방법이 없어져서, 관련 코드까지 함께 정리했다 — NowPlayingContext.tsx 참고).
// 배경색은 GlobalPlayerBar와 완전히 같은 기준(ThemeSync와 동일한 pathname + ?feed=complex)으로
// 지금 보고 있는 사이트 테마를 따른다(2026-09-23 사용자 요청 — DEMO/memo 배경과 동일하게):
// memo 탭이면 #1c1c1e 다크, 그 외(DEMO 포함)는 demo-bg 라이트. 바로 위 사운드바와 한 덩어리로
// 이어져 보이고, 탭 전환 시 globals.css .theme-transition으로 같이 부드럽게 바뀐다.
import { usePathname, useSearchParams } from "next/navigation";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { useNotificationCount } from "@/components/NotificationCountContext";
import { useMessageCount } from "@/components/MessageCountContext";
import Link from "next/link";
import { HomeIcon, SearchIcon, MailIcon, PlusIcon, UserIcon } from "@/components/icons";

const itemClass = (active: boolean) =>
  `relative flex flex-col items-center gap-0.5 text-xs ${active ? "opacity-100" : "opacity-60"}`;

export function BottomNav({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = useSearchOverlay();
  const unseenNotifications = useNotificationCount();
  const unreadConversations = useMessageCount();
  const isMemoTheme = pathname === "/feed" && searchParams.get("feed") === "complex";

  return (
    <nav
      // 5등분 그리드 — justify-around는 탭마다 라벨 폭(홈/업로드 등)이 달라 가운데 "업로드"가
      // 화면 정중앙에서 어긋났다(2026-09-23 제보). 열 폭을 똑같이 나눠 각 탭을 열 가운데에 둔다.
      className={`fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 place-items-center border-t transition-colors md:hidden ${
        isMemoTheme ? "border-white/10 bg-[#1c1c1e] text-white" : "border-black/10 bg-demo-bg text-black"
      }`}
    >
      <Link href="/feed" className={itemClass(pathname === "/feed")}>
        <HomeIcon className="h-5 w-5" />
        홈
      </Link>
      <button type="button" onClick={search.open} className={itemClass(search.isOpen)}>
        <SearchIcon className="h-5 w-5" />
        검색
      </button>
      <Link href="/upload" className={itemClass(pathname === "/upload")}>
        <PlusIcon className="h-5 w-5" />
        업로드
      </Link>
      <Link href="/messages" className={itemClass(pathname.startsWith("/messages"))}>
        <MailIcon className="h-5 w-5" />
        메시지
        {unreadConversations > 0 && (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {unreadConversations}
          </span>
        )}
      </Link>
      <Link
        href={`/profile/${currentUserId}`}
        className={itemClass(pathname.startsWith("/profile/"))}
      >
        <UserIcon className="h-5 w-5" />
        프로필
        {unseenNotifications > 0 && (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {unseenNotifications}
          </span>
        )}
      </Link>
    </nav>
  );
}
