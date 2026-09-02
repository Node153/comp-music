"use client";

// S2 회원가입 (AUTH-01)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { BirthDateScrollPicker } from "@/components/BirthDateScrollPicker";
import { field, label, errorText, pageTitle } from "@/components/ui/styles";
import { generateNicknameCandidate, hasWhitespace } from "@/lib/nicknameExamples";
import { MailIcon, DiceIcon } from "@/components/icons";
import {
  isValidPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/lib/passwordPolicy";
import { isOldEnough } from "@/lib/age";

// 약관/정책 링크를 새 탭으로 열기(사용자 요청) — <Link target="_blank">를 체크박스와 같은
// <label> 안에 두면 Safari가 새 탭을 열긴 열되 href로 이동하지 않고 현재 페이지를 그대로
// 복제해서 띄우는 버그가 있다(label의 클릭 위임 로직과 앵커 태그가 충돌하는 것으로 보임,
// stopPropagation만으로는 해결 안 됨). <a>를 아예 쓰지 않고 버튼 클릭 시 window.open을
// 직접 호출하면 이 문제를 피할 수 있다.
function openInNewTab(path: string) {
  window.open(path, "_blank", "noopener,noreferrer");
}

const CONTACT_EMAIL = "jtaein0723@gmail.com";

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
  // 약관 동의 재구성(2026-08-20) — 이용약관/개인정보처리방침을 각각 별개 필수 체크박스로
  // 분리하고, 커뮤니티 운영정책(/community-guidelines) 체크박스를 추가했다. 실제 기록은
  // handle_new_user 트리거(0039)가 가입 성공 시 6개 항목을 한 번에 남기므로, 여기서는
  // 여전히 폼 제출을 막는 게이트 역할만 한다.
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedCommunityGuidelines, setAgreedCommunityGuidelines] = useState(false);
  // 만 14세 이상 자기신고 체크박스(2026-08-29, 사용자 요청) — 생년월일로 실제 나이를 검증하는
  // 로직(handleSubmit의 isOldEnough)이 이미 있지만, 생년월일을 조작해서 입력할 수도 있으므로
  // 명시적 동의도 별도로 받는다(데이터 검증 + 자기신고 이중 장치).
  const [agreedOver14, setAgreedOver14] = useState(false);
  // 베타 서비스 이용 안내 동의(2026-08-29, 사용자 요청) — 정식 출시 전 베타 기간 중 기능/
  // 데이터가 유지 안 될 수 있다는 점을 명시적으로 고지하고 동의받는다(/beta-notice).
  const [agreedBetaNotice, setAgreedBetaNotice] = useState(false);
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
    if (
      !agreedContentRights ||
      !agreedCollabDisclaimer ||
      !agreedLicenseGrant ||
      !agreedTerms ||
      !agreedPrivacy ||
      !agreedCommunityGuidelines ||
      !agreedOver14 ||
      !agreedBetaNotice
    ) {
      setError("아래 동의 항목에 모두 체크해주세요.");
      return;
    }

    setLoading(true);

    // 중복가입 사전 차단(2026-08-29, 사용자 요청) — 소셜로그인마다 이메일이 달라서 같은
    // 사람이 로그인 방법을 잊고 다른 방법으로 또 가입할 수 있는 문제. 이름+생년월일이 겹치는
    // 계정이 이미 있으면 여기서 막는다(완전 자동 차단 — 동명이인 오탐 가능성은 감수하기로
    // 사용자가 명시적으로 결정함. 추후 PASS 본인인증 도입 시 연락처 기반으로 재검토 예정).
    const { data: isDuplicate, error: duplicateCheckError } = await supabase.rpc(
      "check_duplicate_identity",
      { p_name: name, p_birth_date: birthDate },
    );
    if (duplicateCheckError) {
      setLoading(false);
      setError(duplicateCheckError.message);
      return;
    }
    if (isDuplicate) {
      setLoading(false);
      setError(
        `이미 동일한 이름과 생년월일로 가입된 계정이 있습니다. 본인의 계정이 맞다면 이전에 가입한 방법으로 로그인해주세요. 다른 사람인데 이 안내를 받으셨다면 ${CONTACT_EMAIL}로 문의해주세요.`,
      );
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, nickname: nickname.trim(), birth_date: birthDate } },
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
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <MailIcon className="h-6 w-6 text-gray-500" />
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
        <div className="flex flex-col gap-1.5">
          <span className={label}>실명</span>
          <input
            type="text"
            placeholder="실명을 입력해주세요"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>생년월일</span>
          <BirthDateScrollPicker
            value={birthDate}
            onChange={setBirthDate}
            minDate={MIN_BIRTH_DATE}
            maxDate={MAX_BIRTH_DATE}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={label}>닉네임</span>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="닉네임을 입력해주세요"
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
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-300 px-3.5 text-gray-600 transition hover:bg-gray-50"
            >
              <DiceIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="px-1 text-xs text-gray-400">
            신원이 드러나지 않도록, 개성 있고 재미있는 닉네임을 사용해 주세요.
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
          {/* 체크박스(<label>)와 새 탭 버튼이 완전히 분리된 구조(사용자 요청, Safari 새탭
              버그 재수정) — <button>을 <label> "안"에 두면 (window.open으로 바꿨어도) 여전히
              실기기 Safari에서 새 탭 이동이 안 됐다. label과 그 안의 다른 상호작용 요소가
              같이 있는 것 자체가 문제였던 것으로 보여, 아예 버튼을 label 바깥의 형제 요소로
              뺐다 — 앞뒤 텍스트만 htmlFor로 같은 체크박스를 가리키는 별개의 <label> 두 개로
              감싸 클릭 영역을 유지한다. */}
          <div className="flex items-start gap-2 text-sm">
            <input
              id="agree-terms"
              type="checkbox"
              required
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              <label htmlFor="agree-terms" className="cursor-pointer">
                [필수]{" "}
              </label>
              <button
                type="button"
                onClick={() => openInNewTab("/terms")}
                className="text-blue-600 underline hover:text-blue-700"
              >
                서비스 이용약관
              </button>
              <label htmlFor="agree-terms" className="cursor-pointer">
                에 동의합니다.
              </label>
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <input
              id="agree-privacy"
              type="checkbox"
              required
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              <label htmlFor="agree-privacy" className="cursor-pointer">
                [필수]{" "}
              </label>
              <button
                type="button"
                onClick={() => openInNewTab("/privacy")}
                className="text-blue-600 underline hover:text-blue-700"
              >
                개인정보 수집·이용
              </button>
              <label htmlFor="agree-privacy" className="cursor-pointer">
                에 동의합니다.
              </label>
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <input
              id="agree-community-guidelines"
              type="checkbox"
              required
              checked={agreedCommunityGuidelines}
              onChange={(e) => setAgreedCommunityGuidelines(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              <label htmlFor="agree-community-guidelines" className="cursor-pointer">
                [필수]{" "}
              </label>
              <button
                type="button"
                onClick={() => openInNewTab("/community-guidelines")}
                className="text-blue-600 underline hover:text-blue-700"
              >
                커뮤니티 운영정책
              </button>
              <label htmlFor="agree-community-guidelines" className="cursor-pointer">
                에 동의합니다.
              </label>
            </span>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedOver14}
              onChange={(e) => setAgreedOver14(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>[필수] 만 14세 이상입니다.</span>
          </label>
          <div className="flex items-start gap-2 text-sm">
            <input
              id="agree-beta-notice"
              type="checkbox"
              required
              checked={agreedBetaNotice}
              onChange={(e) => setAgreedBetaNotice(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              <label htmlFor="agree-beta-notice" className="cursor-pointer">
                [필수]{" "}
              </label>
              <button
                type="button"
                onClick={() => openInNewTab("/beta-notice")}
                className="text-blue-600 underline hover:text-blue-700"
              >
                베타 서비스 이용 안내
              </button>
              <label htmlFor="agree-beta-notice" className="cursor-pointer">
                에 동의합니다.
              </label>
            </span>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedContentRights}
              onChange={(e) => setAgreedContentRights(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              제가 올리는 음원·영상·이미지는 직접 만들었거나, 사용할 권한을 받은 콘텐츠입니다.
              다른 사람의 저작권을 침해하지 않겠습니다.
              <span className="mt-0.5 block text-xs text-gray-400">
                다른 사람의 샘플·비트·반주 등을 사용했다면 정식 허가가 필요해요.
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
              memo(비공개 협업 공간)에서 다른 사람과 함께 만든 콘텐츠의 소유권·수익 배분·크레딧은
              참여자끼리 직접 정해야 한다는 점을 이해했습니다. Comp는 이를 대신 결정하거나
              분쟁을 중재하지 않습니다.
              <span className="mt-0.5 block text-xs text-gray-400">
                작업을 시작하기 전에 각자의 역할과 지분을 미리 정해두는 것을 추천해요.
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
              Comp가 제 게시물을 서비스 화면에 보여주고, 서비스 운영에 필요한 범위에서 사용하는
              것에 동의합니다. 콘텐츠의 소유권은 여전히 저에게 있습니다.
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
