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

const MOCK_ONLINE = [
  { name: "정하늘", meta: "베이스" },
  { name: "오세준", meta: "기타" },
  { name: "한지민", meta: "작곡" },
];

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

      <section>
        <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          접속 중 · {MOCK_ONLINE.length}
        </h2>
        <div
          className="mt-1.5 flex items-center px-2"
          title={`${MOCK_ONLINE.map((p) => `${p.name}(${p.meta})`).join(", ")} — 실시간 접속 상태는 준비 중이에요`}
        >
          {MOCK_ONLINE.map((person, i) => (
            <span
              key={person.name}
              style={{ zIndex: MOCK_ONLINE.length - i, marginLeft: i === 0 ? 0 : "-0.5rem" }}
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[10px] font-semibold text-gray-500 dark:border-black dark:bg-gray-800 dark:text-gray-400"
            >
              {person.name.slice(0, 1)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500 dark:border-black" />
            </span>
          ))}
          <span className="ml-2 truncate text-xs text-gray-400">지금 {MOCK_ONLINE.length}명 활동 중</span>
        </div>
      </section>

      <SidebarChatPanel />
    </aside>
  );
}
