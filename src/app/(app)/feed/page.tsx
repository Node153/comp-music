import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { MessageButton } from "@/components/MessageButton";
import { EngagementMeter } from "@/components/EngagementMeter";
import { PostEngagementProvider } from "@/components/PostEngagementContext";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { PostVideo } from "@/components/PostVideo";
import { MockPlayOverlay } from "@/components/MockPlayOverlay";
import { ComplexPostChat } from "@/components/ComplexPostChat";
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

// 샘플 게시물 — 실제 업로드 없이 볼륨미터/PEAK/타임리밋 UI를 바로 확인할 수 있도록 넣은 데모 데이터.
// isMock 게시물은 DB에 실제 row가 없어 좋아요/댓글 버튼을 누를 수 없고 숫자만 정적으로 보여준다.
// Demo(전체공개, 노출영구·완성작) / Complex(비공개, 노출시간필수·raw — 공개범위는 팔로워공개
// 또는 특정인 초대 중 하나) 두 세트로 분리.
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
  // Complex 전용 — 공개범위 두 옵션. "followers"는 팔로워 전체 공개, "specific"은 invitedNames로
  // 지정한 특정 인원만 공개. 초대 UI 자체는 아직 없고 이 필드로 두 옵션을 구분해서 보여주는 단계.
  visibility?: "followers" | "specific";
  invitedNames?: string[]; // visibility가 "specific"일 때만 사용 — 초대된 특정 인원 이름 목록
  pendingKnockNames?: string[]; // visibility가 "specific"일 때만 사용 — 이미 노크(열람 요청)를 보낸 미초대 인원 데모용 시드
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

const COMPLEX_MOCK_SAMPLES: MockSample[] = [
  {
    postId: "mock-complex-1",
    userId: "mock-user-1",
    name: "정하늘",
    school: "서울대",
    major: "작곡과",
    caption: "새벽에 혼자 연습하다 녹음한 거... 친한 사람들만 들어줘 ㅠㅠ",
    contentType: "practice",
    tags: ["피아노"],
    collab: false,
    collabRole: null,
    likes: 4,
    comments: 2,
    publishedHoursAgo: 1,
    expireHours: 6,
    gradient: "from-neutral-600 to-neutral-800",
    emoji: "😳",
    visibility: "specific",
    invitedNames: ["오세준", "한지민"],
    // 노크(열람 요청)가 이미 하나 와있는 상태를 데모하기 위한 시드 — 개별 수락/거절 UI 확인용.
    pendingKnockNames: ["강태오"],
  },
  {
    postId: "mock-complex-2",
    userId: "mock-user-2",
    name: "오세준",
    school: "한예종",
    major: "실용음악과",
    caption: "리허설 날것 그대로임, 팔로워들한테만 공개할게요",
    contentType: "rehearsal",
    tags: ["기타"],
    collab: true,
    collabRole: "베이스",
    likes: 9,
    comments: 5,
    publishedHoursAgo: 2,
    expireHours: 3,
    gradient: "from-violet-800 to-fuchsia-900",
    emoji: "🙈",
    visibility: "followers",
  },
  {
    postId: "mock-complex-3",
    userId: "mock-user-3",
    name: "한지민",
    school: "활동자",
    major: "보컬",
    caption: "가사 쓰다 막혀서 넋두리... 아무한테도 말 안 했던 얘기",
    contentType: "practice",
    tags: ["보컬"],
    collab: false,
    collabRole: null,
    likes: 6,
    comments: 3,
    publishedHoursAgo: 4,
    expireHours: 12,
    gradient: "from-red-800 to-neutral-900",
    emoji: "🫣",
    visibility: "specific",
    invitedNames: ["정하늘", "오세준"],
  },
];

function buildMockPosts(
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
      collab_available: m.collab,
      collab_role_needed: m.collabRole,
      published_at: new Date(now - m.publishedHoursAgo * 3600 * 1000).toISOString(),
      expires_at: m.expireHours == null ? null : new Date(now + m.expireHours * 3600 * 1000).toISOString(),
      videoSrc: null,
      isMock: true as const,
      gradient: m.gradient,
      emoji: m.emoji,
      demoVideoSrc: m.demoVideoSrc ?? null,
      visibility: m.visibility ?? null,
      invitedNames: m.invitedNames ?? null,
      pendingKnockNames: m.pendingKnockNames ?? null,
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
  // 아직 실제 비공개 게시물이 없어서(초대 UI·DB 연동은 Phase 1 예정) 샘플 게시물로만 UI를 보여준다.
  const isComplex = feedParam === "complex";

  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data: posts } = isComplex
    ? { data: [] }
    : await supabase
        .from("posts")
        .select(
          "id, user_id, video_url, image_url, audio_url, media_type, thumbnail_url, caption, content_type, instrument_tags, collab_available, collab_role_needed, published_at, expires_at",
        )
        .eq("status", "published")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
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

  const postsWithVideo = await Promise.all(
    (posts ?? []).map(async (post) => {
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = mediaPath ? await getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS) : null;
      const posterSrc = post.thumbnail_url
        ? await getR2SignedUrl(post.thumbnail_url, SIGNED_URL_EXPIRY_SECONDS)
        : null;
      return {
        ...post,
        videoSrc,
        posterSrc,
        isMock: false as const,
        gradient: "",
        emoji: "",
        demoVideoSrc: null,
        visibility: null,
        invitedNames: null,
        pendingKnockNames: null,
      };
    }),
  );

  const mockPosts = buildMockPosts(
    isComplex ? COMPLEX_MOCK_SAMPLES : DEMO_MOCK_SAMPLES,
    userMap,
    profileMap,
    likeCountMap,
    commentCountMap,
  );

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

              {isComplex && post.visibility === "specific" && post.isMock ? (
                <ComplexAccessGate
                  postId={post.id}
                  authorName={author?.name ?? "알 수 없음"}
                  isOwnPost={isOwnPost}
                  expiresAt={post.expires_at}
                  initialInvitedNames={post.invitedNames ?? []}
                  initialPendingNames={post.pendingKnockNames ?? []}
                  gradient={post.gradient}
                  emoji={post.emoji}
                  contentTypeLabel={post.content_type ? CONTENT_TYPE_LABEL[post.content_type] : null}
                  tags={post.instrument_tags ?? []}
                  collabAvailable={post.collab_available}
                  collabRoleNeeded={post.collab_role_needed}
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

                    {post.isMock ? (
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

                  {isComplex && post.isMock ? (
                    <ComplexPostChat
                      postId={post.id}
                      authorName={author?.name ?? "알 수 없음"}
                      participants={post.invitedNames ?? []}
                      originalGradient={post.gradient}
                      originalEmoji={post.emoji}
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
