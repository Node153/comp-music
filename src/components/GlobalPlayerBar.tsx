"use client";

// 사운드클라우드 참고 — 화면 하단에 항상 고정되는 한 줄짜리 플레이어 바. 실제 재생 엘리먼트가
// 여기 하나뿐이고 (app) 레이아웃에 마운트돼 페이지 이동에도 안 끊긴다.
// 레이아웃은 3분할 그리드로 폭을 고정한다(제목/파형 영역이 트랙마다 흔들리지 않게):
//   왼쪽=트랜스포트 / 가운데=경과시간·파형(탐색)·총시간 / 오른쪽=커버·제목·게시자 + 대기열
// 바 자체가 항상 하단에 고정이라 별도 "닫기(X)" 버튼은 없음(사용자 요청) — 재생 정지는
// 재생/일시정지 토글로, 큐 비우기는 QueuePanel 쪽에서.
import { useEffect, useMemo, useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { usePlaylist } from "@/components/PlaylistContext";
import { useMediaProgress } from "@/lib/useMediaProgress";
import { computeWaveformBars } from "@/lib/waveform";
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ListIcon,
  HeadphonesIcon,
} from "@/components/icons";

const BAR_COUNT = 160;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// 진폭(0~1)에 따라 재생된 구간 색을 골드 3단계로 — SoundbarPlayer(카드 파형)와 같은 언어.
function demoBandColor(v: number): string {
  if (v < 0.35) return "#8a6a2e";
  if (v < 0.65) return "#c9a668";
  return "#f5d999";
}

// 실제 분석이 끝나기 전(또는 실패 시) 보여줄 프리셋 파형 — 트랙 id로 시드를 고정해 0~1 진폭 배열.
function presetBars(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    bars.push(0.2 + (h % 80) / 100); // 0.2 ~ 0.99
  }
  return bars;
}

export function GlobalPlayerBar() {
  const { track, isPlaying, setIsPlaying, toggle, pause, videoRef, duration, setDuration } =
    useNowPlaying();
  const {
    items: queueItems,
    playAt,
    playNext,
    playPrev,
    hasNext,
    hasPrev,
    queueOpen,
    toggleQueue,
    recentlyPlayed,
  } = usePlaylist();
  const hasQueue = queueItems.length > 0;
  const hasPanel = hasQueue || recentlyPlayed.length > 0;
  const [progress] = useMediaProgress(videoRef, isPlaying);

  // #1 — 프리셋이 아니라 현재 트랙의 실제 오디오를 분석한 파형.
  const preset = useMemo(() => presetBars(track?.id ?? ""), [track?.id]);
  const [analyzed, setAnalyzed] = useState<number[] | null>(null);
  const bars = analyzed ?? preset;

  useEffect(() => {
    setAnalyzed(null);
    const src = track?.videoSrc;
    if (!src) return;
    let cancelled = false;
    // 같은 출처(/... 로컬 파일)는 바로 fetch, R2 signed URL은 CORS 때문에 서버 프록시 경유.
    const url = src.startsWith("/") ? src : `/api/media/waveform-proxy?url=${encodeURIComponent(src)}`;
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buf) => computeWaveformBars(buf, BAR_COUNT))
      .then((result) => {
        if (!cancelled) setAnalyzed(result);
      })
      .catch(() => {
        // 분석 실패해도 프리셋 파형으로 계속 — 재생엔 지장 없음.
      });
    return () => {
      cancelled = true;
    };
  }, [track?.videoSrc]);

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
  }, [videoRef, pause, playNext, setDuration]);

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const playedBarCount = Math.round((pct / 100) * bars.length);

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
      {/* 바 배경 = DEMO 탭 배경(#fafafa)과 memo 탭 배경(#1c1c1e)의 정확한 중간값(#8b8b8c) —
          사용자 요청: 아이콘이 아니라 사운드바 자체를 이 중립 회색으로. */}
      <div className="fixed inset-x-0 bottom-14 z-50 grid h-16 grid-cols-[36px_minmax(0,1fr)_140px] items-center gap-2 border-t border-black/15 bg-[#8b8b8c] px-3 text-white md:bottom-0 md:grid-cols-[128px_minmax(0,1fr)_300px] md:gap-4 md:px-4">
        {/* 왼쪽: 트랜스포트 (이전/다음은 데스크톱만 — 모바일은 대기열 패널에서 곡 선택) */}
        <div className="flex items-center gap-1 justify-self-start">
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
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <span className="hidden w-9 shrink-0 text-right text-[11px] tabular-nums text-black/55 md:block">
            {formatTime(progress)}
          </span>
          <button
            onClick={seek}
            disabled={!track}
            className="relative flex h-9 min-w-0 flex-1 items-center gap-px disabled:cursor-default"
            aria-label="탐색 바 (파형)"
          >
            {bars.map((v, i) => (
              <span
                key={i}
                className="w-full flex-1 rounded-[1px]"
                style={{
                  height: `${Math.max(6, v * 100)}%`,
                  background: i < playedBarCount ? demoBandColor(v) : "rgba(255,255,255,0.22)",
                }}
              />
            ))}
            {track && (
              <span
                className="pointer-events-none absolute top-0 h-full w-px bg-[#f5d999]"
                style={{ left: `${pct}%` }}
              />
            )}
          </button>
          <span className="hidden w-9 shrink-0 text-[11px] tabular-nums text-black/55 md:block">
            {formatTime(duration)}
          </span>
        </div>

        {/* 오른쪽: 커버 · 제목 · 게시자 + 대기열 (폭 고정 열) */}
        <div className="flex min-w-0 items-center gap-1.5 justify-self-end md:gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-white/10">
            {track?.posterSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.posterSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <HeadphonesIcon className="h-4 w-4 text-black/45" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-semibold md:text-sm">
              {track ? track.title : "재생 중인 트랙 없음"}
            </span>
            <span className="truncate text-[11px] text-black/55 md:text-xs">
              {track ? track.author : hasQueue ? `대기열 ${queueItems.length}곡` : "—"}
            </span>
          </div>
          <button
            onClick={toggleQueue}
            disabled={!hasPanel}
            aria-label="재생 대기열"
            aria-pressed={queueOpen}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-30 ${
              queueOpen ? "bg-white/20" : "hover:bg-gray-800"
            }`}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
