"use client";

// 모바일(md 미만) 전용 상단바. TopNav는 md 이상에서만 보이는데(hidden md:flex), 그동안
// 모바일에는 알림(/notifications)·DEMO/memo 피드 전환으로 갈 방법이 BottomNav 5탭
// (피드/검색/메시지/업로드/프로필) 어디에도 없었다 — 안읽음 뱃지만 프로필 탭에 얹혀있어서
// 눌러도 알림함으로 못 갔다. 인스타/디스코드처럼 모바일에서도 항상 떠 있는 얇은 바 하나로
// 이 두 가지(피드 전환·알림)만 보충한다. 검색/DM/업로드는 이미 BottomNav에 있어 여기 안 넣음.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BellIcon } from "@/components/icons";

const FEED_TABS = [
  { value: "completion", label: "DEMO", icon: "☀" },
  { value: "complex", label: "memo", icon: "☾" },
];

export function MobileTopBar({ unseenNotifications = 0 }: { unseenNotifications?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-[#1c1c1e] md:hidden">
      <Link href="/feed" className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">
        Comp
      </Link>

      <nav className="flex flex-1 items-center justify-center gap-1">
        {FEED_TABS.map((tab) => {
          const isActive = pathname === "/feed" && activeFeedTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/feed?feed=${tab.value}`}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                isActive
                  ? tab.value === "complex"
                    ? "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                    : "bg-demo-gold/15 text-demo-gold"
                  : "text-gray-400"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/notifications"
        aria-label="알림"
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          pathname === "/notifications"
            ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        <BellIcon className="h-5 w-5" />
        {unseenNotifications > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {unseenNotifications}
          </span>
        )}
      </Link>
    </header>
  );
}
