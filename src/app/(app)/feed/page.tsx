import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FeedHero } from "@/components/FeedHero";
import { UnheardPlayAll } from "@/components/UnheardPlayAll";
import { initialFeedState } from "./feedQuery";
import { loadFeedChunk } from "./feedChunk";
import { isOneScreenFeed } from "./feedRender";
import { FeedInfiniteList } from "./FeedInfiniteList";
import { NewDropsRail } from "./NewDropsRail";
import { NotifyLandingBanner } from "./NotifyLandingBanner";
import { AlbumChartSection } from "./lab/AlbumChartSection";

// S6 메인 피드 (FEED-05~09, INTERACT-01/02)
// 웹 기준 카드형 피드(페이스북 참고) — 영상이 화면을 꽉 채우지 않고 카드 안에 담기도록 구성.
// 2026-09-24부터 맞춤형 정렬(안 들은 글 먼저 + 게시자 섞기, feedQuery.ts) + 10개씩 무한 스크롤
// (FeedInfiniteList) — 예전엔 최근 20개만 한 번 불러와서 그보다 오래된 글은 볼 방법이 없었다.
// 카드 렌더링은 feedRender.tsx, 페이지 조립은 feedChunk.tsx(무한 스크롤 서버 액션과 공용).

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; tag?: string; from?: string; post?: string; lab?: string }>;
}) {
  const { feed: feedParam, tag: tagParam, from: fromParam, post: postParam, lab: labParam } = await searchParams;
  // 공유·알림 링크(post=<id>)로 들어온 글 — 맞춤 정렬 + 10개씩이라 그 글이 첫 페이지에 없을 수
  // 있어서 첫 페이지 맨 위에 고정해 보여준다(feedQuery.ts focusId). uuid가 아니면 무시.
  const focusId = postParam && /^[0-9a-f-]{36}$/i.test(postParam) ? postParam : null;
  // 2026-09-25(사용자 요청) memo 작업물 기능(시간제한·콜라보·Companion 공개·특정인 공개)을 DEMO에
  // 통합 — 이제 DEMO 피드 하나에 전체공개 글과 내가 볼 수 있는 비공개 글이 함께 뜬다(0088).
  // memo 탭(feed=complex)은 실험 기능 자리로 남아 지금은 명반 차트(0087)만 있다.
  // 예전 memo 글 링크(알림·메일의 feed=complex&post=, lab=memo)는 DEMO 피드로 넘긴다.
  const isMemoTab = feedParam === "complex";
  if (isMemoTab && (postParam || labParam === "memo")) {
    redirect(focusId ? `/feed?post=${focusId}#${focusId}` : "/feed");
  }

  // getCurrentUser()는 (app)/feed 레이아웃과 같은 요청 스코프 캐시 — 여기서 또 불러도
  // 실제 auth 왕복은 추가로 안 생긴다(예전엔 미들웨어 포함 요청당 4번 검증했다).
  const currentUser = await getCurrentUser();
  const oneScreenFeed = isOneScreenFeed(currentUser);
  // 하단 여백 = 고정 바 클리어런스. 로그인 시에만 그 바들이 떠 있으므로(비로그인은 없음,
  // AppLayout 참고) oneScreenFeed일 때만 넉넉히 잡는다 — 데스크톱은 pageCard(공유 스타일,
  // ui/styles.ts)와 같은 md:pb-24(96px = 바 h-16/64px + 여유 32px) 기준으로 통일했다
  // (2026-09-18 수정 — 기존 md:pb-8=32px로는 바 높이(64px)를 못 가려 맨 마지막 게시물이
  // 잘려 보였다 — 피드·명반 차트 공통이라 여기 한 곳에서 잡는다).
  // 모바일은 이제(스냅 스크롤 제거, 2026-09-23) 일반 페이지 스크롤이라 pb-[6.25rem]
  // (100px = GlobalPlayerBar h-11/44px + BottomNav h-14/56px)로 직접 클리어런스를 준다.
  // +env(safe-area-inset-bottom)은 2026-09-24 BottomNav 높이 조정(홈 인디케이터 여백 추가)에
  // 맞춘 것 — BottomNav.tsx 주석 참고.
  const mainClass = `mx-auto max-w-[900px] px-0 pt-0 md:px-4 md:pt-4 ${
    oneScreenFeed ? "pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:pb-24" : "pb-24 md:pb-8"
  }`;

  // memo 탭 — 명반 차트. 비로그인 방문자에게도 공개(추천은 가입 유도 팝업).
  if (isMemoTab) {
    return (
      <main className={`${mainClass} pt-4`}>
        {!currentUser && (
          <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900 md:mx-auto md:max-w-[659px]">
            <p className="text-sm text-gray-600 dark:text-gray-300">가입하면 명반을 추천하고 순위를 함께 만들 수 있어요.</p>
            <Link
              href="/signup"
              className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              가입하기
            </Link>
          </div>
        )}
        <AlbumChartSection currentUserId={currentUser?.id ?? null} />
      </main>
    );
  }

  const { nodes, next, postCount, focused } = await loadFeedChunk(
    initialFeedState(tagParam ?? null),
    true,
    tagParam ? null : focusId,
  );
  const hasPosts = postCount > 0;
  const feedListClass = "flex flex-col gap-4 md:gap-6";

  // DEMO 피드 상단 힐링 멘트(관리자가 /admin/feed-hero에서 편집) — 히어로가 실제로 뜰
  // 조건일 때만 조회한다.
  // 링크로 콕 집어 들어왔으면 힐링 멘트·PEAK 후보 목록 없이 그 글부터 바로 보여준다.
  const showHero = !tagParam && hasPosts && !focused;
  const { data: heroRows } = showHero
    ? await (await createClient())
        .from("feed_hero_messages")
        .select("question, answer")
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : { data: [] as { question: string; answer: string }[] };
  const heroMessages = (heroRows ?? []).map((r) => ({ q: r.question, a: r.answer }));

  return (
    <main className={mainClass}>
      {!currentUser && (
        <div className="mx-3 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 md:mx-0">
          <p className="text-sm text-gray-600">
            가입하면 좋아요·Kick·댓글을 남기고, Companion끼리만 보는 작업물도 볼 수 있어요.
          </p>
          <Link
            href="/signup"
            className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            가입하기
          </Link>
        </div>
      )}
      {/* 내 게시물 알림(푸시·메일·알림 패널)을 타고 들어왔을 때 — 다음 Drop 올리기 유도(0077). */}
      {currentUser && fromParam === "notify" && <NotifyLandingBanner userId={currentUser.id} />}
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
      {!hasPosts && (
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
        {showHero && (
          <FeedHero messages={heroMessages} snap={oneScreenFeed}>
            {currentUser && <UnheardPlayAll />}
          </FeedHero>
        )}
        {/* PEAK 유력 후보(0081) — PEAK 직전 DEMO를 피드 맨 위에 모아 반응을 보태도록 유도. */}
        {currentUser && !tagParam && !focused && <NewDropsRail userId={currentUser.id} />}
        <FeedInfiniteList
          // 태그가 바뀌면 이어 붙인 페이지를 버리고 새로 시작.
          key={`demo:${tagParam ?? ""}`}
          initialState={next}
          hasPosts={hasPosts}
        >
          {nodes}
        </FeedInfiniteList>
      </div>
    </main>
  );
}
