import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { MessageButton } from "@/components/MessageButton";
import { LogoutButton } from "@/components/LogoutButton";
import { badge, badgeDark, pageCard } from "@/components/ui/styles";
import { FollowButton } from "./FollowButton";

// S9 프로필 (본인/타인 분기, FEED-10 프로필 피드 = 본인 게시물 그리드)
// Phase 0: visibility가 public 고정이라 타인도 published/expired 게시물을 전부 볼 수 있음(0-2, 0-7)
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

  const { count: followerCount } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("followee_id", userId);
  const { count: followingCount } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", userId);

  let isFollowing = false;
  if (currentUser && !isOwnProfile) {
    const { data: existingFollow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("followee_id", userId)
      .maybeSingle();
    isFollowing = !!existingFollow;
  }

  return (
    <main className={pageCard}>
      {isOwnProfile && <MarkNotificationsSeen userId={userId} />}

      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-2xl font-semibold text-gray-500">
          {user.name.slice(0, 1)}
        </span>
        <div className="flex flex-1 flex-col gap-1 pt-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
            {isOwnProfile && <LogoutButton />}
          </div>
          <div className="flex gap-4 text-sm text-gray-600">
            <Link href={`/profile/${userId}/follows?tab=followers`} className="hover:text-gray-900">
              팔로워 <span className="font-semibold text-gray-900">{followerCount ?? 0}</span>
            </Link>
            <Link href={`/profile/${userId}/follows?tab=following`} className="hover:text-gray-900">
              팔로잉 <span className="font-semibold text-gray-900">{followingCount ?? 0}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile?.school && <span className={badge}>{profile.school}</span>}
        {profile?.major && <span className={badge}>{profile.major}</span>}
        {(profile?.instruments ?? []).map((inst) => (
          <span key={inst} className={badge}>
            {inst}
          </span>
        ))}
        {profile?.collab_available && <span className={badgeDark}>협업 가능</span>}
      </div>
      {profile?.bio && <p className="mt-3 text-sm leading-relaxed text-gray-700">{profile.bio}</p>}

      <div className="mt-4 flex gap-2">
        {isOwnProfile ? (
          <>
            <Link
              href="/profile/edit"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-900 transition hover:bg-gray-50"
            >
              프로필 수정
            </Link>
            <Link
              href="/profile/manage"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-900 transition hover:bg-gray-50"
            >
              게시물 관리
            </Link>
          </>
        ) : (
          currentUser && (
            <>
              <FollowButton
                currentUserId={currentUser.id}
                targetUserId={userId}
                initialFollowing={isFollowing}
              />
              <MessageButton
                currentUserId={currentUser.id}
                otherUserId={userId}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
              >
                메시지 보내기
              </MessageButton>
            </>
          )
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-1.5">
        {postsWithVideo.map((post) => (
          <div key={post.id} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-gray-100">
            {post.videoSrc ? (
              <video src={post.videoSrc} className="h-full w-full object-cover" muted preload="metadata" />
            ) : null}
            {post.status === "expired" && (
              <span className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                만료됨
              </span>
            )}
          </div>
        ))}
        {postsWithVideo.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-gray-400">게시물이 없습니다</p>
        )}
      </div>
    </main>
  );
}
