import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackStatus } from "@/lib/feedback";

// 알림 아이템 조립 — 원래 (app)/notifications/page.tsx 안에만 있던 로직을 여기로 옮겨
// 전체 알림 페이지와 TopNav 알림 드롭다운(/api/notifications/list)이 같이 쓴다.
// href/unread를 미리 계산해서 내려주면 두 소비처가 렌더링에만 집중할 수 있다.
export type NotificationItem = (
  | { type: "like"; id: string; postId: string; actorId: string; actorName: string; createdAt: string }
  // 0071 — 누군가 이번 주 Kick을 내 게시물에 줬을 때(좋아요와 별도로 강조해서 보여준다).
  | { type: "kick"; id: string; postId: string; actorId: string; actorName: string; createdAt: string }
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
  // 0076 — 반응 유도 알림: 청취자 수 마일스톤, PEAK 진행률(50/80%), Companion 새 글.
  | { type: "play_milestone"; id: string; postId: string; value: number; title: string; createdAt: string }
  | { type: "peak_progress"; id: string; postId: string; value: number; title: string; createdAt: string }
  | {
      type: "companion_post";
      id: string;
      postId: string;
      actorId: string;
      actorName: string;
      title: string;
      isDemo: boolean;
      createdAt: string;
    }
  | { type: "knock"; id: string; postId: string; actorId: string; actorName: string; createdAt: string }
  // 0063 — 관리자가 내 피드백의 상태를 바꾸거나 답변을 달았을 때. createdAt = admin_updated_at.
  | {
      type: "feedback_update";
      id: string;
      status: FeedbackStatus;
      hasReply: boolean;
      content: string;
      createdAt: string;
    }
  // 0067 — 내가 👍 공감한 피드백이 "피드백 반영" 공지로 올라왔을 때. id/createdAt = 공지.
  | { type: "liked_feedback_announced"; id: string; title: string; createdAt: string }
  // 0069 — 이번 달 기여 3위 안 진입 / 1위 달성(좋은 소식만).
  | { type: "contribution_milestone"; id: string; milestone: "top3" | "first"; createdAt: string }
) & { href: string; unread: boolean };

// 내가 공감(feedback_reactions)한 피드백과 연결된 "피드백 반영" 공지 — 알림 목록과 뱃지 숫자
// (notificationCount.ts)가 같은 정의를 쓴다. since가 있으면 그 이후 공지만.
export async function getLikedFeedbackAnnouncements(
  supabase: SupabaseClient,
  userId: string,
  since?: string,
): Promise<{ id: string; title: string; created_at: string }[]> {
  const { data: myReactions } = await supabase
    .from("feedback_reactions")
    .select("feedback_id")
    .eq("user_id", userId)
    .limit(500);
  const feedbackIds = (myReactions ?? []).map((r) => r.feedback_id);
  if (feedbackIds.length === 0) return [];
  const { data: links } = await supabase
    .from("announcement_feedback")
    .select("announcement_id")
    .in("feedback_id", feedbackIds);
  const announcementIds = [...new Set((links ?? []).map((l) => l.announcement_id))];
  if (announcementIds.length === 0) return [];
  let query = supabase
    .from("announcements")
    .select("id, title, created_at")
    .in("id", announcementIds)
    .eq("kind", "feedback")
    .order("created_at", { ascending: false })
    .limit(50);
  if (since) query = query.gt("created_at", since);
  const { data } = await query;
  return data ?? [];
}

// 0076 — 내 게시물의 청취자 수·PEAK 진행 마일스톤(post_milestones, 작성자만 읽기 가능).
// since가 있으면 그 이후 것만(뱃지 숫자용).
export async function getMyPostMilestones(
  supabase: SupabaseClient,
  myPostIds: string[],
  since?: string,
): Promise<{ id: string; post_id: string; kind: "plays" | "peak_progress"; value: number; created_at: string }[]> {
  if (myPostIds.length === 0) return [];
  let query = supabase
    .from("post_milestones")
    .select("id, post_id, kind, value, created_at")
    .in("post_id", myPostIds)
    .in("kind", ["plays", "peak_progress"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (since) query = query.gt("created_at", since);
  const { data } = await query;
  return data ?? [];
}

// 0076 — Companion이 최근 14일 안에 올린 새 글(내가 볼 수 있는 것만 — posts RLS가 거른다).
// 첫 반응을 남기러 오게 하려는 알림이라 invite_only는 빼고(초대는 별도 흐름), since가 있으면
// 그 이후 것만(뱃지 숫자용).
export async function getCompanionPosts(
  supabase: SupabaseClient,
  userId: string,
  since?: string,
): Promise<
  {
    id: string;
    user_id: string;
    title: string | null;
    caption: string | null;
    visibility: string;
    published_at: string | null;
    created_at: string;
  }[]
> {
  const { data: rows } = await supabase
    .from("companions")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const companionIds = (rows ?? []).map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  if (companionIds.length === 0) return [];
  const floor = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("posts")
    .select("id, user_id, title, caption, visibility, published_at, created_at")
    .in("user_id", companionIds)
    .eq("status", "published")
    .in("visibility", ["public", "followers"])
    .gt("published_at", since && since > floor ? since : floor)
    .order("published_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

// 정렬만 된, 필터링/자르기 전 전체 목록을 돌려준다 — 카테고리 필터는 자르기 전에 적용돼야
// 하므로(예: "신청" 탭이 50개보다 적으면 안 잘리게) 호출하는 쪽이 각자 filter+slice 한다.
export async function getNotificationItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ items: NotificationItem[]; seenAt: string }> {
  const [{ data: myPosts }, { data: me }, { data: incomingRequests }, { data: feedbackUpdates }, likedAnnouncements] =
    await Promise.all([
    supabase.from("posts").select("id, visibility, peaked_at, title, caption").eq("user_id", userId),
    supabase.from("users").select("notifications_seen_at").eq("id", userId).single(),
    supabase
      .from("companions")
      .select("requester_id, created_at")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("feedback_messages")
      .select("id, content, status, admin_reply, admin_updated_at")
      .eq("user_id", userId)
      .not("admin_updated_at", "is", null)
      .order("admin_updated_at", { ascending: false })
      .limit(50),
    getLikedFeedbackAnnouncements(supabase, userId),
  ]);
  const { data: milestones } = await supabase
    .from("contribution_milestones")
    .select("month, milestone, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const [postMilestones, companionPosts] = await Promise.all([
    getMyPostMilestones(supabase, (myPosts ?? []).map((p) => p.id)),
    getCompanionPosts(supabase, userId),
  ]);

  const myPostIds = (myPosts ?? []).map((p) => p.id);
  const myInviteOnlyPostIds = (myPosts ?? []).filter((p) => p.visibility === "invite_only").map((p) => p.id);
  const visibilityByPostId = new Map((myPosts ?? []).map((p) => [p.id, p.visibility]));
  const seenAt = me?.notifications_seen_at ?? new Date(0).toISOString();

  const [{ data: likes }, { data: comments }, { data: knocks }, { data: kicks }] =
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
          supabase
            .from("kicks")
            .select("id, post_id, user_id, created_at")
            .in("post_id", myPostIds)
            .order("created_at", { ascending: false })
            .limit(50),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const actorIds = new Set([
    ...(incomingRequests ?? []).map((r) => r.requester_id),
    ...(likes ?? []).map((l) => l.user_id),
    ...(comments ?? []).map((c) => c.user_id),
    ...(knocks ?? []).map((k) => k.user_id),
    ...(kicks ?? []).map((k) => k.user_id),
    ...companionPosts.map((p) => p.user_id),
  ]);
  const { data: actors } =
    actorIds.size > 0
      ? await supabase.from("user_display").select("id, display_name").in("id", [...actorIds])
      : { data: [] };
  const actorNameById = new Map((actors ?? []).map((a) => [a.id, a.display_name]));

  // PEAK 판정은 posts.peaked_at(0056 — 조회수+좋아요*10>=PEAK_VIEW_THRESHOLD에서 한 번
  // 영구 고정, EngagementMeter/RightSidebar와 동일 기준)을 그대로 쓴다.
  const peakedPosts = (myPosts ?? []).filter((p) => p.peaked_at);

  function hrefFor(postId: string) {
    return `/feed?feed=${visibilityByPostId.get(postId) === "public" ? "completion" : "complex"}#${postId}`;
  }
  const titleByPostId = new Map((myPosts ?? []).map((p) => [p.id, p.title || p.caption || "회원님의 게시물"]));
  function isUnread(createdAt: string) {
    return new Date(createdAt) > new Date(seenAt);
  }

  // Kick하면 좋아요도 자동으로 같이 들어가서(give_kick) 같은 사람·같은 게시물 알림이 두 줄이
  // 된다 — Kick 알림 하나만 남긴다.
  const kickKeys = new Set((kicks ?? []).map((k) => `${k.post_id}:${k.user_id}`));
  const likesWithoutKicks = (likes ?? []).filter((l) => !kickKeys.has(`${l.post_id}:${l.user_id}`));

  const items: NotificationItem[] = [
    ...likesWithoutKicks.map(
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
    ...(kicks ?? []).map(
      (k): NotificationItem => ({
        type: "kick",
        id: k.id,
        postId: k.post_id,
        actorId: k.user_id,
        actorName: actorNameById.get(k.user_id) ?? "알 수 없음",
        createdAt: k.created_at,
        href: hrefFor(k.post_id),
        unread: isUnread(k.created_at),
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
    ...peakedPosts.map(
      (p): NotificationItem => ({
        type: "peak",
        id: p.id,
        postId: p.id,
        createdAt: p.peaked_at as string,
        href: hrefFor(p.id),
        unread: isUnread(p.peaked_at as string),
      }),
    ),
    ...postMilestones.map(
      (m): NotificationItem => ({
        type: m.kind === "plays" ? "play_milestone" : "peak_progress",
        id: m.id,
        postId: m.post_id,
        value: m.value,
        title: titleByPostId.get(m.post_id) ?? "회원님의 게시물",
        createdAt: m.created_at,
        href: hrefFor(m.post_id),
        unread: isUnread(m.created_at),
      }),
    ),
    ...companionPosts.map(
      (p): NotificationItem => ({
        type: "companion_post",
        id: p.id,
        postId: p.id,
        actorId: p.user_id,
        actorName: actorNameById.get(p.user_id) ?? "알 수 없음",
        title: p.title || p.caption || "새 게시물",
        isDemo: p.visibility === "public",
        createdAt: p.published_at ?? p.created_at,
        href: `/feed?feed=${p.visibility === "public" ? "completion" : "complex"}#${p.id}`,
        unread: isUnread(p.published_at ?? p.created_at),
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
    ...(feedbackUpdates ?? []).map(
      (f): NotificationItem => ({
        type: "feedback_update",
        id: f.id,
        status: f.status,
        hasReply: !!f.admin_reply,
        content: f.content,
        createdAt: f.admin_updated_at as string,
        href: "/help",
        unread: isUnread(f.admin_updated_at as string),
      }),
    ),
    ...(milestones ?? []).map(
      (m): NotificationItem => ({
        type: "contribution_milestone",
        id: `${m.month}-${m.milestone}`,
        milestone: m.milestone,
        createdAt: m.created_at,
        href: "/help",
        unread: isUnread(m.created_at),
      }),
    ),
    ...likedAnnouncements.map(
      (a): NotificationItem => ({
        type: "liked_feedback_announced",
        id: a.id,
        title: a.title,
        createdAt: a.created_at,
        href: "/help",
        unread: isUnread(a.created_at),
      }),
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { items, seenAt };
}
