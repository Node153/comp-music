"use client";

// 승인된 사용자 화면 전반(S6/S8/S9/S12)에서 공통으로 쓰는 하단 탭바.
// 미승인/가입/관리자 화면에서는 노출하지 않는다 ((app) 라우트 그룹의 layout에서만 렌더링).
// 순서: 검색 · 업로드(가운데) · 메시지 · 프로필 · 재생목록(사운드바 접기/펼치기).
// Help는 레퍼런스 3곳(인스타/스레드/페이스북) 다 하단 탭에 상시 노출 안 하는 유틸리티
// 성격이라 하단 탭에서 빼고 상단바(MobileTopBar)로 옮겼다 — 5탭 유지.
// "검색"만 페이지 이동이 아니라 오버레이를 여는 버튼 — /goal 검색 UX 논의 참고
// (SearchOverlay.tsx 주석).
// 맨 왼쪽 "홈" 탭은 2026-09-23 제거(사용자 요청 — MobileTopBar의 "Compmusic" 로고가
// 이미 /feed로 가는 홈 링크라 중복이었다). 그 자리에 GlobalPlayerBar(사운드바)를
// 접고/펼치는 "재생목록" 토글을 추가했는데, 같은 날 맨 오른쪽으로 재배치하고 아이콘도
// GlobalPlayerBar의 대기열 버튼과 같은 ListIcon으로, 라벨도 접기/펼치기로 바뀌던 걸
// 고정된 "재생목록"으로 바꿨다(사용자 요청).
import { usePathname } from "next/navigation";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { useNotificationCount } from "@/components/NotificationCountContext";
import { useMessageCount } from "@/components/MessageCountContext";
import { useNowPlaying } from "@/components/NowPlayingContext";
import Link from "next/link";
import { SearchIcon, MailIcon, PlusIcon, UserIcon, ListIcon } from "@/components/icons";

const itemClass = (active: boolean) =>
  `relative flex flex-col items-center gap-0.5 text-xs ${active ? "opacity-100" : "opacity-60"}`;

export function BottomNav({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const search = useSearchOverlay();
  const unseenNotifications = useNotificationCount();
  const unreadConversations = useMessageCount();
  const { barCollapsed, toggleBarCollapsed } = useNowPlaying();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-white/10 bg-[#1c1c1e]/80 text-white backdrop-blur md:hidden">
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
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px]">
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
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px]">
            {unseenNotifications}
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={toggleBarCollapsed}
        aria-label={barCollapsed ? "사운드바 펼치기" : "사운드바 접기"}
        aria-pressed={!barCollapsed}
        className={itemClass(!barCollapsed)}
      >
        <ListIcon className="h-5 w-5" />
        재생목록
      </button>
    </nav>
  );
}
