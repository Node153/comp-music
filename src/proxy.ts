import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 접근 권한 매트릭스 (spec 1.2, 3.1)
// 비로그인: 랜딩/가입/로그인만. 미승인(대기/반려): 심사 관련 화면만. 승인: 전체.
const PUBLIC_PATHS = ["/", "/login", "/signup"];
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
    .select("status, role")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";

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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
