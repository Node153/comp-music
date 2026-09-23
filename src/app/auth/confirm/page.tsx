"use client";

// 회원가입 이메일 인증 링크 착지 화면. Supabase가 두 가지 방식 중 하나로 토큰을 붙여
// 보낼 수 있어서 둘 다 처리한다:
// - 해시 방식(#access_token=...&type=signup): supabase-js 브라우저 클라이언트가 마운트
//   시점에 자동으로 읽어 세션을 만든다(reset-password/page.tsx와 동일 패턴).
// - PKCE 방식(?code=...): auth/callback/route.ts의 OAuth 콜백과 동일하게
//   exchangeCodeForSession을 직접 호출해야 세션이 만들어진다.
// 둘 다 해시/쿼리가 서버로 안 넘어가거나(해시) 세션 교환 전에 막히면 안 되므로(코드)
// proxy.ts가 이 경로를 항상 public으로 통과시켜야 한다. 세션이 만들어지면 /feed로 보내고,
// 그 뒤는 proxy.ts가 status(pending)에 맞춰 자동으로 /status(심사 대기 화면)로 보내준다.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { pageTitle, mutedText } from "@/components/ui/styles";

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // 링크가 만료/이미 사용됨 등으로 실패하면 해시 또는 쿼리에 error가 붙어서 온다.
    if (window.location.hash.includes("error") || searchParams.get("error")) {
      setFailed(true);
      return;
    }

    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data: { session } }) => {
        if (session) {
          router.push("/feed");
          router.refresh();
        } else {
          setFailed(true);
        }
      });
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.push("/feed");
        router.refresh();
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/feed");
        router.refresh();
      }
    });

    const timeout = setTimeout(() => setFailed(true), 8000);
    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [supabase, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 text-center">
        <h1 className={pageTitle}>{failed ? "인증 링크를 확인할 수 없어요" : "이메일 인증 중..."}</h1>
        <p className={mutedText}>
          {failed ? (
            <>
              링크가 만료됐거나 이미 사용됐을 수 있어요.{" "}
              <Link href="/login" className="font-medium text-gray-900 underline">
                로그인
              </Link>
              을 시도해보세요.
            </>
          ) : (
            "잠시만 기다려주세요."
          )}
        </p>
      </div>
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={null}>
      <AuthConfirmContent />
    </Suspense>
  );
}
