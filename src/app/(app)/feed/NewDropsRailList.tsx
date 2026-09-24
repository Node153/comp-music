"use client";

// NewDropsRail(서버, PEAK 유력 후보)의 화면 부분 — 카드를 누르면 전역 플레이어로 바로 재생하고, 그 게시물이 지금
// 피드에 이미 그려져 있으면 그 카드로 스크롤해서 좋아요·댓글을 바로 남길 수 있게 한다.
// 재생 URL은 R2 signed URL이라 누르는 순간 /api/media/track-url에서 새로 받아온다(PlaylistContext와 같은 방식).
import { useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { HeadphonesIcon, HeartIcon, KickIcon, PlayIcon } from "@/components/icons";
import { PEAK_KICK_WEIGHT, PEAK_LIKE_WEIGHT, PEAK_VIEW_THRESHOLD } from "@/lib/feedConstants";
import { useMyWeeklyKick } from "@/lib/useMyWeeklyKick";

export type NewDrop = {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  posterSrc: string | null;
  mediaType: "audio" | "video";
  publishedAt: string;
  // PEAK 점수(peakScore) — 기준(PEAK_VIEW_THRESHOLD)에 닿으면 PEAK.
  score: number;
  myLiked: boolean;
};

// 기준 대비 %(1 단위). PEAK 직전이어도 100%로 보이지 않게 99에서 멈춘다.
function toPercent(points: number) {
  return Math.min(99, Math.floor((points / PEAK_VIEW_THRESHOLD) * 100));
}

export function NewDropsRailList({ drops, userId }: { drops: NewDrop[]; userId: string }) {
  const { play, track } = useNowPlaying();
  // 이번 주 Kick을 아직 안 썼으면 "Kick하면 +10%"로 더 큰 반응을 권한다.
  const { loaded: kickLoaded, kickedPostId } = useMyWeeklyKick(userId);
  const kickAvailable = kickLoaded && kickedPostId === null;
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function open(drop: NewDrop) {
    document.getElementById(drop.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (track?.id === drop.id) return;
    setLoadingId(drop.id);
    try {
      const res = await fetch(`/api/media/track-url?postId=${encodeURIComponent(drop.id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { videoSrc?: string; posterSrc?: string | null };
      if (!data.videoSrc) return;
      play({
        id: drop.id,
        title: drop.title,
        author: drop.authorName,
        authorId: drop.authorId,
        videoSrc: data.videoSrc,
        posterSrc: data.posterSrc ?? drop.posterSrc,
        mediaType: drop.mediaType,
      });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="md:mx-auto md:w-full md:max-w-[659px]" aria-label="PEAK 유력 후보">
      <div className="flex items-baseline justify-between px-4 md:px-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">🔥 PEAK 유력 후보</h2>
        <span className="text-xs text-gray-400">반응을 보태 PEAK에 올려주세요</span>
      </div>
      <div className="mt-2 flex gap-3 overflow-x-auto px-4 pb-1 md:px-0">
        {drops.map((drop) => {
          const active = track?.id === drop.id;
          const percent = toPercent(drop.score);
          const likesLeft = Math.max(1, Math.ceil((PEAK_VIEW_THRESHOLD - drop.score) / PEAK_LIKE_WEIGHT));
          return (
            <button
              key={drop.id}
              type="button"
              onClick={() => open(drop)}
              className="group flex w-36 shrink-0 flex-col text-left"
            >
              <span
                className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-900 ${
                  active ? "ring-2 ring-black dark:ring-white" : ""
                }`}
              >
                {drop.posterSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={drop.posterSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <HeadphonesIcon className="h-8 w-8 text-gray-400" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow transition group-hover:opacity-100">
                    <PlayIcon className="h-4 w-4" />
                  </span>
                </span>
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {loadingId === drop.id ? "불러오는 중…" : `PEAK까지 ${percent}%`}
                </span>
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
                  <span
                    className="block h-full bg-gradient-to-r from-amber-400 to-red-500"
                    style={{ width: `${percent}%` }}
                  />
                </span>
              </span>
              <span className="mt-1.5 block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{drop.title}</span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{drop.authorName}</span>
              <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                {!drop.myLiked ? (
                  <>
                    <HeartIcon className="h-3 w-3" filled />
                    좋아요하면 +{toPercent(PEAK_LIKE_WEIGHT)}%
                  </>
                ) : kickAvailable ? (
                  <>
                    <KickIcon className="h-3 w-3" filled />
                    Kick하면 +{toPercent(PEAK_KICK_WEIGHT)}%
                  </>
                ) : (
                  <>공유하면 더 빨리 PEAK</>
                )}
              </span>
              <span className="block truncate text-[11px] text-gray-400">좋아요 {likesLeft}개면 PEAK</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
