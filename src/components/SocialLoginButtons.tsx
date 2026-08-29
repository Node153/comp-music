"use client";

// 로그인/회원가입 화면 공용 — Google/Kakao/Spotify 버튼. 셋 다 Supabase Auth Provider 설정에서
// 활성화돼 있어야 실제로 동작한다(대시보드 Authentication > Sign In / Providers, Client
// ID/Secret은 각 제공자 개발자 콘솔에서 발급 — 이 코드만으로는 동작 안 함).
// signUp/signIn 구분이 따로 없다 — OAuth는 계정이 있으면 로그인, 없으면 자동 가입이라
// 로그인/가입 화면 어디서 눌러도 동일하게 signInWithOAuth 하나만 부르면 된다.
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { KAKAO_LOGIN_ENABLED } from "@/lib/featureFlags";

// 각 제공자 공식 마크를 인라인 SVG로 재현하되, 브랜드 컬러 대신 흑백 단색으로 통일
// (앱 전체가 중성적인 흑백 톤 — src/components/ui/styles.ts 참고). currentColor를 써서
// 버튼 텍스트 색(gray-900)과 항상 같이 맞춰진다. 도형(패스) 자체는 원본 아이콘과 동일.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden fill="currentColor">
      <path d="M19.6 10.23c0-.82-.07-1.42-.22-2.05H10v3.72h5.51c-.11.92-.72 2.3-2.07 3.22l-.02.13 3 2.32.21.02c1.91-1.76 3-4.35 3-7.36z" />
      <path d="M10 20c2.7 0 4.96-.89 6.62-2.41l-3.15-2.44c-.85.59-1.99 1-3.47 1-2.65 0-4.9-1.76-5.7-4.19l-.13.01-3.11 2.4-.04.12C2.72 17.78 6.05 20 10 20z" />
      <path d="M4.3 11.96c-.2-.59-.32-1.22-.32-1.96s.12-1.37.31-1.96l-.01-.13-3.14-2.44-.1.05C.31 6.9 0 8.41 0 10s.31 3.1.94 4.48l3.36-2.52z" />
      <path d="M10 3.96c1.88 0 3.15.81 3.87 1.49l2.83-2.76C14.94.99 12.7 0 10 0 6.05 0 2.72 2.22.94 5.52l3.35 2.52C5.1 5.72 7.35 3.96 10 3.96z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path
        fill="#FFFFFF"
        d="M10 4.5c-3.31 0-6 2.13-6 4.75 0 1.7 1.14 3.19 2.85 4.03-.13.46-.45 1.65-.51 1.9-.08.32.11.31.24.23.1-.07 1.64-1.11 2.31-1.57.36.05.74.08 1.11.08 3.31 0 6-2.13 6-4.75s-2.69-4.75-6-4.75z"
      />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path
        fill="#FFFFFF"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.78 13.06c-.16 0-.26-.05-.4-.13-1.44-.87-3.11-1.16-5.13-.72-.17.04-.29.07-.36.07-.28 0-.47-.22-.47-.48 0-.34.2-.5.45-.55 2.32-.5 4.28-.17 5.93.83.22.13.32.29.32.53 0 .27-.21.45-.34.45zm.85-2.12c-.19 0-.32-.08-.44-.15-1.68-1-4.16-1.42-6.28-.86-.14.04-.22.06-.35.06-.34 0-.61-.27-.61-.61 0-.34.17-.56.5-.66 2.53-.7 5.34-.24 7.32.95.26.15.4.36.4.68 0 .34-.28.59-.54.59zm.97-2.35c-.22 0-.36-.08-.5-.16-1.96-1.16-5.19-1.5-7.4-.9-.13.03-.3.09-.42.09-.4 0-.72-.32-.72-.73 0-.41.24-.65.56-.74 2.6-.7 6.16-.4 8.47.98.25.15.42.35.42.73 0 .41-.32.73-.41.73z"
      />
    </svg>
  );
}

const ALL_PROVIDERS: { id: "google" | "kakao" | "spotify"; label: string; icon: ReactNode }[] = [
  { id: "google", label: "Google로 계속하기", icon: <GoogleIcon /> },
  { id: "kakao", label: "Kakao로 계속하기", icon: <KakaoIcon /> },
  { id: "spotify", label: "Spotify로 계속하기", icon: <SpotifyIcon /> },
];

// 사업자 등록 전까지 Kakao 버튼 숨김(featureFlags.ts) — 목록에서만 빼고 handleClick 등
// 나머지 로직은 그대로 둔다(다시 켤 때 값만 뒤집으면 됨).
const PROVIDERS = ALL_PROVIDERS.filter((p) => p.id !== "kakao" || KAKAO_LOGIN_ENABLED);

// Kakao는 Supabase가 기본으로 account_email/profile_image/profile_nickname 3개를 한꺼번에
// 요청하는데, 우리 Kakao 앱은 "카카오계정(이메일)"이 사업자 인증 없이는 권한 자체가 안 열려서
// (KOE205, "설정하지 않은 동의 항목" 에러) 이메일/프로필사진은 요청에서 빼고 실제로 켜둔
// 닉네임만 요청한다 — 어차피 프로필 사진은 우리 앱이 쓰지도 않음.
// Spotify는 이메일 제공에 별도 사업자 인증이 없어서 기본 스코프 그대로 둬도 된다(제한 없음).
const SCOPES: Partial<Record<"google" | "kakao" | "spotify", string>> = {
  kakao: "profile_nickname",
};

export function SocialLoginButtons() {
  const supabase = createClient();

  async function handleClick(provider: "google" | "kakao" | "spotify") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: SCOPES[provider],
      },
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => handleClick(id)}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}
