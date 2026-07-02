// S6 메인 피드 (FEED-05~09) — 풀스크린 세로 스와이프, 활성 게시물만(status='published')
// Phase 0: 필터(S7)·검색(S19) 없음, 최신순만 (1.4)
export default function FeedPage() {
  return (
    <main className="flex h-screen w-full snap-y snap-mandatory flex-col overflow-y-scroll">
      {/* TODO: posts where status='published' order by published_at desc, 무한스크롤 */}
      <section className="flex h-screen w-full snap-start items-center justify-center bg-black text-white">
        <p className="text-sm text-gray-400">아직 게시물이 없습니다</p>
      </section>
    </main>
  );
}
