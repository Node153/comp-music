"use client";

// 전역 재생 상태 — (app)/layout.tsx에 마운트되어 피드/프로필/업로드/DM 등 페이지를 이동해도
// 언마운트되지 않는다(같은 레이아웃 세그먼트 안에서는 Next.js가 layout을 유지). 이 덕분에
// 실제 <video> 재생은 GlobalPlayerBar 안의 엘리먼트 하나로만 이뤄지고, 페이지 이동에도 안 끊긴다.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notifyReaction } from "@/lib/notifyReaction";
import { onBeforeFlush, track as trackEvent } from "@/lib/analytics";

export type NowPlayingTrack = {
  id: string;
  title: string;
  author: string;
  videoSrc: string;
  // 사운드바 우측 커버 썸네일용(플레이리스트에서 담은 트랙이면 채워짐).
  posterSrc?: string | null;
  // 재생 목록에서 게시자 이름 클릭 시 프로필로 이동하기 위한 user id.
  authorId?: string;
  // memo(비공개) 게시물의 노출 만료 시각 — 있으면 재생목록에 남은 시간 카운트다운을 보여준다.
  // DEMO는 영구노출이라 항상 null/undefined.
  expiresAt?: string | null;
  // 영상 게시물인데 별도 커버(posterSrc)가 없을 때, 재생목록 썸네일을 헤드폰 아이콘 대신
  // 영상 자체의 첫 프레임으로 보여주기 위한 구분(QueuePanel).
  mediaType?: "audio" | "video";
};

type NowPlayingContextValue = {
  track: NowPlayingTrack | null;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  play: (track: NowPlayingTrack) => void;
  pause: () => void;
  toggle: () => void;
  close: () => void;
  // 실제 소리를 내는 전역 미디어 엘리먼트. 이름은 예전 그대로 videoRef지만 2026-09-24부터
  // <audio>다 — 화면에 보이는 영상은 카드의 음소거 미리보기(PostVideo)가 따로 그리고 이 엘리먼트는
  // 소리만 내므로, iOS가 앱을 내리거나 화면을 끄면 멈춰버리는 <video> 대신 백그라운드 재생이
  // 되는 <audio>를 쓴다(<audio>도 mp4·mov 영상 파일의 소리를 그대로 재생한다).
  videoRef: React.RefObject<HTMLAudioElement | null>;
  // 현재 트랙 길이(초). GlobalPlayerBar가 <video> 메타데이터에서 읽어 올려준다 —
  // 카드(SoundbarPlayer)가 렌더 중 ref를 만지지 않고도 진행률을 계산할 수 있게.
  duration: number;
  setDuration: (v: number) => void;
  // DEMO 조회수(0053/0054) — 이 트랙이 실제로 30초 이상 재생돼 서버에 카운트가 반영된
  // 직후의 이벤트. 카드(PostVideo/SoundbarPlayer)가 자기 postId와 비교해서 화면 숫자를
  // 낙관적으로 올리는 용도 — at은 매번 새 값이라 같은 트랙이 다시 카운트돼도 감지된다.
  lastCountedView: { id: string; at: number } | null;
};

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null);

export function NowPlayingProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<NowPlayingTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [lastCountedView, setLastCountedView] = useState<{ id: string; at: number } | null>(null);
  const videoRef = useRef<HTMLAudioElement>(null);

  // 조회수(0053/0054) 30초 시청 세션 — 실제 소리가 나는 이 <video> 하나를 기준으로 재는다.
  // 피드 인라인 재생/최근 들은/담기 큐 재생이 전부 결국 play()를 거치므로 여기 한 곳에서만
  // 재면 어디서 재생을 시작했든 동일하게 처리된다(사용자 요청). memo(expiresAt 있음)는
  // 조회수 개념이 없어서 트랙 id를 세션에 안 실어 아예 재지 않는다.
  // 지금 재생 중인 트랙 id — play()가 같은 트랙 재호출인지 판단하는 데만 쓴다(state인 track을
  // 읽으려면 play의 의존성이 바뀌어 매 렌더 새 함수가 되므로 ref로 따로 둔다).
  const currentTrackIdRef = useRef<string | null>(null);
  // 같은 세션으로 "5초 이상 재생함"(post_plays, 0072 — 피드에서 안 들은 글 먼저 보여주기용)도
  // 잰다. 이건 memo 글도 대상이라 trackId는 항상 싣고, 조회수 대상인지는 countView로 가른다.
  const viewSessionRef = useRef<{
    trackId: string | null;
    countView: boolean;
    watchedMs: number;
    counted: boolean;
    played: boolean;
    lastWallClock: number | null;
  }>({ trackId: null, countView: false, watchedMs: 0, counted: false, played: false, lastWallClock: null });

  // 이용 통계(0079) — 한 곡을 몇 초 듣고 넘겼는지. 다른 곡으로 넘어가거나/끝까지 듣거나/닫거나/
  // 페이지를 떠날 때 지금까지 들은 만큼을 play_end로 남기고 누적을 0으로 돌린다(같은 곡을 다시
  // 들으면 그 뒤 들은 만큼이 또 한 번의 play_end가 된다). 1초도 안 들었으면 남기지 않는다.
  // 조회수/post_plays와 같은 watchedMs(실제 경과 시간, 틱당 2초 캡)를 쓴다.
  const endPlaySession = useCallback((reason: "switch" | "ended" | "close" | "leave") => {
    const session = viewSessionRef.current;
    if (!session.trackId || session.watchedMs < 1000) return;
    const listenedS = Math.round(session.watchedMs / 1000);
    const duration = videoRef.current?.duration;
    const durationS = duration && Number.isFinite(duration) ? Math.round(duration) : null;
    trackEvent("play_end", {
      post: session.trackId,
      props: {
        listened_s: listenedS,
        duration_s: durationS,
        pct: durationS ? Math.min(100, Math.round((listenedS / durationS) * 100)) : null,
        reason,
        memo: !session.countView,
      },
    });
    session.watchedMs = 0;
  }, []);

  useEffect(() => onBeforeFlush(() => endPlaySession("leave")), [endPlaySession]);

  const play = useCallback((next: NowPlayingTrack) => {
    setTrack(next);
    setIsPlaying(true);
    // 길이는 트랙이 실제로 바뀔 때만 0으로 초기화한다 — 같은 트랙이 다시 play()로 들어오면
    // (아래 주석의 버퍼링 후 네이티브 onPlay 재발화, 일시정지 후 재개 등) <video> src가 그대로라
    // loadedmetadata/durationchange가 다시 안 불려서, 여기서 0으로 지우면 끝 시간이 0:00에
    // 멈추고 진행 바도 안 움직였다(사용자 제보, 2026-09-23 — 영상 게시물 사운드바).
    if (currentTrackIdRef.current !== next.id) setDuration(0);
    currentTrackIdRef.current = next.id;
    // 같은 트랙이 다시 play()로 들어오면(예: 영상 미리보기가 버퍼링으로 잠깐 멈췄다 브라우저가
    // 자동으로 다시 발화하는 네이티브 onPlay, 혹은 일시정지 후 재개) 세션을 리셋하지 않고
    // 누적을 그대로 이어간다 — 트랙 id가 바뀔 때만 새로 잰다. 예전엔 play()가 불릴 때마다
    // 무조건 리셋해서, PostVideo의 재생/일시정지 버튼이 재생 중 버퍼링 등으로 onPlay를 다시
    // 쏠 때마다 30초 누적이 매번 0으로 끊겨 조회수가 사실상 절대 안 올라가고 있었다(사용자
    // 제보: "새로고침하면 조회수가 초기화되는데" — 실제로는 초기화가 아니라 애초에 DB에
    // 반영된 적이 없었던 것).
    if (viewSessionRef.current.trackId === next.id) return;
    endPlaySession("switch");
    trackEvent("play_start", { post: next.id, props: { memo: Boolean(next.expiresAt) } });
    viewSessionRef.current = {
      trackId: next.id,
      countView: !next.expiresAt,
      watchedMs: 0,
      counted: false,
      played: false,
      lastWallClock: null,
    };
  }, [endPlaySession]);

  // 전역 <video>는 (app) 레이아웃에 항상 마운트돼 있어서(GlobalPlayerBar) 이 리스너는
  // 앱이 켜져 있는 동안 한 번만 붙으면 된다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      const session = viewSessionRef.current;
      // 조회수·재생 기록이 끝난 뒤에도 누적은 계속한다 — 통계(play_end)의 들은 시간에 쓴다.
      if (!session.trackId) return;
      const now = Date.now();
      // 실제 경과한 시간(wall clock)만으로 누적한다 — 예전엔 video.currentTime 변화량과도
      // 비슷해야만 인정했는데, R2 signed URL로 스트리밍하는 오디오는 버퍼링 때문에
      // currentTime 진행이 실제 시간과 미세하게 안 맞는 틱이 잦아서 정상 재생인데도 계속
      // 누락되고 있었다(사용자 제보: "재생해서 조회수를 높였는데 새로고침하니 반영 안 됨" —
      // 30초를 사실상 거의 못 채우고 있었음). 탐색/탭 백그라운드 등으로 시간이 훌쩍 뛰는
      // 경우만 틱당 2초로 캡을 씌워 과대 집계를 막는다. 일시정지 중엔 애초에 timeupdate가
      // 안 불리지만, paused 체크도 한 번 더 해서 안전하게 막는다.
      if (session.lastWallClock !== null && !video.paused) {
        const deltaWall = (now - session.lastWallClock) / 1000;
        if (deltaWall > 0) {
          session.watchedMs += Math.min(deltaWall, 2) * 1000;
        }
      }
      session.lastWallClock = now;
      if (!session.played && session.watchedMs >= 5000) {
        session.played = true;
        // 비로그인은 함수 권한이 없어 실패한다 — 피드 정렬용 기록일 뿐이라 조용히 무시.
        // 0076 — 이번에 처음 기록된 재생이면(true) 작성자에게 청취자 수 알림을 보낼지 서버가 판단.
        const playedId = session.trackId;
        createClient()
          .rpc("mark_post_played", { pid: playedId })
          .then(({ data }) => {
            if (data === true) notifyReaction({ kind: "play", postId: playedId });
          });
      }
      if (session.countView && !session.counted && session.watchedMs >= 30000) {
        session.counted = true;
        const viewedId = session.trackId;
        // ⚠️ postgrest-js의 쿼리 빌더는 .then()을 실제로 호출해야만 fetch가 나간다("thenable"
        // 지연 실행 — .rpc(...)만 만들어두고 아무도 안 부르면 요청 자체가 안 보내진다).
        // void만 붙이고 끝내면 컴파일은 되지만 네트워크 요청이 영영 안 나가서, 여태 조회수가
        // DB에 전혀 반영되지 않고 있었다(사용자 제보로 Supabase 로그까지 까서 확인한 원인).
        // .then()으로 실제 실행시키고 실패하면 최소한 콘솔에라도 남긴다.
        createClient()
          .rpc("increment_post_view", { pid: viewedId })
          .then(({ error }) => {
            if (error) console.error("increment_post_view failed", error);
          });
        setLastCountedView({ id: viewedId, at: now });
      }
    };
    const onEnded = () => endPlaySession("ended");
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
  }, [endPlaySession]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // ⚠️ "음소거로 먼저 재생 후 해제" 우회를 넣었다가 되돌림 — GlobalPlayerBar와 같은 이유
      // (비동기 unmute를 브라우저가 제스처 밖 행동으로 보고 재생을 멈추는 걸 재현·확인함).
      video.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const close = useCallback(() => {
    endPlaySession("close");
    videoRef.current?.pause();
    currentTrackIdRef.current = null;
    setTrack(null);
    setIsPlaying(false);
    setDuration(0);
  }, [endPlaySession]);

  return (
    <NowPlayingContext.Provider
      value={{
        track,
        isPlaying,
        setIsPlaying,
        play,
        pause,
        toggle,
        close,
        videoRef,
        duration,
        setDuration,
        lastCountedView,
      }}
    >
      {children}
    </NowPlayingContext.Provider>
  );
}

export function useNowPlaying() {
  const ctx = useContext(NowPlayingContext);
  if (!ctx) throw new Error("useNowPlaying은 NowPlayingProvider 안에서만 사용할 수 있어요");
  return ctx;
}
