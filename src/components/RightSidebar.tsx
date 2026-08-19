"use client";

// 데스크톱 우측 사이드바 — Discord 접속자 리스트 참고. 페이스북 카드형 박스 대신
// 아바타+이름 한 줄로 축약해서 위계를 낮춘다.
// memo(구 Complex) 탭에서는 "실시간 PEAK" 대신 노크 가능한 비공개(초대전용) 게시물 목록을
// 보여준다 — 실제 posts/post_access 기반(0012_complex_access_and_chat). memo는 방장과
// Companion인 게시물만 보이므로(feed/page.tsx와 동일한 원칙) 여기서도 Companion 필터를 거친
// 후보만 후보로 삼는다 — 안 그러면 RLS(post_access_insert_knock_self)에서 막히는 죽은
// 노크 버튼을 보여주게 된다.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/timeAgo";
import { peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";
import { presenceStatus, avatarColorFor, type PresenceStatus } from "@/lib/presence";

// 온라인/자리비움/오프라인 판정은 lib/presence(메시지 화면과 공유)를 그대로 쓴다. 오프라인인
// Companion은 이 목록에 아예 안 보인다(헤더가 "온라인 — N명"이라 오프라인까지 섞으면 숫자가
// 안 맞음 — Discord도 접속 안 한 사람은 기본 목록에서 접는다).
type OnlineCompanion = {
  id: string;
  name: string;
  status: Exclude<PresenceStatus, "offline">;
  color: string;
};

const ONLINE_VISIBLE_LIMIT = 3;
// 온라인 목록도 PresenceHeartbeat와 같은 주기로 다시 조회해서 "방금 나간 사람"이 계속 온라인으로
// 남아있지 않게 한다.
const ONLINE_REFRESH_INTERVAL_MS = 30_000;

// 금주의 PEAK 게시물 = 이번 주(캘린더) 좋아요 수가 peakThreshold(승인 회원 수/3) 이상인 게시물,
// 이번 주 좋아요 수 많은 순으로 최대 3개만 노출.
const PEAK_POSTS_VISIBLE_LIMIT = 3;
// PEAK 후보를 뽑을 게시물 풀 — feed/page.tsx의 FEED_LIMIT(20)과 별개로 넉넉히 잡아서, 최신
// 20개 밖이라도 이번 주 좋아요가 몰린 DEMO(영구 노출) 게시물을 놓치지 않게 한다.
const PEAK_CANDIDATE_POOL_LIMIT = 50;

type PeakPost = {
  postId: string;
  authorName: string;
  caption: string | null;
  publishedAt: string;
  weeklyLikeCount: number;
};

type KnockablePost = {
  postId: string;
  authorName: string;
  caption: string | null;
  publishedAt: string;
  pending: boolean;
};

export function RightSidebar({ currentUserId }: { currentUserId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMemoTab = pathname === "/feed" && searchParams.get("feed") === "complex";

  const [knockablePosts, setKnockablePosts] = useState<KnockablePost[] | null>(null);
  const [peakPosts, setPeakPosts] = useState<PeakPost[] | null>(null);
  const [onlineCompanions, setOnlineCompanions] = useState<OnlineCompanion[] | null>(null);

  const [showAllOnline, setShowAllOnline] = useState(false);

  const visibleCompanions =
    onlineCompanions === null
      ? []
      : showAllOnline
        ? onlineCompanions
        : onlineCompanions.slice(0, ONLINE_VISIBLE_LIMIT);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadPresence() {
      const { data: companionRows } = await supabase
        .from("companions")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
      const companionIds = [
        ...new Set(
          (companionRows ?? []).map((r) =>
            r.requester_id === currentUserId ? r.addressee_id : r.requester_id,
          ),
        ),
      ];

      if (companionIds.length === 0) {
        if (!cancelled) setOnlineCompanions([]);
        return;
      }

      // Companion끼리는 실명 공개 대상이라(0018) user_display를 거치지 않고 users.name을
      // 바로 써도 정책상 문제없다 — last_seen_at은 애초에 뷰에 없어서 어차피 직접 조회해야 함.
      const { data: users } = await supabase
        .from("users")
        .select("id, name, last_seen_at")
        .in("id", companionIds);

      const presentCompanions: OnlineCompanion[] = (users ?? [])
        .map((u) => ({ id: u.id, name: u.name, status: presenceStatus(u.last_seen_at) }))
        .filter(
          (u): u is { id: string; name: string; status: Exclude<PresenceStatus, "offline"> } =>
            u.status !== "offline",
        )
        .sort((a, b) => (a.status === b.status ? 0 : a.status === "online" ? -1 : 1))
        .map((u) => ({ ...u, color: avatarColorFor(u.id) }));

      if (!cancelled) setOnlineCompanions(presentCompanions);
    }

    loadPresence();
    const timer = setInterval(loadPresence, ONLINE_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!isMemoTab) return;
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data: companionRows } = await supabase
        .from("companions")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
      const companionIds = new Set(
        (companionRows ?? []).map((r) =>
          r.requester_id === currentUserId ? r.addressee_id : r.requester_id,
        ),
      );

      if (companionIds.size === 0) {
        if (!cancelled) setKnockablePosts([]);
        return;
      }

      // 이후 Companion 필터 + accessMap 필터 + slice(0,5)로 더 줄어들 걸 감안해 넉넉히 가져온다.
      const { data: rawPosts } = await supabase
        .from("posts")
        .select("id, user_id, caption, published_at")
        .eq("visibility", "invite_only")
        .eq("status", "published")
        .neq("user_id", currentUserId)
        .order("published_at", { ascending: false })
        .limit(30);

      const posts = (rawPosts ?? []).filter((p) => companionIds.has(p.user_id));

      if (posts.length === 0) {
        if (!cancelled) setKnockablePosts([]);
        return;
      }

      const postIds = posts.map((p) => p.id);
      const authorIds = [...new Set(posts.map((p) => p.user_id))];

      const [{ data: access }, { data: authors }] = await Promise.all([
        supabase.from("post_access").select("post_id, status").eq("user_id", currentUserId).in("post_id", postIds),
        supabase.from("user_display").select("id, display_name").in("id", authorIds),
      ]);

      const accessMap = new Map((access ?? []).map((a) => [a.post_id, a.status]));
      const authorMap = new Map((authors ?? []).map((u) => [u.id, u.display_name]));

      const knockable: KnockablePost[] = posts
        .filter((p) => accessMap.get(p.id) !== "invited" && accessMap.get(p.id) !== "accepted")
        .slice(0, 5)
        .map((p) => ({
          postId: p.id,
          authorName: authorMap.get(p.user_id) ?? "알 수 없음",
          caption: p.caption,
          publishedAt: p.published_at ?? new Date().toISOString(),
          pending: accessMap.get(p.id) === "pending",
        }));

      if (!cancelled) setKnockablePosts(knockable);
    })();

    return () => {
      cancelled = true;
    };
  }, [isMemoTab, currentUserId]);

  useEffect(() => {
    if (isMemoTab) return;
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const weekStartISO = currentWeekStartISO();

      const [{ count: approvedMemberCount }, { data: rawPosts }] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase
          .from("posts")
          .select("id, user_id, caption, published_at")
          .eq("visibility", "public")
          .eq("status", "published")
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order("published_at", { ascending: false })
          .limit(PEAK_CANDIDATE_POOL_LIMIT),
      ]);
      const peakThreshold = peakThresholdFromMemberCount(approvedMemberCount ?? 0);
      const posts = rawPosts ?? [];

      if (posts.length === 0) {
        if (!cancelled) setPeakPosts([]);
        return;
      }

      const postIds = posts.map((p) => p.id);
      const { data: weekLikes } = await supabase
        .from("likes")
        .select("post_id")
        .in("post_id", postIds)
        .gte("created_at", weekStartISO);

      const weeklyLikeCountMap = new Map<string, number>();
      for (const row of weekLikes ?? []) {
        weeklyLikeCountMap.set(row.post_id, (weeklyLikeCountMap.get(row.post_id) ?? 0) + 1);
      }

      const peakCandidates = posts
        .map((p) => ({ ...p, weeklyLikeCount: weeklyLikeCountMap.get(p.id) ?? 0 }))
        .filter((p) => p.weeklyLikeCount >= peakThreshold)
        .sort((a, b) => b.weeklyLikeCount - a.weeklyLikeCount)
        .slice(0, PEAK_POSTS_VISIBLE_LIMIT);

      if (peakCandidates.length === 0) {
        if (!cancelled) setPeakPosts([]);
        return;
      }

      const authorIds = [...new Set(peakCandidates.map((p) => p.user_id))];
      const { data: authors } = await supabase
        .from("user_display")
        .select("id, display_name")
        .in("id", authorIds);
      const authorMap = new Map((authors ?? []).map((u) => [u.id, u.display_name]));

      const result: PeakPost[] = peakCandidates.map((p) => ({
        postId: p.id,
        authorName: authorMap.get(p.user_id) ?? "알 수 없음",
        caption: p.caption,
        publishedAt: p.published_at ?? new Date().toISOString(),
        weeklyLikeCount: p.weeklyLikeCount,
      }));

      if (!cancelled) setPeakPosts(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [isMemoTab]);

  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-4 md:flex">
      <section>
        <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          온라인 — {onlineCompanions?.length ?? 0}명
        </h2>
        <div
          className={`mt-1 flex flex-col gap-0.5 ${
            showAllOnline ? "max-h-72 overflow-y-auto pr-0.5" : ""
          }`}
        >
          {onlineCompanions === null ? (
            <p className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">불러오는 중...</p>
          ) : onlineCompanions.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">
              지금 접속 중인 Companion이 없어요
            </p>
          ) : (
            visibleCompanions.map((person) => (
              <div
                key={person.id}
                className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-gray-200/60 dark:hover:bg-gray-900"
              >
                <span
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${person.color}`}
                >
                  {person.name.slice(0, 1)}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-black ${
                      person.status === "online" ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {person.name}
                  </span>
                  <span className="truncate text-xs text-gray-400 dark:text-gray-500">
                    {person.status === "online" ? "온라인" : "자리 비움"}
                  </span>
                </div>
                <button
                  aria-label="더 보기"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  ⋮
                </button>
              </div>
            ))
          )}
        </div>
        {onlineCompanions !== null && onlineCompanions.length > ONLINE_VISIBLE_LIMIT && (
          <button
            onClick={() => setShowAllOnline((v) => !v)}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-left text-xs text-gray-400 transition hover:bg-gray-200/60 hover:text-gray-600 dark:hover:bg-gray-900 dark:hover:text-gray-300"
          >
            {showAllOnline ? "접기" : `더 보기 (+${onlineCompanions.length - ONLINE_VISIBLE_LIMIT})`}
          </button>
        )}
      </section>

      <section>
        {isMemoTab ? (
          <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            🔒 노크 가능한 게시물
          </h2>
        ) : (
          <h2 className="flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-red-500 dark:text-red-400">
            🔥 금주의 Peak 게시물
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          </h2>
        )}
        <div className="mt-1 flex flex-col gap-1">
          {isMemoTab ? (
            knockablePosts === null ? (
              <p className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">불러오는 중...</p>
            ) : knockablePosts.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">
                노크할 수 있는 비공개 게시물이 없어요
              </p>
            ) : (
              knockablePosts.map((post, i) => (
                <Link
                  key={post.postId}
                  href={`/feed?feed=complex#${post.postId}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                  className="animate-peak-in flex items-center gap-2 rounded-md border border-violet-100 bg-violet-50 px-2 py-1.5 transition hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/30 dark:hover:bg-violet-950/50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs dark:bg-black/30">
                    🔒
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-gray-700 dark:text-violet-200">{post.authorName}</span>
                      {post.pending && (
                        <span className="shrink-0 text-[10px] font-bold text-violet-500 dark:text-violet-400">
                          요청됨
                        </span>
                      )}
                    </div>
                    <span className="truncate text-[11px] text-gray-400 dark:text-violet-400/70">
                      {post.caption || "비공개 게시물"} · {timeAgo(post.publishedAt)}
                    </span>
                  </div>
                </Link>
              ))
            )
          ) : peakPosts === null ? (
            <p className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">불러오는 중...</p>
          ) : peakPosts.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">
              이번 주 PEAK 게시물이 아직 없어요
            </p>
          ) : (
            peakPosts.map((post, i) =>
              i === 0 ? (
                // 1위는 카드로 확대 — 나머지 두 개와 같은 줄짜리 취급이면 순위 1위라는 게 안 와닿아서
                // 여기만 반응 수를 크게 보여주고 카드 자체 크기도 키운다.
                <Link
                  key={post.postId}
                  href={`/feed?feed=completion#${post.postId}`}
                  className="animate-peak-in flex flex-col gap-1 rounded-lg border-2 border-red-300 bg-red-50 p-2.5 transition hover:bg-red-100 dark:border-red-800/70 dark:bg-red-950/40 dark:hover:bg-red-950/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      🔥 1위
                    </span>
                    <span className="shrink-0 text-base font-bold text-red-600 dark:text-red-400">
                      🔥 {post.weeklyLikeCount}
                    </span>
                  </div>
                  <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {post.authorName}
                  </span>
                  <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {post.caption || "게시물"}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(post.publishedAt)}</span>
                </Link>
              ) : (
                <Link
                  key={post.postId}
                  href={`/feed?feed=completion#${post.postId}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                  className="animate-peak-in flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-2 py-1.5 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:hover:bg-red-950/50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-red-500 dark:bg-black/30">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-gray-700 dark:text-gray-200">{post.authorName}</span>
                      <span className="shrink-0 text-[10px] font-bold text-red-500">🔥 {post.weeklyLikeCount}</span>
                    </div>
                    <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                      {post.caption || "게시물"} · {timeAgo(post.publishedAt)}
                    </span>
                  </div>
                </Link>
              ),
            )
          )}
        </div>
      </section>
    </aside>
  );
}
