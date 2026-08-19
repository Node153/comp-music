"use client";

// 로그인 (AUTH-01의 로그인 측면)
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { field, errorText, pageTitle } from "@/components/ui/styles";

// 로그인 화면 배경음악/배경 이미지 — 관리자가 /admin/login-screen에서 직접 올린 값
// (site_settings.login_bgm_key / login_background_key)을 /api/login-screen로 조회해서 쓴다.
// 배경음악은 아직 아무것도 안 올렸으면(또는 조회 실패 시) 기본 데모 트랙으로 대체하고,
// 배경 이미지는 안 올렸으면 그냥 기본(흰 배경, 이미지 없음)으로 둔다.
// 브라우저 자동재생 정책상 소리 있는 오디오는 사용자 제스처 없이는 재생이 막히므로(자동재생
// 시도해봐야 대부분 무시됨), 자동재생 대신 우측 하단 토글 버튼으로 직접 켜고 끄게 한다 —
// 로그인 성공해서 화면을 벗어나면 언마운트 시 자동으로 멈춘다.
const FALLBACK_BGM_SRC = "/demo-completion-track.wav";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [bgmSrc, setBgmSrc] = useState(FALLBACK_BGM_SRC);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // /auth/callback이 소셜로그인 실패 시 ?error=...를 붙여 여기로 돌려보낸다.
    // useSearchParams 대신 직접 읽는 이유: 클라이언트 컴포넌트에서 useSearchParams를 쓰면
    // 빌드 시 Suspense 경계가 필요해지는데, 이 정도 용도로는 과함.
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) setError(oauthError);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/login-screen")
      .then((res) => res.json())
      .then((data: { bgmUrl: string | null; backgroundUrl: string | null }) => {
        if (cancelled) return;
        if (data.bgmUrl) {
          setBgmSrc(data.bgmUrl);
          audioRef.current?.load();
        }
        if (data.backgroundUrl) setBackgroundUrl(data.backgroundUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, []);

  function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicOn) {
      audio.pause();
      setMusicOn(false);
    } else {
      audio.play().catch(() => {});
      setMusicOn(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    router.push("/feed");
    router.refresh();
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-cover bg-center p-6"
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
    >
      <audio ref={audioRef} src={bgmSrc} loop />
      <button
        type="button"
        onClick={toggleMusic}
        aria-label={musicOn ? "배경음악 끄기" : "배경음악 켜기"}
        title={musicOn ? "배경음악 끄기" : "배경음악 켜기"}
        className="fixed bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full bg-black text-lg text-white shadow-lg transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        {musicOn ? "🔊" : "🔇"}
      </button>

      {/* 배경 이미지가 있을 때만 카드로 감싸서 어떤 사진 위에서도 글자가 읽히게 한다 —
          배경이 없으면(기본 상태) 지금까지와 똑같이 카드 없이 밋밋하게 보여준다. */}
      <div
        className={`mx-auto flex w-full max-w-sm flex-col gap-6 ${
          backgroundUrl ? "rounded-2xl bg-white/90 p-6 shadow-xl backdrop-blur-sm dark:bg-black/70" : ""
        }`}
      >
        <h1 className={pageTitle}>로그인</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            placeholder="비밀번호"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          <Link
            href="/forgot-password"
            className="-mt-1 text-right text-xs text-gray-500 hover:text-gray-900"
          >
            비밀번호를 잊으셨나요?
          </Link>
          {error && <p className={errorText}>{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          또는
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <SocialLoginButtons />
        <Link href="/signup" className="text-center text-sm text-gray-500 hover:text-gray-900">
          아직 계정이 없으신가요? <span className="font-medium text-gray-900">가입하기</span>
        </Link>
      </div>
    </main>
  );
}
