import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { timeAgo } from "@/lib/timeAgo";
import { avatarColorFor } from "@/lib/presence";
import { pageTitle, pageCard } from "@/components/ui/styles";
import { peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";

// 알림 목록 — 좋아요·댓글(1단계) + Companion 신청·PEAK(2단계) + 노크(3단계). 공동창작 신청은 다음 단계.
// 별도 notifications 테이블 없이 기존 테이블(likes/comments/companions/post_access)과 PEAK 판정
// 로직(EngagementMeter와 동일 기준 — 이번 주 좋아요 수 ≥ 승인 회원 수/3)을 그대로 재사용해서 조립한다.
// 노크(post_access status='pending')는 원래 본인 게시물을 직접 열어야만 보이던 걸, 좋아요/댓글처럼
// 여기서도 놓치지 않게 추가했다(사용자 피드백: "노크도 알림에 떠야 할 것 같은데").
// PEAK는 "이벤트"가 아니라 "지금 임계치를 넘은 상태"라 정확한 도달 시각이 없다 — 근사치로
// 그 게시물의 이번 주 가장 최근 좋아요 시각을 쓴다.
// 인스타그램 알림탭 참고 — 줄마다 붙던 ❤️/💬/🤝 아이콘이 좌측 사이드바 장르필터 아이콘과
// 겹쳐서 혼란스럽다는 피드백으로, 아이콘 대신 상대방 아바타(메시지/RightSidebar와 동일한
// avatarColorFor)를 앞세우고, 카테고리 필터 탭으로 종류를 구분한다.
type NotificationItem =
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
  | { type: "knock"; id: string; postId: string; actorId: string; actorName: string; createdAt: string };

type CategoryFilter = "all" | "engagement" | "request" | "peak";

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "engagement", label: "좋아요·댓글" },
  { value: "request", label: "신청" },
  { value: "peak", label: "PEAK" },
];

function matchesCategory(item: NotificationItem, filter: CategoryFilter) {
  if (filter === "all") return true;
  if (filter === "engagement") return item.type === "like" || item.type === "comment";
  if (filter === "request") return item.type === "companion_request" || item.type === "knock";
  return item.type === "peak";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const activeCategory: CategoryFilter = CATEGORY_OPTIONS.some((o) => o.value === typeParam)
    ? (typeParam as CategoryFilter)
    : "all";
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
          // PEAK 판정용 — EngagementMeter와 동일하게 이번 주(캘린더) 좋아요 수만 쓴다(본인 반응 포함).
          supabase.from("likes").select("post_id, created_at").in("post_id", myPostIds).gte("created_at", currentWeekStartISO()),
          supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "approved"),
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

  const items: NotificationItem[] = [
    ...(likes ?? []).map(
      (l): NotificationItem => ({
        type: "like",
        id: l.id,
        postId: l.post_id,
        actorId: l.user_id,
        actorName: actorNameById.get(l.user_id) ?? "알 수 없음",
        createdAt: l.created_at,
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
        actorId: r.requester_id,
        actorName: actorNameById.get(r.requester_id) ?? "알 수 없음",
        createdAt: r.created_at,
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
      }),
    ),
  ]
    .filter((item) => matchesCategory(item, activeCategory))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return (
    <main className={pageCard}>
      <MarkNotificationsSeen userId={user.id} />
      <div className="flex items-center justify-between">
        <h1 className={pageTitle}>알림</h1>
        <Link href="/notifications/settings" className="text-sm text-gray-400 hover:text-gray-600">
          알림 설정
        </Link>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto">
        {CATEGORY_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "all" ? "/notifications" : `/notifications?type=${option.value}`}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              activeCategory === option.value
                ? "border-black bg-black text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">아직 알림이 없어요</p>
        ) : (
          items.map((item) => {
            const unread = new Date(item.createdAt) > new Date(seenAt);
            const href =
              item.type === "companion_request"
                ? `/profile/${item.requesterId}`
                : `/feed?feed=${visibilityByPostId.get(item.postId) === "public" ? "completion" : "complex"}#${item.postId}`;
            const avatar =
              item.type === "peak" ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-500 text-base dark:bg-gray-600">
                  🔥
                </span>
              ) : (
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColorFor(item.actorId)}`}
                >
                  {item.actorName.slice(0, 1)}
                </span>
              );
            return (
              <Link
                key={`${item.type}-${item.id}`}
                href={href}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:bg-gray-50 ${
                  unread ? "border-gray-300 bg-gray-50" : "border-gray-200"
                }`}
              >
                {avatar}
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
                        {item.type === "knock" && "님이 비공개 게시물에 노크했어요"}
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
