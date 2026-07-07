import Link from "next/link";

// 데스크톱 좌측 사이드바(페이스북 참고). 즐겨찾기/최근 활동 등 일부 항목은
// 아직 기능이 없는 자리표시 UI — 사용자 요청에 따라 구조부터 먼저 잡아둔 상태.
const SHORTCUTS = (userId: string) => [
  { href: `/profile/${userId}`, label: "내 프로필", icon: "👤", color: "bg-blue-100 text-blue-600", active: true },
  { href: "/profile/manage", label: "게시물 관리", icon: "🎞️", color: "bg-purple-100 text-purple-600", active: true },
  {
    href: `/profile/${userId}/follows?tab=following`,
    label: "팔로잉",
    icon: "🤝",
    color: "bg-amber-100 text-amber-600",
    active: true,
  },
  { href: "#", label: "저장한 게시물", icon: "🔖", color: "bg-rose-100 text-rose-600", active: false },
  { href: "#", label: "즐겨찾는 아티스트", icon: "⭐", color: "bg-emerald-100 text-emerald-600", active: false },
  { href: "#", label: "최근 본 게시물", icon: "🕘", color: "bg-sky-100 text-sky-600", active: false },
];

const MOCK_GENRES = [
  { label: "재즈", color: "bg-orange-200" },
  { label: "클래식", color: "bg-indigo-200" },
  { label: "밴드", color: "bg-teal-200" },
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
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base ${item.color}`}>
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
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base opacity-50 ${item.color}`}>
                {item.icon}
              </span>
              {item.label}
            </span>
          ),
        )}
      </div>

      <div className="my-2 border-t border-gray-200" />

      <div className="flex flex-col gap-1 px-2">
        <span className="text-sm font-semibold text-gray-500">관심 장르</span>
        <div className="flex flex-col gap-0.5" title="관심 장르 기능은 준비 중이에요">
          {MOCK_GENRES.map((genre) => (
            <div
              key={genre.label}
              className="flex cursor-default items-center gap-3 rounded-lg py-1.5 text-sm text-gray-400"
            >
              <span className={`h-7 w-7 shrink-0 rounded-lg ${genre.color} opacity-60`} />
              {genre.label}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
