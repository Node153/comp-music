"use client";

// NewDropsRail(서버)의 화면 부분 — 카드를 누르면 전역 플레이어로 바로 재생하고, 그 게시물이 지금
// 피드에 이미 그려져 있으면 그 카드로 스크롤해서 좋아요·댓글을 바로 남길 수 있게 한다.
// 재생 URL은 R2 signed URL이라 누르는 순간 /api/media/track-url에서 새로 받아온다(PlaylistContext와 같은 방식).
import { useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { HeadphonesIcon, PlayIcon } from "@/components/icons";
import { timeAgo } from "@/lib/timeAgo";

export type NewDrop = {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  posterSrc: string | null;
  mediaType: "audio" | "video";
  publishedAt: string;
  reactionCount: number;
};

export function NewDropsRailList({ drops }: { drops: NewDrop[] }) {
  const { play, track } = useNowPlaying();
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
    <section className="md:mx-auto md:w-full md:max-w-[659px]" aria-label="첫 반응을 기다리는 Drop">
      <div className="flex items-baseline justify-between px-4 md:px-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">첫 반응을 기다리는 Drop</h2>
        <span className="text-xs text-gray-400">들어보고 한마디 남겨주세요</span>
      </div>
      <div className="mt-2 flex gap-3 overflow-x-auto px-4 pb-1 md:px-0">
        {drops.map((drop) => {
          const active = track?.id === drop.id;
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
                  {loadingId === drop.id
                    ? "불러오는 중…"
                    : drop.reactionCount === 0
                      ? "아직 반응 0"
                      : `반응 ${drop.reactionCount}`}
                </span>
              </span>
              <span className="mt-1.5 block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{drop.title}</span>
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                {drop.authorName} · {timeAgo(drop.publishedAt)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
