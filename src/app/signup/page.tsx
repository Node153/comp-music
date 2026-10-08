"use client";

// S2 회원가입 (AUTH-01)
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import {
  SignupAgreements,
  SignupHeader,
  SignupProfileFields,
  signupEyebrow,
  signupFieldLabel,
  signupSubmitButton,
  useSignupAgreements,
} from "@/components/SignupFormParts";
import { field, errorText } from "@/components/ui/styles";
import { hasWhitespace } from "@/lib/nicknameExamples";
import { MailIcon } from "@/components/icons";
import {
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/lib/passwordPolicy";
import { isOldEnough } from "@/lib/age";

const CONTACT_EMAIL = "jtaein0723@gmail.com";

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      aria-label={shown ? "비밀번호 숨기기" : "비밀번호 표시"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
    >
      {shown ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      )}
    </button>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // 약관 동의 8종 — 폼 제출을 막는 게이트 역할만 한다(실제 기록은 handle_new_user 트리거).
  const agreements = useSignupAgreements();
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!birthDate) {
      setError("생년월일을 입력해주세요.");
      return;
    }
    if (!isOldEnough(birthDate)) {
      setError("만 14세 이상만 가입할 수 있어요.");
      return;
    }
    if (!isValidPassword(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setError(PASSWORD_MISMATCH_MESSAGE);
      return;
    }
    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (hasWhitespace(nickname)) {
      setError("닉네임에는 띄어쓰기를 쓸 수 없어요.");
      return;
    }
    if (!agreements.allAgreed) {
      setError("아래 동의 항목에 모두 체크해주세요.");
      return;
    }

    setLoading(true);

    // 중복가입 사전 차단(2026-08-29, 사용자 요청) — 소셜로그인마다 이메일이 달라서 같은
    // 사람이 로그인 방법을 잊고 다른 방법으로 또 가입할 수 있는 문제. 이름+생년월일이 겹치는
    // 계정이 이미 있으면 여기서 막는다(완전 자동 차단 — 동명이인 오탐 가능성은 감수하기로
    // 사용자가 명시적으로 결정함. 추후 PASS 본인인증 도입 시 연락처 기반으로 재검토 예정).
    // 가입 전(비로그인) 호출이라 RPC를 직접 부르지 않고 rate limit이 걸린 서버 라우트를
    // 거친다(0058) — anon이 이 RPC를 직접 무제한 호출하면 로그인 없이 "이름+생년월일 존재
    // 여부"를 조회하는 프라이버시 오라클이 되기 때문.
    const duplicateCheckRes = await fetch("/api/auth/check-duplicate-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birthDate }),
    });
    const duplicateCheckBody = (await duplicateCheckRes.json().catch(() => ({}))) as {
      isDuplicate?: boolean;
      error?: string;
    };
    if (!duplicateCheckRes.ok) {
      setLoading(false);
      setError(duplicateCheckBody.error ?? "중복가입 확인에 실패했습니다.");
      return;
    }
    if (duplicateCheckBody.isDuplicate) {
      setLoading(false);
      setError(
        `이미 동일한 이름과 생년월일로 가입된 계정이 있습니다. 본인의 계정이 맞다면 이전에 가입한 방법으로 로그인해주세요. 다른 사람인데 이 안내를 받으셨다면 ${CONTACT_EMAIL}로 문의해주세요.`,
      );
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, nickname: nickname.trim(), birth_date: birthDate },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setLoading(false);

    if (signUpError) {
      // 닉네임(nickname) 자체는 이제 유니크 제약이 없다(0038) — 실제로 겹치는 건 서버가
      // 자동 배정하는 nickname_tag뿐이고 그건 클라이언트가 절대 못 건드리므로 여기서 날
      // 에러가 아니다. "이미 가입된 이메일" 정도만 특별 취급하면 충분하다.
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
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-white">
          <MailIcon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">이메일을 확인해주세요</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          <span className="font-medium text-gray-900">{email}</span> 로 인증 메일을 보냈습니다.
          <br />
          메일 속 링크를 눌러 인증한 뒤 로그인해주세요.
        </p>
        <p className="rounded-xl bg-gray-50 p-3 text-sm leading-relaxed text-gray-500">
          이메일 인증 후 로그인하면 가입 심사가 진행돼요. 평균 48시간 정도 걸릴 수 있으니 잠시
          기다려주세요. 심사가 끝나면 이메일로 알려드리고, 그때부터 서비스를 이용하실 수 있어요.
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm font-medium text-gray-900 underline-offset-2 hover:underline"
        >
          로그인하러 가기
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <SignupHeader title="회원가입" description="몇 가지만 입력하면 바로 시작할 수 있어요." />

      <SocialLoginButtons />

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        또는 이메일로 가입
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* ── 계정 ───────────────────────────── */}
        <section className="flex flex-col gap-3">
          <p className={signupEyebrow}>계정</p>
          <div className="flex flex-col gap-1.5">
            <span className={signupFieldLabel}>이메일</span>
            <input
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={signupFieldLabel}>비밀번호</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={`특수문자 포함 ${PASSWORD_MIN_LENGTH}자 이상`}
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${field} pr-11`}
              />
              <EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={signupFieldLabel}>비밀번호 확인</span>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="비밀번호를 한 번 더 입력"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${field} pr-11`}
              />
              <EyeToggle
                shown={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
              />
            </div>
          </div>
        </section>

        <div className="h-px bg-gray-100" />

        <SignupProfileFields
          name={name}
          setName={setName}
          birthDate={birthDate}
          setBirthDate={setBirthDate}
          nickname={nickname}
          setNickname={setNickname}
        />

        <div className="h-px bg-gray-100" />

        <SignupAgreements agreements={agreements} />

        {error && <p className={errorText}>{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className={signupSubmitButton}
        >
          {loading ? "가입 중..." : "가입하기"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium text-gray-900 underline-offset-2 hover:underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
