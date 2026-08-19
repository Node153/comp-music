import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 소셜로그인(Google/Kakao) 콜백 — signInWithOAuth의 redirectTo가 여기로 옴.
// OAuth는 이메일 확인 링크(URL 해시)와 달리 ?code= 쿼리 파라미터로 오는 PKCE 플로우라서,
// 서버(라우트 핸들러)에서 바로 세션으로 교환할 수 있다 — reset-password처럼 클라이언트가
// 해시를 파싱할 때까지 기다릴 필요 없음.
// 이후 어디로 보낼지는 여기서 직접 분기하지 않고 항상 /feed로 보낸다 — proxy.ts가 이미
// needs_onboarding(0027)/status 기준으로 온보딩·심사·피드 중 맞는 곳으로 다시 보내주므로
// (로그인 폼도 성공 시 항상 /feed로 보내는 것과 동일한 패턴).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/feed`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("소셜로그인에 실패했습니다. 다시 시도해주세요.")}`,
  );
}
