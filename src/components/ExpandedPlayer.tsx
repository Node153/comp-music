"use client";

// 사운드클라우드의 "미니플레이어 탭 → 풀스크린 플레이어" 참고(2026-09-23, 사용자 요청 —
// 실제 사운드클라우드 화면 녹화를 보여주며 이 인터랙션 추가 요청). GlobalPlayerBar의 커버·
// 제목 영역을 탭하면 이 풀스크린 뷰가 뜨고, 우상단 ⌄로 다시 접는다. 파형(bars)·재생 상태는
// GlobalPlayerBar가 이미 계산해둔 값을 그대로 props로 받아써서, 이 컴포넌트가 따로 파형을
// 다시 분석하거나 <video>를 새로 붙잡지 않는다(재생 엘리먼트는 앱 전체에 하나뿐이어야 함).
// 좋아요·댓글은 실제 게시물(track.id = posts.id)에 연결 — 열릴 때만 가볍게 카운트를 조회한다
// (피드 카드처럼 서버에서 미리 내려주는 초기값이 없어서, 여기선 클라이언트에서 직접 조회).
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { useScrub } from "@/lib/useScrub";
import type { NowPlayingTrack } from "@/components/NowPlayingContext";
import { PostEngagementProvider } from "@/components/PostEngagementContext";
import { LikeButton } from "@/app/(app)/feed/LikeButton";
import { CommentPanel } from "@/app/(app)/feed/CommentPanel";
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ChevronDownIcon,
  ListIcon,
  HeadphonesIcon,
} from "@/components/icons";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExpandedPlayer({
  track,
  isPlaying,
  toggle,
  playPrev,
  playNext,
  hasPrev,
  hasNext,
  bars,
  playedBarCount,
  playedColor,
  unplayedBarColor,
  playheadColor,
  pct,
  scrubHandlers,
  progress,
  duration,
  onClose,
  hasPanel,
  queueOpen,
  toggleQueue,
}: {
  track: NowPlayingTrack;
  isPlaying: boolean;
  toggle: () => void;
  playPrev: () => boolean;
  playNext: () => boolean;
  hasPrev: boolean;
  hasNext: boolean;
  bars: number[];
  playedBarCount: number;
  playedColor: (v: number) => string;
  unplayedBarColor: string;
  playheadColor: string;
  pct: number;
  scrubHandlers: ReturnType<typeof useScrub>["scrubHandlers"];
  progress: number;
  duration: number;
  onClose: () => void;
  hasPanel: boolean;
  queueOpen: boolean;
  toggleQueue: () => void;
}) {
  // 좋아요/댓글 수·내 좋아요 여부 — 피드 카드와 달리 서버에서 미리 내려주는 초기값이 없어서
  // 풀스크린 플레이어가 열릴 때 트랙(post) id 기준으로 딱 한 번 조회한다.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<{
    likeCount: number;
    commentCount: number;
    liked: boolean;
  } | null>(null);

  useEffect(() => {
    setEngagement(null);
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setCurrentUserId(user.id);
      const [likeCountRes, commentCountRes, likedRes] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", track.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", track.id),
        supabase
          .from("likes")
          .select("post_id")
          .eq("post_id", track.id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setEngagement({
        likeCount: likeCountRes.count ?? 0,
        commentCount: commentCountRes.count ?? 0,
        liked: !!likedRes.data,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [track.id]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      {/* 배경 — 커버 아트를 풀블리드로 깔고 위아래 그라데이션으로 어둡게(사운드클라우드 참고).
          커버가 없는(영상만 있는) 트랙은 헤드폰 아이콘 + 어두운 그라데이션으로 대체. */}
      <div className="absolute inset-0">
        {track.posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.posterSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-gray-800 to-black">
            <HeadphonesIcon className="h-16 w-16 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black" />
      </div>

      <div className="relative flex h-full flex-col pt-[env(safe-area-inset-top,0px)]">
        {/* 상단바 — 곡 정보 + 접기 */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{track.title}</p>
            <p className="truncate text-xs text-white/60">{track.author}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="플레이어 접기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <ChevronDownIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 가운데 여백 — 배경 커버 아트가 그대로 보이는 영역 */}
        <div className="flex-1" />

        {/* 파형(탐색) + 시간 */}
        <div className="px-4">
          <button
            {...scrubHandlers}
            className="relative flex h-16 w-full touch-none items-center gap-px disabled:cursor-default"
            aria-label="탐색 바 (파형)"
          >
            {bars.map((v, i) => (
              <span
                key={i}
                className="w-full flex-1 rounded-[1px]"
                style={{
                  height: `${Math.max(6, v * 100)}%`,
                  background: i < playedBarCount ? playedColor(v) : unplayedBarColor,
                }}
              />
            ))}
            <span
              className="pointer-events-none absolute top-0 h-full w-px"
              style={{ left: `${pct}%`, background: playheadColor }}
            />
          </button>
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/60">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 트랜스포트 */}
        <div className="mt-5 flex items-center justify-center gap-8 px-4">
          <button
            onClick={() => playPrev()}
            disabled={!hasPrev}
            aria-label="이전 곡"
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <SkipBackIcon className="h-5 w-5" />
          </button>
          <button
            onClick={toggle}
            aria-label={isPlaying ? "일시정지" : "재생"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition hover:opacity-90"
          >
            {isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
          </button>
          <button
            onClick={() => playNext()}
            disabled={!hasNext}
            aria-label="다음 곡"
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <SkipForwardIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 액션 바 — 좋아요·댓글·대기열(공유/더보기는 아직 없어서 넣지 않음) */}
        <div className="mt-5 flex items-center justify-around border-t border-white/10 px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          {currentUserId && engagement ? (
            <PostEngagementProvider
              initialLikeCount={engagement.likeCount}
              initialCommentCount={engagement.commentCount}
              initialWeeklyLikeCount={0}
              initialLiked={engagement.liked}
              peakThreshold={0}
            >
              <LikeButton postId={track.id} userId={currentUserId} />
              <CommentPanel postId={track.id} userId={currentUserId} />
            </PostEngagementProvider>
          ) : (
            <>
              <span className="h-5 w-9" />
              <span className="h-5 w-9" />
            </>
          )}
          <button
            onClick={toggleQueue}
            disabled={!hasPanel}
            aria-label="재생 대기열"
            aria-pressed={queueOpen}
            className="inline-flex items-center gap-1 text-base font-semibold text-gray-300 transition hover:text-white disabled:opacity-30"
          >
            <ListIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
