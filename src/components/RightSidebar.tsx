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
import { SidebarChatPanel } from "@/components/SidebarChatPanel";
import { timeAgo } from "@/lib/timeAgo";

type Companion = {
  id: string;
  name: string;
  role: string;
  status: "online" | "idle";
  activity?: string;
  color: string;
};

const COMPANIONS: Companion[] = [
  { id: "c1", name: "이도윤", role: "보컬", status: "online", color: "bg-amber-700" },
  {
    id: "c2",
    name: "강민서",
    role: "드럼",
    status: "online",
    activity: "온라인 게임 중",
    color: "bg-sky-700",
  },
  { id: "c3", name: "윤소이", role: "신스", status: "idle", color: "bg-fuchsia-900" },
  { id: "c4", name: "배지훈", role: "프로듀서", status: "idle", color: "bg-orange-400" },
];

const ONLINE_VISIBLE_LIMIT = 3;

// 실시간 PEAK 게시물 = 지금 핫한 게시물(좋아요+댓글 합이 PEAK_THRESHOLD를 넘은 게시물).
// postId는 feed/page.tsx의 DEMO_MOCK_SAMPLES와 같은 값 — 클릭하면 해당 게시물로 이동(#앵커).
const MOCK_PEAK_POSTS = [
  {
    postId: "mock-completion-3",
    name: "한지민",
    caption: "합주 영상 반응이 심상치 않아요",
    publishedAgo: "5시간 전",
    emoji: "🔥",
  },
  {
    postId: "mock-completion-2",
    name: "오세준",
    caption: "즉흥 세션 녹화했어요",
    publishedAgo: "1일 전",
    emoji: "🎸",
  },
  {
    postId: "mock-completion-8",
    name: "강태오",
    caption: "베이스 솔로 챌린지 영상",
    publishedAgo: "1일 전",
    emoji: "🎸",
  },
];

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

  const [showAllOnline, setShowAllOnline] = useState(false);
  const [dmPanelOpen, setDmPanelOpen] = useState(false);
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);

  function openDmWith(id: string) {
    setSelectedDmId(id);
    setDmPanelOpen(true);
  }

  const visibleCompanions = showAllOnline ? COMPANIONS : COMPANIONS.slice(0, ONLINE_VISIBLE_LIMIT);

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

  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-4 md:flex">
      <section>
        <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          온라인 — {COMPANIONS.length}명
        </h2>
        <div className="mt-1 flex flex-col gap-0.5">
          {visibleCompanions.map((person) => (
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
                  {person.activity ? `🎮 ${person.activity}` : person.status === "online" ? "온라인" : "자리 비움"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => openDmWith(person.id)}
                  aria-label="DM 보내기"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  💬
                </button>
                <button
                  aria-label="더 보기"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  ⋮
                </button>
              </div>
            </div>
          ))}
        </div>
        {COMPANIONS.length > ONLINE_VISIBLE_LIMIT && (
          <button
            onClick={() => setShowAllOnline((v) => !v)}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-left text-xs text-gray-400 transition hover:bg-gray-200/60 hover:text-gray-600 dark:hover:bg-gray-900 dark:hover:text-gray-300"
          >
            {showAllOnline ? "접기" : `더 보기 (+${COMPANIONS.length - ONLINE_VISIBLE_LIMIT})`}
          </button>
        )}
      </section>

      <SidebarChatPanel
        contacts={COMPANIONS.map((c) => ({ id: c.id, name: c.name, meta: c.role }))}
        open={dmPanelOpen}
        onOpenChange={setDmPanelOpen}
        selectedId={selectedDmId}
        onSelectedIdChange={setSelectedDmId}
      />

      <section>
        <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {isMemoTab ? "🔒 노크 가능한 게시물" : "실시간 PEAK"}
        </h2>
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
          ) : (
            MOCK_PEAK_POSTS.map((post, i) => (
              <Link
                key={post.postId}
                href={`/feed?feed=completion#${post.postId}`}
                style={{ animationDelay: `${i * 100}ms` }}
                className="animate-peak-in flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-2 py-1.5 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:hover:bg-red-950/50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs dark:bg-black/30">
                  {post.emoji}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-gray-700 dark:text-gray-200">{post.name}</span>
                    <span className="shrink-0 text-[10px] font-bold text-red-500">🔥 PEAK</span>
                  </div>
                  <span className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                    {post.publishedAgo}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
