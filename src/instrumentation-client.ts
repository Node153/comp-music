// Sentry 에러 모니터링 — 브라우저(클라이언트) 초기화 (0035_error_monitoring).
// DSN이 없으면 no-op. Session Replay는 실명·DM 노출 우려로 기본 비활성 —
// 필요해지면 replaysOnErrorSampleRate를 올리고 마스킹 옵션을 검토한다.
import * as Sentry from "@sentry/nextjs";

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

// App Router 클라이언트 라우팅 구간을 트레이스에 반영.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
