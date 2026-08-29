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
import { generateNicknameCandidate, fetchTakenNicknames } from "@/lib/nicknameExamples";
import { DiceIcon } from "@/components/icons";

// signup/page.tsx의 handle_new_user 트리거(0023/0029)가 이메일 가입자에게 남기는 것과 동일한
// 버전 문자열 — 동의 이력을 한 기준으로 통일하기 위해 하드코딩 값도 그대로 맞춘다.
const AGREEMENT_VERSION = "2026-08-10";
const TERMS_PRIVACY_VERSION = "2026-08-19";

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
  // signup/page.tsx와 동일 — 이미 다른 회원이 쓰는 문구는 추천에서 제외.
  const [takenNicknames, setTakenNicknames] = useState<Set<string>>(new Set());
  const [agreedContentRights, setAgreedContentRights] = useState(false);
  const [agreedCollabDisclaimer, setAgreedCollabDisclaimer] = useState(false);
  const [agreedLicenseGrant, setAgreedLicenseGrant] = useState(false);
  const [agreedTermsAndPrivacy, setAgreedTermsAndPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Google/Kakao 프로필의 표시 이름을 실명 입력칸에 미리 채워준다(수정 가능) — 닉네임은
    // 실명이 그대로 새면 안 되므로 예시 목록 기반 랜덤값으로 채운다(signup/page.tsx와 동일 패턴).
    supabase.auth.getUser().then(({ data: { user } }) => {
      const metaName =
        (user?.user_metadata?.name as string | undefined) ??
        (user?.user_metadata?.full_name as string | undefined);
      if (metaName) setName(metaName);
    });
    fetchTakenNicknames(supabase).then((taken) => {
      setTakenNicknames(taken);
      setNickname(generateNicknameCandidate(taken));
    });
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
      setLoading(false);
      setError(
        updateError.message.includes("duplicate")
          ? "이미 사용 중인 닉네임이에요. 다시 뽑거나 다른 닉네임을 입력해주세요."
          : updateError.message,
      );
      return;
    }

    const { error: agreementError } = await supabase.from("agreements").insert([
      { user_id: user.id, type: "content_rights", version: AGREEMENT_VERSION },
      { user_id: user.id, type: "collab_disclaimer", version: AGREEMENT_VERSION },
      { user_id: user.id, type: "license_grant", version: AGREEMENT_VERSION },
      { user_id: user.id, type: "terms_of_service", version: TERMS_PRIVACY_VERSION },
      { user_id: user.id, type: "privacy_policy", version: TERMS_PRIVACY_VERSION },
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
              onClick={() => setNickname(generateNicknameCandidate(takenNicknames))}
              title="다른 닉네임 뽑기"
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-300 px-3.5 text-gray-600 transition hover:bg-gray-50"
            >
              <DiceIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="px-1 text-xs text-gray-400">
            Companion이 아닌 사람에게는 실명 대신 닉네임이 보여요. 다른 사람이 이 닉네임으로
            나를 검색해서 찾을 수 있으니, 활동명이 있다면 그걸로 적는 걸 추천해요.
          </p>
        </div>

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
          {loading ? "확인 중..." : "시작하기"}
        </Button>
      </form>
    </main>
  );
}
