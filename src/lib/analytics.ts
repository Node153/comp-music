// 이용 통계 수집 클라이언트(0079) — 어디서든 track()만 부르면 된다. 전송은 AnalyticsTracker가
// 30초마다, 그리고 탭을 떠날 때(sendBeacon) 모아서 /api/t로 보낸다.
// 로그인 여부·user_id는 서버가 쿠키로 판단한다(클라이언트가 보낸 값을 믿지 않음).
// 통계는 부가 기능이라 여기서 나는 어떤 오류도 앱을 깨면 안 된다 — 전부 try/catch로 삼킨다.

export type AnalyticsEventName =
  | "page_view"
  | "link_open"
  | "post_impression"
  | "play_start"
  | "play_end"
  | "share"
  | "upload_submit"
  | "upload_error"
  | "install_prompt_shown"
  | "install_prompt_result"
  | "pwa_installed";

type QueuedEvent = {
  n: AnalyticsEventName;
  t: number;
  p: string;
  post?: string;
  x?: Record<string, string | number | boolean | null>;
};

const SESSION_KEY = "cm:an:session:v1";
const ANON_KEY = "cm:an:anon:v1";
// 이만큼 활동이 없다가 돌아오면 새 방문(세션)으로 본다 — GA와 같은 기준.
const SESSION_IDLE_MS = 30 * 60_000;
const MAX_QUEUE = 200;

const queue: QueuedEvent[] = [];
let activeMs = 0;
let listenMs = 0;
const beforeFlushHooks = new Set<() => void>();

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 사파리 개인정보 보호 모드 등 — 탭 단위로만 유지된다.
  }
}

let memoryAnon: string | null = null;
export function getAnonId(): string {
  const stored = readJson<string>(ANON_KEY);
  if (stored) return stored;
  memoryAnon ??= uuid();
  writeJson(ANON_KEY, memoryAnon);
  return memoryAnon;
}

type StoredSession = { id: string; last: number; meta: SessionMeta };

export type SessionMeta = {
  device_type: string;
  os: string;
  browser: string;
  is_pwa: boolean;
  screen_w: number;
  screen_h: number;
  entry_path: string;
  entry_src: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

let memorySession: StoredSession | null = null;

// 현재 세션을 돌려준다. 30분 넘게 비어 있었으면 새로 만든다(이때만 기기·유입 정보를 새로 잰다).
export function currentSession(): StoredSession {
  const now = Date.now();
  const stored = readJson<StoredSession>(SESSION_KEY) ?? memorySession;
  if (stored && now - stored.last < SESSION_IDLE_MS) {
    memorySession = stored;
    return stored;
  }
  const fresh: StoredSession = { id: uuid(), last: now, meta: collectMeta() };
  memorySession = fresh;
  writeJson(SESSION_KEY, fresh);
  return fresh;
}

// 활동이 있었다는 표시 — 세션 만료 시계를 뒤로 민다.
export function touchSession() {
  const s = currentSession();
  s.last = Date.now();
  memorySession = s;
  writeJson(SESSION_KEY, s);
}

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

// 기기 판별은 UA로 한다 — iPadOS 사파리는 UA가 Mac과 똑같아서 터치 지점 수로 가른다.
export function detectDevice(ua: string, touchPoints: number) {
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const os = /iPhone|iPod/.test(ua) || isIpad
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /CrOS/.test(ua)
        ? "ChromeOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "other";
  const device_type = isIpad || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? "tablet"
    : /Mobi|iPhone|iPod|Android/.test(ua)
      ? "mobile"
      : "desktop";
  // 인앱 브라우저(카톡·인스타로 링크를 연 경우)를 먼저 — 유입 경로 파악에 중요.
  const browser = /KAKAOTALK/i.test(ua)
    ? "KakaoTalk"
    : /Instagram/.test(ua)
      ? "Instagram"
      : /FBAN|FBAV/.test(ua)
        ? "Facebook"
        : /NAVER\(/.test(ua)
          ? "NAVER"
          : /Line\//.test(ua)
            ? "LINE"
            : /SamsungBrowser/.test(ua)
              ? "Samsung"
              : /Whale/.test(ua)
                ? "Whale"
                : /Edg\//.test(ua)
                  ? "Edge"
                  : /CriOS|Chrome\//.test(ua)
                    ? "Chrome"
                    : /FxiOS|Firefox\//.test(ua)
                      ? "Firefox"
                      : /Safari\//.test(ua)
                        ? "Safari"
                        : "other";
  return { device_type, os, browser };
}

function collectMeta(): SessionMeta {
  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | null = null;
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).host;
      if (host !== window.location.host) referrerHost = host;
    }
  } catch {
    // 잘못된 referrer는 무시
  }
  return {
    ...detectDevice(navigator.userAgent, navigator.maxTouchPoints || 0),
    is_pwa: isStandalone(),
    screen_w: Math.round(window.screen?.width || 0),
    screen_h: Math.round(window.screen?.height || 0),
    entry_path: window.location.pathname,
    entry_src: params.get("src"),
    referrer_host: referrerHost,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  };
}

export function track(
  name: AnalyticsEventName,
  opts: { post?: string | null; props?: QueuedEvent["x"] } = {},
) {
  try {
    if (typeof window === "undefined") return;
    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push({
      n: name,
      t: Date.now(),
      p: window.location.pathname,
      ...(opts.post ? { post: opts.post } : {}),
      ...(opts.props ? { x: opts.props } : {}),
    });
  } catch {
    // 무시
  }
}

export function addActiveMs(ms: number) {
  activeMs += ms;
}

export function addListenMs(ms: number) {
  listenMs += ms;
}

// 떠나기 직전에 마지막 이벤트(예: 듣던 곡의 play_end)를 큐에 넣을 기회를 준다.
export function onBeforeFlush(fn: () => void): () => void {
  beforeFlushHooks.add(fn);
  return () => beforeFlushHooks.delete(fn);
}

// sendBeacon은 페이지가 닫히는 중에도 브라우저가 끝까지 보내준다. leaving=true(페이지를 실제로
// 떠남)일 때만 onBeforeFlush 훅을 불러 진행 중이던 것(듣던 곡 등)을 마무리해 같이 보낸다.
export function flush(leaving = false) {
  try {
    if (leaving) beforeFlushHooks.forEach((fn) => fn());
    const activeS = Math.floor(activeMs / 1000);
    const listenS = Math.floor(listenMs / 1000);
    if (queue.length === 0 && activeS === 0 && listenS === 0) return;

    const session = currentSession();
    const events = queue.splice(0, queue.length);
    activeMs -= activeS * 1000;
    listenMs -= listenS * 1000;

    const body = JSON.stringify({
      sid: session.id,
      aid: getAnonId(),
      meta: session.meta,
      a: activeS,
      l: listenS,
      e: events,
    });

    if (navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // 무시
  }
}
