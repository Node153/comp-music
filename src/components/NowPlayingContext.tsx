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
  // 사운드바 우측 커버 썸네일용(플레이리스트에서 담은 트랙이면 채워짐).
  posterSrc?: string | null;
  // 재생 목록에서 게시자 이름 클릭 시 프로필로 이동하기 위한 user id.
  authorId?: string;
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
  // 현재 트랙 길이(초). GlobalPlayerBar가 <video> 메타데이터에서 읽어 올려준다 —
  // 카드(SoundbarPlayer)가 렌더 중 ref를 만지지 않고도 진행률을 계산할 수 있게.
  duration: number;
  setDuration: (v: number) => void;
};

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null);

export function NowPlayingProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<NowPlayingTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const play = useCallback((next: NowPlayingTrack) => {
    setTrack(next);
    setIsPlaying(true);
    setDuration(0);
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
    setDuration(0);
  }, []);

  return (
    <NowPlayingContext.Provider
      value={{ track, isPlaying, setIsPlaying, play, pause, toggle, close, videoRef, duration, setDuration }}
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
