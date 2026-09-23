import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyUserRow } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const APP_URL = "https://compmusic.kr";

// 회원 승인 시 가입자에게 "이제 이용할 수 있다" 이메일 발송 — MemberStatusActions.tsx가
// users.status를 approved로 바꾼 직후 호출한다. RESEND_API_KEY는 비밀 값이라 서버 라우트를
// 거쳐야 한다(0-1 상단 email.ts 주석 참고).
export async function POST(request: Request) {
  const me = await getMyUserRow();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("users")
    .select("email, name, status")
    .eq("id", userId)
    .single();

  if (!target || target.status !== "approved") {
    return NextResponse.json({ error: "not found or not approved" }, { status: 404 });
  }

  await sendEmail(
    target.email,
    "가입 심사가 승인됐어요 — Compmusic 이용을 시작해보세요",
    `<p>${target.name}님, 가입 심사가 승인됐습니다.</p><p>이제 Compmusic의 모든 기능을 이용하실 수 있어요.</p><p><a href="${APP_URL}/feed">지금 시작하기</a></p>`,
  );

  return NextResponse.json({ notified: true });
}
