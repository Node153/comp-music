"use client";

// 피드 카드 안의 영상 미리보기 — 항상 muted라 실제 소리는 나지 않고,
// 재생 버튼을 누르면 하단 GlobalPlayerBar가 실제 소리를 재생해 페이지 이동에도 안 끊긴다.
//
// tone="demo"는 인스타그램 참고 검토 후 나온 두 가지 변경 — object-cover로 프레임을
// 꽉 채우고(원본 비율과 안 맞으면 자동으로 살짝 잘림), 브라우저 기본 <video controls>
// 대신 MockPlayOverlay와 같은 커스텀 재생 버튼을 쓴다(브라우저마다 다르게 생긴 네이티브
// 컨트롤이 앱 톤과 안 맞는다는 지적). tone="memo"(기본값)는 예전 방식 그대로.
import { useRef, useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { PlayIcon, PauseIcon } from "@/components/icons";

export function PostVideo({
  postId,
  title,
  author,
  videoSrc,
  posterSrc,
  tone = "memo",
}: {
  postId: string;
  title: string;
  author: string;
  videoSrc: string;
  posterSrc?: string | null;
  tone?: "demo" | "memo";
}) {
  const { track, play, pause } = useNowPlaying();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handlePlay() {
    setIsPlaying(true);
    play({ id: postId, title, author, videoSrc });
  }

  function handlePause() {
    setIsPlaying(false);
    if (track?.id === postId) pause();
  }

  if (tone === "demo") {
    return (
      <div className="relative">
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc ?? undefined}
          className="aspect-[4/5] w-full object-cover"
          muted
          playsInline
          onPlay={handlePlay}
          onPause={handlePause}
        />
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) v.play();
            else v.pause();
          }}
          aria-label={isPlaying ? "일시정지" : "재생"}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/20"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            {isPlaying ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="h-7 w-7" />}
          </span>
        </button>
      </div>
    );
  }

  return (
    <video
      src={videoSrc}
      poster={posterSrc ?? undefined}
      className="max-h-[780px] w-auto max-w-full object-contain"
      controls
      muted
      playsInline
      onPlay={handlePlay}
      onPause={handlePause}
    />
  );
}
