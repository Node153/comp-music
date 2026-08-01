"use client";

// SoundbarPreview(업로드 미리보기)와 같은 파형 재생 위젯을 피드 카드에서도 보여주기 위한 버전.
// 업로드 쪽은 File을 바로 갖고 있지만 피드는 R2 signed URL만 있어서, fetch로 받아온 뒤
// 같은 computeWaveformBars로 분석한다. signed URL이 만료되기 전(발급 후 30분)에만 유효 —
// 이미 <audio src>가 같은 URL을 쓰고 있어서 새로운 제약은 아니다.
import { useEffect, useRef, useState } from "react";
import { computeWaveformBars, formatWaveformTime } from "@/lib/waveform";

export function SoundbarPlayer({ src, title }: { src: string; title: string }) {
  const [bars, setBars] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let cancelled = false;
    // <audio src>는 태그라 CORS 영향 없이 바로 재생되지만, 파형 분석을 위한 fetch()는
    // R2 도메인에 대한 브라우저 CORS 처리가 불안정해서 우리 서버 프록시(같은 출처)를 거친다.
    fetch(`/api/media/waveform-proxy?url=${encodeURIComponent(src)}`)
      .then((res) => res.arrayBuffer())
      .then(computeWaveformBars)
      .then((result) => {
        if (!cancelled) setBars(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }

  function seekFromClientX(clientX: number, rect: DOMRect) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  }

  const playedRatio = duration > 0 ? currentTime / duration : 0;
  const playedBarCount = bars ? Math.round(playedRatio * bars.length) : 0;

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-xl bg-neutral-900 p-3">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="hidden"
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm text-white transition hover:bg-violet-400"
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{title}</p>
          <p className="text-[11px] text-neutral-400">
            {formatWaveformTime(currentTime)} / {formatWaveformTime(duration)}
          </p>
        </div>
      </div>

      {failed && <p className="text-[11px] text-neutral-400">파형을 분석하지 못했어요. 재생은 문제없어요.</p>}
      {!failed && !bars && <p className="text-[11px] text-neutral-400">파형 분석 중...</p>}
      {bars && (
        <div
          className="flex h-12 cursor-pointer items-center gap-[1.5px]"
          onClick={(e) => seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect())}
        >
          {bars.map((v, i) => (
            <div
              key={i}
              className={`w-full rounded-full transition-colors ${
                i < playedBarCount ? "bg-cyan-300" : "bg-cyan-800"
              }`}
              style={{ height: `${Math.max(4, v * 100)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
