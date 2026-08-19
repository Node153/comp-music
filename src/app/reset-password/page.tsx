"use client";

// 비밀번호 재설정 — 이메일의 재설정 링크를 타고 들어오는 화면.
// 링크에는 URL 해시(#access_token=...&type=recovery)가 붙어있고, supabase-js 브라우저 클라이언트가
// 마운트 시점에 이걸 자동으로 읽어 "복구 세션"을 만든다(서버로는 해시가 전달되지 않으므로
// proxy.ts는 이 경로를 항상 public으로 통과시켜야 함 — 그래야 페이지가 뜬 다음 클라이언트가
// 해시를 처리할 시간을 준다). 세션이 만들어지기 전까지는 "링크 확인 중" 상태로 대기한다.
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, errorText, pageTitle, mutedText } from "@/components/ui/styles";
import {
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/lib/passwordPolicy";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // PASSWORD_RECOVERY 이벤트가 정석 신호지만, 브라우저가 이미 해시를 처리해버린 뒤 리스너가
    // 붙는 경우(느린 마운트 등)를 대비해 세션 존재 여부도 함께 확인한다.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidPassword(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setError(PASSWORD_MISMATCH_MESSAGE);
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("비밀번호 변경에 실패했습니다. 링크가 만료됐을 수 있어요 — 다시 요청해주세요.");
      return;
    }

    router.push("/feed");
    router.refresh();
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4 text-center">
          <h1 className={pageTitle}>링크 확인 중...</h1>
          <p className={mutedText}>
            잠시만 기다려주세요. 계속 이 화면이라면 링크가 만료됐을 수 있어요 —{" "}
            <Link href="/forgot-password" className="font-medium text-gray-900 underline">
              비밀번호 재설정을 다시 요청
            </Link>
            해주세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <h1 className={pageTitle}>새 비밀번호 설정</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder={`새 비밀번호 (특수문자 포함 ${PASSWORD_MIN_LENGTH}자 이상)`}
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <input
            type="password"
            placeholder="새 비밀번호 확인"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={field}
          />
          {error && <p className={errorText}>{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "변경 중..." : "비밀번호 변경"}
          </Button>
        </form>
      </div>
    </main>
  );
}
