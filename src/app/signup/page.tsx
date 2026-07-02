// S2 회원가입 (AUTH-01)
export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">회원가입</h1>
      {/* TODO: 이메일 중복 검사, 비밀번호 8자 이상 규칙, supabase.auth.signUp 연동 */}
      {/* 가입 성공 시 /verify/type 으로 이동 (플로우 A) */}
      <form className="flex flex-col gap-3">
        <input type="text" placeholder="이름" className="rounded border px-3 py-2" />
        <input type="email" placeholder="이메일" className="rounded border px-3 py-2" />
        <input type="password" placeholder="비밀번호 (8자 이상)" className="rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          가입하기
        </button>
      </form>
    </main>
  );
}
