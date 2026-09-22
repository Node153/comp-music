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
// 피드(홈)는 한 번 하단 탭에서 뺀 적 있는데(예전 사용자 요청, 상단 MobileTopBar의
// 로고/DEMO·memo 탭으로 이동) 이번에 다시 하단 탭 맨 앞에 추가 — 상단 바 방식은 유지하고
// 하단 탭도 겸용.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { useNotificationCount } from "@/components/NotificationCountContext";
import { HomeIcon, SearchIcon, MailIcon, PlusIcon, UserIcon } from "@/components/icons";

const itemClass = (active: boolean) =>
  `relative flex flex-col items-center gap-0.5 text-xs ${active ? "opacity-100" : "opacity-60"}`;

export function BottomNav({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const search = useSearchOverlay();
  const unseenNotifications = useNotificationCount();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-white/10 bg-[#1c1c1e]/80 text-white backdrop-blur md:hidden">
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
    </nav>
  );
}
