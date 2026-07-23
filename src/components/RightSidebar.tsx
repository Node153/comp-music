// 데스크톱 우측 사이드바 — Discord 접속자 리스트 참고. 페이스북 카드형 박스 대신
// 아바타+이름 한 줄로 축약해서 위계를 낮춘다.
// 아직 실시간 로직이 없어 목업 데이터로 자리만 잡아둔 상태 — 실제 API 연동은 이후 작업.
import Link from "next/link";
import { SidebarChatPanel } from "@/components/SidebarChatPanel";

const MOCK_ONLINE = [
  { name: "정하늘", meta: "베이스" },
  { name: "오세준", meta: "기타" },
  { name: "한지민", meta: "작곡" },
];

// 실시간 PEAK 게시물 = 지금 핫한 게시물(좋아요+댓글 합이 PEAK_THRESHOLD를 넘은 게시물).
// postId는 feed/page.tsx의 COMPLETION_MOCK_SAMPLES와 같은 값 — 클릭하면 해당 게시물로 이동(#앵커).
const MOCK_PEAK_POSTS = [
  {
    postId: "mock-completion-3",
    name: "한지민",
    caption: "합주 영상 반응이 심상치 않아요",
    publishedAgo: "5시간 전",
    emoji: "🔥",
  },
  {
    postId: "mock-completion-2",
    name: "오세준",
    caption: "즉흥 세션 녹화했어요",
    publishedAgo: "1일 전",
    emoji: "🎸",
  },
  {
    postId: "mock-completion-8",
    name: "강태오",
    caption: "베이스 솔로 챌린지 영상",
    publishedAgo: "1일 전",
    emoji: "🎸",
  },
];

export function RightSidebar() {
  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-4 md:flex">
      <section>
        <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          실시간 PEAK
        </h2>
        <div className="mt-1 flex flex-col gap-1">
          {MOCK_PEAK_POSTS.map((post, i) => (
            <Link
              key={post.postId}
              href={`/feed?feed=completion#${post.postId}`}
              style={{ animationDelay: `${i * 100}ms` }}
              className="animate-peak-in flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-2 py-1.5 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:hover:bg-red-950/50"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs dark:bg-black/30">
                {post.emoji}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm text-gray-700 dark:text-gray-200">{post.name}</span>
                  <span className="shrink-0 text-[10px] font-bold text-red-500">🔥 PEAK</span>
                </div>
                <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {post.publishedAgo}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          접속 중 · {MOCK_ONLINE.length}
        </h2>
        <div
          className="mt-1.5 flex items-center px-2"
          title={`${MOCK_ONLINE.map((p) => `${p.name}(${p.meta})`).join(", ")} — 실시간 접속 상태는 준비 중이에요`}
        >
          {MOCK_ONLINE.map((person, i) => (
            <span
              key={person.name}
              style={{ zIndex: MOCK_ONLINE.length - i, marginLeft: i === 0 ? 0 : "-0.5rem" }}
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[10px] font-semibold text-gray-500 dark:border-black dark:bg-gray-800 dark:text-gray-400"
            >
              {person.name.slice(0, 1)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500 dark:border-black" />
            </span>
          ))}
          <span className="ml-2 truncate text-xs text-gray-400">지금 {MOCK_ONLINE.length}명 활동 중</span>
        </div>
      </section>

      <SidebarChatPanel />
    </aside>
  );
}
