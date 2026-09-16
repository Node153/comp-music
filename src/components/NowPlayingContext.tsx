"use client";

// 전역 재생 상태 — (app)/layout.tsx에 마운트되어 피드/프로필/업로드/DM 등 페이지를 이동해도
// 언마운트되지 않는다(같은 레이아웃 세그먼트 안에서는 Next.js가 layout을 유지). 이 덕분에
// 실제 <video> 재생은 GlobalPlayerBar 안의 엘리먼트 하나로만 이뤄지고, 페이지 이동에도 안 끊긴다.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  videoRef: React.RefObject<HTMLVideoElement | null>;
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
  const videoRef = useRef<HTMLVideoElement>(null);

  // 조회수(0053/0054) 30초 시청 세션 — 실제 소리가 나는 이 <video> 하나를 기준으로 재는다.
  // 피드 인라인 재생/최근 들은/담기 큐 재생이 전부 결국 play()를 거치므로 여기 한 곳에서만
  // 재면 어디서 재생을 시작했든 동일하게 처리된다(사용자 요청). memo(expiresAt 있음)는
  // 조회수 개념이 없어서 트랙 id를 세션에 안 실어 아예 재지 않는다.
  const viewSessionRef = useRef<{
    trackId: string | null;
    watchedMs: number;
    counted: boolean;
    lastWallClock: number | null;
  }>({ trackId: null, watchedMs: 0, counted: false, lastWallClock: null });

  const play = useCallback((next: NowPlayingTrack) => {
    setTrack(next);
    setIsPlaying(true);
    setDuration(0);
    // 같은 트랙이 다시 play()로 들어오면(예: 영상 미리보기가 버퍼링으로 잠깐 멈췄다 브라우저가
    // 자동으로 다시 발화하는 네이티브 onPlay, 혹은 일시정지 후 재개) 세션을 리셋하지 않고
    // 누적을 그대로 이어간다 — 트랙 id가 바뀔 때만 새로 잰다. 예전엔 play()가 불릴 때마다
    // 무조건 리셋해서, PostVideo의 재생/일시정지 버튼이 재생 중 버퍼링 등으로 onPlay를 다시
    // 쏠 때마다 30초 누적이 매번 0으로 끊겨 조회수가 사실상 절대 안 올라가고 있었다(사용자
    // 제보: "새로고침하면 조회수가 초기화되는데" — 실제로는 초기화가 아니라 애초에 DB에
    // 반영된 적이 없었던 것).
    if (viewSessionRef.current.trackId === next.id) return;
    viewSessionRef.current = {
      trackId: next.expiresAt ? null : next.id,
      watchedMs: 0,
      counted: false,
      lastWallClock: null,
    };
  }, []);

  // 전역 <video>는 (app) 레이아웃에 항상 마운트돼 있어서(GlobalPlayerBar) 이 리스너는
  // 앱이 켜져 있는 동안 한 번만 붙으면 된다.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      const session = viewSessionRef.current;
      if (!session.trackId || session.counted) return;
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
      if (session.watchedMs >= 30000) {
        session.counted = true;
        const viewedId = session.trackId;
        void createClient().rpc("increment_post_view", { pid: viewedId });
        setLastCountedView({ id: viewedId, at: now });
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

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
    videoRef.current?.pause();
    setTrack(null);
    setIsPlaying(false);
    setDuration(0);
  }, []);

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
