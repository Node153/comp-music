// Resend REST API 직접 호출 — SDK 없이 fetch 하나로 충분해서 의존성을 안 늘렸다.
// RESEND_API_KEY는 비밀 값이라 서버 코드(크론/API 라우트)에서만 써야 한다 — 절대
// NEXT_PUBLIC_ 접두사 붙이지 말 것.
// compmusic.kr이 Resend에 도메인 인증 완료(2026-09-17)돼서 더 이상 공유 테스트 도메인
// (resend.dev, 계정 소유자 본인에게만 발송됨)을 쓸 필요 없어졌다 — 실제 발신 도메인으로 전환.
const FROM_ADDRESS = "Compmusic <no-reply@compmusic.kr>";

export async function sendEmail(to: string, subject: string, html: string) {
  // 키 없으면 throw 하지 말고 조용히 건너뛴다. (throw 하면 크론 핸들러가 통째로 500 나고
  // Discord 에러 웹훅까지 울린다.)
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
