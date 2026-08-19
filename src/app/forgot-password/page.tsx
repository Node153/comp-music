"use client";

// 비밀번호 찾기 — 로그인 화면에 "비밀번호를 잊으셨나요?" 링크로 진입.
// 이메일을 받아 Supabase가 재설정 링크를 발송하게 한다(실제 발송/토큰 검증은 Supabase 쪽 책임).
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, errorText, pageTitle, mutedText } from "@/components/ui/styles";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    // 가입 여부와 무관하게 항상 같은 성공 화면을 보여준다 — "이 이메일은 가입 안 됐어요" 같은
    // 응답을 주면 이메일 존재 여부를 외부에서 캐낼 수 있어서(계정 존재 유추 공격) 막아둔다.
    // Supabase API 자체도 존재하지 않는 이메일에 별도 에러를 주지 않으므로, 여기서 에러가 나는
    // 경우는 대부분 rate limit 등 일시적 문제 — 그 경우만 예외적으로 실패를 알린다.
    if (resetError) {
      setError("잠시 후 다시 시도해주세요.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4 text-center">
          <h1 className={pageTitle}>메일을 확인해주세요</h1>
          <p className={mutedText}>
            입력하신 이메일로 가입된 계정이 있다면, 비밀번호 재설정 링크를 보내드렸습니다.
          </p>
          <Link href="/login" className="text-sm font-medium text-gray-900 underline">
            로그인으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className={pageTitle}>비밀번호 찾기</h1>
          <p className={mutedText}>가입한 이메일로 비밀번호 재설정 링크를 보내드릴게요.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="이메일"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
          {error && <p className={errorText}>{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "전송 중..." : "재설정 링크 보내기"}
          </Button>
        </form>
        <Link href="/login" className="text-center text-sm text-gray-500 hover:text-gray-900">
          로그인으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
