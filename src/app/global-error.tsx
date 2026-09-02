"use client";

// 루트 레이아웃까지 터진 렌더 에러를 잡는 최후 방어선. Sentry로 보고하고 최소한의
// 안내 화면을 보여준다(0035_error_monitoring). 라우트별 error.tsx가 따로 없으면
// 모든 클라이언트 렌더 에러가 여기로 온다.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
    reportClientError("global", error.message || "global error", error.stack);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#111",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "18px", fontWeight: 600 }}>일시적인 오류가 발생했어요</h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          잠시 후 다시 시도해 주세요. 문제가 계속되면 Help에서 알려주세요.
        </p>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            marginTop: "8px",
            borderRadius: "10px",
            background: "#111",
            color: "#fff",
            border: "none",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          홈으로
        </button>
      </body>
    </html>
  );
}
