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
// /terms, /privacy, /community-guidelines, /beta-notice는 법적 고지 문서라 회원 여부와
// 무관하게 항상 열람 가능해야 한다(가입 전 signup 화면에서도 링크로 걸림).
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/feed",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/community-guidelines",
  "/beta-notice",
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
  // ⚠️ /terms·/privacy·/community-guidelines·/beta-notice는 예외로 허용한다 — 온보딩
  // 화면의 동의 체크박스가 이 문서들을 새 탭으로 여는데, 새 탭도 같은 로그인 세션(쿠키)을
  // 공유하므로 여기서 막으면 그 새 탭조차 곧장 /onboarding으로 튕겨버린다. 실제로 겪은
  // 버그 — Safari에서 새 탭은 열리는데 약관 대신 온보딩 화면이 또 뜨는 것처럼 보였음
  // (원인은 label/버튼 구조가 아니라 이 서버 리다이렉트였다).
  if (profile?.needs_onboarding) {
    if (
      pathname !== "/onboarding" &&
      pathname !== "/terms" &&
      pathname !== "/privacy" &&
      pathname !== "/community-guidelines" &&
      pathname !== "/beta-notice"
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return response;
  }
  if (pathname === "/onboarding") {
    // needs_onboarding이 이미 끝난(false) 상태에서 뒤늦게 /onboarding을 다시 열람하려는 경우.
    return NextResponse.redirect(new URL("/status", request.url));
  }

  // 로그인된 사용자는 랜딩/가입/로그인 화면에 머무를 이유가 없다 — 상태에 맞는 다음 화면으로
  // 보낸다. 예전엔 "/"이 이 목록에 없어서, 소셜로그인 완료 후(또는 그냥 로그인한 채로) "/"에
  // 들어오면 로그인 여부와 무관하게 항상 같은 랜딩 화면(가입하기/로그인 버튼)을 보여줬다 —
  // "로그인했는데 로그인 화면이 또 뜬다"는 버그로 실제 발견됨. 승인 여부(approved 아닌 대기/
  // 반려도 포함)와 무관하게 무조건 적용 — 예전엔 status==='approved'일 때만 이 리다이렉트가
  // 됐어서, 대기 중인 사용자가 로그인한 채로 "/"·"/login"·"/signup"에 들어오면 아무 반응 없이
  // 그대로 보여지는 것도 같은 원인의 버그였다.
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    return NextResponse.redirect(new URL(status === "approved" ? "/feed" : "/status", request.url));
  }

  // 승인된 사용자가 심사 관련 화면(승인 전에 보던 화면)에 남아있으면 피드로 보냄.
  // 관리자가 SQL로 수동 승인한 경우(서류 미제출) 특히 중요 — 승인 직후 새로고침/재방문 시
  // /status·/verify/type에 그대로 멈춰있지 않고 바로 피드로 넘어가야 한다.
  if (status === "approved" && UNAPPROVED_ALLOWED_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  // 승인되지 않은 사용자는 심사 관련 화면(S4/S5) 외 전체 비노출 (0-1)
  // ⚠️ /feed는 PUBLIC_PATHS에 있지만 그건 "가입도 안 한 방문자에게 보여주는 미리보기"
  // 목적이고(DEMO만 공개, memo는 잠금 — posts_select_public_anyone RLS가 담당), "가입은
  // 했지만 아직 승인 안 된 로그인 사용자"에게 커뮤니티 열람을 허용하겠다는 뜻이 아니다.
  // 이 둘을 구분 안 하면 대기 중인 회원이 로그인한 채로 /feed에 들어가 콘텐츠를 미리
  // 볼 수 있게 된다(실제로 발견된 문제, 사용자 요청으로 여기서 명시적으로 막는다).
  if (
    status !== "approved" &&
    !UNAPPROVED_ALLOWED_PATHS.includes(pathname) &&
    (pathname === "/feed" || !isPublicPath)
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
