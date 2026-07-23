"use client";

// 전역 재생 상태 — (app)/layout.tsx에 마운트되어 피드/프로필/업로드/DM 등 페이지를 이동해도
// 언마운트되지 않는다(같은 레이아웃 세그먼트 안에서는 Next.js가 layout을 유지). 이 덕분에
// 실제 <video> 재생은 GlobalPlayerBar 안의 엘리먼트 하나로만 이뤄지고, 페이지 이동에도 안 끊긴다.
import { createContext, useCallback, useContext, useRef, useState } from "react";

export type NowPlayingTrack = {
  id: string;
  title: string;
  author: string;
  videoSrc: string;
};

type NowPlayingContextValue = {
  track: NowPlayingTrack | null;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  play: (track: NowPlayingTrack) => void;
  pause: () => void;
  toggle: () => void;
  close: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null);

export function NowPlayingProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<NowPlayingTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const play = useCallback((next: NowPlayingTrack) => {
    setTrack(next);
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const close = useCallback(() => {
    videoRef.current?.pause();
    setTrack(null);
    setIsPlaying(false);
  }, []);

  return (
    <NowPlayingContext.Provider
      value={{ track, isPlaying, setIsPlaying, play, pause, toggle, close, videoRef }}
    >
      {children}
    </NowPlayingContext.Provider>
  );
}

export function useNowPlaying() {
  const ctx = useContext(NowPlayingContext);
  if (!ctx) throw new Error("useNowPlaying은 NowPlayingProvider 안에서만 사용할 수 있어요");
  return ctx;
}
