// S8 업로드 화면 (FEED-01, 02, 05, 07)
// Phase 0: 공개범위 UI 없음(visibility=public 고정), 예약 게시 없음(즉시 게시만) — 1.4
export default function UploadPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">영상 업로드</h1>
      <form className="flex flex-col gap-3">
        {/* FEED-01: mp4/mov, 최대 60초(임시값) */}
        <input type="file" accept="video/mp4,video/quicktime" className="rounded border px-3 py-2" />
        {/* FEED-02: 캡션 + content_type + 악기 태그(각 최소 1개 필수) */}
        <textarea placeholder="캡션" className="rounded border px-3 py-2" />
        <select className="rounded border px-3 py-2" defaultValue="">
          <option value="" disabled>
            콘텐츠 유형
          </option>
          <option value="composition">작곡</option>
          <option value="performance">연주</option>
          <option value="practice">연습</option>
          <option value="rehearsal">리허설</option>
          <option value="improv">즉흥</option>
          <option value="ensemble">합주</option>
        </select>
        {/* FEED-05: 노출시간 6/12/24/48h — Phase 0에서도 그대로 유지 */}
        <select className="rounded border px-3 py-2" defaultValue="24">
          <option value="6">6시간</option>
          <option value="12">12시간</option>
          <option value="24">24시간</option>
          <option value="48">48시간</option>
        </select>
        {/* FEED-07: 협업가능 표시 — Phase 0은 체크+역할텍스트만, 바로 DM 연결 */}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" /> 협업 구함
        </label>
        <input type="text" placeholder="찾는 역할 (예: 보컬)" className="rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          게시하기
        </button>
      </form>
    </main>
  );
}
