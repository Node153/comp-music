import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import type { ContentType } from "@/types/database";

// S6 메인 피드 (FEED-05~09) — 풀스크린 세로 스와이프, 활성 게시물만(status='published')
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
      <div className="fixed inset-x-4 top-4 z-10 flex items-center justify-between">
        {currentUser && (
          <Link
            href={`/profile/${currentUser.id}`}
            className="rounded-full bg-white/20 px-3 py-2 text-sm text-white"
          >
            내 프로필
          </Link>
        )}
        <Link
          href="/upload"
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
        >
          + 업로드
        </Link>
      </div>
      {postsWithVideo.length === 0 && (
        <section className="flex h-screen w-full snap-start flex-col items-center justify-center gap-4 text-white">
          <p className="text-sm text-gray-400">아직 게시물이 없습니다</p>
          <LogoutButton />
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
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{author?.name ?? "알 수 없음"}</span>
                {(profile?.school || profile?.major) && (
                  <span className="rounded bg-white/20 px-2 py-0.5 text-xs">
                    {[profile?.school, profile?.major].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              {post.caption && <p className="text-sm">{post.caption}</p>}
              <div className="flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-white/20 px-2 py-0.5">
                  {CONTENT_TYPE_LABEL[post.content_type]}
                </span>
                {(post.instrument_tags ?? []).map((tag) => (
                  <span key={tag} className="rounded bg-white/20 px-2 py-0.5">
                    #{tag}
                  </span>
                ))}
              </div>
              {post.collab_available && (
                <span className="mt-1 w-fit rounded bg-white px-2 py-1 text-xs font-medium text-black">
                  협업 구함{post.collab_role_needed ? `: ${post.collab_role_needed}` : ""}
                </span>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
