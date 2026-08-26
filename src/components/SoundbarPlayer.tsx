"use client";

// SoundbarPreview(업로드 미리보기)와 같은 파형 재생 위젯을 피드 카드에서도 보여주기 위한 버전.
// 업로드 쪽은 File을 바로 갖고 있지만 피드는 R2 signed URL만 있어서, fetch로 받아온 뒤
// 같은 computeWaveformBars로 분석한다. signed URL이 만료되기 전(발급 후 30분)에만 유효 —
// 이미 <audio src>가 같은 URL을 쓰고 있어서 새로운 제약은 아니다.
// posterSrc(커버 이미지)가 있으면 파형 대신 이미지 위에 재생 버튼을 얹은 형태로 바뀐다 —
// 둘을 동시에 보여주지 않는다(커버를 넣은 이유가 파형 대신 앨범아트를 보여주려는 것이므로).
import { useEffect, useRef, useState } from "react";
import { computeWaveformBars, formatWaveformTime } from "@/lib/waveform";
import { PlayIcon, PauseIcon } from "@/components/icons";

export function SoundbarPlayer({
  src,
  title,
  posterSrc,
}: {
  src: string;
  title: string;
  posterSrc?: string | null;
}) {
  const [bars, setBars] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (posterSrc) return; // 커버 이미지 모드에서는 파형을 안 그리니 분석 자체를 건너뛴다.
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
  }, [src, posterSrc]);

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

  const audioEl = (
    <audio
      ref={audioRef}
      src={src}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      className="hidden"
    />
  );

  if (posterSrc) {
    return (
      <button
        type="button"
        onClick={togglePlay}
        className="group relative block max-h-[420px] w-auto overflow-hidden rounded-xl"
      >
        {audioEl}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterSrc} alt={title} className="max-h-[420px] w-auto object-contain" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/45">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black">
            {isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
          <div className="h-full bg-violet-400" style={{ width: `${playedRatio * 100}%` }} />
        </div>
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl bg-neutral-900 p-3">
      {audioEl}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400"
        >
          {isPlaying ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
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
