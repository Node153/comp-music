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
  // memo(비공개) 게시물의 노출 만료 시각 — 있으면 재생목록에 남은 시간 카운트다운을 보여준다.
  // DEMO는 영구노출이라 항상 null/undefined.
  expiresAt?: string | null;
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
      // ⚠️ "음소거로 먼저 재생 후 해제" 우회를 넣었다가 되돌림 — GlobalPlayerBar와 같은 이유
      // (비동기 unmute를 브라우저가 제스처 밖 행동으로 보고 재생을 멈추는 걸 재현·확인함).
      video.play().catch(() => setIsPlaying(false));
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
