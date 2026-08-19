import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ⚠️ 임시 조치(2026-08-19, 사용자 요청) — 서류 심사를 잠시 끄고 가입만 하면 바로 승인시키기
// 위한 라우트. verify/documents/page.tsx의 DOCUMENT_VERIFICATION_ENABLED가 false일 때만
// 호출된다. 나중에 서류 심사를 다시 켜면 이 라우트는 그냥 안 쓰이게 되고(호출부가 없어짐),
// 지울 필요도 없음 — 재사용 가능성 있어 남겨둠.
// status는 트리거(0006/0008)가 본인 update로는 못 바꾸게 막아놔서(자가 승인 취약점 방지),
// 반드시 service-role로 처리해야 한다 — 그래서 클라이언트에서 직접 update 안 하고
// 이 라우트를 거친다.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ status: "approved" })
    .eq("id", user.id)
    .eq("status", "pending"); // 이미 승인/반려된 계정을 실수로 덮어쓰지 않도록 방어

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
