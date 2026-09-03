"use client";

// 승인된 사용자 화면 전반(S6/S8/S9/S12)에서 공통으로 쓰는 하단 탭바.
// 미승인/가입/관리자 화면에서는 노출하지 않는다 ((app) 라우트 그룹의 layout에서만 렌더링).
// "검색"만 페이지 이동이 아니라 오버레이를 여는 버튼 — /goal 검색 UX 논의 참고
// (SearchOverlay.tsx 주석).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { useNotificationCount } from "@/components/NotificationCountContext";
import { HomeIcon, SearchIcon, MailIcon, PlusIcon, UserIcon } from "@/components/icons";

const TABS = (currentUserId: string) => [
  { href: "/feed", label: "피드", Icon: HomeIcon },
  { href: "/messages", label: "메시지", Icon: MailIcon },
  { href: "/upload", label: "업로드", Icon: PlusIcon },
  { href: `/profile/${currentUserId}`, label: "프로필", Icon: UserIcon },
];

export function BottomNav({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const search = useSearchOverlay();
  const unseenNotifications = useNotificationCount();
  const tabs = TABS(currentUserId);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-white/10 bg-[#1c1c1e]/80 text-white backdrop-blur md:hidden">
      <Link
        href="/feed"
        className={`relative flex flex-col items-center gap-0.5 text-xs ${pathname === "/feed" ? "opacity-100" : "opacity-60"}`}
      >
        <HomeIcon className="h-5 w-5" />
        피드
      </Link>
      <button
        type="button"
        onClick={search.open}
        className={`relative flex flex-col items-center gap-0.5 text-xs ${search.isOpen ? "opacity-100" : "opacity-60"}`}
      >
        <SearchIcon className="h-5 w-5" />
        검색
      </button>
      {tabs.slice(1).map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const isProfileTab = tab.href.startsWith("/profile/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center gap-0.5 text-xs ${isActive ? "opacity-100" : "opacity-60"}`}
          >
            <tab.Icon className="h-5 w-5" />
            {tab.label}
            {isProfileTab && unseenNotifications > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px]">
                {unseenNotifications}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
