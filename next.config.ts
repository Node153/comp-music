import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry (0035_error_monitoring) — SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT가
// 빌드 환경에 없으면 소스맵 업로드만 건너뛰고 빌드는 정상 진행된다(경고만 출력).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // 로컬 빌드 로그를 조용하게. CI(Vercel)에서는 업로드 로그를 남긴다.
  silent: !process.env.CI,
  // 클라이언트 번들 소스맵을 넓게 수집해 스택트레이스 복원율을 높인다.
  widenClientFileUpload: true,
  // 광고차단기 우회를 위한 /monitoring 터널 라우트. DSN이 설정된 환경에서만 활성화된다.
  tunnelRoute: "/monitoring",
});
