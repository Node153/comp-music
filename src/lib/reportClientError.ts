// 브라우저 에러를 /api/client-error로 보내는 헬퍼 (0035_error_monitoring).
// 서버 쪽 discordError.ts가 최종 스로틀/스크럽을 하지만, 여기서도 탭 단위로
// "같은 메시지는 1분에 1번"만 보내서 네트워크 노이즈를 먼저 줄인다.
const sentAt = new Map<string, number>();
const CLIENT_COOLDOWN_MS = 60_000;

export function reportClientError(
  kind: "global" | "window" | "promise",
  message: string,
  stack?: string | null,
) {
  try {
    const key = `${kind}:${message}`.slice(0, 300);
    const now = Date.now();
    const prev = sentAt.get(key);
    if (prev && now - prev < CLIENT_COOLDOWN_MS) return;
    sentAt.set(key, now);
    if (sentAt.size > 100) sentAt.clear();

    const payload = JSON.stringify({
      kind,
      message: String(message).slice(0, 2000),
      stack: stack ? String(stack).slice(0, 2000) : undefined,
      url: typeof location !== "undefined" ? location.href : undefined,
    });

    // sendBeacon이 있으면 페이지 언로드 중에도 전송이 보장됨. 없으면 keepalive fetch.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/client-error", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // 리포터가 앱을 깨지 않게 함
  }
}
