"use client";

// 데스크톱 웹 기준 상단 네비게이션(페이스북 참고). 모바일(md 미만)에서는 BottomNav가 대신 노출됨.
// 좌: 로고+검색(장식용, SEARCH는 Phase1) · 중앙: 홈 탭 · 우: 업로드/메시지/알림 아이콘 클러스터 + 프로필 메뉴
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileMenu } from "@/components/ProfileMenu";

const ICON_ACTIONS = [
  { href: "/upload", label: "업로드", icon: "➕" },
  { href: "/messages", label: "메시지", icon: "✉️" },
];

export function TopNav({
  currentUserId,
  userName,
  unseenNotifications = 0,
}: {
  currentUserId: string;
  userName: string;
  unseenNotifications?: number;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 md:flex">
      <div className="flex flex-1 items-center gap-2">
        <Link href="/feed" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm text-white">
            🎵
          </span>
          <span className="text-lg font-bold text-gray-900">음악넷</span>
        </Link>
        <div className="relative ml-2 hidden lg:block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="음악넷 검색"
            disabled
            title="검색 기능은 준비 중이에요"
            className="w-60 rounded-full bg-gray-100 py-2 pl-9 pr-4 text-sm text-gray-600 placeholder:text-gray-400 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <nav className="flex h-full items-center">
        <Link
          href="/feed"
          className={`flex h-full w-24 items-center justify-center border-b-2 text-2xl transition ${
            pathname === "/feed"
              ? "border-black text-gray-900"
              : "border-transparent text-gray-400 hover:bg-gray-50"
          }`}
        >
          🏠
        </Link>
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2">
        {ICON_ACTIONS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition ${
                isActive ? "bg-gray-200 text-gray-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {item.icon}
            </Link>
          );
        })}
        <Link
          href={`/profile/${currentUserId}`}
          title="알림"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-base text-gray-600 transition hover:bg-gray-200"
        >
          🔔
          {unseenNotifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
              {unseenNotifications}
            </span>
          )}
        </Link>
        <ProfileMenu userId={currentUserId} userName={userName} />
      </div>
    </header>
  );
}
