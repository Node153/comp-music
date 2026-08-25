import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { MessageButton } from "@/components/MessageButton";
import { LogoutButton } from "@/components/LogoutButton";
import { badge, pageCard } from "@/components/ui/styles";
import { Avatar } from "@/components/Avatar";
import { CompanionButton, type CompanionRelation } from "./CompanionButton";

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

  // 표시 이름은 user_display 뷰(0018) — 본인/Companion이면 실명, 아니면 닉네임.
  const { data: user } = await supabase
    .from("user_display")
    .select("display_name")
    .eq("id", userId)
    .single();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("school, school_public, instruments, region, bio")
    .eq("user_id", userId)
    .single();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, video_url, image_url, audio_url, media_type, content_type, status")
    .eq("user_id", userId)
    .in("status", ["published", "expired"])
    .order("created_at", { ascending: false });

  const postsWithVideo = await Promise.all(
    (posts ?? []).map(async (post) => {
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = mediaPath ? await getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS) : null;
      return { ...post, videoSrc };
    }),
  );

  // Companion(0017) — 팔로워/팔로잉 두 숫자 대신 "Companion n명" 하나만 센다(accepted만).
  const { count: companionCount } = await supabase
    .from("companions")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  let relation: CompanionRelation = "none";
  if (currentUser && !isOwnProfile) {
    const { data: pairRow } = await supabase
      .from("companions")
      .select("requester_id, status")
      .or(
        `and(requester_id.eq.${currentUser.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${currentUser.id})`,
      )
      .maybeSingle();
    if (pairRow) {
      relation =
        pairRow.status === "accepted"
          ? "companions"
          : pairRow.requester_id === currentUser.id
            ? "outgoing"
            : "incoming";
    }
  }

  return (
    <main className={pageCard}>
      {isOwnProfile && <MarkNotificationsSeen userId={userId} />}

      <div className="flex items-start gap-4">
        <Avatar userId={userId} name={user.display_name} className="h-16 w-16 text-2xl" />
        <div className="flex flex-1 flex-col gap-1 pt-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">{user.display_name}</h1>
            {isOwnProfile && <LogoutButton />}
          </div>
          <div className="flex gap-4 text-sm text-gray-600">
            <Link href={`/profile/${userId}/companions`} className="hover:text-gray-900">
              {isOwnProfile ? "나의 Companion" : "Companion"}{" "}
              <span className="font-semibold text-gray-900">{companionCount ?? 0}명</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile?.school && (profile.school_public || isOwnProfile) && (
          <span className={badge}>{profile.school}</span>
        )}
        {(profile?.instruments ?? []).map((inst) => (
          <span key={inst} className={badge}>
            {inst}
          </span>
        ))}
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
              <CompanionButton
                currentUserId={currentUser.id}
                targetUserId={userId}
                initialRelation={relation}
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
            {post.videoSrc && post.media_type === "image" ? (
              <img src={post.videoSrc} alt="" className="h-full w-full object-cover" />
            ) : post.videoSrc && post.media_type === "audio" ? (
              <div className="flex h-full w-full items-center justify-center bg-gray-800 text-2xl">🎵</div>
            ) : post.videoSrc ? (
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
