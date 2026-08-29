"use client";

// 소셜로그인(Google/Kakao) 최초 로그인 온보딩 — proxy.ts가 users.needs_onboarding=true인
// 사용자를 여기로 보낸다(0027). 이메일 회원가입(signup/page.tsx)에서 받던 실명/닉네임 확정 +
// 저작권 동의 체크박스 3종을 여기서 대신 받는다 — OAuth는 그 화면 자체를 안 거치고
// auth.users 행이 바로 생기기 때문에, 동의는 반드시 사용자가 실제로 체크박스를 보고 눌러야만
// 기록되게 이 화면에서 처리한다(트리거가 대신 기록하지 않음 — 0027 마이그레이션 주석 참고).
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, label, errorText, pageTitle, mutedText } from "@/components/ui/styles";
import { generateNicknameCandidate, hasWhitespace } from "@/lib/nicknameExamples";
import { DiceIcon } from "@/components/icons";
import { isOldEnough } from "@/lib/age";

// signup/page.tsx의 handle_new_user 트리거(0023/0029/0039)가 이메일 가입자에게 남기는 것과
// 동일한 버전 문자열 — 동의 이력을 한 기준으로 통일하기 위해 하드코딩 값도 그대로 맞춘다.
const AGREEMENT_VERSION = "2026-08-10";
const TERMS_PRIVACY_VERSION = "2026-08-19";
const COMMUNITY_GUIDELINES_VERSION = "2026-08-20";
const AGE_OVER_14_VERSION = "2026-08-29";

const today = new Date();
const MAX_BIRTH_DATE = today.toISOString().slice(0, 10);
const MIN_BIRTH_DATE = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())
  .toISOString()
  .slice(0, 10);

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  // 소셜로그인 제공자(Google/Kakao/Spotify) 어디서도 생년월일을 안 줘서(0031) 직접 입력받는다
  // — signup/page.tsx와 같은 이유(동명이인 판별 보조).
  const [birthDate, setBirthDate] = useState("");
  const [nickname, setNickname] = useState("");
  // 화면에 "이 계정으로 로그인했다"는 걸 보여주기 위한 용도(사용자 요청) — 소셜로그인은
  // 이메일 입력칸 자체가 없어서 회원이 자기가 어느 이메일로 가입됐는지 확인할 방법이
  // 없었다(특히 Spotify 이메일 인증 이슈를 겪은 뒤 나온 요청). 폼 제출과는 무관, 읽기 전용 표시.
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [agreedContentRights, setAgreedContentRights] = useState(false);
  const [agreedCollabDisclaimer, setAgreedCollabDisclaimer] = useState(false);
  const [agreedLicenseGrant, setAgreedLicenseGrant] = useState(false);
  // 약관 동의 재구성(2026-08-20) — signup/page.tsx와 동일하게 이용약관/개인정보처리방침을
  // 각각 별개 체크박스로 분리하고 커뮤니티 운영정책 체크박스를 추가했다.
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedCommunityGuidelines, setAgreedCommunityGuidelines] = useState(false);
  // 만 14세 이상 자기신고 체크박스(2026-08-29, 사용자 요청) — signup/page.tsx와 동일한 이유
  // (생년월일 데이터 검증만으론 조작 가능성이 있어 명시적 동의도 같이 받음).
  const [agreedOver14, setAgreedOver14] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Google 프로필의 표시 이름을 실명 입력칸에 미리 채워준다(수정 가능) — 닉네임은 실명이
    // 그대로 새면 안 되므로 예시 목록 기반 랜덤값으로 채운다(signup/page.tsx와 동일 패턴).
    // Spotify는 여기서 제외(사용자 요청) — Spotify의 'name'은 실명이 아니라 사용자가 자유롭게
    // 정한 표시 이름(예: "노래좋으면벽봄" 같은 닉네임)이라 실명 입력칸에 미리 채우면 오히려
    // 헷갈린다. Google은 보통 실제 이름을 쓰므로 그대로 둔다.
    supabase.auth.getUser().then(({ data: { user } }) => {
      setConnectedEmail(user?.email ?? null);
      const provider = user?.app_metadata?.provider;
      if (provider !== "spotify") {
        const metaName =
          (user?.user_metadata?.name as string | undefined) ??
          (user?.user_metadata?.full_name as string | undefined);
        if (metaName) setName(metaName);
      }
    });
    setNickname(generateNicknameCandidate());
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("실명을 입력해주세요.");
      return;
    }
    if (!birthDate) {
      setError("생년월일을 입력해주세요.");
      return;
    }
    if (!isOldEnough(birthDate)) {
      setError("만 14세 이상만 가입할 수 있어요.");
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
      !agreedOver14
    ) {
      setError("아래 동의 항목에 모두 체크해주세요.");
      return;
    }

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("세션이 만료됐어요. 다시 로그인해주세요.");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        name: name.trim(),
        nickname: nickname.trim(),
        birth_date: birthDate,
        needs_onboarding: false,
      })
      .eq("id", user.id);

    if (updateError) {
      // nickname은 이제 유니크 제약이 없다(0038) — 실제 유일함은 서버가 자동 배정하는
      // nickname_tag가 담당하고 클라이언트는 그걸 절대 안 건드리므로 여기서 날 에러가 아니다.
      setLoading(false);
      setError(updateError.message);
      return;
    }

    const { error: agreementError } = await supabase.from("agreements").insert([
      { user_id: user.id, type: "content_rights", version: AGREEMENT_VERSION },
      { user_id: user.id, type: "collab_disclaimer", version: AGREEMENT_VERSION },
      { user_id: user.id, type: "license_grant", version: AGREEMENT_VERSION },
      { user_id: user.id, type: "terms_of_service", version: TERMS_PRIVACY_VERSION },
      { user_id: user.id, type: "privacy_policy", version: TERMS_PRIVACY_VERSION },
      { user_id: user.id, type: "community_guidelines", version: COMMUNITY_GUIDELINES_VERSION },
      { user_id: user.id, type: "age_over_14", version: AGE_OVER_14_VERSION },
    ]);
    setLoading(false);

    if (agreementError) {
      setError(agreementError.message);
      return;
    }

    router.push("/verify/type");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1.5">
        <h1 className={pageTitle}>거의 다 됐어요</h1>
        <p className={mutedText}>Comp에서 쓸 이름/닉네임을 확인하고, 마지막으로 동의만 하면 돼요.</p>
        {connectedEmail && (
          <p className={mutedText}>
            연결된 이메일: <span className="font-medium text-gray-700">{connectedEmail}</span>
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="실명"
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
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-300 px-3.5 text-gray-600 transition hover:bg-gray-50"
            >
              <DiceIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="px-1 text-xs text-gray-400">
            더 자유롭고 안전한 활동을 위해, 나만의 재미있는 닉네임을 사용해 주세요.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3.5">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              [필수]{" "}
              <Link href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-700">
                서비스 이용약관
              </Link>
              에 동의합니다.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              [필수]{" "}
              <Link href="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-700">
                개인정보 수집·이용
              </Link>
              에 동의합니다.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              checked={agreedCommunityGuidelines}
              onChange={(e) => setAgreedCommunityGuidelines(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-black"
            />
            <span>
              [필수]{" "}
              <Link
                href="/community-guidelines"
                target="_blank"
                className="text-blue-600 underline hover:text-blue-700"
              >
                커뮤니티 운영정책
              </Link>
              에 동의합니다.
            </span>
          </label>
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
          {loading ? "확인 중..." : "시작하기"}
        </Button>
      </form>
    </main>
  );
}
