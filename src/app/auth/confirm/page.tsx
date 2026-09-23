"use client";

// 회원가입 이메일 인증 링크 착지 화면 — 링크에는 URL 해시(#access_token=...&type=signup)가
// 붙어있고, supabase-js 브라우저 클라이언트가 마운트 시점에 이걸 자동으로 읽어 로그인
// 세션을 만든다(해시는 서버로 전달되지 않으므로 proxy.ts가 이 경로를 항상 public으로
// 통과시켜야 함 — reset-password/page.tsx와 동일한 패턴). 세션이 만들어지면 /feed로 보내고,
// 그 뒤는 proxy.ts가 status(pending)에 맞춰 자동으로 /status(심사 대기 화면)로 보내준다.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { pageTitle, mutedText } from "@/components/ui/styles";

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createClient();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // 링크가 만료/이미 사용됨 등으로 실패하면 해시에 error가 붙어서 온다.
    if (window.location.hash.includes("error")) {
      setFailed(true);
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
  }, [supabase, router]);

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
