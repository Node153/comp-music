"use client";

// 승인된 사용자 화면 전반(S6/S8/S9/S12)에서 공통으로 쓰는 하단 탭바.
// 미승인/가입/관리자 화면에서는 노출하지 않는다 ((app) 라우트 그룹의 layout에서만 렌더링).
// 순서: 검색 · 메시지 · 업로드(가운데) · 프로필 · Help. "검색"만 페이지 이동이 아니라
// 오버레이를 여는 버튼 — /goal 검색 UX 논의 참고(SearchOverlay.tsx 주석).
// 피드는 하단 탭에서 뺐다(사용자 요청) — 상단 MobileTopBar의 로고/DEMO·memo 탭으로 이동.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { useNotificationCount } from "@/components/NotificationCountContext";
import { SearchIcon, MailIcon, PlusIcon, UserIcon, HelpIcon } from "@/components/icons";

const itemClass = (active: boolean) =>
  `relative flex flex-col items-center gap-0.5 text-xs ${active ? "opacity-100" : "opacity-60"}`;

export function BottomNav({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const search = useSearchOverlay();
  const unseenNotifications = useNotificationCount();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-white/10 bg-[#1c1c1e]/80 text-white backdrop-blur md:hidden">
      <button type="button" onClick={search.open} className={itemClass(search.isOpen)}>
        <SearchIcon className="h-5 w-5" />
        검색
      </button>
      <Link href="/messages" className={itemClass(pathname.startsWith("/messages"))}>
        <MailIcon className="h-5 w-5" />
        메시지
      </Link>
      <Link href="/upload" className={itemClass(pathname === "/upload")}>
        <PlusIcon className="h-5 w-5" />
        업로드
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
      <Link href="/help" className={itemClass(pathname === "/help")}>
        <HelpIcon className="h-5 w-5" />
        Help
      </Link>
    </nav>
  );
}
