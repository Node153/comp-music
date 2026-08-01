import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText } from "@/components/ui/styles";

// 관리자 - 사용자 피드백 목록(0021_announcements_and_feedback). role=admin만 접근(proxy.ts에서 가드).
// 관리 목적 내부 화면이라 user_display(닉네임) 대신 users에서 실명을 바로 조회한다.
export default async function AdminFeedbackPage() {
  const supabase = await createClient();

  const { data: feedbackRows } = await supabase
    .from("feedback")
    .select("id, user_id, content, created_at")
    .order("created_at", { ascending: false });

  const userIds = [...new Set((feedbackRows ?? []).map((f) => f.user_id))];
  const { data: users } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, email").in("id", userIds)
      : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className={pageTitle}>피드백</h1>
        <Link href="/admin/announcements" className="text-sm font-medium text-blue-600 hover:underline">
          공지사항 관리 →
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {(feedbackRows ?? []).map((f) => {
          const sender = userMap.get(f.user_id);
          return (
            <div key={f.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">{sender?.name ?? "알 수 없음"}</span>
                <span className={mutedText}>{new Date(f.created_at).toLocaleString("ko-KR")}</span>
              </div>
              {sender?.email && <span className="text-xs text-gray-400">{sender.email}</span>}
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{f.content}</p>
            </div>
          );
        })}
        {(feedbackRows ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">아직 받은 피드백이 없습니다</p>
        )}
      </div>
    </main>
  );
}
