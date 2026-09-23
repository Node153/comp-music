import { createClient } from "@/lib/supabase/server";
import { pageTitle } from "@/components/ui/styles";
import { AnnouncementForm } from "./AnnouncementForm";
import { AnnouncementItem } from "./AnnouncementItem";

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
          <AnnouncementItem key={a.id} announcement={a} authorId={user?.id ?? ""} />
        ))}
        {(announcements ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">등록된 공지가 없습니다</p>
        )}
      </div>
    </main>
  );
}
