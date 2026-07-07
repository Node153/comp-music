import Link from "next/link";

// 데스크톱 좌측 사이드바(페이스북 참고). 즐겨찾기/최근 활동 등 일부 항목은
// 아직 기능이 없는 자리표시 UI — 사용자 요청에 따라 구조부터 먼저 잡아둔 상태.
const SHORTCUTS = (userId: string) => [
  { href: `/profile/${userId}`, label: "내 프로필", icon: "👤", active: true },
  { href: "/profile/manage", label: "게시물 관리", icon: "🎞️", active: true },
  { href: `/profile/${userId}/follows?tab=following`, label: "팔로잉", icon: "🤝", active: true },
  { href: "#", label: "저장한 게시물", icon: "🔖", active: false },
  { href: "#", label: "즐겨찾는 아티스트", icon: "⭐", active: false },
  { href: "#", label: "최근 본 게시물", icon: "🕘", active: false },
];

export function LeftSidebar({ userId, userName }: { userId: string; userName: string }) {
  const shortcuts = SHORTCUTS(userId);

  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-1 md:flex">
      <Link
        href={`/profile/${userId}`}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-gray-200/60"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
          {userName.slice(0, 1)}
        </span>
        <span className="text-sm font-semibold text-gray-900">{userName}</span>
      </Link>

      <div className="mt-2 flex flex-col gap-0.5">
        {shortcuts.map((item) =>
          item.active ? (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-700 transition hover:bg-gray-200/60"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-base">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              className="flex cursor-default items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-400"
              title="준비 중인 기능이에요"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-base opacity-60">
                {item.icon}
              </span>
              {item.label}
            </span>
          ),
        )}
      </div>
    </aside>
  );
}
