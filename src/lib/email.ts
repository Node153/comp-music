// Resend REST API 직접 호출 — SDK 없이 fetch 하나로 충분해서 의존성을 안 늘렸다.
// RESEND_API_KEY는 비밀 값이라 서버 코드(크론/API 라우트)에서만 써야 한다 — 절대
// NEXT_PUBLIC_ 접두사 붙이지 말 것.
const FROM_ADDRESS = "Comp <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend 발송 실패 (${res.status}): ${await res.text()}`);
  }
}
