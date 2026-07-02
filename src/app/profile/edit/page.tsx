// S10 프로필 수정 (PROFILE-01, 본인만 접근)
export default function ProfileEditPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-3 p-6">
      <h1 className="text-xl font-semibold">프로필 수정</h1>
      {/* TODO: profiles upsert — school, major, instruments, region, collab_available, bio, portfolio_links */}
      <form className="flex flex-col gap-3">
        <input type="text" placeholder="학교" className="rounded border px-3 py-2" />
        <input type="text" placeholder="전공" className="rounded border px-3 py-2" />
        <input type="text" placeholder="지역" className="rounded border px-3 py-2" />
        <textarea placeholder="소개글" className="rounded border px-3 py-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" /> 협업 가능
        </label>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          저장
        </button>
      </form>
    </main>
  );
}
