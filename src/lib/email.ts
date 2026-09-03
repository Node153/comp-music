// Resend REST API 직접 호출 — SDK 없이 fetch 하나로 충분해서 의존성을 안 늘렸다.
// RESEND_API_KEY는 비밀 값이라 서버 코드(크론/API 라우트)에서만 써야 한다 — 절대
// NEXT_PUBLIC_ 접두사 붙이지 말 것.
const FROM_ADDRESS = "Comp <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  // 도메인 verify 전이라 RESEND_API_KEY를 아직 안 넣었다 — 키 없으면 throw 하지 말고
  // 조용히 건너뛴다. (throw 하면 크론 핸들러가 통째로 500 나고 Discord 에러 웹훅까지
  // 울린다.) 키 + FROM_ADDRESS 도메인 주소 채우면 자동으로 발송 재개.
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY 미설정 — 발송 건너뜀 (to: ${to})`);
    return;
  }

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
