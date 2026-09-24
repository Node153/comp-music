import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // 인스타 스토리 영상(/api/story-video)이 쓰는 ffmpeg 바이너리 — 번들링하면 경로(__dirname)가
  // 깨지니 외부 패키지로 두고, 바이너리 파일은 파일 트레이싱이 못 찾으니 직접 포함시킨다.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/story-video/[postId]": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  // Sentry/Supabase realtime/Giphy/카카오 OAuth 등 외부 연동이 많아 CSP는 라이브 검증 없이
  // 섣불리 추가하지 않고, 깨질 위험이 거의 없는 기본 보안 헤더만 우선 적용한다.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // 서비스 워커(0074 웹 푸시)는 캐시되면 수정 배포가 브라우저에 안 닿는다 — 항상 새로 받게.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
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
