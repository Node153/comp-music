// S17 관리자 - 심사 대기열 (ADMIN-01)
// 제출일 오름차순, SLA(48h) 임박 항목 강조. role='admin'만 접근 (proxy.ts에서 가드)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, badge, mutedText } from "@/components/ui/styles";

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
    <main>
      <h1 className={pageTitle}>심사 대기열</h1>
      <div className="mt-5 flex flex-col gap-2">
        {(verifications ?? []).map((v) => {
          const user = userMap.get(v.user_id);
          const submittedAt = new Date(v.submitted_at);
          const isOverdue = isOverdueSubmission(submittedAt);
          return (
            <Link
              key={v.id}
              href={`/admin/verifications/${v.id}`}
              className={`flex items-center justify-between rounded-2xl border p-4 transition hover:border-gray-300 ${
                isOverdue ? "border-red-200 bg-red-50" : "border-gray-200"
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{user?.name ?? "-"}</span>
                  <span className={badge}>{v.type === "student" ? "전공생" : "활동자"}</span>
                  {isOverdue && (
                    <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium text-white">
                      SLA 초과
                    </span>
                  )}
                </div>
                <span className={mutedText}>{submittedAt.toLocaleString("ko-KR")}</span>
              </div>
              <span className="text-sm font-medium text-blue-600">심사하기 →</span>
            </Link>
          );
        })}
        {(verifications ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">대기 중인 심사 건이 없습니다</p>
        )}
      </div>
    </main>
  );
}
