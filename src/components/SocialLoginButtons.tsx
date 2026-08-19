"use client";

// 로그인/회원가입 화면 공용 — Google/Kakao 버튼. 둘 다 Supabase Auth Provider 설정에서
// 활성화돼 있어야 실제로 동작한다(대시보드 Authentication > Sign In / Providers, Client
// ID/Secret은 각 제공자 개발자 콘솔에서 발급 — 이 코드만으로는 동작 안 함).
// signUp/signIn 구분이 따로 없다 — OAuth는 계정이 있으면 로그인, 없으면 자동 가입이라
// 로그인/가입 화면 어디서 눌러도 동일하게 signInWithOAuth 하나만 부르면 된다.
import { createClient } from "@/lib/supabase/client";

const PROVIDERS = [
  { id: "google" as const, label: "Google로 계속하기", icon: "G" },
  { id: "kakao" as const, label: "Kakao로 계속하기", icon: "💬" },
];

// Kakao는 Supabase가 기본으로 account_email/profile_image/profile_nickname 3개를 한꺼번에
// 요청하는데, 우리 Kakao 앱은 "카카오계정(이메일)"이 사업자 인증 없이는 권한 자체가 안 열려서
// (KOE205, "설정하지 않은 동의 항목" 에러) 이메일/프로필사진은 요청에서 빼고 실제로 켜둔
// 닉네임만 요청한다 — 어차피 프로필 사진은 우리 앱이 쓰지도 않음.
const SCOPES: Partial<Record<"google" | "kakao", string>> = {
  kakao: "profile_nickname",
};

export function SocialLoginButtons() {
  const supabase = createClient();

  async function handleClick(provider: "google" | "kakao") {
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
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
        >
          <span aria-hidden>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
