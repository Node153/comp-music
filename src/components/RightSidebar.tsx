"use client";

// 데스크톱 우측 사이드바 — Discord 접속자 리스트 참고. 페이스북 카드형 박스 대신
// 아바타+이름 한 줄로 축약해서 위계를 낮춘다.
// memo(구 Complex) 탭에서는 "실시간 PEAK" 대신 노크 가능한 비공개(초대전용) 게시물 목록을
// 보여준다 — 실제 posts/post_access 기반(0012_complex_access_and_chat). memo는 방장과
// Companion인 게시물만 보이므로(feed/page.tsx와 동일한 원칙) 여기서도 Companion 필터를 거친
// 후보만 후보로 삼는다 — 안 그러면 RLS(post_access_insert_knock_self)에서 막히는 죽은
// 노크 버튼을 보여주게 된다.
import { InstallAdCard } from "@/components/InstallAdCard";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/timeAgo";
import { presenceStatus, type PresenceStatus } from "@/lib/presence";
import { Avatar } from "@/components/Avatar";
import { MessageButton } from "@/components/MessageButton";
import { LockIcon, FlameIcon, DotsIcon, HeadphonesIcon } from "@/components/icons";

// 온라인/자리비움/오프라인 판정은 lib/presence(메시지 화면과 공유)를 그대로 쓴다. 오프라인인
// Companion은 이 목록에 아예 안 보인다(헤더가 "온라인 — N명"이라 오프라인까지 섞으면 숫자가
// 안 맞음 — Discord도 접속 안 한 사람은 기본 목록에서 접는다).
type OnlineCompanion = {
  id: string;
  name: string;
  status: Exclude<PresenceStatus, "offline">;
};

const ONLINE_VISIBLE_LIMIT = 3;
// 온라인 목록도 PresenceHeartbeat와 같은 주기로 다시 조회해서 "방금 나간 사람"이 계속 온라인으로
// 남아있지 않게 한다.
const ONLINE_REFRESH_INTERVAL_MS = 30_000;
// PEAK 목록도 같은 주기로 다시 조회한다 — 조회수는 페이지를 새로고침 안 해도 재생 중에
// 실시간으로 오르기 때문에(NowPlayingContext), 마운트 시 한 번만 조회하면 그 사이에 새로
// 기준을 넘긴 게시물이 있어도 사이드바가 계속 예전 상태로 남아있는다(사용자 제보 — 카드엔
// PEAK 배지가 떴는데 사이드바엔 그대로 "아직 없어요"였던 원인).
const PEAK_REFRESH_INTERVAL_MS = 30_000;

type PeakPost = {
  postId: string;
  authorId: string;
  authorName: string;
  caption: string | null;
  publishedAt: string;
  thumbnailUrl: string | null;
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
        .sort((a, b) => (a.status === b.status ? 0 : a.status === "online" ? -1 : 1));

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

    // PEAK 판정(posts.peaked_at) 자체는 이제 DB에 영구 고정돼있어(0056 마이그레이션) 여기서
    // 점수를 다시 계산할 필요가 없다 — 다만 썸네일(thumbnail_url)이 R2 key인 경우 signed URL로
    // 바꾸는 resolveMediaUrl이 서버 전용 함수라 브라우저에서 바로 못 써서, 전용 API 라우트
    // (/api/peak-posts)를 거쳐 이미 해석된 URL을 받아온다.
    async function loadPeakPosts() {
      try {
        const res = await fetch("/api/peak-posts");
        const { posts } = (await res.json()) as { posts: PeakPost[] };
        if (!cancelled) setPeakPosts(posts);
      } catch {
        if (!cancelled) setPeakPosts((prev) => prev ?? []);
      }
    }

    loadPeakPosts();
    const timer = setInterval(loadPeakPosts, PEAK_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
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
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                  <Avatar userId={person.id} name={person.name} className="h-9 w-9 text-sm" />
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
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenuId((v) => (v === person.id ? null : person.id))}
                    aria-label="더 보기"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 ${
                      openMenuId === person.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <DotsIcon className="h-4 w-4" />
                  </button>
                  {openMenuId === person.id && (
                    <>
                      <button
                        aria-label="메뉴 닫기"
                        onClick={() => setOpenMenuId(null)}
                        className="fixed inset-0 z-40 cursor-default"
                      />
                      <div className="absolute right-0 z-50 mt-1 w-36 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-950">
                        <Link
                          href={`/profile/${person.id}`}
                          onClick={() => setOpenMenuId(null)}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-900"
                        >
                          프로필 보기
                        </Link>
                        <MessageButton
                          currentUserId={currentUserId}
                          otherUserId={person.id}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-900"
                        >
                          메시지 보내기
                        </MessageButton>
                      </div>
                    </>
                  )}
                </div>
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
          <h2 className="flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <LockIcon className="h-3 w-3" /> 노크 가능한 게시물
          </h2>
        ) : (
          <h2 className="flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <FlameIcon className="h-3.5 w-3.5 text-red-500 dark:text-red-400" /> Peak 게시물
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
                  href={`/feed?post=${post.postId}#${post.postId}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                  className="animate-peak-in flex items-center gap-2 rounded-md border border-violet-100 bg-violet-50 px-2 py-1.5 transition hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/30 dark:hover:bg-violet-950/50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs dark:bg-black/30">
                    <LockIcon className="h-3.5 w-3.5" />
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
              PEAK 게시물이 아직 없어요
            </p>
          ) : (
            // 박스형 목록 줄(테두리·배경) 대신 게시물 카드 자체만 깔끔하게, 세로로 쌓는다
            // (사용자 요청). 카드 안에 제목을 오버레이하는 방식은 유지 — 순위·조회수 숫자
            // ("1위", "1K")는 계속 없음. 한 번 PEAK가 되면(posts.peaked_at) 좋아요를 취소해도
            // 계속 여기 남는다.
            <div className="flex flex-col gap-2">
              {peakPosts.map((post, i) => (
                <Link
                  key={post.postId}
                  href={`/feed?feed=completion#${post.postId}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                  className="animate-peak-in group"
                >
                  <div className="relative aspect-[16/10] w-full rounded-2xl bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 p-[2px] transition group-hover:brightness-110">
                    <div className="relative h-full w-full overflow-hidden rounded-[14px] bg-gray-200 dark:bg-gray-900">
                      {post.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.thumbnailUrl}
                          alt={post.caption || "PEAK 게시물"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                          <HeadphonesIcon className="h-6 w-6 text-white/70" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent px-2 pb-1.5 pt-5">
                        <span className="block truncate text-[13px] font-semibold text-white">
                          {post.caption || "제목 없음"}
                        </span>
                      </div>
                    </div>
                    <span className="absolute -left-1.5 -top-1.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white dark:ring-black">
                      <Avatar userId={post.authorId} name={post.authorName} className="h-7 w-7 text-[10px]" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 앱 설치 광고(InstallAdCard) — 설치 유도가 중요해서 팝업과 별개로 사이드바에 상시 노출.
          이미 설치한 앱이거나 닫은 지 7일이 안 됐으면 알아서 안 그린다. */}
      <InstallAdCard />
    </aside>
  );
}
