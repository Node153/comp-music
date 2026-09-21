import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// signup/page.tsx의 중복가입 사전 차단(0044 check_duplicate_identity)은 가입 전(비로그인)
// 호출이라 anon 권한이 필요했는데, 그대로 클라이언트에서 직접 RPC를 부르면 로그인 없이
// "이름+생년월일 존재 여부"를 무제한 조회할 수 있는 프라이버시 오라클이 된다(0058). anon
// 직접 호출은 막고(0058 migration), 이 라우트가 IP 기준 rate limit을 건 다음 service_role로
// 대신 호출한다.
export async function POST(request: NextRequest) {
  const { name, birthDate } = (await request.json().catch(() => ({}))) as {
    name?: string;
    birthDate?: string;
  };
  if (!name || !birthDate) {
    return NextResponse.json({ error: "name과 birthDate가 필요합니다." }, { status: 400 });
  }

  const ip = clientIp(request);
  const allowed = await checkRateLimit("check_duplicate_identity", ip, 3600, 20);
  if (!allowed) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const supabase = createAdminClient();
  const { data: isDuplicate, error } = await supabase.rpc("check_duplicate_identity", {
    p_name: name,
    p_birth_date: birthDate,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ isDuplicate });
}
