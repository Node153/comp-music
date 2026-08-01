"use client";

// S2 회원가입 (AUTH-01)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, errorText, pageTitle } from "@/components/ui/styles";
import { randomNicknameExample } from "@/lib/nicknameExamples";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  // 실명/닉네임 이원화(0018) — Companion에게는 실명, 그 외에게는 닉네임이 보이므로 둘 다 필수.
  const [nickname, setNickname] = useState("");
  // placeholder 예시는 mount마다 랜덤 — SSR과 달라질 수 있어 input에 suppressHydrationWarning.
  const [nicknameExample] = useState(randomNicknameExample);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, nickname: nickname.trim() } },
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "이미 가입된 이메일입니다."
          : signUpError.message,
      );
      return;
    }

    // 이메일 인증(Confirm email)이 켜져 있으면 session이 바로 발급되지 않음
    if (!data.session) {
      setPendingConfirm(true);
      return;
    }

    router.push("/verify/type");
  }

  if (pendingConfirm) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
          ✉️
        </div>
        <h1 className={pageTitle}>이메일을 확인해주세요</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          <span className="font-medium text-gray-900">{email}</span> 로 인증 메일을 보냈습니다.
          <br />
          인증 후 다시 로그인해주세요.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className={pageTitle}>회원가입</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="실명 (Companion에게만 보여요)"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder={`닉네임 예: ${nicknameExample}`}
            suppressHydrationWarning
            required
            maxLength={30}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={field}
          />
          <p className="px-1 text-xs text-gray-400">
            Companion이 아닌 사람에게는 실명 대신 닉네임이 보여요.
          </p>
        </div>
        <input
          type="email"
          placeholder="이메일"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
        />
        <input
          type="password"
          placeholder="비밀번호 (8자 이상)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
        {error && <p className={errorText}>{error}</p>}
        <Button type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? "가입 중..." : "가입하기"}
        </Button>
      </form>
    </main>
  );
}
