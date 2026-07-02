import Link from "next/link";

// S1 랜딩/온보딩 (전체 접근 가능, 비로그인 사용자는 여기서 가입 유도 — spec 1.2)
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-bold">음악 전공생 네트워킹</h1>
      <p className="text-sm text-gray-500">
        폐쇄형 인증 기반의 음악 전공/활동자 릴스 네트워킹 플랫폼
      </p>
      <div className="flex w-full flex-col gap-3">
        <Link href="/signup" className="rounded bg-black px-3 py-2 text-white">
          가입하기
        </Link>
        <Link href="/login" className="rounded border px-3 py-2">
          로그인
        </Link>
      </div>
    </main>
  );
}
