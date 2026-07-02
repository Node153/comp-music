// S17 관리자 - 심사 대기열 (ADMIN-01)
// 제출일 오름차순, SLA(48h) 임박 항목 강조. role='admin'만 접근 (middleware에서 가드)
export default function AdminVerificationQueuePage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">심사 대기열</h1>
      {/* TODO: verifications where status='pending', order by submitted_at asc */}
      {/* SLA(0-5): submitted_at + 48h 지난 항목은 강조 표시 */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">이름</th>
            <th>유형</th>
            <th>제출일</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody />
      </table>
    </main>
  );
}
