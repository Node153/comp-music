"use client";

// S2 회원가입 (AUTH-01)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { field, label, errorText, pageTitle } from "@/components/ui/styles";
import { generateNicknameCandidate } from "@/lib/nicknameExamples";
import {
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/lib/passwordPolicy";

const today = new Date();
const MAX_BIRTH_DATE = today.toISOString().slice(0, 10);
const MIN_BIRTH_DATE = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())
  .toISOString()
  .slice(0, 10);

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  // 동명이인(중복 계정 의심) 판별 보조용(0031) — 소셜로그인마다 이메일이 달라서 같은 사람이
  // 여러 계정을 만들 수 있는 문제 대응. /admin/members의 동명이인 경고에서 같이 비교됨.
  const [birthDate, setBirthDate] = useState("");
  // 실명/닉네임 이원화(0018) — Companion에게는 실명, 그 외에게는 닉네임이 보이므로 둘 다 필수.
  // 배달의민족 가입 화면 참고 — 재밌는 닉네임을 자동으로 채워주고 "다시 뽑기"로 고르게 한다.
  // 서버(SSR)와 클라이언트가 다른 랜덤값을 만들면 하이드레이션이 꼬이므로, 초기값은 빈
  // 문자열로 두고 마운트 후 useEffect에서만 채운다(NicknameForm의 비동기 로드와 같은 패턴).
  const [nickname, setNickname] = useState("");
  useEffect(() => {
    setNickname(generateNicknameCandidate());
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // 저작권/공동창작 동의(docs/copyright_agreement_draft.md) — 셋 다 필수 체크.
  // 실제 기록은 handle_new_user 트리거(0023_agreements)가 가입 성공 시 고정 버전으로 남긴다 —
  // 여기서는 폼 제출을 막는 게이트 역할만 하고 별도로 서버에 값을 보내지 않는다.
  const [agreedContentRights, setAgreedContentRights] = useState(false);
  const [agreedCollabDisclaimer, setAgreedCollabDisclaimer] = useState(false);
  const [agreedLicenseGrant, setAgreedLicenseGrant] = useState(false);
  // 이용약관(/terms)·개인정보처리방침(/privacy) 동의(0029) — 위 3개와 별개 체크박스.
  const [agreedTermsAndPrivacy, setAgreedTermsAndPrivacy] = useState(false);
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
    if (
      !agreedContentRights ||
      !agreedCollabDisclaimer ||
      !agreedLicenseGrant ||
      !agreedTermsAndPrivacy
    ) {
      setError("아래 동의 항목에 모두 체크해주세요.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, nickname: nickname.trim(), birth_date: birthDate } },
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "이미 가입된 이메일입니다."
          : signUpError.message.includes("duplicate")
            ? "이미 사용 중인 닉네임이에요. 🎲로 다시 뽑거나 다른 닉네임을 입력해주세요."
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
      <SocialLoginButtons />
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        또는 이메일로 가입
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="실명 (Companion에게만 보여요)"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
        <div className="flex flex-col gap-1.5">
          <span className={label}>생년월일</span>
          <input
            type="date"
            required
            min={MIN_BIRTH_DATE}
            max={MAX_BIRTH_DATE}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="닉네임"
              required
              maxLength={30}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={field}
            />
            <button
              type="button"
              onClick={() => setNickname(generateNicknameCandidate())}
              title="다른 닉네임 뽑기"
              className="shrink-0 rounded-xl border border-gray-300 px-3.5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              🎲
            </button>
          </div>
          <p className="px-1 text-xs text-gray-400">
            Companion이 아닌 사람에게는 실명 대신 닉네임이 보여요. 마음에 안 들면 🎲로 다시
            뽑거나 직접 수정할 수 있어요.
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
          placeholder={`비밀번호 (특수문자 포함 ${PASSWORD_MIN_LENGTH}자 이상)`}
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
        <input
          type="password"
          placeholder="비밀번호 확인"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={field}
        />

        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3.5">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedTermsAndPrivacy}
              onChange={(e) => setAgreedTermsAndPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              <Link href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-700">
                이용약관
              </Link>{" "}
              및{" "}
              <Link href="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-700">
                개인정보처리방침
              </Link>
              에 동의합니다.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedContentRights}
              onChange={(e) => setAgreedContentRights(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              제가 올리는 모든 음원·영상·이미지는 제가 직접 만들었거나 올릴 수 있는 정당한 권리를
              가지고 있으며, 다른 사람의 저작권을 침해하지 않습니다.
              <span className="mt-0.5 block text-xs text-gray-400">
                샘플·비트·반주 등 타인의 저작물을 사용했다면 정식 라이선스나 사용 허가를 받은
                것이어야 해요.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedCollabDisclaimer}
              onChange={(e) => setAgreedCollabDisclaimer(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              memo에서 다른 사람과 함께 만든 결과물(공동창작)의 소유권·지분·크레딧 배분은
              참여자들끼리 직접 정할 사항이며, Comp는 이를 대신 정하거나 분쟁을 중재하지
              않는다는 것을 이해합니다.
              <span className="mt-0.5 block text-xs text-gray-400">
                여러 명이 함께 곡을 완성하면 법적으로 "공동저작물"이 되고 참여자 전원이
                공동저작권자가 될 수 있어요. 참여자끼리 미리 역할과 지분을 이야기해두는 걸
                권장해요.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedLicenseGrant}
              onChange={(e) => setAgreedLicenseGrant(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              Comp가 제 게시물을 서비스 화면에 노출하고 운영하는 데 필요한 범위 안에서만
              사용하는 것에 동의합니다. 이 동의가 제 창작물의 소유권을 Comp에 넘기는 것은
              아닙니다.
            </span>
          </label>
        </div>

        {error && <p className={errorText}>{error}</p>}
        <Button type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? "가입 중..." : "가입하기"}
        </Button>
      </form>
    </main>
  );
}
