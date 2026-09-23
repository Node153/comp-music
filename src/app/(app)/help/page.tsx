import { createClient } from "@/lib/supabase/server";
import { FeedbackChat, type FeedbackChatMessage } from "@/components/FeedbackChat";
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";

// Help(구 Away) — 공지사항+피드백 창구(0021_announcements_and_feedback).
// 관리자 페이지 진입은 TopNav 프로필 드롭다운(ProfileMenu)의 "관리자 메뉴"로 옮겼다.
// 여기서 isAdmin은 피드백 채팅 메시지 삭제 권한 판정에만 쓴다.
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

  // 피드백 단체 채팅(0047) — 최근 200개만. 닉네임은 users에서 별도 조회(관리자/admin 페이지와
  // 동일 패턴, PostgREST embed 대신 2쿼리). 표시는 무조건 닉네임.
  const { data: rawFeedback } = user
    ? await supabase
        .from("feedback_messages")
        .select("id, user_id, content, is_private, category, created_at")
        .order("created_at", { ascending: true })
        .limit(200)
    : { data: null };

  const feedbackSenderIds = [...new Set((rawFeedback ?? []).map((m) => m.user_id))];
  const { data: feedbackNicks } =
    feedbackSenderIds.length > 0
      ? await supabase.from("users").select("id, nickname, nickname_tag, role").in("id", feedbackSenderIds)
      : { data: [] };
  const nickById = new Map((feedbackNicks ?? []).map((u) => [u.id, u]));
  const feedbackMessages: FeedbackChatMessage[] = (rawFeedback ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    nickname: nickById.get(m.user_id)?.nickname ?? "탈퇴한 사용자",
    nicknameTag: nickById.get(m.user_id)?.nickname_tag ?? "",
    isComper: nickById.get(m.user_id)?.role === "admin",
    content: m.content,
    isPrivate: m.is_private,
    category: m.category,
    createdAt: m.created_at,
  }));

  return (
    // 모바일은 pb-24(96px)로는 부족 — 로그인 사용자에겐 하단바 두 개(GlobalPlayerBar 64px +
    // BottomNav 56px = 7.5rem/120px)가 항상 떠 있어서, 페이지 맨 아래 피드백 채팅 입력창이
    // 그 밑에 24px 정도 가려지는 문제가 있었다(2026-09-22 확인 — messages/[conversationId]와
    // 같은 원인). 데스크톱은 BottomNav가 없어(md:hidden) 기존 md:pb-6 그대로 둔다.
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 bg-main-gray p-6 pb-[7.5rem] md:my-6 md:rounded-lg md:pb-6">
      <div>
        <h1 className={`${pageTitle} !text-black`}>Help</h1>
        <p className={`${mutedText} !text-active-gray mt-1`}>공지사항을 확인하고, 하고 싶은 말을 남겨주세요.</p>
      </div>

      {/* 왼쪽: 공지사항 · 오른쪽: 피드백 채팅. 데스크톱은 두 칸, 모바일은 위아래로 쌓임. */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className={`${sectionTitle} !text-black`}>📣 공지사항</h2>
          <div className="flex flex-col gap-3 overflow-y-auto rounded-xl bg-box-gray p-4 md:h-[600px]">
            {(announcements ?? []).map((a) => (
              <article key={a.id} className="rounded-xl bg-main-gray p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-black">{a.title}</h3>
                  <span className="shrink-0 text-xs text-active-gray">
                    {new Date(a.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-black">
                  {a.content}
                </p>
              </article>
            ))}
            {(announcements ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-active-gray">아직 공지사항이 없습니다</p>
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className={`${sectionTitle} !text-black`}>💬 피드백 채팅</h2>
          <p className={`${mutedText} !text-active-gray`}>
            유형을 고르면 더 빨리 확인할 수 있어요. 🔒 운영자에게만 보내면 다른 회원에게는 보이지 않아요.
          </p>
          <div className="h-[70vh] md:h-[600px]">
            {user ? (
              <FeedbackChat currentUserId={user.id} isAdmin={isAdmin} initialMessages={feedbackMessages} />
            ) : (
              <p className="flex h-full items-center justify-center rounded-xl bg-box-gray text-center text-sm text-active-gray">
                로그인 후 이용할 수 있어요.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
