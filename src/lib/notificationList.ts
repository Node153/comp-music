import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";

// 알림 아이템 조립 — 원래 (app)/notifications/page.tsx 안에만 있던 로직을 여기로 옮겨
// 전체 알림 페이지와 TopNav 알림 드롭다운(/api/notifications/list)이 같이 쓴다.
// href/unread를 미리 계산해서 내려주면 두 소비처가 렌더링에만 집중할 수 있다.
export type NotificationItem = (
  | { type: "like"; id: string; postId: string; actorId: string; actorName: string; createdAt: string }
  | {
      type: "comment";
      id: string;
      postId: string;
      actorId: string;
      actorName: string;
      createdAt: string;
      content: string;
    }
  | {
      type: "companion_request";
      id: string;
      requesterId: string;
      actorId: string;
      actorName: string;
      createdAt: string;
    }
  | { type: "peak"; id: string; postId: string; createdAt: string }
  | { type: "knock"; id: string; postId: string; actorId: string; actorName: string; createdAt: string }
) & { href: string; unread: boolean };

// 정렬만 된, 필터링/자르기 전 전체 목록을 돌려준다 — 카테고리 필터는 자르기 전에 적용돼야
// 하므로(예: "신청" 탭이 50개보다 적으면 안 잘리게) 호출하는 쪽이 각자 filter+slice 한다.
export async function getNotificationItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ items: NotificationItem[]; seenAt: string }> {
  const [{ data: myPosts }, { data: me }, { data: incomingRequests }] = await Promise.all([
    supabase.from("posts").select("id, visibility").eq("user_id", userId),
    supabase.from("users").select("notifications_seen_at").eq("id", userId).single(),
    supabase
      .from("companions")
      .select("requester_id, created_at")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const myPostIds = (myPosts ?? []).map((p) => p.id);
  const myInviteOnlyPostIds = (myPosts ?? []).filter((p) => p.visibility === "invite_only").map((p) => p.id);
  const visibilityByPostId = new Map((myPosts ?? []).map((p) => [p.id, p.visibility]));
  const seenAt = me?.notifications_seen_at ?? new Date(0).toISOString();

  const [{ data: likes }, { data: comments }, { data: weekLikes }, { count: approvedMemberCount }, { data: knocks }] =
    myPostIds.length > 0
      ? await Promise.all([
          supabase
            .from("likes")
            .select("id, post_id, user_id, created_at")
            .in("post_id", myPostIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("comments")
            .select("id, post_id, user_id, content, created_at")
            .in("post_id", myPostIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(50),
          // PEAK 판정용 — EngagementMeter와 동일하게 이번 주(캘린더) 좋아요 수만 쓴다(본인 반응 포함).
          supabase.from("likes").select("post_id, created_at").in("post_id", myPostIds).gte("created_at", currentWeekStartISO()),
          supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "approved").neq("role", "admin"),
          // 노크 = 내 초대전용(invite_only) 게시물에 status='pending'으로 들어온 post_access 행.
          myInviteOnlyPostIds.length > 0
            ? supabase
                .from("post_access")
                .select("id, post_id, user_id, created_at")
                .in("post_id", myInviteOnlyPostIds)
                .eq("status", "pending")
                .order("created_at", { ascending: false })
                .limit(50)
            : Promise.resolve({ data: [] }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { count: 0 }, { data: [] }];

  const actorIds = new Set([
    ...(incomingRequests ?? []).map((r) => r.requester_id),
    ...(likes ?? []).map((l) => l.user_id),
    ...(comments ?? []).map((c) => c.user_id),
    ...(knocks ?? []).map((k) => k.user_id),
  ]);
  const { data: actors } =
    actorIds.size > 0
      ? await supabase.from("user_display").select("id, display_name").in("id", [...actorIds])
      : { data: [] };
  const actorNameById = new Map((actors ?? []).map((a) => [a.id, a.display_name]));

  const peakThreshold = peakThresholdFromMemberCount(approvedMemberCount ?? 0);
  const weeklyLikesByPost = new Map<string, { count: number; lastActivityAt: string }>();
  for (const row of weekLikes ?? []) {
    const prev = weeklyLikesByPost.get(row.post_id);
    const isNewer = !prev || new Date(row.created_at) > new Date(prev.lastActivityAt);
    weeklyLikesByPost.set(row.post_id, {
      count: (prev?.count ?? 0) + 1,
      lastActivityAt: isNewer ? row.created_at : prev.lastActivityAt,
    });
  }
  const peakPosts = [...weeklyLikesByPost.entries()].filter(([, v]) => v.count >= peakThreshold);

  function hrefFor(postId: string) {
    return `/feed?feed=${visibilityByPostId.get(postId) === "public" ? "completion" : "complex"}#${postId}`;
  }
  function isUnread(createdAt: string) {
    return new Date(createdAt) > new Date(seenAt);
  }

  const items: NotificationItem[] = [
    ...(likes ?? []).map(
      (l): NotificationItem => ({
        type: "like",
        id: l.id,
        postId: l.post_id,
        actorId: l.user_id,
        actorName: actorNameById.get(l.user_id) ?? "알 수 없음",
        createdAt: l.created_at,
        href: hrefFor(l.post_id),
        unread: isUnread(l.created_at),
      }),
    ),
    ...(comments ?? []).map(
      (c): NotificationItem => ({
        type: "comment",
        id: c.id,
        postId: c.post_id,
        actorId: c.user_id,
        actorName: actorNameById.get(c.user_id) ?? "알 수 없음",
        createdAt: c.created_at,
        content: c.content,
        href: hrefFor(c.post_id),
        unread: isUnread(c.created_at),
      }),
    ),
    ...peakPosts.map(
      ([postId, v]): NotificationItem => ({
        type: "peak",
        id: postId,
        postId,
        createdAt: v.lastActivityAt,
        href: hrefFor(postId),
        unread: isUnread(v.lastActivityAt),
      }),
    ),
    ...(incomingRequests ?? []).map(
      (r): NotificationItem => ({
        type: "companion_request",
        id: r.requester_id,
        requesterId: r.requester_id,
        actorId: r.requester_id,
        actorName: actorNameById.get(r.requester_id) ?? "알 수 없음",
        createdAt: r.created_at,
        href: `/profile/${r.requester_id}`,
        unread: isUnread(r.created_at),
      }),
    ),
    ...(knocks ?? []).map(
      (k): NotificationItem => ({
        type: "knock",
        id: k.id,
        postId: k.post_id,
        actorId: k.user_id,
        actorName: actorNameById.get(k.user_id) ?? "알 수 없음",
        createdAt: k.created_at,
        href: hrefFor(k.post_id),
        unread: isUnread(k.created_at),
      }),
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { items, seenAt };
}
