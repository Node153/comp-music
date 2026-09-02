// Sentry 에러 모니터링 — 서버/엣지 런타임 초기화 (0035_error_monitoring).
// DSN(NEXT_PUBLIC_SENTRY_DSN)이 없으면 Sentry SDK는 전부 no-op이라, env를 안 넣은 환경에서는
// 아무 영향이 없다. 파일럿 중엔 Vercel 프로젝트 환경변수에만 넣어두면 프로덕션에서만 켜진다.
import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { reportErrorToDiscord } from "@/lib/discordError";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      // 파일럿 규모라 트래픽이 적어 성능 트레이스는 10%만 샘플링(에러는 항상 100% 수집).
      tracesSampleRate: 0.1,
      // 실명·DM 등 민감정보가 많은 앱이라 IP/쿠키/요청바디 자동수집은 끈다.
      sendDefaultPii: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

// Next.js 15+ 서버 컴포넌트/라우트 핸들러에서 던져진 에러 처리 —
// Sentry(DSN 있을 때)와 Discord 웹훅(URL 있을 때) 양쪽으로 보냄. 둘 다 없으면 no-op.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  Sentry.captureRequestError(err, request, context);
  const e = err as { message?: string; stack?: string };
  await reportErrorToDiscord({
    kind: "server",
    message: e?.message ?? String(err),
    stack: e?.stack ?? null,
    url: request.path,
    extra: `${context.routerKind} · ${context.routeType}`,
  });
};
