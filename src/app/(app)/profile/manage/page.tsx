import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageTitle } from "@/components/ui/styles";
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
    .select("id, video_url, status")
    .eq("user_id", user.id)
    .in("status", ["published", "expired"])
    .order("created_at", { ascending: false });

  const postsWithVideo = await Promise.all(
    (posts ?? []).map(async (post) => {
      const { data } = await supabase.storage
        .from("posts")
        .createSignedUrl(post.video_url, SIGNED_URL_EXPIRY_SECONDS);
      return { ...post, videoSrc: data?.signedUrl ?? null };
    }),
  );

  return (
    <main className="mx-auto max-w-lg p-6 pb-20">
      <h1 className={pageTitle}>내 게시물 관리</h1>
      <div className="mt-6 grid grid-cols-3 gap-1.5">
        {postsWithVideo.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
            {post.videoSrc ? (
              <video src={post.videoSrc} className="h-full w-full object-cover" muted preload="metadata" />
            ) : null}
            {post.status === "expired" && (
              <span className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                만료됨
              </span>
            )}
            <DeletePostButton postId={post.id} videoPath={post.video_url} />
          </div>
        ))}
        {postsWithVideo.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-gray-400">게시물이 없습니다</p>
        )}
      </div>
    </main>
  );
}
