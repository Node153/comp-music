"use client";

// 잠금화면·알림창·블루투스 이어폰·차량 화면 재생 컨트롤(Media Session API, 2026-09-24).
// 전역 <audio>(GlobalPlayerBar)에 곡 정보(제목·작성자·커버)와 재생/일시정지/탐색/이전·다음 곡
// 동작을 연결한다. iOS는 이게 있어야 백그라운드 재생이 끊기지 않고 잠금화면에 곡이 뜨고,
// Android는 알림창에 미디어 컨트롤이 붙는다. 지원 안 하는 브라우저에선 아무것도 안 한다.
//
// 이어폰을 뽑거나 다른 앱이 소리를 가져가서 브라우저가 직접 멈춘 경우에도 화면(isPlaying)이
// 따라가도록 엘리먼트의 play/pause 이벤트로 상태를 맞춘다.
import { useEffect } from "react";
import type { NowPlayingTrack } from "@/components/NowPlayingContext";

const SEEK_STEP_SECONDS = 10;

type Options = {
  track: NowPlayingTrack | null;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  pause: () => void;
  mediaRef: React.RefObject<HTMLAudioElement | null>;
  playNext: () => boolean;
  playPrev: () => boolean;
  hasNext: boolean;
  hasPrev: boolean;
};

function supported() {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

export function useMediaSession({ track, isPlaying, setIsPlaying, pause, mediaRef, playNext, playPrev, hasNext, hasPrev }: Options) {
  // 곡 정보 — 커버가 없으면 앱 아이콘.
  useEffect(() => {
    if (!supported()) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.author,
      album: "Compmusic",
      artwork: track.posterSrc
        ? [{ src: track.posterSrc, sizes: "512x512" }]
        : [
            { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
          ],
    });
  }, [track]);

  useEffect(() => {
    if (!supported()) return;
    navigator.mediaSession.playbackState = track ? (isPlaying ? "playing" : "paused") : "none";
  }, [track, isPlaying]);

  // 컨트롤 동작. 이전 곡은 대기열에 이전 곡이 없으면 처음부터 다시(일반 음악 앱과 같은 동작).
  useEffect(() => {
    if (!supported()) return;
    const session = navigator.mediaSession;
    const media = () => mediaRef.current;
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      [
        "play",
        () => {
          media()
            ?.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        },
      ],
      ["pause", () => pause()],
      ["stop", () => pause()],
      [
        "seekto",
        (details) => {
          const m = media();
          if (m && details.seekTime !== undefined) m.currentTime = details.seekTime;
        },
      ],
      [
        "seekbackward",
        (details) => {
          const m = media();
          if (m) m.currentTime = Math.max(0, m.currentTime - (details.seekOffset ?? SEEK_STEP_SECONDS));
        },
      ],
      [
        "seekforward",
        (details) => {
          const m = media();
          if (m && Number.isFinite(m.duration)) {
            m.currentTime = Math.min(m.duration, m.currentTime + (details.seekOffset ?? SEEK_STEP_SECONDS));
          }
        },
      ],
      [
        "previoustrack",
        () => {
          if (hasPrev && playPrev()) return;
          const m = media();
          if (m) m.currentTime = 0;
        },
      ],
      // 다음 곡이 없으면 버튼 자체를 숨긴다(null).
      ["nexttrack", hasNext ? () => void playNext() : null],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, track ? handler : null);
      } catch {
        // 브라우저가 모르는 동작(예: 구형 사파리의 stop) — 무시.
      }
    }
  }, [track, mediaRef, setIsPlaying, pause, playNext, playPrev, hasNext, hasPrev]);

  // 잠금화면 진행 막대 + 브라우저가 직접 멈추거나 재개한 경우 화면 상태 동기화.
  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    const syncPosition = () => {
      if (!supported() || !("setPositionState" in navigator.mediaSession)) return;
      const duration = m.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: m.playbackRate || 1,
          position: Math.min(Math.max(0, m.currentTime), duration),
        });
      } catch {
        // 길이가 아직 불확실한 스트림 등 — 다음 이벤트에서 다시 맞춘다.
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      syncPosition();
    };
    // 곡이 끝나서 멈춘 건 GlobalPlayerBar의 ended 처리(다음 곡 재생)가 맡는다.
    const onPause = () => {
      if (!m.ended) setIsPlaying(false);
      syncPosition();
    };
    const events: [string, () => void][] = [
      ["play", onPlay],
      ["pause", onPause],
      ["loadedmetadata", syncPosition],
      ["durationchange", syncPosition],
      ["seeked", syncPosition],
      ["ratechange", syncPosition],
    ];
    for (const [name, fn] of events) m.addEventListener(name, fn);
    return () => {
      for (const [name, fn] of events) m.removeEventListener(name, fn);
    };
  }, [mediaRef, setIsPlaying]);
}
