import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { timeAgo } from "@/lib/timeAgo";
import { pageTitle, pageCard, mutedText } from "@/components/ui/styles";

// 알림 목록 1단계: 내 게시물에 달린 좋아요·댓글만 다룬다(Companion 신청·Peak·공동창작 신청은
// 이후 단계에서 추가 예정 — 각 이벤트 소스를 붙일 때마다 이 페이지의 집계 로직에 병합).
// 별도 notifications 테이블 없이 likes/comments를 직접 조회해서 합치는 방식 —
// layout.tsx가 뱃지 개수를 셀 때 쓰는 것과 동일한 소스(notifications_seen_at 기준 안읽음 판정).
type NotificationItem =
  | { type: "like"; id: string; postId: string; actorName: string; createdAt: string }
  | { type: "comment"; id: string; postId: string; actorName: string; createdAt: string; content: string };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: myPosts }, { data: me }] = await Promise.all([
    supabase.from("posts").select("id, visibility").eq("user_id", user.id),
    supabase.from("users").select("notifications_seen_at").eq("id", user.id).single(),
  ]);

  const myPostIds = (myPosts ?? []).map((p) => p.id);
  const visibilityByPostId = new Map((myPosts ?? []).map((p) => [p.id, p.visibility]));
  const seenAt = me?.notifications_seen_at ?? new Date(0).toISOString();

  let items: NotificationItem[] = [];

  if (myPostIds.length > 0) {
    const [{ data: likes }, { data: comments }] = await Promise.all([
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
    ]);

    const actorIds = [...new Set([...(likes ?? []).map((l) => l.user_id), ...(comments ?? []).map((c) => c.user_id)])];
    const { data: actors } =
      actorIds.length > 0
        ? await supabase.from("user_display").select("id, display_name").in("id", actorIds)
        : { data: [] };
    const actorNameById = new Map((actors ?? []).map((a) => [a.id, a.display_name]));

    items = [
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
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }

  return (
    <main className={pageCard}>
      <MarkNotificationsSeen userId={user.id} />
      <h1 className={pageTitle}>알림</h1>
      <p className={`${mutedText} mt-1`}>내 게시물에 달린 좋아요와 댓글이에요.</p>

      <div className="mt-6 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">아직 알림이 없어요</p>
        ) : (
          items.map((item) => {
            const feedTab = visibilityByPostId.get(item.postId) === "public" ? "completion" : "complex";
            const unread = new Date(item.createdAt) > new Date(seenAt);
            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={`/feed?feed=${feedTab}#${item.postId}`}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:bg-gray-50 ${
                  unread ? "border-gray-300 bg-gray-50" : "border-gray-200"
                }`}
              >
                <span className="text-lg">{item.type === "like" ? "❤️" : "💬"}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-sm text-gray-800">
                    <span className="font-semibold">{item.actorName}</span>
                    {item.type === "like" ? "님이 회원님의 게시물을 좋아합니다" : "님이 댓글을 남겼습니다"}
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
