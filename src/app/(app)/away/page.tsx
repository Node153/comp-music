import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "@/components/FeedbackForm";
import { pageTitle, sectionTitle, pageCard, mutedText } from "@/components/ui/styles";

// Away — 상단바 DM 자리를 대신하는 공지사항+피드백 창구(0021_announcements_and_feedback).
export default async function AwayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, content, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className={`${pageCard} flex flex-col gap-8`}>
      <div>
        <h1 className={pageTitle}>Away</h1>
        <p className={`${mutedText} mt-1`}>공지사항을 확인하고, 하고 싶은 말을 남겨주세요.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>📣 공지사항</h2>
        <div className="flex flex-col gap-3">
          {(announcements ?? []).map((a) => (
            <article key={a.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {a.content}
              </p>
            </article>
          ))}
          {(announcements ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">아직 공지사항이 없습니다</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>✍️ 피드백 보내기</h2>
        {user && <FeedbackForm userId={user.id} />}
      </section>
    </main>
  );
}
