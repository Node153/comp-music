import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FeedbackChat, type FeedbackChatMessage } from "@/components/FeedbackChat";
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";

const ADMIN_LINKS = [
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/verifications", label: "심사 대기열" },
  { href: "/admin/announcements", label: "공지사항 관리" },
  { href: "/admin/feedback", label: "피드백 보기" },
  { href: "/admin/login-screen", label: "로그인 화면 설정" },
];

// Help(구 Away) — 공지사항+피드백 창구(0021_announcements_and_feedback).
// 관리자에게는 여기(맨 위)에 관리자 페이지 진입 링크도 노출 — 앱 안에 다른 진입점이 없어서
// 지금까지는 /admin/* URL을 직접 쳐서만 들어갈 수 있었음.
export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, content, created_at")
    .order("created_at", { ascending: false });

  // 피드백 단체 채팅(0046) — 최근 200개만. 닉네임은 users에서 별도 조회(관리자/admin 페이지와
  // 동일 패턴, PostgREST embed 대신 2쿼리). 표시는 무조건 닉네임.
  const { data: rawFeedback } = user
    ? await supabase
        .from("feedback_messages")
        .select("id, user_id, content, created_at")
        .order("created_at", { ascending: true })
        .limit(200)
    : { data: null };

  const feedbackSenderIds = [...new Set((rawFeedback ?? []).map((m) => m.user_id))];
  const { data: feedbackNicks } =
    feedbackSenderIds.length > 0
      ? await supabase.from("users").select("id, nickname, nickname_tag").in("id", feedbackSenderIds)
      : { data: [] };
  const nickById = new Map((feedbackNicks ?? []).map((u) => [u.id, u]));
  const feedbackMessages: FeedbackChatMessage[] = (rawFeedback ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    nickname: nickById.get(m.user_id)?.nickname ?? "탈퇴한 사용자",
    nicknameTag: nickById.get(m.user_id)?.nickname_tag ?? "",
    content: m.content,
    createdAt: m.created_at,
  }));

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 bg-white p-6 pb-24 md:my-6 md:rounded-lg md:border md:border-gray-200 md:pb-6">
      <div>
        <h1 className={pageTitle}>Help</h1>
        <p className={`${mutedText} mt-1`}>공지사항을 확인하고, 하고 싶은 말을 남겨주세요.</p>
      </div>

      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitle}>🛠️ 관리자 메뉴</h2>
          <div className="flex flex-wrap gap-2">
            {ADMIN_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 왼쪽: 공지사항 · 오른쪽: 피드백 채팅. 데스크톱은 두 칸, 모바일은 위아래로 쌓임. */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className={sectionTitle}>📣 공지사항</h2>
          <div className="flex flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 p-4 md:h-[600px]">
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

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className={sectionTitle}>💬 피드백 채팅</h2>
          <p className={mutedText}>
            전체 회원이 함께 보는 공간이에요. 무엇이든 편하게 남겨주세요. (닉네임으로 표시됩니다)
          </p>
          <div className="h-[70vh] md:h-[600px]">
            {user ? (
              <FeedbackChat currentUserId={user.id} isAdmin={isAdmin} initialMessages={feedbackMessages} />
            ) : (
              <p className="flex h-full items-center justify-center rounded-xl border border-gray-200 text-center text-sm text-gray-400 dark:border-gray-800 dark:text-gray-500">
                로그인 후 이용할 수 있어요.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
