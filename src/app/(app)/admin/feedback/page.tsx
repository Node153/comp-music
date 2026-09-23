import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText } from "@/components/ui/styles";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABEL,
  FEEDBACK_STATUSES,
  PULSE_QUESTIONS,
  PULSE_SCORES,
  type FeedbackCategory,
  type FeedbackStatus,
  type PulseTrigger,
} from "@/lib/feedback";
import { FeedbackImage } from "@/components/FeedbackChat";
import { FeedbackAdminControls } from "./FeedbackAdminControls";

// 관리자 - 피드백 단체 채팅 로그(0047_feedback_group_chat). role=admin만 접근(proxy.ts에서 가드).
// 앱 /help에서는 닉네임으로만 보이지만, 관리 화면은 관례대로 실명을 바로 조회해 최신순으로 훑는다.
// (모더레이션용 삭제는 채팅 UI에서 관리자가 바로 할 수 있음.)
//
// 0063 — 메시지마다 처리 상태/답변을 달면 작성자에게 알림이 가고 /help 채팅에도 바로 보인다.
// 상단 필터(?status=, ?category=)로 처리할 것만 추려 본다.
//
// 0065 — "나도 👍" 수(?sort=likes로 공감순 정렬), 첨부 스크린샷, 상황별 짧은 설문 결과 요약.
type SearchParams = { status?: string; category?: string; sort?: string };

function filterHref(current: SearchParams, patch: SearchParams) {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams(
    Object.entries(next).filter((e): e is [string, string] => !!e[1]),
  ).toString();
  return qs ? `/admin/feedback?${qs}` : "/admin/feedback";
}

function chipClass(active: boolean) {
  return `rounded-full px-2.5 py-1 text-xs font-medium transition ${
    active ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
  }`;
}

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const status = FEEDBACK_STATUSES.some((s) => s.value === params.status)
    ? (params.status as FeedbackStatus)
    : undefined;
  const category =
    params.category === "none" || FEEDBACK_CATEGORIES.some((c) => c.value === params.category)
      ? (params.category as FeedbackCategory | "none")
      : undefined;
  const sort = params.sort === "likes" ? "likes" : undefined;
  const current: SearchParams = { status, category, sort };

  const supabase = await createClient();

  let query = supabase
    .from("feedback_messages")
    .select("id, user_id, content, is_private, category, status, admin_reply, admin_updated_at, image_path, created_at")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (category === "none") query = query.is("category", null);
  else if (category) query = query.eq("category", category);
  const { data: rawRows } = await query;

  const [{ data: reactions }, { data: pulses }] = await Promise.all([
    (rawRows ?? []).length > 0
      ? supabase.from("feedback_reactions").select("feedback_id").in("feedback_id", (rawRows ?? []).map((f) => f.id))
      : Promise.resolve({ data: [] as { feedback_id: string }[] }),
    supabase.from("feedback_pulses").select("trigger, score, comment, created_at").order("created_at", { ascending: false }),
  ]);
  const likeCount = new Map<string, number>();
  for (const r of reactions ?? []) likeCount.set(r.feedback_id, (likeCount.get(r.feedback_id) ?? 0) + 1);
  const feedbackRows =
    sort === "likes"
      ? [...(rawRows ?? [])].sort((a, b) => (likeCount.get(b.id) ?? 0) - (likeCount.get(a.id) ?? 0))
      : (rawRows ?? []);

  // 설문 요약 — 트리거별 점수 분포/평균, "다음에"로 닫은 수, 최근 코멘트.
  const pulseSummary = (Object.keys(PULSE_QUESTIONS) as PulseTrigger[]).map((trigger) => {
    const rows = (pulses ?? []).filter((p) => p.trigger === trigger);
    const answered = rows.filter((p) => p.score !== null);
    const avg = answered.length > 0 ? answered.reduce((sum, p) => sum + (p.score ?? 0), 0) / answered.length : null;
    return {
      trigger,
      answered: answered.length,
      dismissed: rows.length - answered.length,
      avg,
      dist: PULSE_SCORES.map((s) => ({ ...s, count: answered.filter((p) => p.score === s.score).length })),
      comments: answered.filter((p) => p.comment).slice(0, 5),
    };
  });

  const userIds = [...new Set(feedbackRows.map((f) => f.user_id))];
  const { data: users } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, email").in("id", userIds)
      : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <main className="flex flex-col gap-5">
      <h1 className={pageTitle}>피드백</h1>

      <section className="grid gap-2 md:grid-cols-2">
        {pulseSummary.map((p) => (
          <div key={p.trigger} className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">{PULSE_QUESTIONS[p.trigger]}</p>
            <p className={`${mutedText} mt-0.5`}>
              응답 {p.answered}명{p.avg !== null && ` · 평균 ${p.avg.toFixed(1)} / 4`} · 다음에 {p.dismissed}명
            </p>
            <div className="mt-2 flex gap-3 text-sm">
              {p.dist.map((d) => (
                <span key={d.score} title={d.label}>
                  {d.emoji} {d.count}
                </span>
              ))}
            </div>
            {p.comments.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
                {p.comments.map((c, i) => (
                  <li key={i}>
                    {PULSE_SCORES.find((s) => s.score === c.score)?.emoji} “{c.comment}”
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 text-xs text-gray-500">상태</span>
          <Link href={filterHref(current, { status: undefined })} className={chipClass(!status)}>
            전체
          </Link>
          {FEEDBACK_STATUSES.map((s) => (
            <Link key={s.value} href={filterHref(current, { status: s.value })} className={chipClass(status === s.value)}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 text-xs text-gray-500">유형</span>
          <Link href={filterHref(current, { category: undefined })} className={chipClass(!category)}>
            전체
          </Link>
          {FEEDBACK_CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={filterHref(current, { category: c.value })}
              className={chipClass(category === c.value)}
            >
              {c.label}
            </Link>
          ))}
          <Link href={filterHref(current, { category: "none" })} className={chipClass(category === "none")}>
            일반 대화
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-10 text-xs text-gray-500">정렬</span>
          <Link href={filterHref(current, { sort: undefined })} className={chipClass(!sort)}>
            최신순
          </Link>
          <Link href={filterHref(current, { sort: "likes" })} className={chipClass(sort === "likes")}>
            공감순
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {feedbackRows.map((f) => {
          const sender = userMap.get(f.user_id);
          const likes = likeCount.get(f.id) ?? 0;
          return (
            <div key={f.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">{sender?.name ?? "알 수 없음"}</span>
                <span className={mutedText}>{new Date(f.created_at).toLocaleString("ko-KR")}</span>
              </div>
              {sender?.email && <span className="text-xs text-gray-400">{sender.email}</span>}
              {(f.category || f.is_private || likes > 0) && (
                <div className="mt-2 flex gap-1.5 text-xs">
                  {f.category && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                      {FEEDBACK_CATEGORY_LABEL[f.category]}
                    </span>
                  )}
                  {f.is_private && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">운영자에게만</span>}
                  {likes > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">공감 {likes}</span>}
                </div>
              )}
              {f.image_path && (
                <div className="mt-2">
                  <FeedbackImage path={f.image_path} />
                </div>
              )}
              {f.content && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{f.content}</p>}
              <FeedbackAdminControls
                id={f.id}
                content={f.content}
                initialStatus={f.status}
                initialReply={f.admin_reply ?? ""}
                adminUpdatedAt={f.admin_updated_at}
              />
            </div>
          );
        })}
        {feedbackRows.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">
            {status || category ? "조건에 맞는 피드백이 없습니다" : "아직 받은 피드백이 없습니다"}
          </p>
        )}
      </div>
    </main>
  );
}
