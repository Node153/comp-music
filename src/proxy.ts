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

  // 승인된 사용자가 가입/로그인 화면에 다시 들어가면 피드로 보냄
  if (status === "approved" && (pathname === "/login" || pathname === "/signup")) {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
