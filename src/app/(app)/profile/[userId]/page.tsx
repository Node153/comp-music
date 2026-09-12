import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { MessageButton } from "@/components/MessageButton";
import { LogoutButton } from "@/components/LogoutButton";
import { pageCard } from "@/components/ui/styles";
import { Avatar } from "@/components/Avatar";
import { ComperBadge } from "@/components/ComperBadge";
import { getAdminIds } from "@/lib/admins";
import { CompanionButton, type CompanionRelation } from "./CompanionButton";
import { PostsGrid } from "./PostsGrid";

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

  // 운영자(comper) 프로필이면 이름 옆에 뱃지, 태그번호는 숨김.
  const isComper = (await getAdminIds()).has(userId);

  // 본인 프로필에서는 실명 아래에 닉네임+태그(0038)를 같이 보여준다 — 남들에게 어떻게
  // 보이는지 / 검색·멘션용 핸들이 뭔지 본인이 알 수 있게.
  const { data: me } = isOwnProfile
    ? await supabase.from("users").select("nickname, nickname_tag").eq("id", userId).single()
    : { data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("school, school_public, instruments, region, bio")
    .eq("user_id", userId)
    .single();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, video_url, image_url, audio_url, media_type, content_type, status, caption, expires_at")
    .eq("user_id", userId)
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
      return { ...post, videoSrc, isExpired };
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
            <h1 className="flex items-center gap-1.5 text-xl font-bold text-black">
              {user.display_name}
              {isComper && <ComperBadge />}
            </h1>
            {isOwnProfile && <LogoutButton />}
          </div>
          {isOwnProfile && me && (
            <p className="text-sm text-black">
              {me.nickname}
              {!isComper && <span className="text-black">#{me.nickname_tag}</span>}
            </p>
          )}
          <div className="flex gap-4 text-sm text-black">
            <Link href={`/profile/${userId}/companions`} className="hover:underline">
              {isOwnProfile ? "나의 Companion" : "Companion"}{" "}
              <span className="font-semibold text-black">{companionCount ?? 0}명</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {profile?.school && (profile.school_public || isOwnProfile) && (
          <span className="rounded-full bg-box-gray px-2.5 py-1 text-xs text-black">{profile.school}</span>
        )}
        {(profile?.instruments ?? []).map((inst) => (
          <span key={inst} className="rounded-full bg-box-gray px-2.5 py-1 text-xs text-black">
            {inst}
          </span>
        ))}
      </div>
      {profile?.bio && <p className="mt-3 text-sm leading-relaxed text-black">{profile.bio}</p>}

      <div className="mt-4 flex gap-2">
        {isOwnProfile ? (
          <>
            <Link
              href="/profile/edit"
              className="flex-1 rounded-xl bg-box-gray px-4 py-2.5 text-center text-sm font-medium text-black transition hover:opacity-80"
            >
              프로필 수정
            </Link>
            <Link
              href="/profile/manage"
              className="flex-1 rounded-xl bg-box-gray px-4 py-2.5 text-center text-sm font-medium text-black transition hover:opacity-80"
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
                className="flex-1 rounded-xl bg-box-gray px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-80"
              >
                메시지 보내기
              </MessageButton>
            </>
          )
        )}
      </div>

      <PostsGrid posts={postsWithVideo} />
    </main>
  );
}
