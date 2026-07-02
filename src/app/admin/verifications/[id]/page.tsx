// S18 관리자 - 심사 상세 (AUTH-06, ADMIN-02)
// Phase 0: 서류는 인라인 뷰어 대신 새 창에서 열기(1.4 저비용안) — 인라인 뷰어는 Phase 1에서 추가
export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">심사 상세</h1>
      <p className="text-sm text-gray-500">verification_id: {id}</p>
      {/* TODO: verifications.documents 목록을 "새 창에서 열기" 링크로 렌더링 */}
      <div className="mt-4 flex flex-col gap-2">
        {/* documents.map(doc => <a href={doc.file_url} target="_blank">{doc.doc_type}</a>) */}
      </div>
      {/* AUTH-04/06: 승인/반려 처리 시 users.status 갱신 + reviewer_id/reviewed_at 기록 */}
      <div className="mt-6 flex flex-col gap-3">
        <textarea placeholder="반려 사유 (선택)" className="rounded border px-3 py-2" />
        <div className="flex gap-2">
          <button className="flex-1 rounded bg-black px-3 py-2 text-white">승인</button>
          <button className="flex-1 rounded border px-3 py-2">반려</button>
        </div>
      </div>
    </main>
  );
}
