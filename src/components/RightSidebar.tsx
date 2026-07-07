// 데스크톱 우측 사이드바(페이스북 "친구 추천/연락처" 참고).
// 아직 추천 로직이 없어 목업 데이터로 자리만 잡아둔 상태 — 실제 추천/온라인 상태 API 연동은 이후 작업.
const MOCK_SUGGESTIONS = [
  { name: "김도윤", meta: "서울대 · 작곡" },
  { name: "이서연", meta: "한예종 · 보컬" },
  { name: "박지훈", meta: "활동자 · 드럼" },
  { name: "최민아", meta: "경희대 · 피아노" },
];

export function RightSidebar() {
  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-4 md:flex">
      <section>
        <h2 className="px-2 text-sm font-semibold text-gray-500">추천 크리에이터</h2>
        <div className="mt-1 flex flex-col gap-0.5">
          {MOCK_SUGGESTIONS.map((person) => (
            <div
              key={person.name}
              className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-70"
              title="추천 기능은 준비 중이에요"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500">
                {person.name.slice(0, 1)}
              </span>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-gray-800">{person.name}</span>
                <span className="truncate text-xs text-gray-500">{person.meta}</span>
              </div>
              <span className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600">
                팔로우
              </span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
