import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyUserRow } from "@/lib/auth";
import { getAdminIds } from "@/lib/admins";
import { getR2SignedUrl, resolveMediaUrl } from "@/lib/r2/storage";
import { MessageButton } from "@/components/MessageButton";
import { EngagementMeter } from "@/components/EngagementMeter";
import { PostEngagementProvider } from "@/components/PostEngagementContext";
import { PostVideo } from "@/components/PostVideo";
import { MockPlayOverlay } from "@/components/MockPlayOverlay";
import { SoundbarPlayer } from "@/components/SoundbarPlayer";
import { ComplexPostChat, type ChatMessage } from "@/components/ComplexPostChat";
import { ComplexAccessGate } from "@/components/ComplexAccessGate";
import { PostFocusToggle } from "@/components/PostFocusToggle";
import { MemoGuideCards } from "@/components/MemoGuideCards";
import { FeedHero } from "@/components/FeedHero";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { PostViewedBy } from "@/components/PostViewedBy";
import { LikeButton } from "./LikeButton";
import { CommentPanel } from "./CommentPanel";
import { GuestEngagementRow } from "./GuestEngagementRow";
import type { ContentType } from "@/types/database";
import { tagColorClass, peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";
import { timeAgo } from "@/lib/timeAgo";
import { HeartIcon, CommentIcon, UsersIcon, MailIcon } from "@/components/icons";

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

// Demo(전체공개) 전용 샘플 게시물 — 실제 업로드 없이 볼륨미터/PEAK/타임리밋 UI를 바로 확인할 수
// 있도록 넣은 데모 데이터. isMock 게시물은 DB에 실제 row가 없어 좋아요/댓글 버튼을 누를 수 없고
// 숫자만 정적으로 보여준다. Complex(팔로워공개/특정인초대)는 0012_complex_access_and_chat부터
// 실제 posts/post_access/post_chat_messages로 연동돼서 더 이상 mock 샘플이 없다.
type MockSample = {
  postId: string;
  userId: string;
  name: string;
  school: string;
  positions: string[];
  caption: string;
  contentType: ContentType;
  tags: string[];
  collab: boolean;
  collabRole: string | null;
  // 좋아요를 고정 숫자로 박아두면 회원이 늘/줄 때마다 "회원 10명인데 좋아요 71개" 같은 비현실적인
  // 숫자가 되고, PEAK 기준(회원수/3)도 그때그때 달라져서 매번 다시 손봐야 한다 — 그래서 절대값
  // 대신 peakThreshold 대비 배수로 갖고 있다가 렌더 시점에 실제 회원 수 기준으로 계산한다.
  // (아래 목록은 배수를 오름차순으로 둬서 미터가 초록/노랑/빨강/PEAK 구간을 골고루 보여준다.)
  likesMultiplier: number;
  // 댓글 수 = 좋아요 수 × 이 비율(원래 데이터의 댓글/좋아요 비율을 그대로 유지).
  commentRatio: number;
  publishedHoursAgo: number;
  expireHours: number | null;
  gradient: string;
  demoVideoSrc?: string;
};

const DEMO_MOCK_SAMPLES: MockSample[] = [
  {
    postId: "mock-completion-1",
    userId: "mock-user-1",
    name: "정하늘",
    school: "서울대",
    positions: ["작곡"],
    caption: "드디어 완성한 첫 발라드 싱글, 앨범 커버까지 다 뽑았어요!",
    contentType: "composition",
    tags: ["피아노", "발라드"],
    collab: false,
    collabRole: null,
    likesMultiplier: 0.65,
    commentRatio: 0.28,
    publishedHoursAgo: 20,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
  },
  {
    postId: "mock-completion-2",
    userId: "mock-user-2",
    name: "오세준",
    school: "한예종",
    positions: ["기타"],
    caption: "6개월 준비한 합주 영상 최종본 공개합니다",
    contentType: "ensemble",
    tags: ["기타", "밴드"],
    collab: false,
    collabRole: null,
    likesMultiplier: 1.0,
    commentRatio: 0.24,
    publishedHoursAgo: 30,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
  },
  {
    postId: "mock-completion-3",
    userId: "mock-user-3",
    name: "한지민",
    school: "활동자",
    positions: ["보컬"],
    caption: "제 보컬 커버 정식 업로드했어요, 많이 들어주세요!",
    contentType: "performance",
    tags: ["보컬"],
    collab: false,
    collabRole: null,
    likesMultiplier: 1.4,
    commentRatio: 0.35,
    publishedHoursAgo: 5,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
    // Demo 게시물만 우선 재생 가능하게 테스트하기 위한 데모 오디오(하단 GlobalPlayerBar 확인용).
    demoVideoSrc: "/demo-completion-track.wav",
  },
  // 아래 5개는 반응량이 서로 달라서 미터가 초록/노랑/빨강/PEAK 구간을 골고루 보여주도록 넣은 샘플.
  {
    postId: "mock-completion-4",
    userId: "mock-user-4",
    name: "이서연",
    school: "한예종",
    positions: ["보컬"],
    caption: "첫 라이브 클립 편집 완료! 떨렸지만 재밌었어요",
    contentType: "performance",
    tags: ["보컬", "라이브"],
    collab: false,
    collabRole: null,
    likesMultiplier: 0.1,
    commentRatio: 0.2,
    publishedHoursAgo: 2,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
  },
  {
    postId: "mock-completion-5",
    userId: "mock-user-5",
    name: "박지훈",
    school: "활동자",
    positions: ["드럼"],
    caption: "드럼 커버 영상 새로 올려요, 이번엔 좀 빠른 곡으로",
    contentType: "performance",
    tags: ["드럼"],
    collab: false,
    collabRole: null,
    likesMultiplier: 0.3,
    commentRatio: 0.2,
    publishedHoursAgo: 9,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
  },
  {
    postId: "mock-completion-6",
    userId: "mock-user-6",
    name: "최민아",
    school: "경희대",
    positions: ["피아노/건반"],
    caption: "쇼팽 녹턴 연주 영상입니다, 편안하게 들어주세요",
    contentType: "performance",
    tags: ["피아노", "클래식"],
    collab: false,
    collabRole: null,
    likesMultiplier: 0.5,
    commentRatio: 0.25,
    publishedHoursAgo: 14,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
  },
  {
    postId: "mock-completion-7",
    userId: "mock-user-7",
    name: "김도윤",
    school: "서울대",
    positions: ["작곡"],
    caption: "영화음악 샘플 트랙 공개합니다, 피드백 환영해요",
    contentType: "composition",
    tags: ["작곡", "필름스코어"],
    collab: false,
    collabRole: null,
    likesMultiplier: 0.7,
    commentRatio: 0.24,
    publishedHoursAgo: 26,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
  },
  {
    postId: "mock-completion-8",
    userId: "mock-user-8",
    name: "강태오",
    school: "활동자",
    positions: ["베이스"],
    caption: "베이스 솔로 챌린지 영상, 다들 한번 도전해보세요!",
    contentType: "improv",
    tags: ["베이스", "챌린지"],
    collab: false,
    collabRole: null,
    likesMultiplier: 0.85,
    commentRatio: 0.25,
    publishedHoursAgo: 40,
    expireHours: null,
    gradient: "from-gray-700 to-gray-900",
  },
];

function buildDemoMockPosts(
  samples: MockSample[],
  userMap: Map<string, { id: string; name: string }>,
  profileMap: Map<
    string,
    { user_id: string; school: string | null; school_public: boolean; instruments: string[] | null }
  >,
  likeCountMap: Map<string, number>,
  commentCountMap: Map<string, number>,
  weeklyLikeCountMap: Map<string, number>,
  peakThreshold: number,
  approvedMemberCount: number,
) {
  const now = Date.now();
  return samples.map((m) => {
    userMap.set(m.userId, { id: m.userId, name: m.name });
    profileMap.set(m.userId, { user_id: m.userId, school: m.school, school_public: true, instruments: m.positions });
    // likesMultiplier × 현재 peakThreshold로 계산 — 좋아요 수가 승인 회원 수를 넘는 비현실적인
    // 상황이 안 나오게 approvedMemberCount로 한 번 더 clamp한다(실제 likes 테이블도
    // post_id+user_id 유니크라 회원 수 이상은 물리적으로 불가능).
    const likes = Math.max(0, Math.min(approvedMemberCount, Math.round(peakThreshold * m.likesMultiplier)));
    const comments = Math.round(likes * m.commentRatio);
    likeCountMap.set(m.postId, likes);
    commentCountMap.set(m.postId, comments);
    // mock 게시물은 개별 좋아요 row(created_at)가 없어서 "이번 주" 구분이 불가능 — 전체
    // 좋아요 수를 그대로 이번 주 수로도 쓴다(볼륨미터 데모 목적이니 근사치로 충분).
    weeklyLikeCountMap.set(m.postId, likes);
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
      demoVideoSrc: m.demoVideoSrc ?? null,
    };
  });
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string; tag?: string }>;
}) {
  const { feed: feedParam, tag: tagParam } = await searchParams;
  // Demo(전체공개, 노출영구) 기본값 · Complex(비공개, 노출시간필수 — 팔로워공개 또는 특정인 초대)는
  // 0012_complex_access_and_chat부터 실제 posts에 저장됨. visibility='public'이 demo, 그 외
  // ('followers'/'invite_only')가 Complex — 같은 posts 테이블을 이 컬럼으로 나눠서 쓴다.
  const isComplex = feedParam === "complex";

  const supabase = await createClient();

  // getCurrentUser()는 (app)/feed 레이아웃과 같은 요청 스코프 캐시 — 여기서 또 불러도
  // 실제 auth 왕복은 추가로 안 생긴다(예전엔 미들웨어 포함 요청당 4번 검증했다).
  const currentUser = await getCurrentUser();

  // 로그인 전 미리보기(Instagram 참고) — DEMO는 비로그인 방문자에게도 열지만, memo는
  // Companion 전용 공간이라 존재 형태조차 안 보여주고 완전히 잠근다(0024_public_feed_preview).
  if (isComplex && !currentUser) {
    return (
      <main className="mx-auto flex max-w-[900px] flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          memo는 아는 사람들끼리만 보는 공간이에요
        </p>
        <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">
          가입하고 Companion을 만들면 서로의 비공개 작업물을 볼 수 있어요. 미리 어떤 걸
          할 수 있는지 보여드릴게요.
        </p>
        <div className="mt-2 w-full">
          <MemoGuideCards />
        </div>
        <Link
          href="/signup"
          className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          가입하기
        </Link>
      </main>
    );
  }

  const me = currentUser ? await getMyUserRow() : null;
  const currentUserName = me?.name || "나";

  const postsSelect =
    "id, user_id, video_url, image_url, audio_url, media_type, thumbnail_url, caption, content_type, instrument_tags, visibility, collab_available, collab_role_needed, published_at, expires_at";
  const postsQuery = supabase
    .from("posts")
    .select(postsSelect)
    .eq("status", "published")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  // rawPosts와 내 Companion 목록은 서로 독립이라 병렬로 — 예전엔 순차 await였다.
  // 내 Companion(맞팔, 0017): 아래 "Companion 공개" 필터와 invite_only 노크 가능 여부
  // (방장과 Companion인가) 판정에 함께 쓴다.
  const [{ data: rawPosts }, { data: companionRows }] = await Promise.all([
    (isComplex ? postsQuery.neq("visibility", "public") : postsQuery.eq("visibility", "public"))
      .order("published_at", { ascending: false })
      .limit(FEED_LIMIT),
    currentUser && isComplex
      ? supabase
          .from("companions")
          .select("requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
      : Promise.resolve({ data: [] as { requester_id: string; addressee_id: string }[] }),
  ]);

  const myCompanionIds = new Set(
    (companionRows ?? []).map((r) =>
      r.requester_id === currentUser?.id ? r.addressee_id : r.requester_id,
    ),
  );

  // memo 원래 취지("팔로우한 사람의 게시물만 보임")대로, "Companion 공개"(followers)와
  // "특정인 초대"(invite_only) 둘 다 방장과 Companion인 사람(또는 본인)에게만 노출 — 아닌
  // 사람에게는 잠긴 티저조차 보여주지 않고 피드에서 아예 뺀다. invite_only의 노크는 그
  // "Companion 사이"에서 방장이 아직 초대 안 한 특정 게시물의 콘텐츠(미디어/채팅)에 대한
  // 별도의 더 좁은 접근 요청일 뿐, 존재 자체를 비Companion에게 공개하는 수단이 아니다.
  const posts = (rawPosts ?? []).filter((p) => {
    if (!isComplex) return true;
    if (currentUser?.id === p.user_id) return true;
    return myCompanionIds.has(p.user_id);
  });

  const postIds = posts.map((p) => p.id);
  const userIds = [...new Set(posts.map((p) => p.user_id))];

  // 이름 표시는 전부 user_display 뷰(0018) — 뷰어가 Companion이면 실명, 아니면 닉네임이 내려온다.
  // 비로그인 방문자는 누구의 Companion도 될 수 없고 user_display 자체가 "승인된 뷰어" 전제라
  // 행을 안 내려주므로, 훨씬 좁은 public_post_authors(0024, 닉네임만) 뷰를 대신 쓴다.
  // 게시물 목록이 정해지면 그에 딸린 조회들(작성자·프로필·좋아요·댓글)과 PEAK 기준치용
  // 회원 수는 서로 독립이라 한 번에 병렬로 — 예전엔 5개를 순차 await 했다.
  // 이름 표시는 user_display 뷰(0018) — 뷰어가 Companion이면 실명, 아니면 닉네임. 비로그인
  // 방문자는 user_display가 행을 안 내려주므로 public_post_authors(0024, 닉네임만)를 쓴다.
  const [
    { data: users },
    { data: profiles },
    { data: likeRows },
    { data: commentRows },
    { count: approvedMemberCount },
  ] = await Promise.all([
    userIds.length > 0
      ? currentUser
        ? supabase.from("user_display").select("id, display_name").in("id", userIds)
        : supabase.from("public_post_authors").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string }[] },
    userIds.length > 0
      ? supabase.from("profiles").select("user_id, school, school_public, instruments").in("user_id", userIds)
      : { data: [] as { user_id: string; school: string | null; school_public: boolean; instruments: string[] | null }[] },
    postIds.length > 0
      ? supabase.from("likes").select("post_id, user_id, created_at").in("post_id", postIds)
      : { data: [] as { post_id: string; user_id: string; created_at: string }[] },
    postIds.length > 0
      ? supabase.from("comments").select("post_id").in("post_id", postIds)
      : { data: [] as { post_id: string }[] },
    supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "approved").neq("role", "admin"),
  ]);

  const userMap = new Map((users ?? []).map((u) => [u.id, { id: u.id, name: u.display_name }]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const peakThreshold = peakThresholdFromMemberCount(approvedMemberCount ?? 0);
  const adminIds = await getAdminIds();
  const weekStartISO = currentWeekStartISO();

  const likeCountMap = new Map<string, number>();
  // PEAK 판정 전용 — 이번 주(캘린더) 좋아요만. likeCountMap(화면에 보이는 전체 누적 수)와는 별개.
  const weeklyLikeCountMap = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const row of likeRows ?? []) {
    likeCountMap.set(row.post_id, (likeCountMap.get(row.post_id) ?? 0) + 1);
    if (row.created_at >= weekStartISO) {
      weeklyLikeCountMap.set(row.post_id, (weeklyLikeCountMap.get(row.post_id) ?? 0) + 1);
    }
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
  const inviteOnlyPostIds = posts.filter((p) => p.visibility === "invite_only").map((p) => p.id);

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
      ? await supabase.from("user_display").select("id, display_name").in("id", accessUserIds)
      : { data: [] };
  const accessNameMap = new Map((accessUsers ?? []).map((u) => [u.id, u.display_name]));

  function canViewMediaFor(post: { id: string; user_id: string; visibility: string }): boolean {
    if (!isComplex) return true;
    if (post.visibility === "public") return true;
    if (!currentUser) return false;
    if (post.user_id === currentUser.id) return true;
    if (post.visibility === "followers") return myCompanionIds.has(post.user_id);
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

  // 노크 UI 참여자 요약(0020) — 방장 본인이 아닌 뷰어에게 "OO, XX...에게 공개" 문구.
  // 아직 참여자가 아니면(!canViewMedia, 아직 초대/노크 안 됨) 내 Companion 이름만 밝히고
  // 나머지는 "외 n명"으로 뭉뚱그린다 — 아직 못 들어간 방의 손님 명단을 함부로 공개하지 않기
  // 위해서다. 이미 참여자면(canViewMedia) 전원을 이름(Companion=실명, 아니면 닉네임)으로
  // 보여준다. knock_context는 항상 전체 참여자+Companion 여부를 반환하지만, 어느 형태로
  // 보여줄지는 여기 서버에서 결정해 최종 문자열만 클라이언트로 내려보낸다 — 그래야 아직
  // 참여 전인 뷰어에게 비Companion 참여자의 닉네임이 응답 페이로드로라도 새지 않는다.
  // 방장 본인은 별도의 invitedNames 경로로 이미 전체 명단을 보고 있어 대상에서 제외.
  const participantSummaryByPost = new Map<string, string>();
  if (currentUser && isComplex) {
    const inviteOnlyForOthers = posts.filter(
      (p) => p.visibility === "invite_only" && p.user_id !== currentUser.id,
    );
    await Promise.all(
      inviteOnlyForOthers.map(async (p) => {
        const { data } = await supabase.rpc("knock_context", { pid: p.id });
        const rows = data ?? [];
        if (rows.length === 0) return;

        if (canViewMediaFor(p)) {
          participantSummaryByPost.set(p.id, `${rows.map((r) => r.display_name).join(", ")}에게 공개`);
          return;
        }

        const companionNames = rows.filter((r) => r.is_companion).map((r) => r.display_name);
        const otherCount = rows.length - companionNames.length;
        const summary =
          companionNames.length > 0
            ? `${companionNames.join(", ")}${otherCount > 0 ? ` 외 ${otherCount}명` : ""}에게 공개`
            : `${otherCount}명에게 공개`;
        participantSummaryByPost.set(p.id, summary);
      }),
    );
  }

  // 열람 가능한 Complex 게시물의 채팅+재창작물 스택을 서버에서 미리 가져온다(초기 렌더용 —
  // ComplexPostChat의 "새로고침" 버튼만 /api/complex/chat을 다시 부른다).
  const accessiblePostIds = isComplex ? posts.filter((p) => canViewMediaFor(p)).map((p) => p.id) : [];
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
      ? await supabase.from("user_display").select("id, display_name").in("id", chatSenderIds)
      : { data: [] };
  const chatSenderNameMap = new Map((chatSenders ?? []).map((u) => [u.id, u.display_name]));

  // 첨부 파일 signed URL은 서로 독립이라 한꺼번에 서명한다 — 예전엔 메시지마다 순차 await.
  const chatMessagesByPost = new Map<string, ChatMessage[]>();
  const builtMessages = await Promise.all(
    (chatRows ?? []).map(async (row): Promise<ChatMessage & { post_id: string }> => ({
      post_id: row.post_id,
      id: row.id,
      senderId: row.sender_id,
      senderName: chatSenderNameMap.get(row.sender_id) ?? "알 수 없음",
      type: row.type,
      content: row.content,
      fileUrl: row.file_key ? await getR2SignedUrl(row.file_key, SIGNED_URL_EXPIRY_SECONDS) : null,
      fileName: row.file_key ? (row.file_key.split("/").pop() ?? null) : null,
      fileKey: row.file_key,
      isWork: row.is_work,
      createdAt: row.created_at,
    })),
  );
  for (const { post_id, ...message } of builtMessages) {
    const list = chatMessagesByPost.get(post_id) ?? [];
    list.push(message);
    chatMessagesByPost.set(post_id, list);
  }

  const postsWithVideo = await Promise.all(
    posts.map(async (post) => {
      const canView = canViewMediaFor(post);
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = canView && mediaPath ? await getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS) : null;
      const posterSrc =
        canView && post.thumbnail_url ? await resolveMediaUrl(post.thumbnail_url, SIGNED_URL_EXPIRY_SECONDS) : null;
      return {
        ...post,
        videoSrc,
        posterSrc,
        canViewMedia: canView,
        isMock: false as const,
        gradient: "",
        demoVideoSrc: null,
      };
    }),
  );

  const mockPosts = isComplex
    ? []
    : buildDemoMockPosts(
        DEMO_MOCK_SAMPLES,
        userMap,
        profileMap,
        likeCountMap,
        commentCountMap,
        weeklyLikeCountMap,
        peakThreshold,
        approvedMemberCount ?? 0,
      );

  const allPostsUnfiltered = [...postsWithVideo, ...mockPosts].sort(
    (a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
  );
  // 해시태그 클릭 시 그 태그가 달린 게시물만 보기(DEMO 전용 — memo는 태그 개념이 없음).
  // 목록을 DB에서부터 다시 걸러오는 대신 이미 불러온 목록을 한 번 더 좁히는 방식 — feed가
  // 어차피 최근 20개 + mock 소량이라 성능상 문제없고, mock 게시물도 똑같이 걸러진다.
  const allPosts = tagParam
    ? allPostsUnfiltered.filter((p) => (p.instrument_tags ?? []).includes(tagParam))
    : allPostsUnfiltered;

  // DEMO 피드 상단 힐링 멘트(관리자가 /admin/feed-hero에서 편집) — 히어로가 실제로 뜰
  // 조건일 때만 조회한다.
  const showHero = !isComplex && !tagParam && allPosts.length > 0;
  const { data: heroRows } = showHero
    ? await supabase
        .from("feed_hero_messages")
        .select("question, answer")
        .eq("active", true)
        .order("sort_order", { ascending: true })
    : { data: [] as { question: string; answer: string }[] };
  const heroMessages = (heroRows ?? []).map((r) => ({ q: r.question, a: r.answer }));

  // 한 게시물 = 한 화면. 게시물마다 고정 프레임 높이 안에 컴팩트하게 담고 세로 가운데 정렬한다.
  //   · 모바일(md 미만): 릴스/쇼츠식 스냅 스크롤. 프레임 = 100svh − MobileTopBar(h-12) −
  //     BottomNav(h-14) − iOS 하단 세이프에어리어. dvh가 아니라 svh인 이유: 주소창이 보일 때
  //     (가장 작을 때) 기준으로 잡아야 좋아요/댓글 줄이 하단 탭바 뒤로 안 잘림.
  //   · 데스크톱(md 이상): 스냅은 없이 일반 스크롤이지만 카드 높이는 똑같이 고정한다.
  //     프레임 = 100dvh − TopNav(h-14) − 상하 여백(≈ 3.5rem) = 100dvh − 7rem.
  //   · 비로그인 미리보기는 상단바/탭바 구성이 달라(GuestTopNav만) 높이 계산이 어긋나므로
  //     기존 카드 피드(자연 높이)를 그대로 둔다.
  const oneScreenFeed = !!currentUser;
  const feedListClass = oneScreenFeed
    ? "flex flex-col md:gap-6 max-md:h-[calc(100svh_-_6.5rem_-_env(safe-area-inset-bottom,0px))] max-md:snap-y max-md:snap-mandatory max-md:overflow-y-auto max-md:overscroll-contain max-md:[scrollbar-width:none]"
    : "flex flex-col gap-6";
  // 모바일: article이 정확히 스냅 프레임 높이(h-full)라 스냅이 게시물 top에 딱 맞는다.
  // 데스크톱: article도 다시 고정 프레임(md:h-[calc(100dvh-7rem)])으로 — 카드 하나가
  //   모니터 크기와 무관하게 항상 화면 한 판을 채운다(사용자 요청, "한 게시물만 보이게").
  //   미디어 박스는 flex-1로 남는 공간을 다 먹고, 그 안의 1:1 정사각 미디어는 박스의
  //   짧은 변에 맞춰 가운데 정렬(레터박스) — 예전처럼 폭 기준 4:3 고정 박스로 하면 큰
  //   모니터에서 박스가 남는 세로 공간을 못 채워 여백이 다시 생겼다. md:max-w-[760px]로
  //   카드 폭도 좀 더 키움(기존 620px). memo는 채팅이 있어 원래도 고정 프레임 + 내부 스크롤.
  // 헤더/캡션/태그/반응줄은 shrink-0, 미디어는 min-h-0으로 눌러도 되게 — 합이 프레임과
  // 같아 안 잘리고 안 남는다.
  const articleSnapClass = !oneScreenFeed
    ? ""
    : isComplex
      // memo: article 자체를 flex-col로 만들어야 안의 ComplexPostChat이 grow로 남는 세로
      // 공간을 흡수해서 메시지 입력칸을 프레임 맨 아래로 밀어낼 수 있다(사용자 요청) —
      // 예전엔 block이라 채팅 내용이 짧으면 입력칸이 그 바로 아래 뜨고 그 밑으로 빈
      // 공간이 남았다. 채팅이 프레임보다 길면(shrink-0) article의 overflow-y-auto가 그대로
      // 전체 스크롤을 맡는다(내부 이중 스크롤 없음).
      ? "flex flex-col shrink-0 overflow-y-auto h-full md:h-[calc(100dvh_-_7rem)] max-md:snap-start max-md:snap-always"
      : "flex shrink-0 flex-col justify-center overflow-hidden h-full md:h-[calc(100dvh_-_7rem)] md:mx-auto md:w-full md:max-w-[760px] max-md:snap-start max-md:snap-always";

  return (
    <main
      className={`mx-auto max-w-[900px] px-0 pt-0 md:px-4 md:pb-8 md:pt-4 ${
        oneScreenFeed ? "pb-24 max-md:pb-0" : "pb-24"
      }`}
    >
      {!currentUser && (
        <div className="mx-3 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 md:mx-0">
          <p className="text-sm text-gray-600">
            가입하면 좋아요·댓글을 남기고, memo(비공개 공간)도 볼 수 있어요.
          </p>
          <Link
            href="/signup"
            className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            가입하기
          </Link>
        </div>
      )}
      {tagParam && (
        <div className="mx-3 mb-4 flex items-center justify-between gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 md:mx-0">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">#{tagParam}</span> 태그 게시물만 보고 있어요
          </span>
          <Link href="/feed?feed=completion" className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-900">
            필터 지우기
          </Link>
        </div>
      )}
      {allPosts.length === 0 && isComplex && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            아직 Companion의 게시물이 없어요 — memo에서는 이런 걸 할 수 있어요
          </p>
          <div className="mt-2 w-full">
            <MemoGuideCards />
          </div>
        </div>
      )}
      {allPosts.length === 0 && !isComplex && (
        <div className="flex flex-col items-center justify-center gap-2 py-24">
          <span className="text-3xl">🎬</span>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {tagParam ? `#${tagParam} 태그를 단 게시물이 아직 없어요` : "아직 게시물이 없습니다"}
          </p>
        </div>
      )}

      {/* DEMO 피드는 열자마자 게시물이 아니라 힐링 멘트가 먼저 보이도록 한 판 비운다.
          태그 필터 중일 때는(결과를 보러 온 상태) 생략. */}
      <div className={feedListClass}>
        {showHero && <FeedHero messages={heroMessages} snap={oneScreenFeed} />}
        {allPosts.map((post) => {
          const author = userMap.get(post.user_id);
          const profile = profileMap.get(post.user_id);
          const isOwnPost = currentUser?.id === post.user_id;
          // memo 공동창작 미체크 게시물은 DEMO처럼 좋아요/댓글 + (본인 글이면 조회자 목록,
          // 아니면 메시지) 3개 슬롯을 쓴다(사용자 요청) — DEMO 본인 글만 2개(좋아요/댓글).
          const buttonBasis = isOwnPost && !isComplex ? "basis-1/2" : "basis-1/3";
          const likeCount = likeCountMap.get(post.id) ?? 0;
          const commentCount = commentCountMap.get(post.id) ?? 0;
          const weeklyLikeCount = weeklyLikeCountMap.get(post.id) ?? 0;
          const visibleSchool = profile?.school_public ? profile.school : null;
          const schoolPositions = [visibleSchool, ...(profile?.instruments ?? [])].filter(Boolean).join(" · ");
          const headerMetaLine = `${schoolPositions}${schoolPositions ? " · " : ""}${timeAgo(post.published_at ?? new Date().toISOString())}`;
          // memo(complex) 공동창작 게시물만 미디어 박스를 따로 안 쓰고 ComplexPostChat의
          // mediaSlot으로 넘겨서 재창작물 스택 + 실시간 채팅과 나란히 보여준다. 공동창작
          // 미체크는 DEMO와 동일하게 독립 미디어 박스 + 좋아요/댓글로 간다(사용자 요청).
          // "Companion 공개"(followers) 게시물은 피드 쿼리 단계에서 이미 Companion만
          // 걸러진 상태라(위 posts 필터) 항상 열람 가능.
          const useInlineChatLayout = isComplex && post.collab_available;
          const inlineMediaEl =
            useInlineChatLayout && post.videoSrc ? (
              post.media_type === "audio" ? (
                <SoundbarPlayer src={post.videoSrc} title={post.caption || "음원"} posterSrc={post.posterSrc} />
              ) : post.media_type === "image" ? (
                <img
                  src={post.videoSrc}
                  alt={post.caption ?? "이미지 게시물"}
                  className="max-h-[420px] w-auto max-w-full rounded-xl object-contain"
                />
              ) : (
                <PostVideo
                  postId={post.id}
                  title={post.caption || (post.content_type && CONTENT_TYPE_LABEL[post.content_type]) || "영상"}
                  author={author?.name ?? "알 수 없음"}
                  videoSrc={post.videoSrc}
                  posterSrc={post.posterSrc}
                />
              )
            ) : null;

          return (
            <article
              key={post.id}
              id={post.id}
              className={`scroll-mt-20 overflow-hidden border-y border-gray-200 bg-white transition-shadow md:rounded-2xl md:border dark:border-gray-800 dark:bg-gray-950 target:ring-2 target:ring-red-400 ${articleSnapClass}`}
            >
              <PostEngagementProvider
                initialLikeCount={likeCount}
                initialCommentCount={commentCount}
                initialWeeklyLikeCount={weeklyLikeCount}
                peakThreshold={peakThreshold}
              >
              <PostFocusToggle
                authorId={post.user_id}
                authorName={author?.name ?? "알 수 없음"}
                isComper={adminIds.has(post.user_id)}
                metaLine={headerMetaLine}
                expiresAt={post.expires_at}
                // 집중 모드(확대) 버튼은 채팅이 있는 공동창작 게시물에만 의미가 있다 —
                // 공동창작 미체크는 DEMO처럼 평범한 카드라 확대할 것도 없다.
                isComplex={isComplex && post.collab_available}
                optionsMenu={
                  isOwnPost && !isComplex && !post.isMock ? (
                    <PostOptionsMenu
                      postId={post.id}
                      mediaPath={post.image_url ?? post.audio_url ?? post.video_url ?? ""}
                      initialCaption={post.caption}
                      initialTags={post.instrument_tags ?? []}
                    />
                  ) : undefined
                }
              >
              {post.caption && (
                <p
                  className={`px-3 pb-2 text-sm text-gray-700 dark:text-gray-300 ${
                    oneScreenFeed ? (isComplex ? "shrink-0" : "line-clamp-3 shrink-0") : ""
                  }`}
                >
                  {post.caption}
                </p>
              )}

              {isComplex && post.visibility === "invite_only" ? (
                <ComplexAccessGate
                  postId={post.id}
                  authorId={post.user_id}
                  authorName={author?.name ?? "알 수 없음"}
                  isOwnPost={isOwnPost}
                  currentUserId={currentUser?.id ?? ""}
                  currentUserName={currentUserName}
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
                  canKnock={!isOwnPost && !!currentUser && myCompanionIds.has(post.user_id)}
                  participantSummary={participantSummaryByPost.get(post.id) ?? null}
                  initialPendingRequests={
                    isOwnPost
                      ? accessRows
                          .filter((r) => r.post_id === post.id && r.status === "pending")
                          .map((r) => ({ userId: r.user_id, name: accessNameMap.get(r.user_id) ?? "알 수 없음" }))
                      : []
                  }
                  contentTypeLabel={post.content_type ? CONTENT_TYPE_LABEL[post.content_type] : null}
                  collabAvailable={post.collab_available}
                  collabRoleNeeded={post.collab_role_needed}
                  initialChatMessages={chatMessagesByPost.get(post.id) ?? []}
                  likedByMe={likedByMeSet.has(post.id)}
                />
              ) : (
                <>
                  {/* "Companion 공개"(followers) 라벨은 없앰 — memo 피드에 뜨는 글은 이제
                      전부(followers/invite_only 가리지 않고) 방장과 Companion인 사람에게만
                      보이므로, 굳이 이 유형만 따로 표시할 이유가 없다(위 posts 필터 참고). */}
                  {useInlineChatLayout ? null : (
                    <div
                      className={`relative flex w-full items-center justify-center bg-black ${
                        oneScreenFeed
                          ? "max-md:shrink-0 overflow-hidden max-h-[40svh] md:max-h-[760px] md:min-h-0 md:flex-1"
                          : ""
                      }`}
                    >
                      {!isComplex && (
                        <div className="absolute right-3 top-3 z-10">
                          <EngagementMeter />
                        </div>
                      )}

                      {post.isMock ? (
                        <div
                          className={`relative flex w-full items-center justify-center bg-gradient-to-br ${post.gradient} ${
                            oneScreenFeed ? "h-[40svh] md:h-full md:w-auto md:aspect-square" : "h-[420px]"
                          }`}
                        >
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
                          className={`w-full object-cover ${
                            oneScreenFeed ? "h-[40svh] md:h-full md:w-auto md:aspect-square" : "aspect-[4/5]"
                          }`}
                        />
                      ) : post.videoSrc && post.media_type === "audio" ? (
                        <div className="flex w-full flex-col items-center gap-3 p-4">
                          <SoundbarPlayer
                            src={post.videoSrc}
                            title={post.caption || "음원"}
                            posterSrc={post.posterSrc}
                            tone="demo"
                          />
                        </div>
                      ) : post.videoSrc ? (
                        // DEMO는 SoundCloud처럼 음원+커버 이미지가 중심이라 영상은 부차적인
                        // 존재로 취급 — 실제 화질을 낮춰 인코딩하는 건 아직 없어서(추후 파이프라인
                        // 필요), 지금은 화면에 작고 빈티지하게 보이도록 크기·필터만 낮춘 스케치.
                        <div className="mx-auto max-w-[420px] p-4 saturate-[0.7] sepia-[0.15]">
                          <PostVideo
                            postId={post.id}
                            title={post.caption || (post.content_type && CONTENT_TYPE_LABEL[post.content_type]) || "영상"}
                            author={author?.name ?? "알 수 없음"}
                            videoSrc={post.videoSrc}
                            posterSrc={post.posterSrc}
                            tone="demo"
                          />
                        </div>
                      ) : (
                        <p className="py-24 text-sm text-gray-400">미디어를 불러올 수 없습니다</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 shrink-0">
                    {post.content_type && (
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                        {CONTENT_TYPE_LABEL[post.content_type]}
                      </span>
                    )}
                    {/* 해시태그는 demo 전용 개념(업로드 폼에도 memo 쪽엔 태그 입력 자체가 없음) —
                        memo(Companion)는 태그로 탐색하는 구조가 아니라 여기서는 표시하지 않는다.
                        클릭하면 같은 태그가 달린 게시물만 걸러본다(위 allPosts 필터와 대응). */}
                    {!isComplex &&
                      (post.instrument_tags ?? []).map((tag) => (
                        <Link
                          key={tag}
                          href={`/feed?feed=completion&tag=${encodeURIComponent(tag)}`}
                          className={`rounded-full px-2 py-1 text-xs font-medium transition hover:opacity-70 ${tagColorClass(tag)}`}
                        >
                          #{tag}
                        </Link>
                      ))}
                    {post.collab_available && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-black">
                        <UsersIcon className="h-3.5 w-3.5" /> 공동창작{post.collab_role_needed ? `: ${post.collab_role_needed}` : ""}
                      </span>
                    )}
                  </div>

                  {isComplex && post.collab_available ? (
                    <ComplexPostChat
                      postId={post.id}
                      currentUserId={currentUser?.id ?? ""}
                      currentUserName={currentUserName}
                      isOwnPost={isOwnPost}
                      initialMessages={chatMessagesByPost.get(post.id) ?? []}
                      collabAvailable={post.collab_available}
                      mediaSlot={inlineMediaEl}
                    />
                  ) : !currentUser ? (
                    <GuestEngagementRow likeCount={likeCount} commentCount={commentCount} />
                  ) : post.isMock ? (
                    <div
                      className="flex items-center gap-6 border-t border-gray-100 px-4 py-3.5 text-base font-semibold text-gray-600 shrink-0 dark:border-gray-800 dark:text-gray-300"
                      title="샘플 게시물이라 실제로 누를 수는 없어요"
                    >
                      <span className="inline-flex items-center gap-1"><HeartIcon className="h-5 w-5" /> {likeCount > 0 ? likeCount : ""}</span>
                      <span className="inline-flex items-center gap-1"><CommentIcon className="h-5 w-5" /> {commentCount > 0 ? commentCount : ""}</span>
                    </div>
                  ) : (
                currentUser && (
                  <div className="flex flex-wrap border-t border-gray-100 shrink-0">
                    <LikeButton
                      postId={post.id}
                      userId={currentUser.id}
                      initialLiked={likedByMeSet.has(post.id)}
                      className={buttonBasis}
                    />
                    <CommentPanel postId={post.id} userId={currentUser.id} buttonClassName={buttonBasis} />
                    {!isOwnPost ? (
                      <MessageButton
                        currentUserId={currentUser.id}
                        otherUserId={post.user_id}
                        sourcePostId={post.id}
                        className={`flex items-center justify-center gap-2 py-3.5 text-base font-semibold text-gray-600 transition hover:bg-gray-50 ${buttonBasis}`}
                      >
                        <MailIcon className="h-5 w-5" />
                        메시지
                      </MessageButton>
                    ) : (
                      // memo 공동창작 미체크 본인 글은 메시지 자리에 조회자 목록(인스타
                      // 스토리 참고, 사용자 요청) — DEMO 본인 글은 이 슬롯 자체가 없다.
                      isComplex && (
                        <PostViewedBy
                          postId={post.id}
                          currentUserId={currentUser.id}
                          isOwnPost
                          className={buttonBasis}
                        />
                      )
                    )}
                  </div>
                )
              )}
                </>
              )}
              </PostFocusToggle>
              </PostEngagementProvider>
            </article>
          );
        })}
      </div>
    </main>
  );
}
