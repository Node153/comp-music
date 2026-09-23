import type { SupabaseClient } from "@supabase/supabase-js";

// 공지 종류(0067) — Help(피드백) 페이지 "업데이트 소식" 칸과 관리자 공지 화면이 같이 쓴다.
export type AnnouncementKind = "notice" | "update" | "feedback";

export const ANNOUNCEMENT_KINDS: { value: AnnouncementKind; label: string }[] = [
  { value: "notice", label: "공지" },
  { value: "update", label: "업데이트" },
  { value: "feedback", label: "피드백 반영" },
];

export const ANNOUNCEMENT_KIND_LABEL = Object.fromEntries(
  ANNOUNCEMENT_KINDS.map((k) => [k.value, k.label]),
) as Record<AnnouncementKind, string>;

// "직접 써보기" 링크는 앱 내부 경로만(DB check와 동일: '/'로 시작, '//' 금지).
export function isInternalPath(url: string) {
  return /^\/[^/]/.test(url);
}

// 피드백 여러 건을 묶어 "피드백 반영" 공지를 만든다(관리자 클라이언트에서 호출 — RLS상 관리자만
// 성공). 요청자 수/공감 수는 관리자가 모든 행을 볼 수 있는 지금 계산해 스냅샷으로 저장한다
// (회원은 비공개 피드백을 못 읽어서 화면에서 셀 수 없음). markDone이면 선택한 피드백을
// "반영됨"으로 바꿔 작성자 알림(feedback_update)도 같이 나가게 한다.
export async function createFeedbackAnnouncement(
  supabase: SupabaseClient,
  input: {
    feedbackIds: string[];
    title: string;
    content: string;
    requestSummary: string;
    linkUrl: string;
    markDone: boolean;
  },
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인 정보가 없습니다" };
  if (input.linkUrl && !isInternalPath(input.linkUrl)) {
    return { error: "바로가기 링크는 /로 시작하는 앱 내부 경로만 쓸 수 있어요 (예: /search)" };
  }

  const [{ data: rows }, { count: likeCount }] = await Promise.all([
    supabase.from("feedback_messages").select("user_id").in("id", input.feedbackIds),
    supabase
      .from("feedback_reactions")
      .select("feedback_id", { count: "exact", head: true })
      .in("feedback_id", input.feedbackIds),
  ]);
  const requesterCount = new Set((rows ?? []).map((r: { user_id: string }) => r.user_id)).size;

  const { data: ann, error: annError } = await supabase
    .from("announcements")
    .insert({
      author_id: user.id,
      kind: "feedback",
      title: input.title.trim(),
      content: input.content.trim(),
      request_summary: input.requestSummary.trim() || null,
      link_url: input.linkUrl.trim() || null,
      requester_count: requesterCount,
      like_count: likeCount ?? 0,
    })
    .select("id")
    .single();
  if (annError || !ann) return { error: `공지 등록 실패: ${annError?.message ?? "알 수 없음"}` };

  const { error: linkError } = await supabase
    .from("announcement_feedback")
    .insert(input.feedbackIds.map((feedbackId) => ({ announcement_id: ann.id, feedback_id: feedbackId })));
  if (linkError) return { error: `공지는 등록됐지만 피드백 연결 실패: ${linkError.message}` };

  if (input.markDone) {
    const { error: doneError } = await supabase
      .from("feedback_messages")
      .update({ status: "done", admin_updated_at: new Date().toISOString() })
      .in("id", input.feedbackIds)
      .neq("status", "done");
    if (doneError) return { error: `공지는 등록됐지만 상태 변경 실패: ${doneError.message}` };
  }
  return { error: null };
}
