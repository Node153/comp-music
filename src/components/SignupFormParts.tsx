"use client";

// 이메일 가입(signup/page.tsx)과 소셜 가입 온보딩(onboarding/page.tsx)이 같이 쓰는 폼 조각 —
// 프로필 입력칸(실명/생년월일/닉네임)과 약관 동의 묶음. 두 화면이 각자 마크업을 복사해 갖고
// 있다가 "전체 동의"·안내 문구·체크박스 스타일이 한쪽에만 들어가는 식으로 계속 어긋나서
// (2026-10-08, 사용자 요청 "UI 통일") 한 곳으로 모았다. 문구·스타일은 여기서만 고칠 것.
import { useState, type Dispatch, type SetStateAction } from "react";
import { BirthDateScrollPicker } from "@/components/BirthDateScrollPicker";
import { field, label } from "@/components/ui/styles";
import { useNicknamePhrases } from "@/lib/useNicknamePhrases";
import { DiceIcon } from "@/components/icons";

// 약관/정책 링크를 새 탭으로 열기(사용자 요청) — <Link target="_blank">를 체크박스와 같은
// <label> 안에 두면 Safari가 새 탭을 열긴 열되 href로 이동하지 않고 현재 페이지를 그대로
// 복제해서 띄우는 버그가 있다(label의 클릭 위임 로직과 앵커 태그가 충돌하는 것으로 보임,
// stopPropagation만으로는 해결 안 됨). <a>를 아예 쓰지 않고 버튼 클릭 시 window.open을
// 직접 호출하면 이 문제를 피할 수 있다.
function openInNewTab(path: string) {
  window.open(path, "_blank", "noopener,noreferrer");
}

const today = new Date();
const MAX_BIRTH_DATE = today.toISOString().slice(0, 10);
const MIN_BIRTH_DATE = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())
  .toISOString()
  .slice(0, 10);

// 작은 대문자 구역 라벨(계정 / 프로필) — 폼을 의미 단위로 끊어 읽히게 한다.
export const signupEyebrow = "text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400";
export const signupFieldLabel = `${label} px-0.5`;
export const signupSubmitButton =
  "w-full py-3 text-[15px] font-semibold shadow-sm transition active:scale-[0.99]";
const hint = "px-0.5 text-xs leading-relaxed text-gray-400";
const checkbox = "mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-black";
const policyLink =
  "font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:underline";

// 가입 화면 상단 머리말 — 브랜드 라벨 + 제목 + 한 줄 설명(children은 그 아래 추가 줄).
export function SignupHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-400">
        Compmusic
      </span>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500">{description}</p>
      {children}
    </header>
  );
}

export function SignupProfileFields({
  name,
  setName,
  birthDate,
  setBirthDate,
  nickname,
  setNickname,
}: {
  name: string;
  setName: (v: string) => void;
  // 동명이인(중복 계정 의심) 판별 보조용(0031) — 소셜로그인마다 이메일이 달라서 같은 사람이
  // 여러 계정을 만들 수 있는 문제 대응. /admin/members의 동명이인 경고에서 같이 비교됨.
  birthDate: string;
  setBirthDate: (v: string) => void;
  nickname: string;
  setNickname: Dispatch<SetStateAction<string>>;
}) {
  // 실명/닉네임 이원화(0018) — Companion에게는 실명, 그 외에게는 닉네임이 보이므로 둘 다 필수.
  // 배달의민족 가입 화면 참고 — 재밌는 닉네임을 자동으로 채워주고 "다시 뽑기"로 고르게 한다.
  // 서버(SSR)와 클라이언트가 다른 랜덤값을 만들면 하이드레이션이 꼬이므로, 초기값은 빈
  // 문자열로 두고 문구 목록 로드가 끝난 뒤에 채운다(그 사이 직접 입력했으면 건드리지 않음).
  const { pick: pickNickname } = useNicknamePhrases((pick) =>
    setNickname((prev) => prev || pick()),
  );

  return (
    <section className="flex flex-col gap-3">
      <p className={signupEyebrow}>프로필</p>
      <div className="flex flex-col gap-1.5">
        <span className={signupFieldLabel}>실명</span>
        <input
          type="text"
          placeholder="실명을 입력해주세요"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
        <p className={hint}>
          관리자가 가입을 승인할 때 실명으로 확인하니, 본인의 실제 이름을 입력해 주세요. 실명은
          서로 Companion이 된 회원과 운영자에게만 보여요.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={signupFieldLabel}>생년월일</span>
        <BirthDateScrollPicker
          value={birthDate}
          onChange={setBirthDate}
          minDate={MIN_BIRTH_DATE}
          maxDate={MAX_BIRTH_DATE}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={signupFieldLabel}>닉네임</span>
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
            onClick={() => setNickname(pickNickname())}
            title="다른 닉네임 뽑기"
            aria-label="다른 닉네임 뽑기"
            className="flex shrink-0 items-center justify-center rounded-xl border border-gray-300 px-3.5 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          >
            <DiceIcon className="h-4 w-4" />
          </button>
        </div>
        <p className={hint}>신원이 드러나지 않도록, 개성 있고 재미있는 닉네임을 사용해 주세요.</p>
      </div>
    </section>
  );
}

// 동의 체크박스 6개(전부 필수) — 기록되는 동의는 8종 그대로다(src/lib/agreements.ts). 키는 화면 표시 순서.
// - terms/privacy/communityGuidelines: 약관 동의 재구성(2026-08-20) — 이용약관/개인정보처리방침을
//   각각 별개 체크박스로 분리하고 커뮤니티 운영정책(/community-guidelines)을 추가.
// - over14: 만 14세 이상 자기신고(2026-08-29, 사용자 요청) — 생년월일 검증(isOldEnough)이 있지만
//   조작해서 입력할 수도 있으므로 명시적 동의도 별도로 받는다(데이터 검증 + 자기신고 이중 장치).
// - betaNotice: 베타 서비스 이용 안내(2026-08-29, 사용자 요청, /beta-notice).
// - contentTerms: 저작권/공동창작/이용 허락 동의(docs/copyright_agreement_draft.md) 세 가지를 체크박스
//   하나로 묶었다(2026-10-08, 가입 절차 단순화 — 체크박스가 8개라 길었고 내용은 이용약관 제6조와
//   같다). 세 문장은 그대로 보여주고, 기록도 content_rights/collab_disclaimer/license_grant 3행 그대로.
const AGREEMENT_KEYS = [
  "over14",
  "terms",
  "privacy",
  "communityGuidelines",
  "betaNotice",
  "contentTerms",
] as const;
type AgreementKey = (typeof AGREEMENT_KEYS)[number];
type AgreementState = Record<AgreementKey, boolean>;

const NONE_AGREED = Object.fromEntries(AGREEMENT_KEYS.map((k) => [k, false])) as AgreementState;

// 동의 체크 상태. 여기서는 폼 제출을 막는 게이트 역할만 한다 — 실제 기록은 이메일 가입은
// handle_new_user 트리거(0023/0039)가, 소셜 가입은 onboarding/page.tsx가 직접 남긴다.
export function useSignupAgreements() {
  const [agreed, setAgreed] = useState<AgreementState>(NONE_AGREED);
  // "전체 동의"는 파생 상태 — 개별 항목을 하나라도 끄면 자동으로 해제된다(별도 state 없음).
  const allAgreed = AGREEMENT_KEYS.every((k) => agreed[k]);
  return {
    agreed,
    allAgreed,
    setOne: (key: AgreementKey, v: boolean) => setAgreed((prev) => ({ ...prev, [key]: v })),
    setAll: (v: boolean) =>
      setAgreed(Object.fromEntries(AGREEMENT_KEYS.map((k) => [k, v])) as AgreementState),
  };
}

const POLICY_ITEMS: { key: AgreementKey; path: string; title: string }[] = [
  { key: "terms", path: "/terms", title: "서비스 이용약관" },
  { key: "privacy", path: "/privacy", title: "개인정보 수집·이용" },
  { key: "communityGuidelines", path: "/community-guidelines", title: "커뮤니티 운영정책" },
];

// 개인정보 수집·이용 동의를 받는 자리에서 바로 볼 수 있는 요약(항목·목적·보유기간·거부 시 불이익).
// 전문은 /privacy — 여기 내용을 바꾸면 방침 1~3장과 어긋나지 않는지 같이 볼 것. 평소엔 접혀 있다.
function PrivacyConsentSummary() {
  return (
    <details className="mt-1 text-xs leading-relaxed text-gray-500">
      <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
        수집 항목·목적·보유기간 보기
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1 rounded-lg bg-white p-2.5 ring-1 ring-gray-200">
        <li>
          <span className="font-medium text-gray-700">수집 항목</span> 이메일, 실명, 생년월일, 닉네임
          (이메일 가입 시 비밀번호), 가입 심사 때 확인하는 학교·전공·학번
        </li>
        <li>
          <span className="font-medium text-gray-700">이용 목적</span> 회원 식별·로그인, 만 14세 이상
          확인과 중복 가입 방지, 가입 심사, 서비스 제공과 알림 발송
        </li>
        <li>
          <span className="font-medium text-gray-700">보유 기간</span> 회원 탈퇴 시까지
        </li>
        <li>
          동의하지 않을 수 있지만, 가입에 꼭 필요한 정보라 동의하지 않으면 가입할 수 없어요.
        </li>
      </ul>
    </details>
  );
}

export function SignupAgreements({
  agreements,
}: {
  agreements: ReturnType<typeof useSignupAgreements>;
}) {
  const { agreed, allAgreed, setOne, setAll } = agreements;

  // 체크박스(<label>)와 새 탭 버튼이 완전히 분리된 구조(사용자 요청, Safari 새탭 버그 재수정) —
  // <button>을 <label> "안"에 두면 (window.open으로 바꿨어도) 여전히 실기기 Safari에서 새 탭
  // 이동이 안 됐다. label과 그 안의 다른 상호작용 요소가 같이 있는 것 자체가 문제였던 것으로
  // 보여, 아예 버튼을 label 바깥의 형제 요소로 뺐다 — 앞뒤 텍스트만 htmlFor로 같은 체크박스를
  // 가리키는 <label>로 감싸 클릭 영역을 유지한다.
  function policyRow(key: AgreementKey, path: string, title: string) {
    const id = `agree-${key}`;
    return (
      <div key={key} className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          required
          checked={agreed[key]}
          onChange={(e) => setOne(key, e.target.checked)}
          className={checkbox}
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="cursor-pointer">
            [필수]{" "}
          </label>
          <button type="button" onClick={() => openInNewTab(path)} className={policyLink}>
            {title}
          </button>
          <label htmlFor={id} className="cursor-pointer">
            에 동의합니다.
          </label>
          {key === "privacy" && <PrivacyConsentSummary />}
        </div>
      </div>
    );
  }

  function plainRow(key: AgreementKey, children: React.ReactNode) {
    return (
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          required
          checked={agreed[key]}
          onChange={(e) => setOne(key, e.target.checked)}
          className={checkbox}
        />
        <span>{children}</span>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
      <label className="flex items-center gap-2.5 text-sm font-semibold text-gray-900">
        <input
          type="checkbox"
          checked={allAgreed}
          onChange={(e) => setAll(e.target.checked)}
          className={checkbox}
        />
        <span>전체 동의</span>
      </label>
      <div className="h-px bg-gray-200" />
      <div className="flex flex-col gap-3 text-sm text-gray-600">
        {/* 만 14세 확인은 읽을 문서가 딸린 약관이 아니라 본인 확인 항목이라 링크가 없다 — 링크 달린
            항목들 사이에 끼어 있으면 혼자 빠진 것처럼 보여서(사용자 지적) 맨 위로 빼고 한 줄 안내를 붙였다. */}
        {plainRow(
          "over14",
          <>
            [필수] 만 14세 이상입니다.
            <span className="mt-0.5 block text-xs text-gray-400">
              만 14세 미만은 가입할 수 없어요.
            </span>
          </>,
        )}
        {POLICY_ITEMS.map((item) => policyRow(item.key, item.path, item.title))}
        {policyRow("betaNotice", "/beta-notice", "베타 서비스 이용 안내")}
        {/* 아래 세 문장은 각각 content_rights / collab_disclaimer / license_grant 동의로 기록된다.
            문장을 바꾸면 해당 항목의 버전도 같이 올릴 것(src/lib/agreements.ts + handle_new_user 트리거). */}
        {plainRow(
          "contentTerms",
          <>
            [필수] 콘텐츠 권리에 관한 아래 세 가지를 확인하고 동의합니다.
            <span className="mt-1.5 flex flex-col gap-1.5 text-[13px] leading-relaxed text-gray-500">
              <span>
                · 제가 올리는 음원·영상·이미지는 직접 만들었거나, 사용할 권한을 받은 콘텐츠입니다.
                다른 사람의 저작권을 침해하지 않겠습니다.
                <span className="block text-xs text-gray-400">
                  다른 사람의 샘플·비트·반주 등을 사용했다면 정식 허가가 필요해요.
                </span>
              </span>
              <span>
                · 다른 사람과 함께 만든 콘텐츠의 소유권·수익 배분·크레딧은 참여자끼리 직접 정해야
                한다는 점을 이해했습니다. Compmusic은 이를 대신 결정하거나 분쟁을 중재하지
                않습니다.
                <span className="block text-xs text-gray-400">
                  작업을 시작하기 전에 각자의 역할과 지분을 미리 정해두는 것을 추천해요.
                </span>
              </span>
              <span>
                · Compmusic이 제 게시물을 서비스 화면에 보여주고, 서비스 운영에 필요한 범위에서
                사용하는 것에 동의합니다. 콘텐츠의 소유권은 여전히 저에게 있습니다.
              </span>
            </span>
          </>,
        )}
      </div>
    </div>
  );
}
