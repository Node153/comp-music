import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { timeAgo } from "@/lib/timeAgo";
import { pageTitle, pageCard, mutedText } from "@/components/ui/styles";
import { PEAK_THRESHOLD } from "@/lib/feedConstants";

// 알림 목록 — 좋아요·댓글(1단계) + Companion 신청·PEAK(2단계). 공동창작 신청은 다음 단계.
// 별도 notifications 테이블 없이 기존 테이블(likes/comments/companions)과 PEAK_THRESHOLD
// 판정 로직(EngagementMeter와 동일 기준)을 그대로 재사용해서 조립한다.
// PEAK는 "이벤트"가 아니라 "지금 임계치를 넘은 상태"라 정확한 도달 시각이 없다 — 근사치로
// 그 게시물의 가장 최근 좋아요/댓글 시각을 쓴다.
type NotificationItem =
  | { type: "like"; id: string; postId: string; actorName: string; createdAt: string }
  | { type: "comment"; id: string; postId: string; actorName: string; createdAt: string; content: string }
  | { type: "companion_request"; id: string; requesterId: string; actorName: string; createdAt: string }
  | { type: "peak"; id: string; postId: string; createdAt: string };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: myPosts }, { data: me }, { data: incomingRequests }] = await Promise.all([
    supabase.from("posts").select("id, visibility").eq("user_id", user.id),
    supabase.from("users").select("notifications_seen_at").eq("id", user.id).single(),
    supabase
      .from("companions")
      .select("requester_id, created_at")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const myPostIds = (myPosts ?? []).map((p) => p.id);
  const visibilityByPostId = new Map((myPosts ?? []).map((p) => [p.id, p.visibility]));
  const seenAt = me?.notifications_seen_at ?? new Date(0).toISOString();

  const [{ data: likes }, { data: comments }, { data: allLikes }, { data: allComments }] =
    myPostIds.length > 0
      ? await Promise.all([
          supabase
            .from("likes")
            .select("id, post_id, user_id, created_at")
            .in("post_id", myPostIds)
            .neq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("comments")
            .select("id, post_id, user_id, content, created_at")
            .in("post_id", myPostIds)
            .neq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50),
          // PEAK 판정용 — EngagementMeter와 동일하게 본인 반응도 포함한 전체 합계를 쓴다.
          supabase.from("likes").select("post_id, created_at").in("post_id", myPostIds),
          supabase.from("comments").select("post_id, created_at").in("post_id", myPostIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const actorIds = new Set([
    ...(incomingRequests ?? []).map((r) => r.requester_id),
    ...(likes ?? []).map((l) => l.user_id),
    ...(comments ?? []).map((c) => c.user_id),
  ]);
  const { data: actors } =
    actorIds.size > 0
      ? await supabase.from("user_display").select("id, display_name").in("id", [...actorIds])
      : { data: [] };
  const actorNameById = new Map((actors ?? []).map((a) => [a.id, a.display_name]));

  const engagementByPost = new Map<string, { count: number; lastActivityAt: string }>();
  for (const row of [...(allLikes ?? []), ...(allComments ?? [])]) {
    const prev = engagementByPost.get(row.post_id);
    const isNewer = !prev || new Date(row.created_at) > new Date(prev.lastActivityAt);
    engagementByPost.set(row.post_id, {
      count: (prev?.count ?? 0) + 1,
      lastActivityAt: isNewer ? row.created_at : prev.lastActivityAt,
    });
  }
  const peakPosts = [...engagementByPost.entries()].filter(([, v]) => v.count >= PEAK_THRESHOLD);

  const items: NotificationItem[] = [
    ...(likes ?? []).map(
      (l): NotificationItem => ({
        type: "like",
        id: l.id,
        postId: l.post_id,
        actorName: actorNameById.get(l.user_id) ?? "알 수 없음",
        createdAt: l.created_at,
      }),
    ),
    ...(comments ?? []).map(
      (c): NotificationItem => ({
        type: "comment",
        id: c.id,
        postId: c.post_id,
        actorName: actorNameById.get(c.user_id) ?? "알 수 없음",
        createdAt: c.created_at,
        content: c.content,
      }),
    ),
    ...peakPosts.map(
      ([postId, v]): NotificationItem => ({
        type: "peak",
        id: postId,
        postId,
        createdAt: v.lastActivityAt,
      }),
    ),
    ...(incomingRequests ?? []).map(
      (r): NotificationItem => ({
        type: "companion_request",
        id: r.requester_id,
        requesterId: r.requester_id,
        actorName: actorNameById.get(r.requester_id) ?? "알 수 없음",
        createdAt: r.created_at,
      }),
    ),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return (
    <main className={pageCard}>
      <MarkNotificationsSeen userId={user.id} />
      <h1 className={pageTitle}>알림</h1>
      <p className={`${mutedText} mt-1`}>좋아요·댓글·Companion 신청·PEAK 소식을 모아 보여줘요.</p>

      <div className="mt-6 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">아직 알림이 없어요</p>
        ) : (
          items.map((item) => {
            const unread = new Date(item.createdAt) > new Date(seenAt);
            const href =
              item.type === "companion_request"
                ? `/profile/${item.requesterId}`
                : `/feed?feed=${visibilityByPostId.get(item.postId) === "public" ? "completion" : "complex"}#${item.postId}`;
            const icon =
              item.type === "like" ? "❤️" : item.type === "comment" ? "💬" : item.type === "peak" ? "🔥" : "🤝";
            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={href}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:bg-gray-50 ${
                  unread ? "border-gray-300 bg-gray-50" : "border-gray-200"
                }`}
              >
                <span className="text-lg">{icon}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-sm text-gray-800">
                    {item.type === "peak" ? (
                      "회원님의 게시물이 PEAK에 도달했어요"
                    ) : (
                      <>
                        <span className="font-semibold">{item.actorName}</span>
                        {item.type === "like" && "님이 회원님의 게시물을 좋아합니다"}
                        {item.type === "comment" && "님이 댓글을 남겼습니다"}
                        {item.type === "companion_request" && "님이 Companion을 신청했어요"}
                      </>
                    )}
                  </p>
                  {item.type === "comment" && (
                    <p className="mt-0.5 truncate text-sm text-gray-500">“{item.content}”</p>
                  )}
                  <span className="mt-1 text-xs text-gray-400">{timeAgo(item.createdAt)}</span>
                </div>
                {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
