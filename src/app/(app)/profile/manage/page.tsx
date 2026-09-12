import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { pageTitle, pageCard } from "@/components/ui/styles";
import { PostsGrid } from "./PostsGrid";

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
      <h1 className={`${pageTitle} !text-black`}>내 게시물 관리</h1>
      <PostsGrid posts={postsWithVideo} />
    </main>
  );
}
