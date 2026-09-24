import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { MemoGuideCards } from "@/components/MemoGuideCards";
import { FeedHero } from "@/components/FeedHero";
import { initialFeedState } from "./feedQuery";
import { loadFeedChunk } from "./feedChunk";
import { isOneScreenFeed } from "./feedRender";
import { FeedInfiniteList } from "./FeedInfiniteList";
import { NewDropsRail } from "./NewDropsRail";

// S6 메인 피드 (FEED-05~09, INTERACT-01/02)
// 웹 기준 카드형 피드(페이스북 참고) — 영상이 화면을 꽉 채우지 않고 카드 안에 담기도록 구성.
// 2026-09-24부터 맞춤형 정렬(안 들은 글 먼저 + 게시자 섞기, feedQuery.ts) + 10개씩 무한 스크롤
// (FeedInfiniteList) — 예전엔 최근 20개만 한 번 불러와서 그보다 오래된 글은 볼 방법이 없었다.
// 카드 렌더링은 feedRender.tsx, 페이지 조립은 feedChunk.tsx(무한 스크롤 서버 액션과 공용).

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; tag?: string }>;
}) {
  const { feed: feedParam, tag: tagParam } = await searchParams;
  // Demo(전체공개, 노출영구) 기본값 · Complex(비공개, 노출시간필수 — 팔로워공개 또는 특정인 초대)는
  // 0012_complex_access_and_chat부터 실제 posts에 저장됨. visibility='public'이 demo, 그 외
  // ('followers'/'invite_only')가 Complex — 같은 posts 테이블을 이 컬럼으로 나눠서 쓴다.
  const isComplex = feedParam === "complex";

  // getCurrentUser()는 (app)/feed 레이아웃과 같은 요청 스코프 캐시 — 여기서 또 불러도
  // 실제 auth 왕복은 추가로 안 생긴다(예전엔 미들웨어 포함 요청당 4번 검증했다).
  const currentUser = await getCurrentUser();

  // 로그인 전 미리보기(Instagram 참고) — DEMO는 비로그인 방문자에게도 열지만, memo는
  // Companion 전용 공간이라 존재 형태조차 안 보여주고 완전히 잠근다(0024_public_feed_preview).
  if (isComplex && !currentUser) {
    return (
      <main className="mx-auto flex max-w-[900px] flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          memo는 아는 사람들끼리만 보는 공간이에요
        </p>
        <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">
          가입하고 Companion을 만들면 서로의 비공개 작업물을 볼 수 있어요. 미리 어떤 걸
          할 수 있는지 보여드릴게요.
        </p>
        <div className="mt-2 w-full">
          <MemoGuideCards />
        </div>
        <Link
          href="/signup"
          className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          가입하기
        </Link>
      </main>
    );
  }

  const scope = isComplex ? "memo" : "demo";
  const { nodes, next, postCount } = await loadFeedChunk(initialFeedState(scope, tagParam ?? null), true);
  const hasPosts = postCount > 0;
  const oneScreenFeed = isOneScreenFeed(currentUser);
  const feedListClass = "flex flex-col gap-4 md:gap-6";

  // DEMO 피드 상단 힐링 멘트(관리자가 /admin/feed-hero에서 편집) — 히어로가 실제로 뜰
  // 조건일 때만 조회한다.
  const showHero = !isComplex && !tagParam && hasPosts;
  const { data: heroRows } = showHero
    ? await (await createClient())
        .from("feed_hero_messages")
        .select("question, answer")
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : { data: [] as { question: string; answer: string }[] };
  const heroMessages = (heroRows ?? []).map((r) => ({ q: r.question, a: r.answer }));

  return (
    <main
      // 하단 여백 = 고정 바 클리어런스. 로그인 시에만 그 바들이 떠 있으므로(비로그인은 없음,
      // AppLayout 참고) oneScreenFeed일 때만 넉넉히 잡는다 — 데스크톱은 pageCard(공유 스타일,
      // ui/styles.ts)와 같은 md:pb-24(96px = 바 h-16/64px + 여유 32px) 기준으로 통일했다
      // (2026-09-18 수정 — 기존 md:pb-8=32px로는 바 높이(64px)를 못 가려 맨 마지막 게시물이
      // 잘려 보였다, DEMO/memo 탭 공통 문제라 여기 한 곳만 고치면 둘 다 해결됨).
      // 모바일은 이제(스냅 스크롤 제거, 2026-09-23) 일반 페이지 스크롤이라 pb-[6.25rem]
      // (100px = GlobalPlayerBar h-11/44px + BottomNav h-14/56px)로 직접 클리어런스를 준다.
      className={`mx-auto max-w-[900px] px-0 pt-0 md:px-4 md:pt-4 ${
        oneScreenFeed ? "pb-[6.25rem] md:pb-24" : "pb-24 md:pb-8"
      }`}
    >
      {!currentUser && (
        <div className="mx-3 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 md:mx-0">
          <p className="text-sm text-gray-600">
            가입하면 좋아요·Kick·댓글을 남기고, memo(비공개 공간)도 볼 수 있어요.
          </p>
          <Link
            href="/signup"
            className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            가입하기
          </Link>
        </div>
      )}
      {tagParam && (
        <div className="mx-3 mb-4 flex items-center justify-between gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 md:mx-0">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">#{tagParam}</span> 태그 게시물만 보고 있어요
          </span>
          <Link href="/feed?feed=completion" className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-900">
            필터 지우기
          </Link>
        </div>
      )}
      {!hasPosts && isComplex && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            아직 Companion의 게시물이 없어요 — memo에서는 이런 걸 할 수 있어요
          </p>
          <div className="mt-2 w-full">
            <MemoGuideCards />
          </div>
        </div>
      )}
      {!hasPosts && !isComplex && (
        <div className="flex flex-col items-center justify-center gap-2 py-24">
          <span className="text-3xl">🎬</span>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {tagParam ? `#${tagParam} 태그를 단 게시물이 아직 없어요` : "아직 게시물이 없습니다"}
          </p>
        </div>
      )}

      {/* DEMO 피드는 열자마자 게시물이 아니라 힐링 멘트가 먼저 보이도록 한 판 비운다.
          태그 필터 중일 때는(결과를 보러 온 상태) 생략. */}
      <div className={feedListClass}>
        {showHero && <FeedHero messages={heroMessages} snap={oneScreenFeed} />}
        {/* 새 글 부스트(0076) — 반응이 적은 최근 DEMO를 피드 맨 위에 모아 첫 반응을 유도. */}
        {currentUser && !isComplex && !tagParam && <NewDropsRail />}
        <FeedInfiniteList
          // 탭/태그가 바뀌면 이어 붙인 페이지를 버리고 새로 시작.
          key={`${scope}:${tagParam ?? ""}`}
          initialState={next}
          hasPosts={hasPosts}
        >
          {nodes}
        </FeedInfiniteList>
      </div>
    </main>
  );
}
