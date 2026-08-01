"use client";

// 피드 카드 안의 영상 미리보기 — 항상 muted라 실제 소리는 나지 않고,
// 재생 버튼을 누르면 하단 GlobalPlayerBar가 실제 소리를 재생해 페이지 이동에도 안 끊긴다.
import { useNowPlaying } from "@/components/NowPlayingContext";

export function PostVideo({
  postId,
  title,
  author,
  videoSrc,
  posterSrc,
}: {
  postId: string;
  title: string;
  author: string;
  videoSrc: string;
  posterSrc?: string | null;
}) {
  const { track, play, pause } = useNowPlaying();

  return (
    <video
      src={videoSrc}
      poster={posterSrc ?? undefined}
      className="max-h-[780px] w-auto max-w-full object-contain"
      controls
      muted
      playsInline
      onPlay={() => play({ id: postId, title, author, videoSrc })}
      onPause={() => {
        if (track?.id === postId) pause();
      }}
    />
  );
}
