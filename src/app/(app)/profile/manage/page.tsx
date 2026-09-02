import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { pageTitle, pageCard } from "@/components/ui/styles";
import { DeletePostButton } from "./DeletePostButton";

// S16 마이 게시물 관리 (PROFILE-04, S9의 본인 전용 관리 모드)
// Phase 0: visibility가 public 고정이라 공개범위 변경 컨트롤은 없음(Phase 1에서 FEED-03 5단계와 함께 추가).
// 삭제(FEED-11)는 Phase 0에도 포함 — 하드 삭제, 복구 불가 확인 단계 필수.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 10;

export default async function ManagePostsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: posts } = await supabase
    .from("posts")
    .select("id, video_url, image_url, audio_url, media_type, status, caption, expires_at")
    .eq("user_id", user.id)
    .in("status", ["published", "expired"])
    .order("created_at", { ascending: false });

  // 만료 판정은 expires_at(시각)으로 직접 한다. status="expired"는 expire-posts 크론이
  // 뒤늦게(하루 1회) 채우는 값이라, 크론 지연과 무관하게 정확한 배지를 보이려면 시각 비교가 필요.
  const nowMs = Date.now();
  const postsWithVideo = await Promise.all(
    (posts ?? []).map(async (post) => {
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = mediaPath ? await getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS) : null;
      const isExpired =
        post.status === "expired" ||
        (post.expires_at != null && new Date(post.expires_at).getTime() <= nowMs);
      return { ...post, videoSrc, mediaPath, isExpired };
    }),
  );

  return (
    <main className={pageCard}>
      <h1 className={pageTitle}>내 게시물 관리</h1>
      <div className="mt-6 grid grid-cols-3 gap-1.5">
        {postsWithVideo.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
            {post.videoSrc && post.media_type === "image" ? (
              <img src={post.videoSrc} alt="" className="h-full w-full object-cover" />
            ) : post.videoSrc && post.media_type === "audio" ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-800 p-3 text-center">
                <span className="text-2xl">🎵</span>
                {post.caption && (
                  <span className="line-clamp-3 text-xs text-gray-300">{post.caption}</span>
                )}
              </div>
            ) : post.videoSrc ? (
              <video src={post.videoSrc} className="h-full w-full object-cover" muted preload="metadata" />
            ) : null}
            {post.isExpired && (
              <span className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                만료됨
              </span>
            )}
            <DeletePostButton postId={post.id} mediaPath={post.mediaPath} />
          </div>
        ))}
        {postsWithVideo.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-gray-400">게시물이 없습니다</p>
        )}
      </div>
    </main>
  );
}
