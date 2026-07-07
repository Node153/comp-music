import { createClient } from "@/lib/supabase/server";
import { MessageButton } from "@/components/MessageButton";
import { LikeButton } from "./LikeButton";
import { CommentPanel } from "./CommentPanel";
import type { ContentType } from "@/types/database";

// S6 메인 피드 (FEED-05~09, INTERACT-01/02)
// 웹 기준 카드형 피드(페이스북 참고) — 영상이 화면을 꽉 채우지 않고 카드 안에 담기도록 구성
// Phase 0: 필터(S7)·검색(S19) 없음, 최신순만, 페이지네이션 없이 최근 20개만(1.4)

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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

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
    <main className="mx-auto max-w-[900px] px-0 pb-24 pt-0 md:px-4 md:pb-8 md:pt-4">
      {postsWithVideo.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-24">
          <span className="text-3xl">🎬</span>
          <p className="text-sm text-gray-400">아직 게시물이 없습니다</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {postsWithVideo.map((post) => {
          const author = userMap.get(post.user_id);
          const profile = profileMap.get(post.user_id);
          const isOwnPost = currentUser?.id === post.user_id;
          const buttonBasis = isOwnPost ? "basis-1/2" : "basis-1/3";

          return (
            <article
              key={post.id}
              className="overflow-hidden border-y border-gray-200 bg-white md:rounded-lg md:border md:shadow-sm"
            >
              <div className="flex items-center gap-3 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base font-semibold text-gray-500">
                  {(author?.name ?? "?").slice(0, 1)}
                </span>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-gray-900">
                    {author?.name ?? "알 수 없음"}
                  </span>
                  <span className="text-sm text-gray-500">
                    {[profile?.school, profile?.major].filter(Boolean).join(" · ")}
                    {(profile?.school || profile?.major) && " · "}
                    {timeAgo(post.published_at ?? new Date().toISOString())}
                  </span>
                </div>
              </div>

              {post.caption && <p className="px-4 pb-4 text-base text-gray-900">{post.caption}</p>}

              <div className="flex items-center justify-center bg-black">
                {post.videoSrc ? (
                  <video
                    src={post.videoSrc}
                    className="max-h-[780px] w-auto object-contain"
                    controls
                    muted
                    playsInline
                  />
                ) : (
                  <p className="py-24 text-sm text-gray-400">영상을 불러올 수 없습니다</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 p-4">
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
                  {CONTENT_TYPE_LABEL[post.content_type]}
                </span>
                {(post.instrument_tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
                    #{tag}
                  </span>
                ))}
                {post.collab_available && (
                  <span className="rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white">
                    🤝 협업 구함{post.collab_role_needed ? `: ${post.collab_role_needed}` : ""}
                  </span>
                )}
              </div>

              {currentUser && (
                <div className="flex flex-wrap border-t border-gray-100">
                  <LikeButton
                    postId={post.id}
                    userId={currentUser.id}
                    initialLiked={likedByMeSet.has(post.id)}
                    initialCount={likeCountMap.get(post.id) ?? 0}
                    className={buttonBasis}
                  />
                  <CommentPanel
                    postId={post.id}
                    userId={currentUser.id}
                    initialCount={commentCountMap.get(post.id) ?? 0}
                    buttonClassName={buttonBasis}
                  />
                  {!isOwnPost && (
                    <MessageButton
                      currentUserId={currentUser.id}
                      otherUserId={post.user_id}
                      sourcePostId={post.id}
                      className={`flex items-center justify-center gap-2 py-3 text-base font-medium text-gray-600 transition hover:bg-gray-50 ${buttonBasis}`}
                    >
                      <span className="text-lg">✉️</span>
                      메시지
                    </MessageButton>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
