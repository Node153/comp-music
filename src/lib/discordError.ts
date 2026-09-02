import "server-only";

// 에러를 Discord 웹훅으로 보내는 알림기 (0035_error_monitoring).
// DISCORD_ERROR_WEBHOOK_URL이 없으면 완전 no-op — env 안 넣은 환경엔 영향 없음.
//
// 한계(파일럿 규모라 감수): 서버리스라 아래 스로틀 상태는 인스턴스별 + 수명이 짧아
// "완벽한" 중복제거는 안 됨. 그래도 한 인스턴스가 같은 에러를 루프로 터뜨릴 때
// 채널 도배는 크게 줄어든다. 진짜 그룹핑/히스토리가 필요하면 Sentry 쪽을 켤 것.

const WEBHOOK_URL = process.env.DISCORD_ERROR_WEBHOOK_URL;

const COOLDOWN_MS = 5 * 60_000; // 같은 에러는 5분에 1번만
const WINDOW_MS = 10 * 60_000; // 10분 창 안에서
const WINDOW_MAX = 20; // 최대 20건까지만 (서로 다른 에러 폭주 방어)
const MSG_MAX = 1500;
const STACK_MAX = 1000;

const lastSentAt = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

function scrub(input: string): string {
  return input
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[jwt]");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…(생략)" : s;
}

type ErrorReport = {
  kind: string; // "server" | "client" | "global" 등
  message: string;
  stack?: string | null;
  url?: string | null;
  extra?: string | null;
};

export async function reportErrorToDiscord(report: ErrorReport): Promise<void> {
  if (!WEBHOOK_URL) return;

  try {
    const now = Date.now();

    // 10분 창 상한
    if (now - windowStart > WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount >= WINDOW_MAX) return;

    const message = scrub(truncate(report.message || "(빈 메시지)", MSG_MAX));
    const stack = report.stack ? scrub(truncate(report.stack, STACK_MAX)) : null;

    // 같은 에러 쿨다운 — 메시지 + 스택 첫 줄로 키 구성
    const dedupeKey = `${report.kind}:${message.split("\n")[0]}:${(stack ?? "").split("\n")[1] ?? ""}`;
    const prev = lastSentAt.get(dedupeKey);
    if (prev && now - prev < COOLDOWN_MS) return;
    lastSentAt.set(dedupeKey, now);
    if (lastSentAt.size > 200) lastSentAt.clear();

    windowCount += 1;

    const env = process.env.VERCEL_ENV ?? "local";
    const fields: { name: string; value: string; inline?: boolean }[] = [
      { name: "종류", value: report.kind, inline: true },
      { name: "환경", value: env, inline: true },
    ];
    if (report.url) fields.push({ name: "URL", value: truncate(scrub(report.url), 1000) });
    if (report.extra) fields.push({ name: "정보", value: truncate(scrub(report.extra), 1000) });
    if (stack) fields.push({ name: "스택", value: "```\n" + stack + "\n```" });

    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "🔴 " + truncate(message.split("\n")[0], 240),
            description: "```\n" + message + "\n```",
            color: 0xe74c3c,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 알림기 자체가 절대 앱을 깨거나 다시 에러를 던지지 않게 함
  }
}
