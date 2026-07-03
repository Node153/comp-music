import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";

// S9 프로필 (본인/타인 분기, FEED-10 프로필 피드 = 본인 게시물 그리드)
// Phase 0: visibility가 public 고정이라 타인도 published/expired 게시물을 전부 볼 수 있음(0-2, 0-7)
// 팔로워/팔로잉(PROFILE-02/03)은 다음 이터레이션에서 채운다.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 10;

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const isOwnProfile = currentUser?.id === userId;

  const { data: user } = await supabase.from("users").select("name").eq("id", userId).single();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("school, major, instruments, region, collab_available, bio")
    .eq("user_id", userId)
    .single();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, video_url, content_type, status")
    .eq("user_id", userId)
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
    <main className="mx-auto max-w-lg p-6">
      {isOwnProfile && <MarkNotificationsSeen userId={userId} />}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{user.name}</h1>
        {isOwnProfile && (
          <div className="flex gap-3 text-sm text-blue-600">
            <Link href="/profile/edit">프로필 수정</Link>
            <Link href="/profile/manage">게시물 관리</Link>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1 text-xs text-gray-600">
        {profile?.school && <span className="rounded bg-gray-100 px-2 py-0.5">{profile.school}</span>}
        {profile?.major && <span className="rounded bg-gray-100 px-2 py-0.5">{profile.major}</span>}
        {(profile?.instruments ?? []).map((inst) => (
          <span key={inst} className="rounded bg-gray-100 px-2 py-0.5">
            {inst}
          </span>
        ))}
        {profile?.collab_available && (
          <span className="rounded bg-black px-2 py-0.5 text-white">협업 가능</span>
        )}
      </div>
      {profile?.bio && <p className="mt-2 text-sm text-gray-700">{profile.bio}</p>}

      <div className="mt-6 grid grid-cols-3 gap-1">
        {postsWithVideo.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] bg-gray-100">
            {post.videoSrc ? (
              <video src={post.videoSrc} className="h-full w-full object-cover" muted preload="metadata" />
            ) : null}
            {post.status === "expired" && (
              <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                만료됨
              </span>
            )}
          </div>
        ))}
        {postsWithVideo.length === 0 && (
          <p className="col-span-3 py-6 text-center text-sm text-gray-400">게시물이 없습니다</p>
        )}
      </div>
    </main>
  );
}
