"use client";

// 사운드클라우드 참고 — 화면 하단 고정 플레이어 바. 실제 재생 엘리먼트가 여기 하나만 있고
// (app) 레이아웃에 마운트돼 페이지 이동에도 언마운트되지 않아 음악이 끊기지 않는다.
import { useEffect, useMemo, useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { usePlaylist } from "@/components/PlaylistContext";
import { useMediaProgress } from "@/lib/useMediaProgress";
import {
  PlayIcon,
  PauseIcon,
  XIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ListIcon,
  HeadphonesIcon,
} from "@/components/icons";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// /goal 사운드바 개편(SoundbarPlayer 참고) — 여기는 mock 트랙도 재생하니 실제 오디오
// 분석은 못 하지만(디코딩할 실제 파일이 없음), 모양·색만 같은 언어로 맞춘다: 얇고
// 촘촘한 막대(64→400개, 화면 전체 폭을 쓰다 보니 넓은 모니터에서도 얇게 유지하려고
// SoundbarPlayer보다 훨씬 많이 잡음), 재생된 구간은 진폭(시드 높이)에 따라 골드 3단계로.
const WAVEFORM_BAR_COUNT = 400;

function demoBandColor(heightPct: number): string {
  const amplitude = (heightPct - 20) / 80; // 20~99% 범위를 0~1로 정규화
  if (amplitude < 0.35) return "#8a6a2e";
  if (amplitude < 0.65) return "#c9a668";
  return "#f5d999";
}

// 실제 오디오 분석 없이, 트랙 id로 시드를 고정한 프리셋 파형 — 트랙이 바뀔 때만 다시 계산되고
// timeupdate(진행률)마다 재계산되지 않아야 막대가 계속 흔들리지 않는다.
function buildWaveformHeights(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const heights: number[] = [];
  for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    heights.push(20 + (h % 80)); // 20%~99% 사이 막대 높이
  }
  return heights;
}

export function GlobalPlayerBar() {
  const { track, isPlaying, setIsPlaying, toggle, pause, close, videoRef } = useNowPlaying();
  const { items: queueItems, playAt, playNext, playPrev, hasNext, hasPrev, queueOpen, toggleQueue } =
    usePlaylist();
  const hasQueue = queueItems.length > 0;
  const [duration, setDuration] = useState(0);
  const [progress] = useMediaProgress(videoRef, isPlaying);
  const waveform = useMemo(() => buildWaveformHeights(track?.id ?? ""), [track?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !track) return;
    if (video.src !== track.videoSrc) {
      video.src = track.videoSrc;
      video.currentTime = 0;
    }
    video.muted = false;
    video.play().catch(() => setIsPlaying(false));
  }, [track, videoRef, setIsPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => setDuration(video.duration || 0);
    // 큐에 다음 곡이 있으면 이어서 재생, 없으면 그 자리에서 멈춘다(바·대기열은 유지 — X로만 닫음).
    const onEnded = () => {
      if (!playNext()) pause();
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef, pause, playNext]);

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  const seek = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const video = videoRef.current;
    if (video && duration > 0) video.currentTime = ratio * duration;
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className="hidden" playsInline />
      {/* 사운드클라우드 참고 — 화면 하단에 항상 고정되는 한 줄짜리 바.
          왼쪽: 재생 컨트롤 / 가운데: 파형(탐색) + 시간 / 오른쪽: 커버·제목·게시자 + 대기열. */}
      <div className="fixed inset-x-0 bottom-14 z-50 flex h-16 items-center gap-2 border-t border-gray-800 bg-[#1c1c1e] px-3 text-white md:bottom-0 md:gap-4 md:px-4">
        {/* 왼쪽: 트랜스포트 (이전/다음은 모바일에서 숨김 — 대기열 패널에서 곡 선택) */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => playPrev()}
            disabled={!hasPrev}
            aria-label="이전 곡"
            className="hidden h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent md:flex"
          >
            <SkipBackIcon className="h-4 w-4" />
          </button>
          <button
            onClick={track ? toggle : () => playAt(0)}
            disabled={!track && !hasQueue}
            aria-label={isPlaying ? "일시정지" : "재생"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition disabled:opacity-30"
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => playNext()}
            disabled={!hasNext}
            aria-label="다음 곡"
            className="hidden h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent md:flex"
          >
            <SkipForwardIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 가운데: 경과 시간 — 파형(탐색) — 총 시간 */}
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <span className="hidden w-9 shrink-0 text-right text-[11px] tabular-nums text-gray-400 md:block">
            {formatTime(progress)}
          </span>
          <button
            onClick={seek}
            disabled={!track}
            className="relative h-9 min-w-0 flex-1 cursor-pointer disabled:cursor-default"
            aria-label="탐색 바 (파형)"
          >
            <div className="flex h-full items-center gap-px">
              {waveform.map((h, i) => (
                <span key={i} className="w-full flex-1 bg-white/20" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div
              className="absolute inset-0 flex h-full items-center gap-px"
              style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
            >
              {waveform.map((h, i) => (
                <span
                  key={i}
                  className="w-full flex-1"
                  style={{ height: `${h}%`, background: demoBandColor(h) }}
                />
              ))}
            </div>
            {track && (
              <div
                className="pointer-events-none absolute top-0 h-full w-px bg-[#f5d999]"
                style={{ left: `${pct}%` }}
              />
            )}
          </button>
          <span className="hidden w-9 shrink-0 text-[11px] tabular-nums text-gray-400 md:block">
            {formatTime(duration)}
          </span>
        </div>

        {/* 오른쪽: 재생 중인 트랙 + 대기열 */}
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-white/10">
            {track?.posterSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.posterSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <HeadphonesIcon className="h-4 w-4 text-gray-500" />
            )}
          </span>
          <div className="flex min-w-0 max-w-[40vw] flex-col md:max-w-[220px]">
            <span className="truncate text-xs font-semibold md:text-sm">
              {track ? track.title : "재생 중인 트랙 없음"}
            </span>
            <span className="truncate text-[11px] text-gray-400 md:text-xs">
              {track ? track.author : hasQueue ? `대기열 ${queueItems.length}곡` : "—"}
            </span>
          </div>
          {hasQueue && (
            <button
              onClick={toggleQueue}
              aria-label="재생 대기열"
              aria-pressed={queueOpen}
              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                queueOpen
                  ? "bg-white/15 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <ListIcon className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black">
                {queueItems.length}
              </span>
            </button>
          )}
          {track && (
            <button
              onClick={close}
              aria-label="플레이어 닫기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-800"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
