import { createClient } from "@/lib/supabase/server";
import { MessageButton } from "@/components/MessageButton";
import { LikeButton } from "./LikeButton";
import { CommentPanel } from "./CommentPanel";
import type { ContentType } from "@/types/database";

// S6 메인 피드 (FEED-05~09, INTERACT-01/02) — 풀스크린 세로 스와이프, 활성 게시물만(status='published')
// Phase 0: 필터(S7)·검색(S19) 없음, 최신순만, 페이지네이션 없이 최근 20개만(1.4)
// 우측 좋아요/댓글 버튼이 시각적으로 가장 눈에 띄어야 함(3.3 UI 강조 우선순위 — 반응 > 매칭)

const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  composition: "작곡",
  performance: "연주",
  practice: "연습",
  rehearsal: "리허설",
  improv: "즉흥",
  ensemble: "합주",
};

const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;
const FEED_LIMIT = 20;

export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data: posts } = await supabase
    .from("posts")
    .select(
      "id, user_id, video_url, caption, content_type, instrument_tags, collab_available, collab_role_needed, published_at",
    )
    .eq("status", "published")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("published_at", { ascending: false })
    .limit(FEED_LIMIT);

  const postIds = (posts ?? []).map((p) => p.id);
  const userIds = [...new Set((posts ?? []).map((p) => p.user_id))];

  const { data: users } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", userIds)
      : { data: [] };
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("user_id, school, major").in("user_id", userIds)
      : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const { data: likeRows } =
    postIds.length > 0
      ? await supabase.from("likes").select("post_id, user_id").in("post_id", postIds)
      : { data: [] };
  const { data: commentRows } =
    postIds.length > 0
      ? await supabase.from("comments").select("post_id").in("post_id", postIds)
      : { data: [] };

  const likeCountMap = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const row of likeRows ?? []) {
    likeCountMap.set(row.post_id, (likeCountMap.get(row.post_id) ?? 0) + 1);
    if (currentUser && row.user_id === currentUser.id) likedByMeSet.add(row.post_id);
  }
  const commentCountMap = new Map<string, number>();
  for (const row of commentRows ?? []) {
    commentCountMap.set(row.post_id, (commentCountMap.get(row.post_id) ?? 0) + 1);
  }

  const postsWithVideo = await Promise.all(
    (posts ?? []).map(async (post) => {
      const { data } = await supabase.storage
        .from("posts")
        .createSignedUrl(post.video_url, SIGNED_URL_EXPIRY_SECONDS);
      return { ...post, videoSrc: data?.signedUrl ?? null };
    }),
  );

  return (
    <main className="relative flex h-screen w-full snap-y snap-mandatory flex-col overflow-y-scroll bg-black">
      {postsWithVideo.length === 0 && (
        <section className="flex h-screen w-full snap-start flex-col items-center justify-center gap-2">
          <span className="text-3xl">🎬</span>
          <p className="text-sm text-gray-400">아직 게시물이 없습니다</p>
        </section>
      )}
      {postsWithVideo.map((post) => {
        const author = userMap.get(post.user_id);
        const profile = profileMap.get(post.user_id);
        return (
          <section
            key={post.id}
            className="relative flex h-screen w-full snap-start items-center justify-center text-white"
          >
            {post.videoSrc ? (
              <video
                src={post.videoSrc}
                className="h-full w-full object-contain"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            ) : (
              <p className="text-sm text-gray-400">영상을 불러올 수 없습니다</p>
            )}

            {currentUser && (
              <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-5">
                <LikeButton
                  postId={post.id}
                  userId={currentUser.id}
                  initialLiked={likedByMeSet.has(post.id)}
                  initialCount={likeCountMap.get(post.id) ?? 0}
                />
                <CommentPanel
                  postId={post.id}
                  userId={currentUser.id}
                  initialCount={commentCountMap.get(post.id) ?? 0}
                />
                {post.user_id !== currentUser.id && (
                  <MessageButton
                    currentUserId={currentUser.id}
                    otherUserId={post.user_id}
                    sourcePostId={post.id}
                    className="flex flex-col items-center gap-1 text-white"
                  >
                    <span className="text-2xl">✉️</span>
                  </MessageButton>
                )}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pb-16 pr-16">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                  {(author?.name ?? "?").slice(0, 1)}
                </span>
                <span className="text-sm font-semibold">{author?.name ?? "알 수 없음"}</span>
                {(profile?.school || profile?.major) && (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                    {[profile?.school, profile?.major].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              {post.caption && <p className="text-sm">{post.caption}</p>}
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="rounded-full bg-white/15 px-2 py-0.5">
                  {CONTENT_TYPE_LABEL[post.content_type]}
                </span>
                {(post.instrument_tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-full bg-white/15 px-2 py-0.5">
                    #{tag}
                  </span>
                ))}
              </div>
              {post.collab_available && (
                <span className="mt-1 w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
                  🤝 협업 구함{post.collab_role_needed ? `: ${post.collab_role_needed}` : ""}
                </span>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
