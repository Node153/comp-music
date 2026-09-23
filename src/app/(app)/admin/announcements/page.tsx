import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText } from "@/components/ui/styles";
import { AnnouncementForm } from "./AnnouncementForm";
import { DeleteAnnouncementButton } from "./DeleteAnnouncementButton";
import { ANNOUNCEMENT_KIND_LABEL } from "@/lib/announcements";

// 관리자 - 공지사항 작성/삭제(0021_announcements_and_feedback). role=admin만 접근(proxy.ts에서 가드).
export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, content, kind, pinned, link_url, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-col gap-5">
      <h1 className={pageTitle}>공지사항 관리</h1>

      {user && <AnnouncementForm authorId={user.id} />}

      <div className="flex flex-col gap-2">
        {(announcements ?? []).map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {ANNOUNCEMENT_KIND_LABEL[a.kind]}
                  </span>
                  {a.pinned && <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">고정</span>}
                  <span className="font-medium text-gray-900">{a.title}</span>
                </span>
                <span className={mutedText}>{new Date(a.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <DeleteAnnouncementButton id={a.id} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{a.content}</p>
            {a.link_url && <p className="mt-1 text-xs text-gray-500">바로가기: {a.link_url}</p>}
          </div>
        ))}
        {(announcements ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">등록된 공지가 없습니다</p>
        )}
      </div>
    </main>
  );
}
