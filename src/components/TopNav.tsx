"use client";

// 데스크톱 웹 기준 상단 네비게이션(페이스북 참고). 모바일(md 미만)에서는 BottomNav가 대신 노출됨.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

const TABS = [
  { href: "/feed", label: "피드", icon: "🏠" },
  { href: "/messages", label: "메시지", icon: "✉️" },
  { href: "/upload", label: "업로드", icon: "➕" },
];

export function TopNav({
  currentUserId,
  unseenNotifications = 0,
}: {
  currentUserId: string;
  unseenNotifications?: number;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:flex">
      <Link href="/feed" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm text-white">
          🎵
        </span>
        <span className="text-lg font-bold text-gray-900">음악넷</span>
      </Link>

      <nav className="flex h-full items-center gap-1">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex h-full w-24 items-center justify-center border-b-2 text-xl transition ${
                isActive
                  ? "border-black text-gray-900"
                  : "border-transparent text-gray-400 hover:bg-gray-50"
              }`}
            >
              {tab.icon}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <Link href={`/profile/${currentUserId}`} className="relative">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
            👤
          </span>
          {unseenNotifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
              {unseenNotifications}
            </span>
          )}
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
