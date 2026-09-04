import "server-only";

// 신규 가입 심사 요청을 Discord 웹훅으로 알린다(#8).
// 전용 웹훅(DISCORD_SIGNUP_WEBHOOK_URL)이 있으면 그쪽으로, 없으면 에러 알림용
// 웹훅(DISCORD_ERROR_WEBHOOK_URL, discordError.ts와 공유)으로 보낸다. 둘 다 없으면
// 완전 no-op — env 안 넣은 환경엔 영향 없음.
// 실패해도 절대 throw 하지 않는다 — 호출부(가입 직후 흐름)를 깨면 안 됨.

const WEBHOOK_URL =
  process.env.DISCORD_SIGNUP_WEBHOOK_URL || process.env.DISCORD_ERROR_WEBHOOK_URL;

const ADMIN_MEMBERS_URL = "https://comp-music.vercel.app/admin/members";
const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";

type NewSignup = {
  name: string;
  email: string;
  // 온보딩(/verify/documents)을 아직 안 거친 사용자는 null일 수 있다.
  userType: "student" | "activist" | null;
  createdAt: string;
};

export async function notifyAdminNewSignup(signup: NewSignup): Promise<void> {
  if (!WEBHOOK_URL) return;

  const typeLabel =
    signup.userType === "student"
      ? "전공생"
      : signup.userType === "activist"
        ? "활동자"
        : "미설정";
  // Kakao 무이메일 가입자(handle_new_user, 0034)의 자리표시자 이메일은 실제 메일함이
  // 아니라서 그대로 보여주면 헷갈린다.
  const emailLabel = signup.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)
    ? "(이메일 없음)"
    : signup.email;

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "🆕 신규 가입 — 심사 대기",
            description: `[심사 대기열 열기](${ADMIN_MEMBERS_URL})\n심사 기한(SLA): 48시간`,
            color: 0x3498db,
            fields: [
              { name: "이름", value: signup.name || "-", inline: true },
              { name: "유형", value: typeLabel, inline: true },
              { name: "이메일", value: emailLabel },
            ],
            timestamp: new Date(signup.createdAt).toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 알림기 자체가 절대 앱을 깨거나 다시 에러를 던지지 않게 함
  }
}
