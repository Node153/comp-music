import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText } from "@/components/ui/styles";
import { AnnouncementForm } from "./AnnouncementForm";
import { DeleteAnnouncementButton } from "./DeleteAnnouncementButton";

// 관리자 - 공지사항 작성/삭제(0021_announcements_and_feedback). role=admin만 접근(proxy.ts에서 가드).
export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, content, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className={pageTitle}>공지사항 관리</h1>
        <Link href="/admin/feedback" className="text-sm font-medium text-blue-600 hover:underline">
          피드백 보기 →
        </Link>
      </div>

      {user && <AnnouncementForm authorId={user.id} />}

      <div className="flex flex-col gap-2">
        {(announcements ?? []).map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-gray-900">{a.title}</span>
                <span className={mutedText}>{new Date(a.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <DeleteAnnouncementButton id={a.id} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{a.content}</p>
          </div>
        ))}
        {(announcements ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">등록된 공지가 없습니다</p>
        )}
      </div>
    </main>
  );
}
