import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { MessageButton } from "@/components/MessageButton";
import { EngagementMeter } from "@/components/EngagementMeter";
import { PostEngagementProvider } from "@/components/PostEngagementContext";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { PostVideo } from "@/components/PostVideo";
import { MockPlayOverlay } from "@/components/MockPlayOverlay";
import { ComplexPostChat, type ChatMessage } from "@/components/ComplexPostChat";
import { ComplexAccessGate } from "@/components/ComplexAccessGate";
import { LikeButton } from "./LikeButton";
import { CommentPanel } from "./CommentPanel";
import type { ContentType } from "@/types/database";
import { tagColorClass } from "@/lib/feedConstants";

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

// Demo(전체공개) 전용 샘플 게시물 — 실제 업로드 없이 볼륨미터/PEAK/타임리밋 UI를 바로 확인할 수
// 있도록 넣은 데모 데이터. isMock 게시물은 DB에 실제 row가 없어 좋아요/댓글 버튼을 누를 수 없고
// 숫자만 정적으로 보여준다. Complex(팔로워공개/특정인초대)는 0012_complex_access_and_chat부터
// 실제 posts/post_access/post_chat_messages로 연동돼서 더 이상 mock 샘플이 없다.
type MockSample = {
  postId: string;
  userId: string;
  name: string;
  school: string;
  major: string;
  caption: string;
  contentType: ContentType;
  tags: string[];
  collab: boolean;
  collabRole: string | null;
  likes: number;
  comments: number;
  publishedHoursAgo: number;
  expireHours: number | null;
  gradient: string;
  emoji: string;
  demoVideoSrc?: string;
};

const DEMO_MOCK_SAMPLES: MockSample[] = [
  {
    postId: "mock-completion-1",
    userId: "mock-user-1",
    name: "정하늘",
    school: "서울대",
    major: "작곡과",
    caption: "드디어 완성한 첫 발라드 싱글, 앨범 커버까지 다 뽑았어요!",
    contentType: "composition",
    tags: ["피아노", "발라드"],
    collab: false,
    collabRole: null,
    likes: 32,
    comments: 9,
    publishedHoursAgo: 20,
    expireHours: null,
    gradient: "from-slate-700 to-slate-900",
    emoji: "🎹",
  },
  {
    postId: "mock-completion-2",
    userId: "mock-user-2",
    name: "오세준",
    school: "한예종",
    major: "실용음악과",
    caption: "6개월 준비한 합주 영상 최종본 공개합니다",
    contentType: "ensemble",
    tags: ["기타", "밴드"],
    collab: false,
    collabRole: null,
    likes: 58,
    comments: 14,
    publishedHoursAgo: 30,
    expireHours: null,
    gradient: "from-indigo-600 to-purple-700",
    emoji: "🎸",
  },
  {
    postId: "mock-completion-3",
    userId: "mock-user-3",
    name: "한지민",
    school: "활동자",
    major: "보컬",
    caption: "제 보컬 커버 정식 업로드했어요, 많이 들어주세요!",
    contentType: "performance",
    tags: ["보컬"],
    collab: false,
    collabRole: null,
    likes: 71,
    comments: 25,
    publishedHoursAgo: 5,
    expireHours: null,
    gradient: "from-rose-600 to-orange-500",
    emoji: "🎤",
    // Demo 게시물만 우선 재생 가능하게 테스트하기 위한 데모 오디오(하단 GlobalPlayerBar 확인용).
    demoVideoSrc: "/demo-completion-track.wav",
  },
  // 아래 5개는 반응량이 서로 달라서 미터가 초록/노랑/빨강/PEAK 구간을 골고루 보여주도록 넣은 샘플.
  {
    postId: "mock-completion-4",
    userId: "mock-user-4",
    name: "이서연",
    school: "한예종",
    major: "보컬",
    caption: "첫 라이브 클립 편집 완료! 떨렸지만 재밌었어요",
    contentType: "performance",
    tags: ["보컬", "라이브"],
    collab: false,
    collabRole: null,
    likes: 5,
    comments: 1,
    publishedHoursAgo: 2,
    expireHours: null,
    gradient: "from-sky-600 to-cyan-700",
    emoji: "🎙️",
  },
  {
    postId: "mock-completion-5",
    userId: "mock-user-5",
    name: "박지훈",
    school: "활동자",
    major: "드럼",
    caption: "드럼 커버 영상 새로 올려요, 이번엔 좀 빠른 곡으로",
    contentType: "performance",
    tags: ["드럼"],
    collab: false,
    collabRole: null,
    likes: 15,
    comments: 3,
    publishedHoursAgo: 9,
    expireHours: null,
    gradient: "from-amber-700 to-yellow-600",
    emoji: "🥁",
  },
  {
    postId: "mock-completion-6",
    userId: "mock-user-6",
    name: "최민아",
    school: "경희대",
    major: "피아노",
    caption: "쇼팽 녹턴 연주 영상입니다, 편안하게 들어주세요",
    contentType: "performance",
    tags: ["피아노", "클래식"],
    collab: false,
    collabRole: null,
    likes: 24,
    comments: 6,
    publishedHoursAgo: 14,
    expireHours: null,
    gradient: "from-emerald-700 to-teal-800",
    emoji: "🎹",
  },
  {
    postId: "mock-completion-7",
    userId: "mock-user-7",
    name: "김도윤",
    school: "서울대",
    major: "작곡",
    caption: "영화음악 샘플 트랙 공개합니다, 피드백 환영해요",
    contentType: "composition",
    tags: ["작곡", "필름스코어"],
    collab: false,
    collabRole: null,
    likes: 33,
    comments: 8,
    publishedHoursAgo: 26,
    expireHours: null,
    gradient: "from-orange-700 to-red-700",
    emoji: "🎬",
  },
  {
    postId: "mock-completion-8",
    userId: "mock-user-8",
    name: "강태오",
    school: "활동자",
    major: "베이스",
    caption: "베이스 솔로 챌린지 영상, 다들 한번 도전해보세요!",
    contentType: "improv",
    tags: ["베이스", "챌린지"],
    collab: false,
    collabRole: null,
    likes: 40,
    comments: 10,
    publishedHoursAgo: 40,
    expireHours: null,
    gradient: "from-fuchsia-700 to-pink-800",
    emoji: "🎸",
  },
];

function buildDemoMockPosts(
  samples: MockSample[],
  userMap: Map<string, { id: string; name: string }>,
  profileMap: Map<string, { user_id: string; school: string | null; major: string | null }>,
  likeCountMap: Map<string, number>,
  commentCountMap: Map<string, number>,
) {
  const now = Date.now();
  return samples.map((m) => {
    userMap.set(m.userId, { id: m.userId, name: m.name });
    profileMap.set(m.userId, { user_id: m.userId, school: m.school, major: m.major });
    likeCountMap.set(m.postId, m.likes);
    commentCountMap.set(m.postId, m.comments);
    return {
      id: m.postId,
      user_id: m.userId,
      video_url: "",
      caption: m.caption,
      content_type: m.contentType,
      instrument_tags: m.tags,
      visibility: "public" as const,
      collab_available: m.collab,
      collab_role_needed: m.collabRole,
      published_at: new Date(now - m.publishedHoursAgo * 3600 * 1000).toISOString(),
      expires_at: m.expireHours == null ? null : new Date(now + m.expireHours * 3600 * 1000).toISOString(),
      media_type: "video" as const,
      videoSrc: null,
      posterSrc: null,
      canViewMedia: true,
      isMock: true as const,
      gradient: m.gradient,
      emoji: m.emoji,
      demoVideoSrc: m.demoVideoSrc ?? null,
    };
  });
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const { feed: feedParam } = await searchParams;
  // Demo(전체공개, 노출영구) 기본값 · Complex(비공개, 노출시간필수 — 팔로워공개 또는 특정인 초대)는
  // 0012_complex_access_and_chat부터 실제 posts에 저장됨. visibility='public'이 demo, 그 외
  // ('followers'/'invite_only')가 Complex — 같은 posts 테이블을 이 컬럼으로 나눠서 쓴다.
  const isComplex = feedParam === "complex";

  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  let currentUserName = "나";
  if (currentUser) {
    const { data: me } = await supabase.from("users").select("name").eq("id", currentUser.id).single();
    if (me?.name) currentUserName = me.name;
  }

  const postsSelect =
    "id, user_id, video_url, image_url, audio_url, media_type, thumbnail_url, caption, content_type, instrument_tags, visibility, collab_available, collab_role_needed, published_at, expires_at";
  const postsQuery = supabase
    .from("posts")
    .select(postsSelect)
    .eq("status", "published")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  const { data: posts } = await (isComplex ? postsQuery.neq("visibility", "public") : postsQuery.eq("visibility", "public"))
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

  // Complex 전용 접근 제어 — followers/invite_only 게시물의 실제 열람 가능 여부를 계산한다.
  // posts 행 자체는(캡션/작성자/태그/노크 버튼) 모두에게 보이지만, 미디어 signed URL과 채팅은
  // 여기서 계산한 canViewMedia가 true일 때만 발급한다(0012 설계 — R2는 버킷 RLS가 없어서
  // 이 조건부 서명이 실제 프라이버시 경계).
  const followersPostAuthorIds = [
    ...new Set((posts ?? []).filter((p) => p.visibility === "followers").map((p) => p.user_id)),
  ];
  const inviteOnlyPostIds = (posts ?? []).filter((p) => p.visibility === "invite_only").map((p) => p.id);

  let followingAuthorIds = new Set<string>();
  if (currentUser && followersPostAuthorIds.length > 0) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", currentUser.id)
      .in("followee_id", followersPostAuthorIds);
    followingAuthorIds = new Set((followRows ?? []).map((f) => f.followee_id));
  }

  // post_access_select_self_or_author RLS 덕분에 이 한 번의 조회로 (a) 내 열람 권한 판정과
  // (b) 내가 작성자인 글의 초대자/대기 노크 명단이 동시에 채워진다 — 내 행은 항상 보이고,
  // 내가 쓴 글이면 그 글의 모든 행이 보이지만, 남의 글의 다른 사람 행은 안 보인다.
  let accessRows: { post_id: string; user_id: string; status: string }[] = [];
  if (currentUser && inviteOnlyPostIds.length > 0) {
    const { data } = await supabase
      .from("post_access")
      .select("post_id, user_id, status")
      .in("post_id", inviteOnlyPostIds);
    accessRows = data ?? [];
  }
  const accessUserIds = [...new Set(accessRows.map((r) => r.user_id))];
  const { data: accessUsers } =
    accessUserIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", accessUserIds)
      : { data: [] };
  const accessNameMap = new Map((accessUsers ?? []).map((u) => [u.id, u.name]));

  function canViewMediaFor(post: { id: string; user_id: string; visibility: string }): boolean {
    if (!isComplex) return true;
    if (post.visibility === "public") return true;
    if (!currentUser) return false;
    if (post.user_id === currentUser.id) return true;
    if (post.visibility === "followers") return followingAuthorIds.has(post.user_id);
    if (post.visibility === "invite_only") {
      return accessRows.some(
        (r) =>
          r.post_id === post.id &&
          r.user_id === currentUser.id &&
          (r.status === "invited" || r.status === "accepted"),
      );
    }
    return false;
  }

  // 열람 가능한 Complex 게시물의 채팅+재창작물 스택을 서버에서 미리 가져온다(초기 렌더용 —
  // ComplexPostChat의 "새로고침" 버튼만 /api/complex/chat을 다시 부른다).
  const accessiblePostIds = isComplex ? (posts ?? []).filter((p) => canViewMediaFor(p)).map((p) => p.id) : [];
  const { data: chatRows } =
    accessiblePostIds.length > 0
      ? await supabase
          .from("post_chat_messages")
          .select("id, post_id, sender_id, type, content, file_key, is_work, created_at")
          .in("post_id", accessiblePostIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const chatSenderIds = [...new Set((chatRows ?? []).map((r) => r.sender_id))];
  const { data: chatSenders } =
    chatSenderIds.length > 0
      ? await supabase.from("users").select("id, name").in("id", chatSenderIds)
      : { data: [] };
  const chatSenderNameMap = new Map((chatSenders ?? []).map((u) => [u.id, u.name]));

  const chatMessagesByPost = new Map<string, ChatMessage[]>();
  for (const row of chatRows ?? []) {
    const fileUrl = row.file_key ? await getR2SignedUrl(row.file_key, SIGNED_URL_EXPIRY_SECONDS) : null;
    const message: ChatMessage = {
      id: row.id,
      senderId: row.sender_id,
      senderName: chatSenderNameMap.get(row.sender_id) ?? "알 수 없음",
      type: row.type,
      content: row.content,
      fileUrl,
      fileName: row.file_key ? (row.file_key.split("/").pop() ?? null) : null,
      isWork: row.is_work,
      createdAt: row.created_at,
    };
    const list = chatMessagesByPost.get(row.post_id) ?? [];
    list.push(message);
    chatMessagesByPost.set(row.post_id, list);
  }

  const postsWithVideo = await Promise.all(
    (posts ?? []).map(async (post) => {
      const canView = canViewMediaFor(post);
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = canView && mediaPath ? await getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS) : null;
      const posterSrc =
        canView && post.thumbnail_url ? await getR2SignedUrl(post.thumbnail_url, SIGNED_URL_EXPIRY_SECONDS) : null;
      return {
        ...post,
        videoSrc,
        posterSrc,
        canViewMedia: canView,
        isMock: false as const,
        gradient: "",
        emoji: "",
        demoVideoSrc: null,
      };
    }),
  );

  const mockPosts = isComplex
    ? []
    : buildDemoMockPosts(DEMO_MOCK_SAMPLES, userMap, profileMap, likeCountMap, commentCountMap);

  const allPosts = [...postsWithVideo, ...mockPosts].sort(
    (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
  );

  return (
    <main className="mx-auto max-w-[900px] px-0 pb-24 pt-0 md:px-4 md:pb-8 md:pt-4">
      {allPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-24">
          <span className="text-3xl">🎬</span>
          <p className="text-sm text-gray-400 dark:text-gray-500">아직 게시물이 없습니다</p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {allPosts.map((post) => {
          const author = userMap.get(post.user_id);
          const profile = profileMap.get(post.user_id);
          const isOwnPost = currentUser?.id === post.user_id;
          const buttonBasis = isOwnPost ? "basis-1/2" : "basis-1/3";
          const likeCount = likeCountMap.get(post.id) ?? 0;
          const commentCount = commentCountMap.get(post.id) ?? 0;
          const followersLocked = isComplex && post.visibility === "followers" && !post.canViewMedia;

          return (
            <article
              key={post.id}
              id={post.id}
              className="scroll-mt-20 overflow-hidden border-y border-gray-200 bg-white transition-shadow md:rounded-2xl md:border md:shadow-sm dark:border-gray-800 dark:bg-gray-950 target:ring-2 target:ring-red-400"
            >
              <PostEngagementProvider initialLikeCount={likeCount} initialCommentCount={commentCount}>
              <div className="flex items-center gap-2 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  {(author?.name ?? "?").slice(0, 1)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                    {author?.name ?? "알 수 없음"}
                  </span>
                  <span className="truncate text-xs text-gray-400 dark:text-gray-500">
                    {[profile?.school, profile?.major].filter(Boolean).join(" · ")}
                    {(profile?.school || profile?.major) && " · "}
                    {timeAgo(post.published_at ?? new Date().toISOString())}
                  </span>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isComplex
                      ? "bg-violet-900/50 text-violet-300"
                      : "bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500"
                  }`}
                >
                  {isComplex ? "🌀 Complex" : "♾️ demo"}
                </span>
              </div>

              {post.caption && (
                <p className="px-3 pb-2 text-sm text-gray-700 dark:text-gray-300">{post.caption}</p>
              )}

              {isComplex && post.visibility === "invite_only" ? (
                <ComplexAccessGate
                  postId={post.id}
                  authorName={author?.name ?? "알 수 없음"}
                  isOwnPost={isOwnPost}
                  currentUserId={currentUser?.id ?? ""}
                  currentUserName={currentUserName}
                  expiresAt={post.expires_at}
                  canViewMedia={post.canViewMedia}
                  videoSrc={post.videoSrc}
                  posterSrc={post.posterSrc}
                  mediaType={post.media_type}
                  invitedNames={
                    isOwnPost
                      ? accessRows
                          .filter(
                            (r) =>
                              r.post_id === post.id && (r.status === "invited" || r.status === "accepted"),
                          )
                          .map((r) => accessNameMap.get(r.user_id) ?? "알 수 없음")
                      : []
                  }
                  initialKnocked={
                    !!currentUser &&
                    accessRows.some(
                      (r) => r.post_id === post.id && r.user_id === currentUser.id && r.status === "pending",
                    )
                  }
                  initialPendingRequests={
                    isOwnPost
                      ? accessRows
                          .filter((r) => r.post_id === post.id && r.status === "pending")
                          .map((r) => ({ userId: r.user_id, name: accessNameMap.get(r.user_id) ?? "알 수 없음" }))
                      : []
                  }
                  contentTypeLabel={post.content_type ? CONTENT_TYPE_LABEL[post.content_type] : null}
                  tags={post.instrument_tags ?? []}
                  collabAvailable={post.collab_available}
                  collabRoleNeeded={post.collab_role_needed}
                  initialChatMessages={chatMessagesByPost.get(post.id) ?? []}
                />
              ) : (
                <>
                  {isComplex && post.visibility === "followers" && (
                    <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-violet-500 dark:text-violet-300">
                      <span>🔒 팔로워 공개</span>
                    </div>
                  )}

                  <div className="relative flex items-center justify-center bg-black">
                    {post.expires_at && (
                      <div className="absolute left-3 top-3 z-10">
                        <TimeLimitBadge expiresAt={post.expires_at} />
                      </div>
                    )}
                    {!isComplex && (
                      <div className="absolute right-3 top-3 z-10">
                        <EngagementMeter />
                      </div>
                    )}

                    {followersLocked ? (
                      <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-center">
                        <span className="text-4xl">🔒</span>
                        <p className="max-w-xs text-sm text-gray-300">
                          {author?.name ?? "작성자"}님을 팔로우하면 이 게시물을 볼 수 있어요.
                        </p>
                      </div>
                    ) : post.isMock ? (
                      <div
                        className={`relative flex h-[420px] w-full items-center justify-center bg-gradient-to-br text-6xl ${post.gradient}`}
                      >
                        {post.emoji}
                        {post.demoVideoSrc && (
                          <MockPlayOverlay
                            postId={post.id}
                            title={post.caption}
                            author={author?.name ?? "알 수 없음"}
                            videoSrc={post.demoVideoSrc}
                          />
                        )}
                      </div>
                    ) : post.videoSrc && post.media_type === "image" ? (
                      <img
                        src={post.videoSrc}
                        alt={post.caption ?? "이미지 게시물"}
                        className="max-h-[780px] w-auto object-contain"
                      />
                    ) : post.videoSrc && post.media_type === "audio" ? (
                      <div className="flex w-full flex-col items-center gap-3 p-4">
                        {post.posterSrc ? (
                          <img
                            src={post.posterSrc}
                            alt={post.caption ?? "커버 이미지"}
                            className="max-h-[420px] w-auto rounded-xl object-contain"
                          />
                        ) : (
                          <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-gray-800 text-5xl">
                            🎵
                          </div>
                        )}
                        <audio src={post.videoSrc} controls className="w-full max-w-md" />
                      </div>
                    ) : post.videoSrc ? (
                      <PostVideo
                        postId={post.id}
                        title={post.caption || (post.content_type && CONTENT_TYPE_LABEL[post.content_type]) || "영상"}
                        author={author?.name ?? "알 수 없음"}
                        videoSrc={post.videoSrc}
                        posterSrc={post.posterSrc}
                      />
                    ) : (
                      <p className="py-24 text-sm text-gray-400">미디어를 불러올 수 없습니다</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                    {post.content_type && (
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                        {CONTENT_TYPE_LABEL[post.content_type]}
                      </span>
                    )}
                    {(post.instrument_tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2 py-1 text-xs font-medium ${tagColorClass(tag)}`}
                      >
                        #{tag}
                      </span>
                    ))}
                    {post.collab_available && (
                      <span className="rounded-full bg-black px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-black">
                        🤝 협업 구함{post.collab_role_needed ? `: ${post.collab_role_needed}` : ""}
                      </span>
                    )}
                  </div>

                  {followersLocked ? (
                    <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                      🔒 팔로우한 사람만 채팅과 작업물을 볼 수 있어요
                    </div>
                  ) : isComplex ? (
                    <ComplexPostChat
                      postId={post.id}
                      currentUserId={currentUser?.id ?? ""}
                      currentUserName={currentUserName}
                      originalMediaType={post.media_type}
                      initialMessages={chatMessagesByPost.get(post.id) ?? []}
                      collabAvailable={post.collab_available}
                    />
                  ) : post.isMock ? (
                    <div
                      className="flex items-center gap-6 border-t border-gray-100 px-4 py-3.5 text-base font-semibold text-gray-600 dark:border-gray-800 dark:text-gray-300"
                      title="샘플 게시물이라 실제로 누를 수는 없어요"
                    >
                      <span>❤️ 좋아요 {likeCount}</span>
                      <span>💬 댓글 {commentCount}</span>
                    </div>
                  ) : (
                currentUser && (
                  <div className="flex flex-wrap border-t border-gray-100">
                    <LikeButton
                      postId={post.id}
                      userId={currentUser.id}
                      initialLiked={likedByMeSet.has(post.id)}
                      className={buttonBasis}
                    />
                    <CommentPanel postId={post.id} userId={currentUser.id} buttonClassName={buttonBasis} />
                    {!isOwnPost && (
                      <MessageButton
                        currentUserId={currentUser.id}
                        otherUserId={post.user_id}
                        sourcePostId={post.id}
                        className={`flex items-center justify-center gap-2 py-3.5 text-base font-semibold text-gray-600 transition hover:bg-gray-50 ${buttonBasis}`}
                      >
                        <span className="text-lg">✉️</span>
                        메시지
                      </MessageButton>
                    )}
                  </div>
                )
              )}
                </>
              )}
              </PostEngagementProvider>
            </article>
          );
        })}
      </div>
    </main>
  );
}
