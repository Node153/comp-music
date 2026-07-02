// S4 인증서류 업로드 (AUTH-03)
// 전공생: 재학증명서/학생증/졸업증명서/학교이메일, 활동자: 음반발매·음원링크·공연포스터·크레딧 등
// 파일당 10MB 제한(이미지/PDF), 최소 1종 이상 필수. 제출 후 verifications row 생성(status=pending) → /status 이동
export default function VerifyDocumentsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">인증 서류 업로드</h1>
      {/* TODO: 선택한 유형(전공생/활동자)에 따라 동적 폼 렌더링, Supabase Storage 업로드 */}
      <form className="flex flex-col gap-3">
        <input type="file" accept="image/*,application/pdf" className="rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          제출하기
        </button>
      </form>
    </main>
  );
}
