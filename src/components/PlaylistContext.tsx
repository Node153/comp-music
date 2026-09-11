"use client";

// DEMO 탭 "미니 플레이리스트" — 이름 없는 단일 재생 큐 하나.
// NowPlayingProvider 안에 마운트되어 실제 재생은 기존 GlobalPlayerBar(<video> 하나)에
// 그대로 위임하고, 여기서는 "다음에 뭘 틀지"(순서) 상태만 들고 있는다.
// 저장은 localStorage(브라우저 한정, 기기 바꾸면 초기화) — LeftSidebar 장르 필터와 같은
// MVP 방식. 나중에 계정별로 옮기려면 이 파일의 load/save만 교체하면 된다.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNowPlaying, type NowPlayingTrack } from "@/components/NowPlayingContext";

export type PlaylistTrack = NowPlayingTrack;

const STORAGE_KEY = "comp:demo-playlist:v1";
const QUEUE_OPEN_KEY = "comp:demo-playlist:queue-open";
const RECENT_KEY = "comp:demo-playlist:recent:v1";
const RECENT_MAX = 20;

type PlaylistContextValue = {
  items: PlaylistTrack[];
  has: (id: string) => boolean;
  add: (track: PlaylistTrack) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** 큐의 index번째 트랙을 지금 재생 */
  playAt: (index: number) => void;
  /** 현재 재생 중인 트랙 기준으로 다음/이전 곡 재생. 재생했으면 true */
  playNext: () => boolean;
  playPrev: () => boolean;
  currentIndex: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** 사운드바에 붙는 "다음 트랙" 패널 열림 여부 */
  queueOpen: boolean;
  setQueueOpen: (v: boolean) => void;
  toggleQueue: () => void;
  /** 피드에서 바로 튼 트랙 히스토리(최신 순). "다음 트랙"(담기 큐)과 별개. */
  recentlyPlayed: PlaylistTrack[];
  /** 지금 재생 + "최근 들은"에 기록(피드 재생버튼용) */
  playNow: (track: PlaylistTrack) => void;
  removeRecent: (id: string) => void;
  clearRecent: () => void;
};

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const { track, play } = useNowPlaying();
  const [items, setItems] = useState<PlaylistTrack[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<PlaylistTrack[]>([]);
  const [queueOpen, setQueueOpenState] = useState(false);
  const loadedRef = useRef(false);

  // 최초 1회 localStorage에서 복원 — 접근 불가 환경이면 빈 큐로 둔다.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed.filter((t) => t && t.id && t.videoSrc));
      }
      const rawRecent = localStorage.getItem(RECENT_KEY);
      if (rawRecent) {
        const parsed = JSON.parse(rawRecent);
        if (Array.isArray(parsed))
          setRecentlyPlayed(parsed.filter((t) => t && t.id && t.videoSrc).slice(0, RECENT_MAX));
      }
      setQueueOpenState(localStorage.getItem(QUEUE_OPEN_KEY) === "1");
    } catch {
      // 무시
    }
    loadedRef.current = true;
  }, []);

  // 변경 시마다 저장(복원 완료 전에는 건드리지 않아 첫 렌더에서 빈 배열로 덮어쓰지 않게).
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // 무시
    }
  }, [items]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyPlayed));
    } catch {
      // 무시
    }
  }, [recentlyPlayed]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(QUEUE_OPEN_KEY, queueOpen ? "1" : "0");
    } catch {
      // 무시
    }
  }, [queueOpen]);

  const setQueueOpen = useCallback((v: boolean) => setQueueOpenState(v), []);
  const toggleQueue = useCallback(() => setQueueOpenState((v) => !v), []);

  const has = useCallback((id: string) => items.some((t) => t.id === id), [items]);

  const add = useCallback((next: PlaylistTrack) => {
    setItems((prev) => (prev.some((t) => t.id === next.id) ? prev : [...prev, next]));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const currentIndex = track ? items.findIndex((t) => t.id === track.id) : -1;

  const playAt = useCallback(
    (index: number) => {
      const target = items[index];
      if (target) play(target);
    },
    [items, play],
  );

  const playNext = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= items.length - 1) return false;
    play(items[currentIndex + 1]);
    return true;
  }, [currentIndex, items, play]);

  const playPrev = useCallback(() => {
    if (currentIndex <= 0) return false;
    play(items[currentIndex - 1]);
    return true;
  }, [currentIndex, items, play]);

  const playNow = useCallback(
    (next: PlaylistTrack) => {
      play(next);
      setRecentlyPlayed((prev) => [next, ...prev.filter((t) => t.id !== next.id)].slice(0, RECENT_MAX));
    },
    [play],
  );

  const removeRecent = useCallback((id: string) => {
    setRecentlyPlayed((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearRecent = useCallback(() => setRecentlyPlayed([]), []);

  return (
    <PlaylistContext.Provider
      value={{
        items,
        has,
        add,
        remove,
        clear,
        playAt,
        playNext,
        playPrev,
        currentIndex,
        hasNext: currentIndex >= 0 && currentIndex < items.length - 1,
        hasPrev: currentIndex > 0,
        queueOpen,
        setQueueOpen,
        toggleQueue,
        recentlyPlayed,
        playNow,
        removeRecent,
        clearRecent,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylist은 PlaylistProvider 안에서만 사용할 수 있어요");
  return ctx;
}

// 비로그인(게스트) 피드처럼 PlaylistProvider 밖에서도 렌더될 수 있는 컴포넌트용 — 없으면 null.
export function usePlaylistOptional() {
  return useContext(PlaylistContext);
}
