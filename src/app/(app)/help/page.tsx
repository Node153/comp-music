import { createClient } from "@/lib/supabase/server";
import { FeedbackChat, type FeedbackChatMessage } from "@/components/FeedbackChat";
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";
import { ArrowRightIcon, FeedbackIcon, HammerIcon, SparkleIcon, ThumbsUpIcon } from "@/components/icons";
import { UpdatesBoard, type UpdateItem } from "@/components/UpdatesBoard";
import { MarkUpdatesSeen } from "@/components/UpdatesStatusContext";
import { FeedbackStatusIcon } from "@/components/FeedbackIcons";
import { FEEDBACK_STATUS_LABEL } from "@/lib/feedback";

// Help(구 Away) — 공지사항+피드백 창구(0021_announcements_and_feedback).
// 0067 — 왼쪽 칸은 "업데이트 소식"(UpdatesBoard): 공지/업데이트/피드백 반영 카드, 고정 공지 먼저.
// 0068 — "남기면 진짜 반영된다"는 신뢰를 주려고 맨 위에 처리 현황 띠(feedback_stats — 받은 의견 →
// 검토 중 → 반영, 이번 달 반영, 평균 첫 응답)와 "지금 만드는 중"(공감 많은 공개 의견)을 둔다.
// 숫자가 0인 항목은 역효과라 숨긴다. 모바일 순서: 현황 → 만드는 중 → 채팅 → 업데이트 소식
// (참여를 먼저), 데스크톱: 왼쪽(만드는 중+업데이트 소식) · 오른쪽(채팅).
// 관리자 페이지 진입은 TopNav 프로필 드롭다운(ProfileMenu)의 "관리자 메뉴"로 옮겼다.
// 여기서 isAdmin은 피드백 채팅 메시지 삭제 권한 판정에만 쓴다.

type Stats = {
  received: number;
  reviewing: number;
  done: number;
  done_this_month: number;
  avg_response_hours: number | null;
};

function responseTimeText(hours: number) {
  if (hours < 1) return "1시간 안에";
  if (hours < 24) return `${Math.ceil(hours)}시간 안에`;
  return `${Math.ceil(hours / 24)}일 안에`;
}

function StatusStrip({ stats }: { stats: Stats | null }) {
  const steps = stats
    ? [
        { label: "받은 의견", value: stats.received },
        { label: "검토 중", value: stats.reviewing },
        { label: "반영", value: stats.done },
      ].filter((st) => st.value > 0)
    : [];
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-box-gray p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 브랜드 이미지(NavSidebar와 동일) */}
        <img src="/brand-cat.png" alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-black">운영자가 모든 의견을 직접 읽어요</span>
          <span className="text-xs text-active-gray">
            {stats?.avg_response_hours != null
              ? `최근 의견엔 평균 ${responseTimeText(Number(stats.avg_response_hours))} 답했어요`
              : "남겨주신 의견은 검토 후 상태와 답변으로 알려드려요"}
          </span>
        </div>
      </div>
      {steps.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-black">
          {steps.map((st, i) => (
            <span key={st.label} className="inline-flex items-center gap-2">
              {i > 0 && <ArrowRightIcon className="h-3.5 w-3.5 text-active-gray" />}
              <span className="text-xs text-active-gray">{st.label}</span>
              <span className="font-semibold tabular-nums">{st.value}</span>
            </span>
          ))}
          {stats && stats.done_this_month > 0 && (
            <span className="ml-1 rounded-full bg-black px-2.5 py-0.5 text-xs font-medium text-white">
              이번 달 반영 {stats.done_this_month}건
            </span>
          )}
        </div>
      )}
    </section>
  );
}

// "지금 만드는 중" — 검토 중인 공개 의견을 공감순으로, 3개가 안 되면 공감 받은 접수 의견으로 채움(최대 5).
function BuildingNow({ items }: { items: FeedbackChatMessage[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className={`${sectionTitle} flex items-center gap-1.5 !text-black`}>
        <HammerIcon className="h-5 w-5" /> 지금 만드는 중
      </h2>
      <div className="flex flex-col gap-1.5 rounded-xl bg-box-gray p-3">
        {items.map((m, i) => (
          <a
            key={m.id}
            href={`#fb-${m.id}`}
            className="flex items-center gap-3 rounded-lg bg-main-gray px-3 py-2 text-sm text-black transition hover:bg-demo-bg"
          >
            <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-active-gray">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{m.content}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-active-gray">
              <FeedbackStatusIcon status={m.status} className="h-3 w-3" />
              {FEEDBACK_STATUS_LABEL[m.status]}
            </span>
            {m.likers.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-active-gray">
                <ThumbsUpIcon className="h-3 w-3" /> {m.likers.length}
              </span>
            )}
          </a>
        ))}
        {items.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-active-gray">
            공감을 많이 받은 의견이 여기 올라와요. 채팅에서 “나도”로 공감해 보세요.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const [{ data: announcements }, { data: statsRows }] = await Promise.all([
    supabase
    .from("announcements")
    .select("id, title, content, kind, pinned, request_summary, link_url, requester_count, like_count, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false }),
    user ? supabase.rpc("feedback_stats") : Promise.resolve({ data: null }),
  ]);
  const stats = (statsRows?.[0] as Stats | undefined) ?? null;
  const announcementLinks = Object.fromEntries((announcements ?? []).map((a) => [a.id, a.link_url]));
  const updates: UpdateItem[] = (announcements ?? []).map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    content: a.content,
    pinned: a.pinned,
    requestSummary: a.request_summary,
    linkUrl: a.link_url,
    requesterCount: a.requester_count,
    likeCount: a.like_count,
    createdAt: a.created_at,
  }));

  // 피드백 단체 채팅(0047) — 최근 200개만. 닉네임은 users에서 별도 조회(관리자/admin 페이지와
  // 동일 패턴, PostgREST embed 대신 2쿼리). 표시는 무조건 닉네임.
  const { data: rawFeedback } = user
    ? await supabase
        .from("feedback_messages")
        .select("id, user_id, content, is_private, category, status, admin_reply, image_path, announcement_id, created_at")
        .order("created_at", { ascending: true })
        .limit(200)
    : { data: null };

  const feedbackSenderIds = [...new Set((rawFeedback ?? []).map((m) => m.user_id))];
  const { data: feedbackNicks } =
    feedbackSenderIds.length > 0
      ? await supabase.from("users").select("id, nickname, nickname_tag, role").in("id", feedbackSenderIds)
      : { data: [] };
  const nickById = new Map((feedbackNicks ?? []).map((u) => [u.id, u]));

  // 0065 — "나도 👍" 누른 사람들(RLS상 볼 수 있는 피드백의 반응만 온다).
  const feedbackIds = (rawFeedback ?? []).map((m) => m.id);
  const { data: reactions } =
    feedbackIds.length > 0
      ? await supabase.from("feedback_reactions").select("feedback_id, user_id").in("feedback_id", feedbackIds)
      : { data: [] };
  const likersById = new Map<string, string[]>();
  for (const r of reactions ?? []) {
    likersById.set(r.feedback_id, [...(likersById.get(r.feedback_id) ?? []), r.user_id]);
  }
  const feedbackMessages: FeedbackChatMessage[] = (rawFeedback ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    nickname: nickById.get(m.user_id)?.nickname ?? "탈퇴한 사용자",
    nicknameTag: nickById.get(m.user_id)?.nickname_tag ?? "",
    isComper: nickById.get(m.user_id)?.role === "admin",
    content: m.content,
    isPrivate: m.is_private,
    category: m.category,
    status: m.status,
    adminReply: m.admin_reply,
    imagePath: m.image_path,
    announcementId: m.announcement_id,
    likers: likersById.get(m.id) ?? [],
    createdAt: m.created_at,
  }));

  const byLikes = (a: FeedbackChatMessage, b: FeedbackChatMessage) => b.likers.length - a.likers.length;
  const candidates = feedbackMessages.filter((m) => !m.isPrivate && !m.announcementId && m.category);
  const reviewing = candidates.filter((m) => m.status === "reviewing").sort(byLikes);
  const popularReceived = candidates.filter((m) => m.status === "received" && m.likers.length > 0).sort(byLikes);
  const buildingNow = [...reviewing, ...(reviewing.length < 3 ? popularReceived : [])].slice(0, 5);

  return (
    // 모바일은 pb-24(96px)로는 부족 — 로그인 사용자에겐 하단바 두 개(GlobalPlayerBar 64px +
    // BottomNav 56px = 7.5rem/120px)가 항상 떠 있어서, 페이지 맨 아래 피드백 채팅 입력창이
    // 그 밑에 24px 정도 가려지는 문제가 있었다(2026-09-22 확인 — messages/[conversationId]와
    // 같은 원인). 데스크톱은 BottomNav가 없어(md:hidden) 기존 md:pb-6 그대로 둔다.
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 bg-main-gray p-6 pb-[7.5rem] md:my-6 md:rounded-lg md:pb-6">
      <div>
        <h1 className={`${pageTitle} !text-black`}>피드백</h1>
        <p className={`${mutedText} !text-active-gray mt-1`}>여러분의 의견으로 바뀐 것들을 확인하고, 하고 싶은 말을 남겨주세요.</p>
      </div>

      {user && <MarkUpdatesSeen />}
      <StatusStrip stats={stats} />

      {/* 데스크톱: 왼쪽(만드는 중 + 업데이트 소식) · 오른쪽(채팅, 두 줄 차지).
          모바일: order로 만드는 중 → 채팅 → 업데이트 소식 순. */}
      <div className="grid gap-6 md:grid-cols-2 md:grid-rows-[auto_1fr]">
        <div className="order-1 min-w-0 md:col-start-1 md:row-start-1">
          <BuildingNow items={buildingNow} />
        </div>

        <section className="order-2 flex min-w-0 flex-col gap-3 md:col-start-2 md:row-span-2 md:row-start-1">
          <h2 className={`${sectionTitle} flex items-center gap-1.5 !text-black`}>
            <FeedbackIcon className="h-5 w-5" /> 피드백 채팅
          </h2>
          <p className={`${mutedText} !text-active-gray`}>
            유형을 고르면 더 빨리 확인할 수 있어요. “운영자에게만”으로 보내면 다른 회원에게는 보이지 않아요.
          </p>
          <div className="h-[70vh] md:h-auto md:min-h-[600px] md:flex-1">
            {user ? (
              <FeedbackChat
                currentUserId={user.id}
                isAdmin={isAdmin}
                initialMessages={feedbackMessages}
                announcementLinks={announcementLinks}
              />
            ) : (
              <p className="flex h-full items-center justify-center rounded-xl bg-box-gray text-center text-sm text-active-gray">
                로그인 후 이용할 수 있어요.
              </p>
            )}
          </div>
        </section>

        <section id="updates" className="order-3 flex min-w-0 scroll-mt-4 flex-col gap-3 md:col-start-1 md:row-start-2">
          <h2 className={`${sectionTitle} flex items-center gap-1.5 !text-black`}>
            <SparkleIcon className="h-5 w-5" /> 업데이트 소식
          </h2>
          <UpdatesBoard items={updates} />
        </section>
      </div>
    </main>
  );
}
