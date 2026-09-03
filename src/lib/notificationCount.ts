import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";

// 상단/하단 네비의 안읽음 뱃지 숫자. 예전엔 (app)/layout.tsx가 매 페이지 렌더마다
// 이 계산(쿼리 최대 7개, 주간 likes 전체 스캔 + users count)을 동기로 돌려서
// 업로드·메시지·프로필 화면 첫 페인트까지 막았다 — 이제 /api/notifications/count로
// 빼서 클라이언트가 페인트 후 비동기로 가져온다.
export async function computeUnseenNotificationCount(
  supabase: SupabaseClient,
  userId: string,
  seenAt: string,
): Promise<number> {
  const [{ data: myPosts }, { data: newCompanionRequests }] = await Promise.all([
    supabase.from("posts").select("id").eq("user_id", userId),
    supabase
      .from("companions")
      .select("id")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .gt("created_at", seenAt),
  ]);

  const myPostIds = (myPosts ?? []).map((p: { id: string }) => p.id);
  let newEngagementCount = 0;
  let newPeakCount = 0;

  if (myPostIds.length > 0) {
    const [{ data: newLikes }, { data: newComments }, { data: weekLikes }, { count: approvedMemberCount }] =
      await Promise.all([
        supabase.from("likes").select("id").in("post_id", myPostIds).neq("user_id", userId).gt("created_at", seenAt),
        supabase.from("comments").select("id").in("post_id", myPostIds).neq("user_id", userId).gt("created_at", seenAt),
        supabase.from("likes").select("post_id, created_at").in("post_id", myPostIds).gte("created_at", currentWeekStartISO()),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "approved"),
      ]);

    newEngagementCount = (newLikes?.length ?? 0) + (newComments?.length ?? 0);

    const peakThreshold = peakThresholdFromMemberCount(approvedMemberCount ?? 0);
    const weeklyLikesByPost = new Map<string, { count: number; lastLikedAt: string }>();
    for (const row of weekLikes ?? []) {
      const prev = weeklyLikesByPost.get(row.post_id);
      const isNewer = !prev || new Date(row.created_at) > new Date(prev.lastLikedAt);
      weeklyLikesByPost.set(row.post_id, {
        count: (prev?.count ?? 0) + 1,
        lastLikedAt: isNewer ? row.created_at : prev.lastLikedAt,
      });
    }
    newPeakCount = [...weeklyLikesByPost.values()].filter(
      (v) => v.count >= peakThreshold && new Date(v.lastLikedAt) > new Date(seenAt),
    ).length;
  }

  return newEngagementCount + newPeakCount + (newCompanionRequests?.length ?? 0);
}
