"use client";

// 사운드클라우드 참고 — 화면 하단 고정 플레이어 바. 실제 재생 엘리먼트가 여기 하나만 있고
// (app) 레이아웃에 마운트돼 페이지 이동에도 언마운트되지 않아 음악이 끊기지 않는다.
import { useEffect, useMemo, useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const WAVEFORM_BAR_COUNT = 64;

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
  const { track, isPlaying, setIsPlaying, toggle, close, videoRef } = useNowPlaying();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
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
    const onTime = () => setProgress(video.currentTime);
    const onLoaded = () => setDuration(video.duration || 0);
    const onEnded = () => close();
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef, close]);

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className="hidden" playsInline />
      {track && (
        <div className="fixed inset-x-0 bottom-14 z-50 border-t border-gray-800 bg-[#1c1c1e] text-white md:bottom-0">
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              const video = videoRef.current;
              if (video && duration > 0) video.currentTime = ratio * duration;
            }}
            className="relative h-10 w-full cursor-pointer bg-[#1c1c1e] px-1"
            aria-label="탐색 바 (파형)"
          >
            <div className="flex h-full items-center gap-[2px]">
              {waveform.map((h, i) => (
                <span
                  key={i}
                  className="min-w-[2px] flex-1 rounded-full bg-gray-700"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div
              className="absolute inset-0 flex h-full items-center gap-[2px] px-1"
              style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
            >
              {waveform.map((h, i) => (
                <span
                  key={i}
                  className="min-w-[2px] flex-1 rounded-full bg-orange-400"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </button>

          <div className="flex items-center gap-3 px-4 py-2">
            <button
              onClick={toggle}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base text-black"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{track.title}</span>
              <span className="truncate text-xs text-gray-400">{track.author}</span>
            </div>
            <span className="hidden shrink-0 text-xs text-gray-400 sm:block">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
            <button
              onClick={close}
              aria-label="플레이어 닫기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
