import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminNewSignup } from "@/lib/discordSignupAlert";

// 신규 가입 심사 요청 Discord 알림(#8) — /status 화면을 처음 연 미승인 사용자에 대해
// 관리자에게 딱 한 번 알림을 보낸다.
//
// - 세션(쿠키)으로 "본인" 확인만 한다. 남의 가입 알림을 대신 트리거할 수 없다.
// - 중복 발송은 users.admin_notified_at(0048)으로 막는다. null일 때만 now()로 채우는
//   조건부 update가 실제로 행을 바꿨을 때만 이어서 웹훅을 쏜다(동시 요청 경합 방어 —
//   Postgres 행 잠금으로 둘 중 하나만 갱신에 성공한다).
// - 조회/갱신은 RLS 우회가 필요해 admin 클라이언트로 한다(크론과 같은 패턴).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: claimed, error: claimError } = await admin
    .from("users")
    .update({ admin_notified_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("admin_notified_at", null)
    .select("name, email, created_at")
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }
  if (!claimed) {
    // 이미 보냈거나(플래그 있음) 해당 유저 행이 없음 — 조용히 성공 처리.
    return NextResponse.json({ notified: false });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("user_type")
    .eq("user_id", user.id)
    .maybeSingle();

  await notifyAdminNewSignup({
    name: claimed.name,
    email: claimed.email,
    userType: profile?.user_type ?? null,
    createdAt: claimed.created_at,
  });

  return NextResponse.json({ notified: true });
}
