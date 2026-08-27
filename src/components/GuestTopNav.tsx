"use client";

// 로그인 전 방문자용 상단바(TopNav 게스트 버전) — /feed DEMO 미리보기 전용(0024).
// 로고+피드탭은 TopNav와 동일하게 두고, Drop/Chat/Alerts/Me/Help 클러스터 대신
// 로그인/가입하기 링크만 보여준다. memo 탭을 눌러도 feed/page.tsx가 자물쇠 화면으로
// 막아주니 여기서 탭 자체를 숨기거나 막을 필요는 없다 — 오히려 눌러보게 두는 게
// "가입하면 이것도 볼 수 있다"는 유인이 된다.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const FEED_TABS = [
  { value: "completion", label: "DEMO", icon: "☀" },
  { value: "complex", label: "memo", icon: "☾" },
];

export function GuestTopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFeedTab = searchParams.get("feed") ?? "completion";

  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-[#1c1c1e] md:flex">
      <div className="flex flex-1 items-center gap-2">
        <Link href="/feed" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-xs font-bold text-white dark:bg-white dark:text-black">
            Comp
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Comp</span>
        </Link>
      </div>

      <nav className="flex h-full items-center gap-1">
        {FEED_TABS.map((tab) => {
          const isActive = pathname === "/feed" && activeFeedTab === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/feed?feed=${tab.value}`}
              title={
                tab.value === "completion"
                  ? "전체공개 게시물 · 노출 시간 영구"
                  : "가입하고 Companion을 만들면 볼 수 있어요"
              }
              className={`flex h-full items-center gap-1.5 border-b-2 px-4 text-sm font-bold transition ${
                isActive
                  ? tab.value === "complex"
                    ? "border-violet-500 text-violet-600 dark:text-violet-300"
                    : "border-demo-gold text-demo-gold"
                  : "border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2">
        <Link
          href="/login"
          className="flex h-9 items-center rounded-full px-3.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          로그인
        </Link>
        <Link
          href="/signup"
          className="flex h-9 items-center rounded-full bg-black px-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          가입하기
        </Link>
      </div>
    </header>
  );
}
