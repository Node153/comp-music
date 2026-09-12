"use client";

// SoundbarPreview(업로드 미리보기)와 같은 파형 재생 위젯을 피드 카드에서도 보여주기 위한 버전.
// 업로드 쪽은 File을 바로 갖고 있지만 피드는 R2 signed URL만 있어서, fetch로 받아온 뒤
// 같은 computeWaveformBars로 분석한다. signed URL이 만료되기 전(발급 후 30분)에만 유효 —
// 이미 <audio src>가 같은 URL을 쓰고 있어서 새로운 제약은 아니다.
// posterSrc(커버 이미지)가 있으면 파형 대신 이미지 위에 재생 버튼을 얹은 형태로 바뀐다.
//
// mode:
//  - "inline" (기본, memo 탭): 자체 <audio>로 카드 안에서 재생.
//  - "global" (DEMO 탭): 재생을 하단 GlobalPlayerBar(<video> 하나)로 넘기고 "최근 들은"에 기록.
//    카드는 파형·재생버튼만 보여주고, 이 트랙이 하단 바의 현재 곡일 때만 진행률이 반영된다.
import { useEffect, useRef, useState } from "react";
import { computeWaveformBars, formatWaveformTime } from "@/lib/waveform";
import { useMediaProgress } from "@/lib/useMediaProgress";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { usePlaylistOptional } from "@/components/PlaylistContext";
import { PlayIcon, PauseIcon } from "@/components/icons";

const SLIM_BAR_COUNT = 200;

const TONE = {
  demo: {
    playBg: "bg-demo-gold",
    playText: "text-neutral-900",
    playheadColor: "#f5d999",
    posterProgress: "bg-demo-gold",
    playedColor: (v: number) => (v < 0.35 ? "#8a6a2e" : v < 0.65 ? "#c9a668" : "#f5d999"),
  },
  memo: {
    playBg: "bg-violet-500",
    playText: "text-white",
    playheadColor: "#c4b5f2",
    posterProgress: "bg-violet-400",
    playedColor: () => "#8b6fd9",
  },
} as const;

export function SoundbarPlayer({
  src,
  title,
  posterSrc,
  tone = "memo",
  mode = "inline",
  trackId,
  author,
  authorId,
  expiresAt,
}: {
  src: string;
  title: string;
  posterSrc?: string | null;
  tone?: "demo" | "memo";
  mode?: "inline" | "global";
  trackId?: string;
  author?: string;
  authorId?: string;
  // memo 게시물의 노출 만료 시각 — 재생목록/최근들은에 그대로 실어서 남은 시간을 보여준다.
  expiresAt?: string | null;
}) {
  const [bars, setBars] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const style = TONE[tone];
  const isGlobal = mode === "global";

  // ---- 파형 분석 (모드 공통) ----
  useEffect(() => {
    if (posterSrc) return; // 커버 이미지 모드에서는 파형을 안 그리니 분석 자체를 건너뛴다.
    let cancelled = false;
    fetch(`/api/media/waveform-proxy?url=${encodeURIComponent(src)}`)
      .then((res) => res.arrayBuffer())
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
  }, [src, posterSrc]);

  // ---- inline 모드: 자체 <audio> ----
  const audioRef = useRef<HTMLAudioElement>(null);
  const [inlinePlaying, setInlinePlaying] = useState(false);
  const [inlineDuration, setInlineDuration] = useState(0);
  const [inlineTime, setInlineTime] = useMediaProgress(audioRef, inlinePlaying);

  // ---- global 모드: 하단 바 공유 ----
  const {
    track: nowTrack,
    isPlaying: nowPlaying,
    videoRef,
    toggle: nowToggle,
    pause: nowPause,
    duration: globalDuration,
  } = useNowPlaying();
  const playlist = usePlaylistOptional();
  const isThisTrack = isGlobal && !!trackId && nowTrack?.id === trackId;
  const [globalTime] = useMediaProgress(videoRef, isThisTrack && nowPlaying);

  const isPlaying = isGlobal ? isThisTrack && nowPlaying : inlinePlaying;
  const currentTime = isGlobal ? (isThisTrack ? globalTime : 0) : inlineTime;
  const duration = isGlobal ? (isThisTrack ? globalDuration : 0) : inlineDuration;

  function startGlobal() {
    // src는 이 렌더에서 서버가 방금 내려준 signed URL이라 이미 최신 — 서버에 다시 물어볼
    // 필요 없어 skipRefresh(재생목록/최근들은에서 트는 경우와 달리 항상 신선한 값).
    if (trackId && playlist)
      playlist.playNow(
        {
          id: trackId,
          title,
          author: author ?? "",
          authorId,
          videoSrc: src,
          posterSrc: posterSrc ?? null,
          expiresAt,
          mediaType: "audio",
        },
        { skipRefresh: true },
      );
  }

  function togglePlay() {
    if (isGlobal) {
      if (!isThisTrack) startGlobal();
      else if (nowPlaying) nowPause();
      else nowToggle();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }

  function seekFromClientX(clientX: number, rect: DOMRect) {
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (isGlobal) {
      if (isThisTrack && videoRef.current && globalDuration) {
        videoRef.current.currentTime = ratio * globalDuration;
      } else {
        startGlobal();
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio || !inlineDuration) return;
    audio.currentTime = ratio * inlineDuration;
  }

  const playedRatio = duration > 0 ? currentTime / duration : 0;
  const playedBarCount = bars ? Math.round(playedRatio * bars.length) : 0;

  const audioEl = isGlobal ? null : (
    <audio
      ref={audioRef}
      src={src}
      onPlay={() => setInlinePlaying(true)}
      onPause={() => setInlinePlaying(false)}
      onTimeUpdate={(e) => setInlineTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => setInlineDuration(e.currentTarget.duration)}
      className="hidden"
    />
  );

  if (posterSrc) {
    return (
      <button
        type="button"
        onClick={togglePlay}
        className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl"
      >
        {audioEl}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterSrc} alt={title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/45">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black">
            {isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
          <div className={`h-full ${style.posterProgress}`} style={{ width: `${playedRatio * 100}%` }} />
        </div>
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl bg-neutral-900 p-2.5">
      {audioEl}
      {/* 게시물 캡션이 이미 카드 위쪽에 한 번 보이므로(feed/page.tsx) 여기서 title을
          또 텍스트로 보여주진 않는다 — poster 모드의 alt 속성 등 접근성 용도로만 쓰인다. */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:brightness-110 ${style.playBg} ${style.playText}`}
        >
          {isPlaying ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
        </button>
        <span className="shrink-0 text-[11px] text-neutral-400">
          {formatWaveformTime(currentTime)} / {formatWaveformTime(duration)}
        </span>
      </div>

      {failed && <p className="text-[11px] text-neutral-400">파형을 분석하지 못했어요. 재생은 문제없어요.</p>}
      {!failed && !bars && <p className="text-[11px] text-neutral-400">파형 분석 중...</p>}
      {bars && (
        <div
          className="relative flex h-8 cursor-pointer items-center gap-px"
          onClick={(e) => seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect())}
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
