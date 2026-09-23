import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLikedFeedbackAnnouncements } from "@/lib/notificationList";

// 상단/하단 네비의 안읽음 뱃지 숫자. 예전엔 (app)/layout.tsx가 매 페이지 렌더마다
// 이 계산(쿼리 최대 7개, 주간 likes 전체 스캔 + users count)을 동기로 돌려서
// 업로드·메시지·프로필 화면 첫 페인트까지 막았다 — 이제 /api/notifications/count로
// 빼서 클라이언트가 페인트 후 비동기로 가져온다.
// PEAK 판정은 posts.peaked_at(0056, 조회수+좋아요*10>=PEAK_VIEW_THRESHOLD에서 한 번
// 영구 고정)을 그대로 쓴다 — src/lib/notificationList.ts와 동일한 기준.
export async function computeUnseenNotificationCount(
  supabase: SupabaseClient,
  userId: string,
  seenAt: string,
): Promise<number> {
  const [{ data: myPosts }, { data: newCompanionRequests }, { data: newFeedbackUpdates }, newLikedAnnouncements] =
    await Promise.all([
    supabase.from("posts").select("id, visibility, peaked_at").eq("user_id", userId),
    supabase
      .from("companions")
      .select("id")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .gt("created_at", seenAt),
    // 0063 — 내 피드백에 관리자가 상태 변경/답변(notificationList.ts의 feedback_update와 동일 기준).
    supabase.from("feedback_messages").select("id").eq("user_id", userId).gt("admin_updated_at", seenAt),
    // 0067 — 내가 공감한 피드백의 반영 공지(notificationList.ts와 동일 정의).
    getLikedFeedbackAnnouncements(supabase, userId, seenAt),
  ]);
  // 0069 — 기여 순위 달성(notificationList.ts의 contribution_milestone과 동일 기준).
  const { data: newMilestones } = await supabase
    .from("contribution_milestones")
    .select("month")
    .eq("user_id", userId)
    .gt("created_at", seenAt);

  const myPostIds = (myPosts ?? []).map((p) => p.id);
  const myInviteOnlyPostIds = (myPosts ?? []).filter((p) => p.visibility === "invite_only").map((p) => p.id);
  const newPeakCount = (myPosts ?? []).filter((p) => p.peaked_at && p.peaked_at > seenAt).length;

  let newEngagementCount = 0;
  let newKnockCount = 0;

  if (myPostIds.length > 0) {
    const [{ data: newLikes }, { data: newComments }, { data: newKicks }] = await Promise.all([
      supabase
        .from("likes")
        .select("post_id, user_id")
        .in("post_id", myPostIds)
        .neq("user_id", userId)
        .gt("created_at", seenAt),
      supabase.from("comments").select("id").in("post_id", myPostIds).neq("user_id", userId).gt("created_at", seenAt),
      // 0071 — Kick(notificationList.ts의 kick과 동일 기준, 본인 글엔 Kick 불가라 neq 불필요).
      supabase.from("kicks").select("post_id, user_id").in("post_id", myPostIds).gt("created_at", seenAt),
    ]);
    // Kick에 딸려 자동으로 들어간 좋아요는 알림 목록에서 Kick 한 줄로 합쳐지므로 여기서도 뺀다.
    const kickKeys = new Set((newKicks ?? []).map((k) => `${k.post_id}:${k.user_id}`));
    const newLikeCount = (newLikes ?? []).filter((l) => !kickKeys.has(`${l.post_id}:${l.user_id}`)).length;
    newEngagementCount = newLikeCount + (newComments?.length ?? 0) + (newKicks?.length ?? 0);
  }

  if (myInviteOnlyPostIds.length > 0) {
    // 노크 = 내 초대전용 게시물에 status='pending'으로 들어온 post_access 행
    // (notificationList.ts의 알림 목록과 동일 정의) — 예전엔 이 카운트가 빠져 있어서
    // 알림 패널엔 표시되는데 뱃지 숫자에는 안 잡히는 불일치가 있었다.
    const { data: newKnocks } = await supabase
      .from("post_access")
      .select("id")
      .in("post_id", myInviteOnlyPostIds)
      .eq("status", "pending")
      .gt("created_at", seenAt);
    newKnockCount = newKnocks?.length ?? 0;
  }

  return (
    newEngagementCount +
    newPeakCount +
    newKnockCount +
    (newCompanionRequests?.length ?? 0) +
    (newFeedbackUpdates?.length ?? 0) +
    newLikedAnnouncements.length +
    (newMilestones?.length ?? 0)
  );
}
