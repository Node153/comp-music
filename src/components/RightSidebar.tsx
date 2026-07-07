import { VolumeBar } from "@/components/VolumeBar";

// 데스크톱 우측 사이드바(페이스북 "친구 추천/연락처" 참고).
// 아직 추천·접속상태 로직이 없어 목업 데이터로 자리만 잡아둔 상태 — 실제 추천/온라인 상태 API 연동은 이후 작업.
const ONLINE_VOLUME_MAX = 8; // 이 인원 이상 접속하면 볼륨 바가 가득 참

const MOCK_SUGGESTIONS = [
  { name: "김도윤", meta: "서울대 · 작곡" },
  { name: "이서연", meta: "한예종 · 보컬" },
  { name: "박지훈", meta: "활동자 · 드럼" },
  { name: "최민아", meta: "경희대 · 피아노" },
];

const MOCK_ONLINE = [
  { name: "정하늘", meta: "베이스" },
  { name: "오세준", meta: "기타" },
  { name: "한지민", meta: "작곡" },
];

// 실시간 PEAK 게시물 = 지금 핫한 게시물(좋아요+댓글이 많이 몰리는 게시물). 피드의 샘플 게시물과 연결되는 목업.
const MOCK_PEAK_POSTS = [
  {
    name: "한지민",
    caption: "합주 영상 반응이 심상치 않아요",
    likes: 48,
    comments: 21,
    emoji: "🔥",
    gradient: "from-rose-600 to-orange-500",
  },
  {
    name: "오세준",
    caption: "즉흥 세션 녹화했어요",
    likes: 15,
    comments: 6,
    emoji: "🎸",
    gradient: "from-indigo-600 to-purple-700",
  },
];

export function RightSidebar() {
  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-5 md:flex">
      <section>
        <div className="flex items-center gap-1.5 px-2">
          <h2 className="text-sm font-semibold text-gray-500">🔥 실시간 PEAK 게시물</h2>
          <span
            className="cursor-help text-xs text-gray-400"
            title="PEAK 게시물 = 지금 핫한 게시물 (좋아요·댓글이 많이 몰린 게시물)"
          >
            ⓘ
          </span>
        </div>
        <div className="mt-1 flex flex-col gap-1" title="실시간 집계 기능은 준비 중이에요">
          {MOCK_PEAK_POSTS.map((post) => (
            <div
              key={post.name}
              className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-80 transition hover:bg-gray-200/60"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-lg ${post.gradient}`}
              >
                {post.emoji}
              </span>
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-gray-800">{post.name}</span>
                  <span className="shrink-0 rounded bg-red-600 px-1 text-[9px] font-extrabold text-white">
                    PEAK
                  </span>
                </div>
                <span className="truncate text-xs text-gray-500">{post.caption}</span>
              </div>
              <span className="shrink-0 text-xs text-gray-400">
                ❤️{post.likes} 💬{post.comments}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold text-gray-500">추천 크리에이터</h2>
          <div className="flex items-center gap-1 text-gray-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-gray-200/60">
              🔍
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-gray-200/60">
              ⋯
            </span>
          </div>
        </div>
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

      <section>
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold text-gray-500">접속 중인 Companion</h2>
          <VolumeBar level={MOCK_ONLINE.length / ONLINE_VOLUME_MAX} />
        </div>
        <div className="mt-1 flex flex-col gap-0.5" title="실시간 접속 상태는 준비 중이에요">
          {MOCK_ONLINE.map((person) => (
            <div
              key={person.name}
              className="flex cursor-default items-center gap-3 rounded-lg px-2 py-1.5 opacity-70 transition hover:bg-gray-200/60"
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-500">
                {person.name.slice(0, 1)}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </span>
              <span className="flex-1 truncate text-sm text-gray-700">{person.name}</span>
              <span className="truncate text-xs text-gray-400">{person.meta}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
