// S17 관리자 - 심사 대기열 (ADMIN-01)
// 제출일 오름차순, SLA(48h) 임박 항목 강조. role='admin'만 접근 (proxy.ts에서 가드)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const SLA_HOURS = 48;

function isOverdueSubmission(submittedAt: Date): boolean {
  return Date.now() - submittedAt.getTime() > SLA_HOURS * 60 * 60 * 1000;
}

export default async function AdminVerificationQueuePage() {
  const supabase = await createClient();

  const { data: verifications } = await supabase
    .from("verifications")
    .select("id, user_id, type, submitted_at")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  const userIds = [...new Set((verifications ?? []).map((v) => v.user_id))];
  const { data: users } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, email").in("id", userIds)
      : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">심사 대기열</h1>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">이름</th>
            <th>유형</th>
            <th>제출일</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(verifications ?? []).map((v) => {
            const user = userMap.get(v.user_id);
            const submittedAt = new Date(v.submitted_at);
            const isOverdue = isOverdueSubmission(submittedAt);
            return (
              <tr key={v.id} className={`border-b ${isOverdue ? "bg-red-50" : ""}`}>
                <td className="py-2">{user?.name ?? "-"}</td>
                <td>{v.type === "student" ? "전공생" : "활동자"}</td>
                <td>
                  {submittedAt.toLocaleString("ko-KR")}
                  {isOverdue && <span className="ml-2 text-red-600">SLA 초과</span>}
                </td>
                <td>
                  <Link href={`/admin/verifications/${v.id}`} className="text-blue-600">
                    심사하기
                  </Link>
                </td>
              </tr>
            );
          })}
          {(verifications ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-400">
                대기 중인 심사 건이 없습니다
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
