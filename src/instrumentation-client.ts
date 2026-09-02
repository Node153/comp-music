// Sentry 에러 모니터링 — 브라우저(클라이언트) 초기화 (0035_error_monitoring).
// DSN이 없으면 no-op. Session Replay는 실명·DM 노출 우려로 기본 비활성 —
// 필요해지면 replaysOnErrorSampleRate를 올리고 마스킹 옵션을 검토한다.
import * as Sentry from "@sentry/nextjs";
import { reportClientError } from "@/lib/reportClientError";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Sentry DSN이 아직 없어도(현재 상태) 클라이언트 에러를 Discord로는 받을 수 있게 —
// 전역 리스너로 잡아 /api/client-error로 보낸다. 웹훅 URL이 없으면 서버에서 no-op.
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    reportClientError("window", e.message || "window error", e.error?.stack);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    reportClientError("promise", r?.message ?? String(e.reason), r?.stack);
  });
}

// App Router 클라이언트 라우팅 구간을 트레이스에 반영.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
