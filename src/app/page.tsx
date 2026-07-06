import Link from "next/link";

// S1 랜딩/온보딩 (전체 접근 가능, 비로그인 사용자는 여기서 가입 유도 — spec 1.2)
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl text-white">
          🎵
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            음악 전공생 네트워킹
          </h1>
          <p className="text-sm leading-relaxed text-gray-500">
            폐쇄형 인증 기반의 음악 전공/활동자 릴스 네트워킹 플랫폼
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            가입하기
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
          >
            로그인
          </Link>
        </div>
      </div>
    </main>
  );
}
