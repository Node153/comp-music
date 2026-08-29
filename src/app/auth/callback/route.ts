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
  // 제공자(Spotify 등)가 code 대신 에러를 바로 붙여 돌려보내는 경우(예: 로그인 거부,
  // Development Mode 허용 목록에 없는 계정) — code 있는 성공 경로와 구분해서 원인을 남긴다.
  const providerError = searchParams.get("error");
  const providerErrorDescription = searchParams.get("error_description");

  if (providerError) {
    console.error("OAuth callback: 제공자가 에러를 반환함", {
      providerError,
      providerErrorDescription,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(`소셜로그인 실패: ${providerErrorDescription ?? providerError}`)}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/feed`);
    }
    // 원인을 못 남기면 매번 이 함수로 다시 들어와서 재현 테스트를 해야 해서, 실패 사유를
    // 서버 로그(Vercel)에도 남기고 화면에도 그대로 보여준다(임시 진단용 — 안정화되면
    // 사용자에게 내부 에러 메시지를 그대로 노출하지 않는 일반 문구로 되돌릴 것).
    console.error("OAuth callback: exchangeCodeForSession 실패", error);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(`소셜로그인 실패: ${error.message}`)}`,
    );
  }

  console.error("OAuth callback: code도 error도 없음", Object.fromEntries(searchParams));
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("소셜로그인에 실패했습니다. 다시 시도해주세요.")}`,
  );
}
