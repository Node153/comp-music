// 로그인 (AUTH-01의 로그인 측면 — IA에는 명시 안 됐지만 회원가입과 쌍을 이루는 필수 화면)
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">로그인</h1>
      {/* TODO: 이메일+비밀번호 supabase.auth.signInWithPassword 연동 */}
      <form className="flex flex-col gap-3">
        <input type="email" placeholder="이메일" className="rounded border px-3 py-2" />
        <input type="password" placeholder="비밀번호" className="rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          로그인
        </button>
      </form>
    </main>
  );
}
