import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl, resolveMediaUrl } from "@/lib/r2/storage";
import { MarkNotificationsSeen } from "@/components/MarkNotificationsSeen";
import { MessageButton } from "@/components/MessageButton";
import { LogoutButton } from "@/components/LogoutButton";
import { pageCard } from "@/components/ui/styles";
import { Avatar } from "@/components/Avatar";
import { ComperBadge } from "@/components/ComperBadge";
import { EditIcon, UsersIcon, GraduationCapIcon, MicIcon, SchoolIcon, MapPinIcon } from "@/components/icons";
import { getAdminIds } from "@/lib/admins";
import { CompanionButton, type CompanionRelation } from "./CompanionButton";
import { ProfileTabs } from "./ProfileTabs";
import { AboutSection } from "./AboutSection";
import { CompanionPreview } from "./CompanionPreview";
import { ProfileFeed } from "./ProfileFeed";

// 애플 이모지(🎓🎤🏫📍) 대신 다른 아이콘과 같은 선(stroke) 톤으로(2026-09, 사용자 피드백 —
// 작은 크기에서 이모지가 깨져 보이는 버그도 같이 발견해서 교체).
const USER_TYPE_LABEL: Record<string, string> = {
  student: "전공생",
  activist: "활동자",
};
const USER_TYPE_ICON: Record<string, typeof GraduationCapIcon> = {
  student: GraduationCapIcon,
  activist: MicIcon,
};

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
    .select(
      "user_type, user_type_public, school, school_public, instruments, region, region_public, bio, favorite_genres, portfolio_links",
    )
    .eq("user_id", userId)
    .single();

  const { data: posts } = await supabase
    .from("posts")
    .select(
      "id, title, video_url, image_url, audio_url, thumbnail_url, media_type, content_type, instrument_tags, status, caption, expires_at, view_count",
    )
    .eq("user_id", userId)
    .in("status", ["published", "expired"])
    .order("created_at", { ascending: false });

  // 데스크톱 오른쪽 피드 카드(2단계, 페이스북 참고)에 실제 좋아요/댓글 버튼을 쓰려면 메인
  // 피드(feed/page.tsx)와 같은 방식으로 likes/comments를 한 번에 배치 조회해야 한다 —
  // LikeButton/CommentPanel은 개수를 직접 안 불러오고 PostEngagementProvider가 미리 준
  // 초기값만 쓴다.
  const postIds = (posts ?? []).map((p) => p.id);
  const { data: likeRows } =
    postIds.length > 0 ? await supabase.from("likes").select("post_id, user_id").in("post_id", postIds) : { data: [] };
  const { data: commentRows } =
    postIds.length > 0 ? await supabase.from("comments").select("post_id").in("post_id", postIds) : { data: [] };

  // 만료 판정은 expires_at(시각)으로 직접 한다. status="expired"는 expire-posts 크론이
  // 뒤늦게(하루 1회) 채우는 값이라, 크론 지연과 무관하게 정확한 배지를 보이려면 시각 비교가 필요.
  const nowMs = Date.now();
  const postsWithVideo = await Promise.all(
    (posts ?? []).map(async (post) => {
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = mediaPath ? await getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS) : null;
      const posterSrc = post.thumbnail_url ? await resolveMediaUrl(post.thumbnail_url, SIGNED_URL_EXPIRY_SECONDS) : null;
      const isExpired =
        post.status === "expired" ||
        (post.expires_at != null && new Date(post.expires_at).getTime() <= nowMs);
      const likeCount = (likeRows ?? []).filter((l) => l.post_id === post.id).length;
      const likedByMe = !!currentUser && (likeRows ?? []).some((l) => l.post_id === post.id && l.user_id === currentUser.id);
      const commentCount = (commentRows ?? []).filter((c) => c.post_id === post.id).length;
      return { ...post, videoSrc, posterSrc, isExpired, likeCount, likedByMe, commentCount };
    }),
  );

  // 게시물 탭의 사용자 정의 폴더(0057, 정태인님 제안) — 현재/보관된처럼 자동 분류가 아니라
  // 본인이 고른 게시물만 모은 묶음. 이름만 먼저 불러오고, 포함된 게시물 id는 한 번에 조회.
  const { data: folderRows } = await supabase
    .from("post_folders")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at");
  const { data: folderItemRows } =
    folderRows && folderRows.length > 0
      ? await supabase
          .from("post_folder_items")
          .select("folder_id, post_id")
          .in(
            "folder_id",
            folderRows.map((f) => f.id),
          )
      : { data: [] };
  const folders = (folderRows ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    postIds: (folderItemRows ?? []).filter((i) => i.folder_id === f.id).map((i) => i.post_id),
  }));

  // Companion(0017) — 팔로워/팔로잉 두 숫자 대신 "Companion n명" 하나만 센다(accepted만).
  const { count: companionCount } = await supabase
    .from("companions")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  // Companion 탭 미리보기 — 전체 목록은 /companions(수락/거절 로직 포함)에 그대로 두고,
  // 여기선 얕게 최대 9명만 아바타로 보여준다(companions/page.tsx의 accepted 쿼리와 동일 패턴).
  const { data: companionRows } = await supabase
    .from("companions")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .limit(9);
  const companionOtherIds = (companionRows ?? []).map((r) =>
    r.requester_id === userId ? r.addressee_id : r.requester_id,
  );
  const { data: companionUsers } =
    companionOtherIds.length > 0
      ? await supabase.from("user_display").select("id, display_name").in("id", companionOtherIds)
      : { data: [] };
  const companionPreview = companionOtherIds
    .map((id) => companionUsers?.find((u) => u.id === id))
    .filter((u): u is { id: string; display_name: string } => Boolean(u));

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

  // 이름 아래 "소개 요약" 줄(페이스북 인트로 참고) — 공개범위 게이트는 기존 학교 칩과 동일하게
  // "공개거나 본인이면 보임"(*_public || isOwnProfile). 토글 없는 필드(포지션 등)는 여기 안 넣고
  // 그 아래 칩 줄에 그대로 둔다.
  const introItems: { Icon: typeof GraduationCapIcon; text: string }[] = [];
  if (profile?.user_type && (profile.user_type_public || isOwnProfile)) {
    introItems.push({
      Icon: USER_TYPE_ICON[profile.user_type] ?? GraduationCapIcon,
      text: USER_TYPE_LABEL[profile.user_type] ?? profile.user_type,
    });
  }
  if (profile?.school && (profile.school_public || isOwnProfile)) {
    introItems.push({ Icon: SchoolIcon, text: profile.school });
  }
  if (profile?.region && (profile.region_public || isOwnProfile)) {
    introItems.push({ Icon: MapPinIcon, text: profile.region });
  }

  return (
    <main className={pageCard}>
      {isOwnProfile && <MarkNotificationsSeen userId={userId} />}

      {/* 배너(3단계, 페이스북 참고) — 실제 사진 업로드는 다음 단계, 지금은 자리만 예약한
          flat 플레이스홀더. pageCard의 p-6 패딩을 상쇄하는 음수 마진으로 카드 가장자리까지
          꽉 채운다(모바일은 pageCard 자체가 각짐 없이 화면 폭 그대로라 그냥 화면 끝까지,
          데스크톱은 md:rounded-t-lg로 카드 위쪽 둥근 모서리를 그대로 따라간다). 그레이 단계
          축소(2026-09)로 새 톤을 안 만들고 이미 페이지 배경에 쓰는 canvas-gray를 재사용. */}
      <div className="-mx-6 -mt-6 h-24 bg-canvas-gray md:rounded-t-lg" />

      <div className="mt-3 flex items-start gap-4">
        <Avatar
          userId={userId}
          name={user.display_name}
          className="-mt-10 h-20 w-20 border-4 border-main-gray text-3xl"
        />
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
          {/* Companion 통계 — 겹친 미니 아바타 무리 + 숫자(페이스북 친구 수 표시 참고). */}
          <Link href={`/profile/${userId}/companions`} className="flex items-center gap-2 hover:underline">
            {companionPreview.length > 0 && (
              <span className="flex -space-x-2">
                {companionPreview.slice(0, 3).map((c) => (
                  <Avatar
                    key={c.id}
                    userId={c.id}
                    name={c.display_name}
                    className="h-5 w-5 border border-main-gray text-[10px]"
                  />
                ))}
              </span>
            )}
            <span className="text-sm text-black">
              {isOwnProfile ? "나의 Companion" : "Companion"}{" "}
              <span className="font-semibold text-black">{companionCount ?? 0}명</span>
            </span>
          </Link>
        </div>
      </div>

      {introItems.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black">
          {introItems.map(({ Icon, text }, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-active-gray" />
              {text}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(profile?.instruments ?? []).map((inst) => (
          <span key={inst} className="rounded-full border border-box-gray px-2.5 py-1 text-xs text-black">
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-box-gray px-4 py-2.5 text-center text-sm font-medium text-black transition hover:opacity-80"
            >
              <EditIcon className="h-4 w-4" />
              프로필 수정
            </Link>
            <Link
              href="/profile/manage"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-box-gray px-4 py-2.5 text-center text-sm font-medium text-black transition hover:opacity-80"
            >
              <UsersIcon className="h-4 w-4" />
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
                className="flex-1 rounded-xl border border-box-gray px-4 py-2.5 text-sm font-medium text-black transition hover:opacity-80"
              >
                메시지 보내기
              </MessageButton>
            </>
          )
        )}
      </div>

      {/* 모바일 — 게시물/소개/Companion 탭으로 세로 스택(기존 구조 그대로). */}
      <div className="md:hidden">
        <ProfileTabs
          posts={postsWithVideo}
          folders={folders}
          profile={profile}
          isOwnProfile={isOwnProfile}
          userId={userId}
          companionCount={companionCount ?? 0}
          companionPreview={companionPreview}
        />
      </div>

      {/* 데스크톱(3단계, 페이스북 참고) — 왼쪽엔 소개/Companion을 탭 대신 항상 보이는
          사이드바 카드로, 오른쪽엔 본인 피드처럼 세로로 넘기는 게시물 카드를 배치한다.
          폴더 탭은 큐레이션 도구 성격이 강해서 오른쪽 피드에서도 기존 썸네일 그리드
          (FolderView)를 그대로 쓴다 — ProfileFeed 내부에서 처리. */}
      <div className="mt-4 hidden md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-4">
        {/* 소개+Companion을 상자 두 개로 나누지 않고 한 카드 안에 구분선만 둔다(2026-09,
            "회색 상자가 너무 많이 겹쳐 보인다" 피드백) — Companion은 헤더 통계 줄과 같은
            압축(compact) 형태라 별도 그리드 박스가 필요 없어져서 자연스럽게 합쳐진다. */}
        <div className="flex flex-col gap-3 rounded-xl border border-box-gray p-3">
          <AboutSection profile={profile} isOwnProfile={isOwnProfile} />
          <div className="border-t border-main-gray pt-3">
            <CompanionPreview
              userId={userId}
              isOwnProfile={isOwnProfile}
              count={companionCount ?? 0}
              people={companionPreview}
              compact
            />
          </div>
        </div>

        <ProfileFeed
          posts={postsWithVideo}
          folders={folders}
          isOwnProfile={isOwnProfile}
          userId={userId}
          currentUserId={currentUser?.id ?? null}
          authorName={user.display_name}
        />
      </div>
    </main>
  );
}
