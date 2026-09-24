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
  /** 현재 재생 중인 트랙 기준으로 다음/이전 곡 재생. 재생했으면 true.
   * 다음 곡은 담기 큐 밖의 곡이면 화면상 다음 카드로 넘어간다. */
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
  /** 지금 재생 + "최근 들은"에 기록(피드 재생버튼용). skipRefresh는 이미 방금 서버가
   * 내려준 최신 데이터일 때만(피드 카드 자체 재생버튼) 써서 불필요한 API 왕복을 건너뛴다 —
   * 재생목록/최근들은 패널에서 트는 경우는 기본값(갱신)으로 둬야 오래된 링크가 안 죽어있다. */
  playNow: (track: PlaylistTrack, opts?: { skipRefresh?: boolean }) => void;
  removeRecent: (id: string) => void;
  clearRecent: () => void;
  /** 담기/최근들은에 같은 id가 있으면 videoSrc 등을 최신 값으로 교체(없으면 아무 일도 안 함).
   * videoSrc는 만료되는 R2 signed URL이라 localStorage에 오래 남아있던 항목은 재생이 안 될 수
   * 있음 — 그 게시물이 피드에 다시 렌더될 때마다(AddToPlaylistButton) 슬쩍 갱신해둔다. */
  refresh: (track: PlaylistTrack) => void;
  /** 지금 화면(피드·프로필)에 보이는 재생 가능한 카드 등록 — 담기 큐에 없는 곡이 끝나면
   * 화면상 다음 카드로 자동 재생하기 위함(usePageTrack). 해제 함수를 돌려준다. */
  registerPageTrack: (track: PlaylistTrack) => () => void;
};

// 카드 루트에 붙이는 속성 — 자동 재생 순서는 등록 순서가 아니라 실제 DOM 순서(화면 위→아래)로 정한다.
export const PAGE_TRACK_ATTR = "data-page-track";

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

  // 화면에 떠 있는 카드들의 트랙 데이터(id → 트랙). 같은 게시물이 두 번 렌더될 수 있어 개수도 센다.
  const pageTracksRef = useRef(new Map<string, { track: PlaylistTrack; count: number }>());
  // 카드가 등록/해제될 때마다 올라가는 번호 — 하단 바 "다음" 버튼 활성 여부(pageHasNext)를 다시 계산하는 신호.
  const [pageVersion, setPageVersion] = useState(0);
  const [pageHasNext, setPageHasNext] = useState(false);
  const [pageHasPrev, setPageHasPrev] = useState(false);
  const registerPageTrack = useCallback((t: PlaylistTrack) => {
    const map = pageTracksRef.current;
    const entry = map.get(t.id);
    map.set(t.id, { track: t, count: (entry?.count ?? 0) + 1 });
    setPageVersion((v) => v + 1);
    return () => {
      const cur = map.get(t.id);
      if (!cur) return;
      if (cur.count <= 1) map.delete(t.id);
      else map.set(t.id, { ...cur, count: cur.count - 1 });
      setPageVersion((v) => v + 1);
    };
  }, []);

  // 담기 큐 밖에서(피드 카드에서 바로) 튼 곡이 끝났을 때 — 화면에서 그 카드 바로 아래에 있는
  // 재생 가능한 카드를 이어서 튼다. 현재 곡 카드가 화면에 없거나(다른 페이지로 이동) 마지막이면 false.
  const pickNextOnPage = useCallback((): PlaylistTrack | null => {
    if (!track || typeof document === "undefined") return null;
    const ids = Array.from(document.querySelectorAll<HTMLElement>(`[${PAGE_TRACK_ATTR}]`))
      .map((el) => el.getAttribute(PAGE_TRACK_ATTR) ?? "")
      .filter((id) => pageTracksRef.current.has(id));
    const at = ids.indexOf(track.id);
    if (at < 0) return null;
    const nextId = ids.slice(at + 1).find((id) => id !== track.id);
    return nextId ? (pageTracksRef.current.get(nextId)?.track ?? null) : null;
  }, [track]);

  // 위와 대칭 — 화면에서 현재 곡 카드 바로 위에 있는 재생 가능한 카드(이전 버튼용).
  const pickPrevOnPage = useCallback((): PlaylistTrack | null => {
    if (!track || typeof document === "undefined") return null;
    const ids = Array.from(document.querySelectorAll<HTMLElement>(`[${PAGE_TRACK_ATTR}]`))
      .map((el) => el.getAttribute(PAGE_TRACK_ATTR) ?? "")
      .filter((id) => pageTracksRef.current.has(id));
    const at = ids.indexOf(track.id);
    if (at < 0) return null;
    const prevId = [...ids.slice(0, at)].reverse().find((id) => id !== track.id);
    return prevId ? (pageTracksRef.current.get(prevId)?.track ?? null) : null;
  }, [track]);

  // 화면상 다음/이전 카드가 있는지 — DOM 순서를 봐야 해서 렌더가 끝난 다음 프레임에 계산한다.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPageHasNext(!!pickNextOnPage());
      setPageHasPrev(!!pickPrevOnPage());
    });
    return () => cancelAnimationFrame(raf);
  }, [pickNextOnPage, pickPrevOnPage, pageVersion]);

  // 재생목록/최근들은에서 실제로 재생을 누르는 순간 서버에서 최신 signed URL을 한 번 더
  // 받아온다 — AddToPlaylistButton의 마운트 시 갱신은 그 게시물이 "지금 피드에 보일 때만"
  // 동작해서, 최근 목록 밖으로 밀려난 옛날 게시물은 놓칠 수 있다(사용자 제보: "특정 트랙만
  // 재생목록에서 안 됨" — 딱 이 케이스). 실패하면 갖고 있던 값 그대로 재생을 시도한다.
  const fetchFreshTrack = useCallback(async (t: PlaylistTrack): Promise<PlaylistTrack> => {
    try {
      const res = await fetch(`/api/media/track-url?postId=${encodeURIComponent(t.id)}`);
      if (!res.ok) return t;
      const data = (await res.json()) as { videoSrc?: string; posterSrc?: string | null };
      if (!data.videoSrc) return t;
      return { ...t, videoSrc: data.videoSrc, posterSrc: data.posterSrc ?? t.posterSrc };
    } catch {
      return t;
    }
  }, []);

  const playAt = useCallback(
    (index: number) => {
      const target = items[index];
      if (!target) return;
      void fetchFreshTrack(target).then((fresh) => {
        play(fresh);
        setItems((prev) => prev.map((t) => (t.id === fresh.id ? fresh : t)));
      });
    },
    [items, play, fetchFreshTrack],
  );

  const playNow = useCallback(
    (next: PlaylistTrack, opts?: { skipRefresh?: boolean }) => {
      const run = async () => {
        const fresh = opts?.skipRefresh ? next : await fetchFreshTrack(next);
        play(fresh);
        setRecentlyPlayed((prev) => [fresh, ...prev.filter((t) => t.id !== fresh.id)].slice(0, RECENT_MAX));
      };
      void run();
    },
    [play, fetchFreshTrack],
  );

  const playNext = useCallback(() => {
    if (currentIndex < 0) {
      const onPage = pickNextOnPage();
      if (!onPage) return false;
      playNow(onPage);
      return true;
    }
    if (currentIndex >= items.length - 1) return false;
    const target = items[currentIndex + 1];
    void fetchFreshTrack(target).then((fresh) => {
      play(fresh);
      setItems((prev) => prev.map((t) => (t.id === fresh.id ? fresh : t)));
    });
    return true;
  }, [currentIndex, items, play, fetchFreshTrack, pickNextOnPage, playNow]);

  const playPrev = useCallback(() => {
    if (currentIndex < 0) {
      const onPage = pickPrevOnPage();
      if (!onPage) return false;
      playNow(onPage);
      return true;
    }
    if (currentIndex <= 0) return false;
    const target = items[currentIndex - 1];
    void fetchFreshTrack(target).then((fresh) => {
      play(fresh);
      setItems((prev) => prev.map((t) => (t.id === fresh.id ? fresh : t)));
    });
    return true;
  }, [currentIndex, items, play, fetchFreshTrack, pickPrevOnPage, playNow]);

  const removeRecent = useCallback((id: string) => {
    setRecentlyPlayed((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearRecent = useCallback(() => setRecentlyPlayed([]), []);

  const refresh = useCallback((next: PlaylistTrack) => {
    // id가 없으면 이전 배열 참조를 그대로 돌려줘서 불필요한 리렌더가 안 나게 한다.
    setItems((prev) => (prev.some((t) => t.id === next.id) ? prev.map((t) => (t.id === next.id ? next : t)) : prev));
    setRecentlyPlayed((prev) =>
      prev.some((t) => t.id === next.id) ? prev.map((t) => (t.id === next.id ? next : t)) : prev,
    );
  }, []);

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
        // 담기 큐 곡이면 큐 기준, 피드·프로필에서 바로 튼 곡이면 화면상 다음 카드 기준.
        hasNext: currentIndex >= 0 ? currentIndex < items.length - 1 : pageHasNext,
        // 담기 큐 곡이면 큐 기준, 피드·프로필에서 바로 튼 곡이면 화면상 이전 카드 기준.
        hasPrev: currentIndex >= 0 ? currentIndex > 0 : pageHasPrev,
        queueOpen,
        setQueueOpen,
        toggleQueue,
        recentlyPlayed,
        playNow,
        removeRecent,
        clearRecent,
        refresh,
        registerPageTrack,
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

// 피드·프로필 카드가 자기 트랙을 "화면상 다음 곡 자동 재생" 후보로 등록한다(게스트면 아무 일도 안 함).
// 카드 루트에는 {[PAGE_TRACK_ATTR]: id}도 같이 붙여야 순서가 잡힌다.
export function usePageTrack(track: PlaylistTrack | null) {
  const register = useContext(PlaylistContext)?.registerPageTrack;
  const key = track ? JSON.stringify(track) : null;
  useEffect(() => {
    if (!register || !key) return;
    return register(JSON.parse(key) as PlaylistTrack);
  }, [register, key]);
}
