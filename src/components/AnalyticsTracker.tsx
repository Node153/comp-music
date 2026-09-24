"use client";

// 이용 통계 수집(0079) — 루트 레이아웃에 하나만 심어두는 마운트 전용 컴포넌트(화면엔 아무것도 안 그림).
// 비로그인 랜딩·가입 화면부터 관리자 화면까지 전부 잰다(가입 퍼널을 보려면 로그인 전 방문도 필요).
//   - page_view: 경로가 바뀔 때마다
//   - link_open: ?src= 태그가 붙은 링크(푸시·메일·공유)로 들어왔을 때
//   - post_impression: 게시물 카드([data-post-id])가 화면에 절반 이상 1초 넘게 보였을 때(화면당 1회)
//   - 활동 시간: 화면이 보이고 최근 60초 안에 입력이 있었거나 소리가 나는 동안
//   - 청취 시간: 소리가 나는 동안(화면이 꺼져 있어도)
// 전송은 30초마다 + 탭이 가려지거나 닫힐 때.
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  addActiveMs,
  addListenMs,
  flush,
  touchSession,
  currentSession,
  track,
} from "@/lib/analytics";

const TICK_MS = 5_000;
const FLUSH_MS = 30_000;
const INPUT_IDLE_MS = 60_000;
// 탭이 백그라운드에서 타이머가 늦게 불리거나(크롬은 1분에 1번) iOS가 JS를 멈췄다 깨운 경우 —
// 한 틱에 이 이상은 인정하지 않는다(과대 집계 방지).
const MAX_TICK_GAP_MS = 70_000;
const IMPRESSION_DWELL_MS = 1_000;

// page_view에 남길 쿼리 파라미터 — 토큰·코드 같은 민감한 값이 섞이지 않게 화이트리스트로만.
const KEPT_PARAMS = ["feed", "tag", "tab", "from"];

function soundIsPlaying(): boolean {
  const media = document.querySelectorAll<HTMLMediaElement>("audio, video");
  for (const el of media) {
    if (!el.paused && !el.muted && !el.ended) return true;
  }
  return false;
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 같은 /feed라도 DEMO↔memo 탭(?feed=)이 바뀌면 다른 화면으로 센다. src는 키에서 뺀다 — 아래에서
  // 주소창의 src를 지우면 searchParams가 바뀌는데 그걸로 page_view가 또 찍히면 안 된다.
  const viewKey = `${pathname}?${KEPT_PARAMS.map((k) => searchParams.get(k) ?? "").join("|")}`;

  // 화면이 바뀔 때마다 page_view(+ ?src가 있으면 link_open).
  useEffect(() => {
    // 새 세션이 필요하면 여기서 만들어진다 — 그래야 세션의 첫 화면·유입 태그가 이 페이지가 된다.
    currentSession();
    touchSession();
    const params = new URLSearchParams(window.location.search);
    const kept: Record<string, string> = {};
    for (const key of KEPT_PARAMS) {
      const v = params.get(key);
      if (v) kept[key] = v.slice(0, 60);
    }
    track("page_view", { props: kept });
    const src = params.get("src");
    if (src) {
      track("link_open", { props: { src: src.slice(0, 60) } });
      // 주소창에 남겨두면 새로고침·링크 재공유 때마다 또 집계되므로 지운다(해시는 유지 — 게시물 앵커).
      params.delete("src");
      const rest = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    }
  }, [viewKey]);

  // 활동·청취 시간 + 주기 전송 + 떠날 때 전송.
  useEffect(() => {
    let lastInput = Date.now();
    let lastTick = Date.now();

    const onInput = () => {
      lastInput = Date.now();
    };
    const inputEvents = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const ev of inputEvents) window.addEventListener(ev, onInput, { passive: true, capture: true });

    // wasVisible: 지난 틱부터 지금까지 화면이 보였는지. 보이기/가리기 전환 순간엔 현재 상태가 아니라
    // 직전 구간의 상태로 세야 해서(가려져 있던 시간을 돌아온 순간 활동으로 세지 않게) 따로 받는다.
    const tick = (wasVisible = document.visibilityState === "visible") => {
      const now = Date.now();
      const gap = Math.min(now - lastTick, MAX_TICK_GAP_MS);
      lastTick = now;
      const sound = soundIsPlaying();
      const visible = wasVisible;
      if (sound) addListenMs(gap);
      if (visible && (sound || now - lastInput < INPUT_IDLE_MS)) {
        addActiveMs(gap);
        touchSession();
      } else if (sound) {
        touchSession();
      }
    };

    const tickTimer = window.setInterval(() => tick(), TICK_MS);
    const flushTimer = window.setInterval(() => flush(false), FLUSH_MS);

    // 가려질 때도 보낸다(모바일은 앱 전환 후 그대로 종료되는 일이 많아 pagehide가 안 올 수 있음).
    // 다만 백그라운드 재생은 계속되므로 듣던 곡을 끝난 것으로 치지는 않는다(leaving=false).
    const onVisibility = () => {
      tick(document.visibilityState === "hidden");
      flush(false);
    };
    const onPageHide = () => {
      tick();
      flush(true);
    };
    const onInstalled = () => track("pwa_installed");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      for (const ev of inputEvents) window.removeEventListener(ev, onInput, { capture: true });
      window.clearInterval(tickTimer);
      window.clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 게시물 노출 — 카드 컴포넌트를 일일이 고치지 않고 [data-post-id]를 전역으로 관찰한다.
  // 무한 스크롤로 카드가 계속 추가되므로 MutationObserver로 새 카드를 붙인다. 화면이 바뀌면
  // 다시 만들어서(seen 초기화) 같은 게시물이 다른 화면에서 보인 것도 새 노출로 센다.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const timers = new Map<Element, number>();
    const observed = new WeakSet<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const postId = el.dataset.postId;
          if (!postId || seen.has(postId)) continue;
          if (entry.isIntersecting) {
            if (timers.has(el)) continue;
            timers.set(
              el,
              window.setTimeout(() => {
                timers.delete(el);
                if (seen.has(postId)) return;
                seen.add(postId);
                track("post_impression", { post: postId });
              }, IMPRESSION_DWELL_MS),
            );
          } else {
            const t = timers.get(el);
            if (t) window.clearTimeout(t);
            timers.delete(el);
          }
        }
      },
      { threshold: 0.5 },
    );

    const scan = () => {
      document.querySelectorAll("[data-post-id]").forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        io.observe(el);
      });
    };
    scan();
    let scheduled = false;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [viewKey]);

  return null;
}
