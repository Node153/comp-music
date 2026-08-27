"use client";

// Complex 업로드에서 음원(mp3/wav) 파일을 고르면 Web Audio API로 파형을 분석해
// 자동으로 그려주는 사운드바 미리보기. 서버 왕복 없이 브라우저에서만 계산.
// 사운드바는 "게시물 이미지"가 아니라 업로드 폼 안에 작게 들어가는 재생 위젯 — 실제 커버
// 이미지는 별도로 첨부해서 미리보기(aside)에 보여준다(업로드 폼 참고).
//
// tone은 SoundbarPlayer와 같은 원칙 — "demo"는 얇고 촘촘한 미러 파형 + 골드 3단계
// 진폭 컬러 + 플레이헤드(비트포트 레퍼런스), "memo"(기본값)는 예전 방식 그대로.
import { useEffect, useRef, useState } from "react";
import { computeWaveformBars, formatWaveformTime } from "@/lib/waveform";
import { PlayIcon, PauseIcon } from "@/components/icons";

const DEMO_BAR_COUNT = 120;

function demoBandColor(amplitude: number): string {
  if (amplitude < 0.35) return "#8a6a2e";
  if (amplitude < 0.65) return "#c9a668";
  return "#f5d999";
}

// 부모가 파일이 바뀔 때마다 다른 key를 넘겨줘야 함 — 그래야 리마운트되면서 bars 상태가
// 새 파일 기준으로 깨끗하게 초기화됨(effect 안에서 직접 setState로 리셋하지 않음).
export function SoundbarPreview({
  file,
  src,
  tone = "memo",
}: {
  file: File;
  src: string;
  tone?: "demo" | "memo";
}) {
  const [bars, setBars] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let cancelled = false;
    file
      .arrayBuffer()
      .then((buf) => computeWaveformBars(buf, tone === "demo" ? DEMO_BAR_COUNT : undefined))
      .then((result) => {
        if (!cancelled) setBars(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file, tone]);

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

  if (tone === "demo") {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-neutral-900 p-2.5">
        <audio
          ref={audioRef}
          src={src}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          className="hidden"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-demo-gold text-neutral-900 transition hover:brightness-110"
          >
            {isPlaying ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{file.name}</p>
          </div>
          <span className="shrink-0 text-[11px] text-neutral-400">
            {formatWaveformTime(currentTime)} / {formatWaveformTime(duration)}
          </span>
        </div>

        {failed && (
          <p className="text-[11px] text-neutral-400">파형을 분석하지 못했어요. 업로드 자체는 문제없어요.</p>
        )}
        {!failed && !bars && <p className="text-[11px] text-neutral-400">파형 분석 중...</p>}
        {bars && (
          <div
            className="relative flex h-8 cursor-pointer items-center gap-px"
            onClick={(e) => seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect())}
          >
            {bars.map((v, i) => (
              <div
                key={i}
                className="w-full flex-1 rounded-[1px]"
                style={{
                  height: `${Math.max(8, v * 100)}%`,
                  background: i < playedBarCount ? demoBandColor(v) : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
            <div
              className="pointer-events-none absolute top-0 h-full w-px bg-[#f5d999]"
              style={{ left: `${playedRatio * 100}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-neutral-900 p-3">
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400"
        >
          {isPlaying ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{file.name}</p>
          <p className="text-[11px] text-neutral-400">
            {formatWaveformTime(currentTime)} / {formatWaveformTime(duration)}
          </p>
        </div>
      </div>

      {failed && (
        <p className="text-[11px] text-neutral-400">파형을 분석하지 못했어요. 업로드 자체는 문제없어요.</p>
      )}
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
                i < playedBarCount ? "bg-gray-300" : "bg-gray-700"
              }`}
              style={{ height: `${Math.max(4, v * 100)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
