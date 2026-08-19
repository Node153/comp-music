import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 접근 권한 매트릭스 (spec 1.2, 3.1)
// 비로그인: 랜딩/가입/로그인 + /feed(DEMO 미리보기, Instagram 참고). 미승인(대기/반려): 심사
// 관련 화면만. 승인: 전체.
// /feed는 비로그인 방문자에게도 열어주지만, 실제로 뭘 보여줄지(DEMO만 공개, memo는 잠금)는
// posts_select_public_anyone 등 RLS(0024)와 feed/page.tsx 안의 분기가 담당한다 — 여기서는
// "리다이렉트하지 않는다"까지만 책임진다.
// /reset-password는 이메일 링크의 access_token이 URL 해시로 붙어오는데, 해시는 서버로
// 전달되지 않아 여기서는 그냥 "로그인 안 한 방문자"로만 보인다. 그래서 항상 public이어야
// 클라이언트가 뜬 뒤 해시를 읽어 복구 세션을 만들 시간을 준다(reset-password/page.tsx 참고).
// /auth/callback도 마찬가지 이유로 public — OAuth 콜백이 도착한 시점엔 아직 세션 쿠키가 없고
// (콜백 라우트 핸들러 안에서 code를 세션으로 교환해야 비로소 생김), 여기서 막으면 그 교환이
// 일어나기 전에 /login으로 튕겨버린다.
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/feed",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];
const UNAPPROVED_ALLOWED_PATHS = ["/status", "/verify/type", "/verify/documents"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!user) {
    if (isPublicPath) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("users")
    .select("status, role, needs_onboarding")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";

  // 소셜로그인(0027)으로 막 가입한 사용자 — 회원가입 폼의 체크박스 화면을 안 거쳤으므로
  // 실명/닉네임 확정 + 저작권 동의를 여기서 먼저 받는다. status(pending/approved) 판정보다
  // 우선한다 — 동의도 안 받은 사람을 심사 대기 화면으로 보내는 게 더 이상함.
  // needs_onboarding===true인 동안은 여기서 완전히 끝내고 아래 승인/미승인 로직을 아예 안
  // 타게 한다 — UNAPPROVED_ALLOWED_PATHS에 /onboarding을 끼워 넣는 식으로 하면, 그 아래
  // "미승인 사용자 비노출" 블록이 /onboarding에서 /status로 도로 쫓아내고 그럼 여기가 다시
  // /onboarding으로 돌려보내는 무한 리다이렉트 루프가 생긴다(실제로 겪은 버그 — 로컬 Google
  // 로그인 테스트 중 Safari "너무 많은 재이동" 에러로 발견). early return으로 완전히 분리해야
  // 이런 상호작용 자체가 안 생긴다.
  if (profile?.needs_onboarding) {
    if (pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return response;
  }
  if (pathname === "/onboarding") {
    // needs_onboarding이 이미 끝난(false) 상태에서 뒤늦게 /onboarding을 다시 열람하려는 경우.
    return NextResponse.redirect(new URL("/status", request.url));
  }

  // 승인된 사용자가 가입/로그인 또는 심사 관련 화면(승인 전에 보던 화면)에 남아있으면 피드로 보냄.
  // 관리자가 SQL로 수동 승인한 경우(서류 미제출) 특히 중요 — 승인 직후 새로고침/재방문 시
  // /status·/verify/type에 그대로 멈춰있지 않고 바로 피드로 넘어가야 한다.
  if (
    status === "approved" &&
    (pathname === "/login" || pathname === "/signup" || UNAPPROVED_ALLOWED_PATHS.includes(pathname))
  ) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // 승인되지 않은 사용자는 심사 관련 화면(S4/S5) 외 전체 비노출 (0-1)
  if (
    status !== "approved" &&
    !UNAPPROVED_ALLOWED_PATHS.includes(pathname) &&
    !isPublicPath
  ) {
    return NextResponse.redirect(new URL("/status", request.url));
  }

  // 관리자 화면(S17/S18)은 role=admin만 접근 가능 (2.8)
  if (pathname.startsWith("/admin") && profile?.role !== "admin") {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // /api는 제외 — cron(expire-posts) 등 API 라우트는 Supabase 세션 쿠키가 없는 서버-서버 호출이라
    // 여기 걸리면 항상 /login으로 리다이렉트되어 라우트 핸들러 자체(Bearer 토큰 검사)가 실행되지 않는다.
    // 이미지 확장자뿐 아니라 오디오/비디오도 제외 — public/의 정적 미디어(로그인 화면 배경음악 등)를
    // 비로그인 상태로 요청하면 여기 걸려서 /login으로 리다이렉트되고, 그 결과 오디오 대신
    // 로그인 페이지 HTML이 내려오는 문제가 있었다(사운드가 아니라 로그인 화면 자기 자신을
    // fetch하고 있었던 셈).
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|mp4|mov)$).*)",
  ],
};
