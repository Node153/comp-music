"use client";

// Complex 업로드에서 음원(mp3/wav) 파일을 고르면 Web Audio API로 파형을 분석해
// 자동으로 그려주는 사운드바 미리보기. 서버 왕복 없이 브라우저에서만 계산.
// 사운드바는 "게시물 이미지"가 아니라 업로드 폼 안에 작게 들어가는 재생 위젯 — 실제 커버
// 이미지는 별도로 첨부해서 미리보기(aside)에 보여준다(업로드 폼 참고).
//
// tone은 SoundbarPlayer와 같은 원칙(주석 참고) — 모양(얇은 미러 파형 + 플레이헤드)은
// DEMO/memo 공통, 색만 DEMO=골드 3단계 / memo=보라 단색.
import { useEffect, useRef, useState } from "react";
import { computeWaveformBars, formatWaveformTime } from "@/lib/waveform";
import { useMediaProgress } from "@/lib/useMediaProgress";
import { PlayIcon, PauseIcon } from "@/components/icons";
import { useScrub } from "@/lib/useScrub";

// 화면이 넓어질수록(카드 너비 최대 900px) 막대가 굵어 보이지 않도록 넉넉하게 잡음 —
// flex-1로 폭을 다 채우는 구조라 막대 수가 적으면 넓은 화면에서 각져 보인다.
const SLIM_BAR_COUNT = 200;

const TONE = {
  demo: {
    playBg: "bg-demo-gold",
    playText: "text-neutral-900",
    playheadColor: "#f5d999",
    playedColor: (v: number) => (v < 0.35 ? "#8a6a2e" : v < 0.65 ? "#c9a668" : "#f5d999"),
  },
  memo: {
    playBg: "bg-violet-500",
    playText: "text-white",
    playheadColor: "#c4b5f2",
    playedColor: () => "#8b6fd9",
  },
} as const;

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
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useMediaProgress(audioRef, isPlaying);
  const style = TONE[tone];

  useEffect(() => {
    let cancelled = false;
    file
      .arrayBuffer()
      .then((buf) => computeWaveformBars(buf, SLIM_BAR_COUNT))
      .then((result) => {
        if (!cancelled) setBars(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }

  function seekToRatio(ratio: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = ratio * duration;
  }

  // 누른 채 드래그 탐색 — 드래그 중엔 손가락 위치를 미리 보여주고 손을 뗄 때 탐색
  const { scrubRatio, scrubHandlers } = useScrub(seekToRatio);
  const playedRatio = scrubRatio ?? (duration > 0 ? currentTime / duration : 0);
  const playedBarCount = bars ? Math.round(playedRatio * bars.length) : 0;

  return (
    // 업로드 화면의 그레이 컬러 시스템에 맞춰 배경·재생버튼은 그레이로(2026-09-16, 사용자
    // 요청 — "사운드파형 제외하고 그레이로") — 파형(재생된 구간 색·플레이헤드)만 기존 tone
    // 색(DEMO 골드/memo 보라)을 그대로 유지한다. bg-neutral-900(검정)이었던 배경은
    // active-gray, style.playBg/playText였던 재생 버튼은 box-gray+검정으로.
    <div className="flex flex-col gap-2 rounded-xl bg-active-gray p-2.5">
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
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-box-gray text-black transition hover:opacity-80"
        >
          {isPlaying ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{file.name}</p>
        </div>
        <span className="shrink-0 text-[11px] text-neutral-400">
          {formatWaveformTime(playedRatio * duration)} / {formatWaveformTime(duration)}
        </span>
      </div>

      {failed && (
        <p className="text-[11px] text-neutral-400">파형을 분석하지 못했어요. 업로드 자체는 문제없어요.</p>
      )}
      {!failed && !bars && <p className="text-[11px] text-neutral-400">파형 분석 중...</p>}
      {bars && (
        <div
          className="relative flex h-8 cursor-pointer touch-pan-y items-center gap-px"
          {...scrubHandlers}
        >
          {bars.map((v, i) => (
            <div
              key={i}
              className="w-full flex-1 transition-colors duration-150"
              style={{
                height: `${Math.max(8, v * 100)}%`,
                background: i < playedBarCount ? style.playedColor(v) : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
          <div
            className="pointer-events-none absolute top-0 h-full w-px"
            style={{ left: `${playedRatio * 100}%`, background: style.playheadColor }}
          />
        </div>
      )}
    </div>
  );
}
