import Link from "next/link";

// S1 랜딩/온보딩 (전체 접근 가능, 비로그인 사용자는 여기서 가입 유도 — spec 1.2)
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-xl font-bold text-white">
          Comp
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Comp</h1>
          <p className="text-sm leading-relaxed text-gray-500">
            컴프레서처럼 다양한 소리를 고르게, 재즈 컴핑처럼 서로를 받쳐주는 음악 전공생·활동자
            네트워킹 플랫폼
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
