"use client";

// 피드 무한 스크롤(2026-09-24, 사용자 요청) — 첫 10개는 서버가 렌더해서 children으로 넘기고,
// 목록 끝의 센티널이 화면 근처(아래 rootMargin, 대략 카드 2장 거리)에 오면 서버 액션으로 다음
// 10개를 받아 이어 붙인다. 인스타처럼 끝에 닿기 전에 미리 불러와서 보통은 기다림이 안 보이고,
// 느릴 때만 스켈레톤이 보인다.
import { useCallback, useEffect, useRef, useState } from "react";
import { loadMoreFeed } from "./actions";
import type { FeedState } from "./feedQuery";

export function FeedInfiniteList({
  initialState,
  hasPosts,
  children,
}: {
  initialState: FeedState | null;
  hasPosts: boolean;
  children: React.ReactNode;
}) {
  const [pages, setPages] = useState<React.ReactNode[][]>([]);
  const [state, setState] = useState<FeedState | null>(initialState);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!state || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const { nodes, next } = await loadMoreFeed(state);
      if (nodes.length > 0) setPages((prev) => [...prev, nodes]);
      setState(next);
    } catch {
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !state || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "0px 0px 1600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // state가 바뀔 때마다 다시 관찰 — 한 번 불러온 뒤에도 센티널이 여전히 보이면(짧은 페이지)
    // 곧바로 이어서 불러온다.
  }, [state, failed, loadMore]);

  return (
    <>
      {children}
      {pages.flat()}
      {state && <div ref={sentinelRef} aria-hidden className="h-px" />}
      {loading && <FeedCardSkeleton />}
      {failed && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            게시물을 불러오지 못했어요 · 다시 시도
          </button>
        </div>
      )}
      {!state && hasPosts && (
        <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">모든 게시물을 확인했어요</p>
      )}
    </>
  );
}

function FeedCardSkeleton() {
  return (
    <div
      aria-label="게시물 불러오는 중"
      className="animate-pulse overflow-hidden border-y border-gray-200 bg-white md:mx-auto md:w-full md:max-w-[659px] md:rounded-2xl md:border dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="flex items-center gap-3 p-3">
        <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-2.5 w-40 rounded bg-gray-100 dark:bg-gray-900" />
        </div>
      </div>
      <div className="aspect-square w-full bg-gray-100 dark:bg-gray-900" />
      <div className="h-12" />
    </div>
  );
}
