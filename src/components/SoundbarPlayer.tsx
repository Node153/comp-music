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
import { usePlaylistOptional, usePageTrack, PAGE_TRACK_ATTR } from "@/components/PlaylistContext";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { useDoubleTap } from "@/lib/useDoubleTap";
import { usePostLike } from "@/lib/usePostLike";
import { useHeartBurst } from "@/components/HeartBurst";
import { PlayIcon, PauseIcon } from "@/components/icons";
import { useGuestSignupPrompt, GUEST_AUDIO_PAUSE_EVENT } from "@/components/GuestSignupPrompt";
import { GUEST_PREVIEW_SECONDS } from "@/lib/feedConstants";
import { useScrub } from "@/lib/useScrub";

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
  // 지금 보고 있는 사람(뷰어)의 id — 더블탭 좋아요 대상(커버 이미지 모드에서만). 게스트나
  // inline 모드(로그인 안 함)는 undefined라 더블탭 감지 없이 클릭이 즉시 재생/일시정지만 한다.
  viewerId,
  // 합작게시물 열람 권한이 있는 사람에게만 원본 음원 다운로드를 열어주기 위한 옵션
  // (호출부가 명시적으로 넘길 때만 다운로드 버튼이 뜬다 — 기본은 비활성).
  downloadUrl,
  downloadName,
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
  viewerId?: string;
  downloadUrl?: string | null;
  downloadName?: string;
}) {
  const [bars, setBars] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const style = TONE[tone];
  const isGlobal = mode === "global";

  // blob:(방금 로컬에서 올린 미리보기)나 같은 출처 경로는 <a download>가 그대로 잘 먹지만,
  // R2 signed URL(cross-origin)은 Safari 등에서 download 속성을 무시하고 그냥 열어버리는
  // 경우가 있어(사용자 보고) 서버 프록시(Content-Disposition: attachment)를 거치게 한다.
  const downloadHref =
    downloadUrl == null
      ? null
      : downloadUrl.startsWith("blob:") || downloadUrl.startsWith("/")
        ? downloadUrl
        : `/api/media/download-proxy?url=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent(downloadName ?? title)}`;

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
  const guestPrompt = useGuestSignupPrompt();

  // 게스트 미리듣기 상한(2026-09-23) — inline 모드는 mode={currentUserId ? "global" :
  // "inline"} 호출 규칙상 항상 게스트 전용이라 여기서 무조건 적용한다. 상한에 닿으면
  // 멈추고 가입 유도 팝업도 같이 띄운다(그 팝업이 뜨면 GUEST_AUDIO_PAUSE_EVENT로 다른
  // 재생 중인 카드도 같이 멈춘다 — 아래 이펙트).
  function handleInlineTimeUpdate(time: number) {
    setInlineTime(time);
    if (!isGlobal && time >= GUEST_PREVIEW_SECONDS) {
      audioRef.current?.pause();
      guestPrompt();
    }
  }

  // 가입 유도 팝업이 (다른 트리거로) 뜨면 이 게스트 오디오도 같이 멈춘다 — 팝업 밑에서
  // 계속 들리면 안 됨(사용자 요청).
  useEffect(() => {
    if (isGlobal) return;
    function handlePauseEvent() {
      audioRef.current?.pause();
    }
    window.addEventListener(GUEST_AUDIO_PAUSE_EVENT, handlePauseEvent);
    return () => window.removeEventListener(GUEST_AUDIO_PAUSE_EVENT, handlePauseEvent);
  }, [isGlobal]);

  // ---- global 모드: 하단 바 공유 ----
  const {
    track: nowTrack,
    isPlaying: nowPlaying,
    videoRef,
    play: nowPlay,
    toggle: nowToggle,
    pause: nowPause,
    duration: globalDuration,
    lastCountedView,
  } = useNowPlaying();
  const playlist = usePlaylistOptional();
  const { setViewCount } = usePostEngagement();
  const isThisTrack = isGlobal && !!trackId && nowTrack?.id === trackId;
  const [globalTime] = useMediaProgress(videoRef, isThisTrack && nowPlaying);
  const processedViewRef = useRef<number | null>(null);

  // DEMO 조회수(0053/0054) — 30초 이상 재생돼 서버에 실제로 카운트된 순간만 화면 숫자를
  // 낙관적으로 올린다(NowPlayingContext가 재생 시작 지점과 무관하게 중앙에서 판정).
  useEffect(() => {
    if (!isGlobal || !trackId) return;
    if (!lastCountedView || lastCountedView.id !== trackId) return;
    if (processedViewRef.current === lastCountedView.at) return;
    processedViewRef.current = lastCountedView.at;
    setViewCount((c) => c + 1);
  }, [isGlobal, trackId, lastCountedView, setViewCount]);

  const isPlaying = isGlobal ? isThisTrack && nowPlaying : inlinePlaying;
  const currentTime = isGlobal ? (isThisTrack ? globalTime : 0) : inlineTime;
  const duration = isGlobal ? (isThisTrack ? globalDuration : 0) : inlineDuration;

  const trackData = trackId
    ? {
        id: trackId,
        title,
        author: author ?? "",
        authorId,
        videoSrc: src,
        posterSrc: posterSrc ?? null,
        expiresAt,
        mediaType: "audio" as const,
      }
    : null;
  // 하단 바에서 앞 곡이 끝나면 화면상 다음 카드로 이어 재생되도록 후보 등록(global 모드만).
  usePageTrack(isGlobal ? trackData : null);
  const pageTrackAttr = isGlobal && trackId ? { [PAGE_TRACK_ATTR]: trackId } : {};

  function startGlobal() {
    if (!trackData) return;
    // memo는 "담기"(+ 버튼)만 금지고 "최근 들은" 기록은 그대로 남는다(사용자 요청) —
    // 담기 제외는 feed/page.tsx의 playlistTrack(!isComplex 게이트)에서만 처리한다.
    // src는 이 렌더에서 서버가 방금 내려준 signed URL이라 이미 최신이라 skipRefresh.
    if (playlist) playlist.playNow(trackData, { skipRefresh: true });
    else nowPlay(trackData);
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

  // 더블탭 좋아요(인스타그램 참고) — 커버 이미지가 있는 global 모드에서만, 로그인 상태일 때만
  // 활성화. 첫 클릭을 300ms 미뤄뒀다가 그 안에 두 번째 클릭이 없으면 원래대로 재생/일시정지,
  // 있으면 좋아요만 실행한다. inline 모드(게스트)는 좋아요 자체가 불가능하므로 그대로 즉시 토글.
  const { likeOnly } = usePostLike(trackId ?? "", viewerId ?? "");
  const { burst, element: heartBurstEl } = useHeartBurst();
  const handleDoubleTapLike = useDoubleTap(togglePlay, () => {
    burst();
    void likeOnly();
  });
  const posterOnClick = isGlobal && viewerId && trackId ? handleDoubleTapLike : togglePlay;

  function seekToRatio(ratio: number) {
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

  // 누른 채 드래그 탐색 — 드래그 중엔 손가락 위치를 미리 보여주고 손을 뗄 때 탐색
  const { scrubRatio, scrubHandlers } = useScrub(seekToRatio);
  const playedRatio = scrubRatio ?? (duration > 0 ? currentTime / duration : 0);
  const playedBarCount = bars ? Math.round(playedRatio * bars.length) : 0;

  const audioEl = isGlobal ? null : (
    <audio
      ref={audioRef}
      src={src}
      onPlay={() => setInlinePlaying(true)}
      onPause={() => setInlinePlaying(false)}
      onTimeUpdate={(e) => handleInlineTimeUpdate(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => setInlineDuration(e.currentTarget.duration)}
      className="hidden"
    />
  );

  if (posterSrc) {
    return (
      <div {...pageTrackAttr} className="group relative aspect-square w-full overflow-hidden rounded-xl">
        <button type="button" onClick={posterOnClick} className="block h-full w-full">
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
        {downloadHref && (
          <a
            href={downloadHref}
            download={downloadName ?? title}
            title="다운로드"
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-sm text-white hover:bg-black/70"
          >
            ⬇
          </a>
        )}
        {heartBurstEl}
      </div>
    );
  }

  return (
    <div {...pageTrackAttr} className="flex w-full flex-col gap-2 rounded-xl bg-neutral-900 p-2.5">
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
          {formatWaveformTime(playedRatio * duration)} / {formatWaveformTime(duration)}
        </span>
        {downloadHref && (
          <a
            href={downloadHref}
            download={downloadName ?? title}
            title="다운로드"
            className="ml-auto shrink-0 rounded-full p-1 text-sm text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
          >
            ⬇
          </a>
        )}
      </div>

      {failed && <p className="text-[11px] text-neutral-400">파형을 분석하지 못했어요. 재생은 문제없어요.</p>}
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
