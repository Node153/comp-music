"use client";

// 승인된 사용자 화면 전반(S6/S8/S9/S12)에서 공통으로 쓰는 하단 탭바.
// 미승인/가입/관리자 화면에서는 노출하지 않는다 ((app) 라우트 그룹의 layout에서만 렌더링).
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = (currentUserId: string) => [
  { href: "/feed", label: "피드", icon: "🏠" },
  { href: "/messages", label: "메시지", icon: "✉️" },
  { href: "/upload", label: "업로드", icon: "➕" },
  { href: `/profile/${currentUserId}`, label: "프로필", icon: "👤" },
];

export function BottomNav({
  currentUserId,
  unseenNotifications = 0,
}: {
  currentUserId: string;
  unseenNotifications?: number;
}) {
  const pathname = usePathname();
  const tabs = TABS(currentUserId);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-white/10 bg-[#1c1c1e]/80 text-white backdrop-blur md:hidden">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/feed" ? pathname === "/feed" : pathname.startsWith(tab.href);
        const isProfileTab = tab.href.startsWith("/profile/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center gap-0.5 text-xs ${isActive ? "opacity-100" : "opacity-60"}`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
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
