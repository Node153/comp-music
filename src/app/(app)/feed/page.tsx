import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyUserRow } from "@/lib/auth";
import { getAdminIds } from "@/lib/admins";
import { getR2SignedUrl, resolveMediaUrl } from "@/lib/r2/storage";
import { MessageButton } from "@/components/MessageButton";
import { EngagementMeter } from "@/components/EngagementMeter";
import { PostEngagementProvider } from "@/components/PostEngagementContext";
import { PostVideo } from "@/components/PostVideo";
import { SoundbarPlayer } from "@/components/SoundbarPlayer";
import { ComplexPostChat, type ChatMessage } from "@/components/ComplexPostChat";
import { ComplexAccessGate } from "@/components/ComplexAccessGate";
import { PostFocusToggle } from "@/components/PostFocusToggle";
import { AddToPlaylistButton } from "@/components/AddToPlaylistButton";
import { MemoGuideCards } from "@/components/MemoGuideCards";
import { FeedHero } from "@/components/FeedHero";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { PostViewedBy } from "@/components/PostViewedBy";
import { PostCaption } from "@/components/PostCaption";
import { PostViewCount } from "@/components/PostViewCount";
import { DoubleTapLikeArea } from "@/components/DoubleTapLikeArea";
import { KickBurst } from "@/components/KickBurst";
import { LikeButton } from "./LikeButton";
import { PinButton } from "./PinButton";
import { CommentPanel } from "./CommentPanel";
import { GuestEngagementRow } from "./GuestEngagementRow";
import type { ContentType } from "@/types/database";
import { tagColorClass, peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";
import { timeAgo } from "@/lib/timeAgo";
import { MailIcon } from "@/components/icons";

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
    "id, user_id, video_url, image_url, audio_url, media_type, thumbnail_url, title, caption, content_type, instrument_tags, visibility, collab_available, collab_role_needed, published_at, expires_at, view_count";
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

  // 이름 표시는 demo/memo가 다르다 — memo(Companion 전용)는 user_display 뷰(0018)로 뷰어가
  // Companion이면 실명, 아니면 닉네임. demo(공개 피드)는 누구나 보는 공간이라 뷰어가 작성자의
  // Companion이어도 닉네임만 보여준다(사용자 요청) — public_post_authors(0024)는 애초에
  // 닉네임만 내려주고 로그인 여부도 안 가려서 그대로 쓸 수 있다.
  // 게시물 목록이 정해지면 그에 딸린 조회들(작성자·프로필·좋아요·댓글)과 PEAK 기준치용
  // 회원 수는 서로 독립이라 한 번에 병렬로 — 예전엔 5개를 순차 await 했다.
  const [
    { data: users },
    { data: profiles },
    { data: likeRows },
    { data: commentRows },
    { count: approvedMemberCount },
    { data: pinRows },
  ] = await Promise.all([
    userIds.length > 0
      ? isComplex
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
    // memo 합작 게시물 고정 오버라이드(post_pins, 0054/0055) — 행이 있으면 그 pinned 값이
    // 아래 isAutoPinnedCollab 자동 규칙을 덮어쓴다(양방향: 자동 고정 해제도, 그 외 글을
    // 고정하는 것도 같은 테이블).
    currentUser && isComplex && postIds.length > 0
      ? supabase.from("post_pins").select("post_id, pinned").eq("user_id", currentUser.id).in("post_id", postIds)
      : { data: [] as { post_id: string; pinned: boolean }[] },
  ]);

  const userMap = new Map((users ?? []).map((u) => [u.id, { id: u.id, name: u.display_name }]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const pinOverrides = new Map((pinRows ?? []).map((r) => [r.post_id, r.pinned]));
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

  // memo 상단 자동 고정 대상(사용자 요청) — 합작 게시물 중 "내 글이거나 특정인으로서
  // 초대된 글"만. 처음엔 합작 게시물 전부를 고정했는데, Companion 공개(followers)로
  // 그냥 보이는 남의 합작 글까지 전부 고정되는 건 과하다는 지적을 받고 범위를 좁혔다 —
  // 그 외 합작 게시물은 보는 사람이 원하면 PinButton(post_pins, 0054)으로 직접 고정한다.
  function isAutoPinnedCollab(post: { id: string; user_id: string; visibility: string; collab_available: boolean }) {
    if (!isComplex || !post.collab_available || !currentUser) return false;
    if (post.user_id === currentUser.id) return true;
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

  // 실제 고정 여부 — post_pins에 오버라이드 행이 있으면 그 값을 그대로 따르고, 없으면
  // 자동 규칙을 쓴다. PinButton이 이 값을 뒤집어 upsert하므로 자동 고정도 해제할 수 있다
  // (사용자 요청 — 처음엔 자동 고정을 끌 수 없게 했다가 "고정/고정 해제 둘 다 되게 해달라"
  // 는 요청을 받고 양방향으로 열었다).
  function isPinned(post: { id: string; user_id: string; visibility: string; collab_available: boolean }) {
    const override = pinOverrides.get(post.id);
    return override ?? isAutoPinnedCollab(post);
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
    if (inviteOnlyForOthers.length > 0) {
      const { data: batchRows } = await supabase.rpc("knock_context_batch", {
        pids: inviteOnlyForOthers.map((p) => p.id),
      });
      const rowsByPost = new Map<string, { display_name: string; is_companion: boolean }[]>();
      for (const row of batchRows ?? []) {
        const list = rowsByPost.get(row.post_id) ?? [];
        list.push({ display_name: row.display_name, is_companion: row.is_companion });
        rowsByPost.set(row.post_id, list);
      }

      for (const p of inviteOnlyForOthers) {
        const rows = rowsByPost.get(p.id) ?? [];
        if (rows.length === 0) continue;

        if (canViewMediaFor(p)) {
          participantSummaryByPost.set(p.id, `${rows.map((r) => r.display_name).join(", ")}에게 공개`);
          continue;
        }

        const companionNames = rows.filter((r) => r.is_companion).map((r) => r.display_name);
        const otherCount = rows.length - companionNames.length;
        const summary =
          companionNames.length > 0
            ? `${companionNames.join(", ")}${otherCount > 0 ? ` 외 ${otherCount}명` : ""}에게 공개`
            : `${otherCount}명에게 공개`;
        participantSummaryByPost.set(p.id, summary);
      }
    }
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

  // 게스트(비로그인)에게 내려주는 서명 URL은 훨씬 짧게(2026-09-23, 사용자 요청) — 미공개·
  // 미등록 저작물을 개발자도구로 URL만 복사해 통째로 받아가는 걸 완전히 막을 순 없지만
  // (서명 URL을 <audio src>/<video src>에 그대로 꽂는 구조라 URL 자체가 노출 표면),
  // 유효시간을 30분→2분으로 줄이면 그 노출 창을 크게 줄일 수 있다. 미리듣기 상한(30초,
  // feedConstants.ts)이 걸리는 시간보다는 여유 있게 둬서 느린 네트워크에서도 재생 시작
  // 전에 만료되는 일은 없게 한다.
  const mediaExpirySeconds = currentUser ? SIGNED_URL_EXPIRY_SECONDS : 60 * 2;
  const postsWithVideo = await Promise.all(
    posts.map(async (post) => {
      const canView = canViewMediaFor(post);
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = canView && mediaPath ? await getR2SignedUrl(mediaPath, mediaExpirySeconds) : null;
      const posterSrc =
        canView && post.thumbnail_url ? await resolveMediaUrl(post.thumbnail_url, mediaExpirySeconds) : null;
      return {
        ...post,
        videoSrc,
        posterSrc,
        canViewMedia: canView,
      };
    }),
  );

  // memo 탭은 고정된(위 isPinned — 자동 규칙 또는 PinButton 오버라이드) 합작 게시물을
  // 최신순보다 우선해 상단에 둔다(사용자 요청). DEMO는 그대로 최신순.
  const allPostsUnfiltered = [...postsWithVideo].sort((a, b) => {
    if (isComplex) {
      const pinDiff = Number(isPinned(b)) - Number(isPinned(a));
      if (pinDiff !== 0) return pinDiff;
    }
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });
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
  //     GlobalPlayerBar(h-16, bottom-14로 BottomNav 바로 위에 뜸) − BottomNav(h-14) − iOS
  //     하단 세이프에어리어(2026-09-18 수정 — 이 calc가 원래 GlobalPlayerBar 도입 전에 짜여
  //     BottomNav만 빼고 있어서, 맨 마지막 게시물이 사운드바에 가려 잘리는 문제가 있었다).
  //     dvh가 아니라 svh인 이유: 주소창이 보일 때(가장 작을 때) 기준으로 잡아야 좋아요/댓글
  //     줄이 하단 탭바 뒤로 안 잘림.
  //   · 데스크톱(md 이상): **완전 고정 px, 뷰포트 크기 무관**(2026-09-14 확정, 사용자 요청 —
  //     "모니터 기준 1440×990 고정, 카드 가로·세로 고정"). 1440×990 모니터에서 TopNav(h-14)
  //     + 상하 여백(≈3.5rem) = 7rem(112px)을 뺀 878px을 세로로 잡고, 카드 비율을 4:3 세로
  //     (가로:세로 = 3:4)로 맞춰 가로 878×3/4 = 658.5 → 659px. 즉 카드는 항상 659×878px —
  //     4K든 작은 노트북이든(md 이상이면) 화면 크기와 무관하게 똑같은 크기. 예전엔 100dvh
  //     기준으로 화면 크기에 비례해서 카드가 커지고 작아졌는데, 그 반응형 특성을 없앤 것.
  //   · 미디어 박스(영상·음원+커버·이미지)도 전부 이 카드 폭(659px)에 맞춰 **정사각형(1:1)
  //     으로 통일**(예전엔 영상 4:5/음원 4:5/이미지 1:1로 타입마다 달랐음 — 2026-09-14 확정).
  //     DEMO(비 isComplex) 카드는 **높이를 878px로 억지로 채우지 않고 내용물(헤더+캡션+
  //     657px 정사각 미디어+태그+반응줄) 높이 그대로**를 쓴다(2026-09-14 최종 확정 — 처음엔
  //     미디어를 659px로 고정하고 남는 공간을 article의 justify-center가 카드 위/아래 흰
  //     여백으로 흡수하게 했다가, 그다음엔 미디어 박스 자체가 md:flex-1로 남는 공간을 검은
  //     레터박스로 흡수하게 바꿨는데 — 두 방법 다 "카드는 878px 고정 + 미디어는 657px 고정"을
  //     동시에 만족시키려다 보니 그 차이가 흰 여백이든 검은 바든 반드시 어딘가에 남았다.
  //     캡션·태그 길이가 게시물마다 달라 그 차이가 매번 다르기 때문에 둘 다 고정하면서
  //     여백을 완전히 없앨 방법이 없다 — 그래서 카드 높이 쪽을 내용물에 맞춰 자연스럽게
  //     줄여서(878px보다 살짝 작게, 게시물마다 조금씩 다름) 여백 자체가 생기지 않게 했다.
  //     memo(합작 포함) 카드는 안의 채팅 목록이 스크롤 프레임으로 878px 고정이 계속
  //     필요해서 그대로 둔다(아래 articleSnapClass).
  //   · 비로그인 미리보기는 상단바/탭바 구성이 달라(GuestTopNav만) 높이 계산이 어긋나므로
  //     기존 카드 피드(자연 높이)를 그대로 둔다.
  const oneScreenFeed = !!currentUser;
  const feedListClass = oneScreenFeed
    ? "flex flex-col md:gap-6 max-md:h-[calc(100svh_-_10.5rem_-_env(safe-area-inset-bottom,0px))] max-md:snap-y max-md:snap-mandatory max-md:overflow-y-auto max-md:overscroll-contain max-md:[scrollbar-width:none]"
    : "flex flex-col gap-6";
  // 모바일: article이 정확히 스냅 프레임 높이(h-full)라 스냅이 게시물 top에 딱 맞는다.
  // 데스크톱: 카드 659×878px 고정(위 설명 참고) — memo(합작 포함)도 2026-09-14부터 같은
  //   폭 캡을 적용해 DEMO와 동일한 카드 크기 기준을 따른다(사용자 요청, "합작 게시물도
  //   우리가 정한 게시물 크기 기준으로"). 합작 게시물의 "집중 모드"(확대, PostFocusToggle)는
  //   position:fixed로 뷰포트 전체를 덮어써서 article의 max-width와 무관하게 커지므로,
  //   평소엔 이 좁은 카드 안에 미디어/채팅을 절반씩 나눠 담아도 필요할 때 확대해서 볼 수 있다.
  const articleSnapClass = !oneScreenFeed
    ? ""
    : isComplex
      // memo: article 자체를 flex-col로 만들어야 안의 ComplexPostChat이 grow로 남는 세로
      // 공간을 흡수해서 메시지 입력칸을 프레임 맨 아래로 밀어낼 수 있다(사용자 요청) —
      // 예전엔 block이라 채팅 내용이 짧으면 입력칸이 그 바로 아래 뜨고 그 밑으로 빈
      // 공간이 남았다. 채팅이 프레임보다 길면(shrink-0) article의 overflow-y-auto가 그대로
      // 전체 스크롤을 맡는다(내부 이중 스크롤 없음).
      ? "flex flex-col shrink-0 overflow-y-auto h-full md:h-[878px] md:mx-auto md:w-full md:max-w-[659px] max-md:snap-start max-md:snap-always"
      // DEMO는 md:h-auto — 878px로 늘리지 않고 내용물 높이 그대로(위 설명 참고).
      : "flex shrink-0 flex-col h-full md:h-auto md:mx-auto md:w-full md:max-w-[659px] max-md:snap-start max-md:snap-always";

  return (
    <main
      // 하단 여백 = GlobalPlayerBar 클리어런스. 로그인 시에만 그 바가 떠 있으므로(비로그인은
      // 없음, AppLayout 참고) oneScreenFeed일 때만 넉넉히 잡는다 — 데스크톱은 pageCard(공유
      // 스타일, ui/styles.ts)와 같은 md:pb-24(96px = 바 h-16/64px + 여유 32px) 기준으로
      // 통일했다(2026-09-18 수정 — 기존 md:pb-8=32px로는 바 높이(64px)를 못 가려 맨 마지막
      // 게시물이 잘려 보였다, DEMO/memo 탭 공통 문제라 여기 한 곳만 고치면 둘 다 해결됨).
      // 모바일은 max-md:pb-0 그대로 두고, 대신 프레임 높이 calc 자체(위 feedListClass의
      // 10.5rem)에서 바 높이를 빼서 처리한다.
      className={`mx-auto max-w-[900px] px-0 pt-0 md:px-4 md:pt-4 ${
        oneScreenFeed ? "max-md:pb-0 md:pb-24" : "pb-24 md:pb-8"
      }`}
    >
      {!currentUser && (
        <div className="mx-3 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 md:mx-0">
          <p className="text-sm text-gray-600">
            가입하면 Kick·댓글을 남기고, memo(비공개 공간)도 볼 수 있어요.
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
          // 재생 가능한(오디오·영상) DEMO 게시물이면 헤더에 "플레이리스트에 담기" 버튼을
          // 붙인다. memo는 담기 금지(사용자 요청 — 한 번 "합작 제외하고 허용"으로 열었다가
          // 다시 완전히 막기로 정정받음) — !isComplex로 DEMO만 남긴다.
          const playlistSrc = post.videoSrc;
          const playlistTrack =
            !!currentUser && !isComplex && post.media_type !== "image" && playlistSrc
              ? {
                  id: post.id,
                  title:
                    post.title ||
                    post.caption ||
                    (post.content_type && CONTENT_TYPE_LABEL[post.content_type]) ||
                    "음원",
                  author: author?.name ?? "알 수 없음",
                  authorId: post.user_id,
                  videoSrc: playlistSrc,
                  posterSrc: post.posterSrc ?? null,
                  expiresAt: post.expires_at ?? null,
                  mediaType: post.media_type === "audio" ? ("audio" as const) : ("video" as const),
                }
              : null;

          const useInlineChatLayout = isComplex && post.collab_available;
          const inlineMediaEl =
            useInlineChatLayout && post.videoSrc ? (
              post.media_type === "audio" ? (
                <SoundbarPlayer
                  src={post.videoSrc}
                  title={post.title || post.caption || "음원"}
                  posterSrc={post.posterSrc}
                  downloadUrl={post.videoSrc}
                  downloadName={post.title || post.caption || "음원"}
                />
              ) : post.media_type === "image" ? (
                <img
                  src={post.videoSrc}
                  alt={post.title || post.caption || "이미지 게시물"}
                  className="max-h-[420px] w-auto max-w-full rounded-xl object-contain"
                />
              ) : (
                <PostVideo
                  postId={post.id}
                  title={post.title || post.caption || (post.content_type && CONTENT_TYPE_LABEL[post.content_type]) || "영상"}
                  author={author?.name ?? "알 수 없음"}
                  videoSrc={post.videoSrc}
                  posterSrc={post.posterSrc}
                />
              )
            ) : null;

          // memo 합작 게시물 헤더의 고정 아이콘 — 자동/수동 구분 없이 항상 켜고 끌 수 있는
          // PinButton 하나로 통일(사용자 요청, 0055).
          const pinButtonEl =
            isComplex && post.collab_available && currentUser ? (
              <PinButton postId={post.id} userId={currentUser.id} initialPinned={isPinned(post)} />
            ) : undefined;

          return (
            <article
              key={post.id}
              id={post.id}
              className={`relative scroll-mt-20 overflow-hidden border-y border-gray-200 bg-white transition-shadow md:rounded-2xl md:border dark:border-gray-800 dark:bg-gray-950 target:ring-2 target:ring-red-400 ${articleSnapClass}`}
            >
              <PostEngagementProvider
                initialLikeCount={likeCount}
                initialCommentCount={commentCount}
                initialWeeklyLikeCount={weeklyLikeCount}
                initialViewCount={post.view_count}
                initialLiked={likedByMeSet.has(post.id)}
                peakThreshold={peakThreshold}
              >
              <KickBurst />
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
                  isOwnPost && !isComplex ? (
                    <PostOptionsMenu
                      postId={post.id}
                      mediaPath={post.image_url ?? post.audio_url ?? post.video_url ?? ""}
                      initialTitle={post.title}
                      initialCaption={post.caption}
                      initialTags={post.instrument_tags ?? []}
                    />
                  ) : undefined
                }
                pinButton={pinButtonEl}
              >
              {/* 작품 제목 — caption(부가 설명)과 분리(0052, 2026-09-15 사용자 요청). 옛 게시물은
                  title이 없어(null) 자연히 안 보이고 caption만 뜬다(하위호환). */}
              {post.title && (
                <p className="px-3 pb-0.5 text-sm font-bold text-gray-900 shrink-0 dark:text-gray-100">
                  {post.title}
                </p>
              )}
              {post.caption && (
                <PostCaption
                  text={post.caption}
                  className={`px-3 pb-2 text-sm text-gray-700 dark:text-gray-300 ${
                    oneScreenFeed ? "shrink-0" : ""
                  }`}
                />
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
                />
              ) : (
                <>
                  {/* "Companion 공개"(followers) 라벨은 없앰 — memo 피드에 뜨는 글은 이제
                      전부(followers/invite_only 가리지 않고) 방장과 Companion인 사람에게만
                      보이므로, 굳이 이 유형만 따로 표시할 이유가 없다(위 posts 필터 참고). */}
                  {useInlineChatLayout ? null : (
                    <div
                      className={`relative flex w-full items-center ${isComplex ? "md:items-end" : ""} justify-center bg-black ${
                        // DEMO(!isComplex)는 article이 이제 md:h-auto(내용물 높이 그대로)라
                        // 미디어 박스가 남는 공간을 흡수할 필요 자체가 없다 — 그냥 657px
                        // 정사각형 그대로 두면 카드도 딱 그만큼만 높아지고 여백이 아예 안
                        // 생긴다(2026-09-14 최종 확정, 위 feedListClass 설명 참고).
                        // memo 비합작(isComplex && !collab)은 article이 여전히 md:h-[878px]
                        // 고정(채팅 스크롤 프레임 때문)이라 남는 공간이 생길 수 있음 — 이
                        // 경우만 md:flex-1로 미디어 박스가 직접 흡수하고 md:items-end로 그
                        // 여유를 미디어 "위"에만 몰아서 반응줄 바로 위는 항상 딱 붙게 한다.
                        // min-h-0 없이 flex-1만 쓰면 정사각 자식의 내용 높이가 flex-basis로
                        // 강제돼 줄어들 공간이 안 생기므로 같이 필요. max-h-[40svh]도 breakpoint
                        // 없이 항상 걸리는 값이라 md:max-h-none으로 지워줘야 flex-1이 실제로
                        // 커질 수 있다(안 그러면 40svh=396px에 눌려서 정사각 미디어가 위아래로
                        // 잘림 — 배포 직후 실측으로 발견·수정).
                        // max-h-[40svh]는 breakpoint 없이 항상 걸리는 값이라(모바일 릴스 프레임용)
                        // flex-1을 안 쓰는 DEMO 분기에서도 md:max-h-none으로 반드시 지워줘야
                        // 한다 — 안 그러면 이 값(990px 기준 396px)이 657px 정사각 미디어보다
                        // 작아서 desktop에서도 영상이 그 안에 잘려 들어간다(재배포 직후 실측
                        // 으로 또 발견·수정 — DEMO/memo 두 분기 모두 이 override가 필요).
                        oneScreenFeed
                          ? isComplex
                            ? "max-md:shrink-0 overflow-hidden max-h-[40svh] md:max-h-none md:min-h-0 md:flex-1"
                            : "max-md:shrink-0 overflow-hidden max-h-[40svh] md:max-h-none"
                          : ""
                      }`}
                    >
                      {!isComplex && (
                        <div className="absolute right-3 top-3 z-10">
                          <EngagementMeter />
                        </div>
                      )}
                      {/* 플레이리스트 담기(+) — 헤더 우측상단에 있던 걸 미디어 우측하단
                          오버레이로 이동(사용자 요청). 흰 칩 배경을 둬서 어두운 미디어
                          위에서도 아이콘이 묻히지 않게 한다. */}
                      {playlistTrack && (
                        <div className="absolute bottom-3 right-3 z-10 rounded-full bg-white/90 shadow-sm dark:bg-gray-900/90">
                          <AddToPlaylistButton track={playlistTrack} />
                        </div>
                      )}

                      {post.videoSrc && post.media_type === "image" ? (
                        currentUser ? (
                          <DoubleTapLikeArea postId={post.id} userId={currentUser.id}>
                            <img
                              src={post.videoSrc}
                              alt={post.title || post.caption || "이미지 게시물"}
                              className={`w-full object-cover ${
                                // 위 목업과 같은 이유로 md:h-auto 필요.
                                oneScreenFeed ? "h-[40svh] md:h-auto md:aspect-square" : "aspect-[4/5]"
                              }`}
                            />
                          </DoubleTapLikeArea>
                        ) : (
                          <img
                            src={post.videoSrc}
                            alt={post.title || post.caption || "이미지 게시물"}
                            className={`w-full object-cover ${
                              oneScreenFeed ? "h-[40svh] md:h-auto md:aspect-square" : "aspect-[4/5]"
                            }`}
                          />
                        )
                      ) : post.videoSrc && post.media_type === "audio" ? (
                        // 음원+커버도 영상·이미지와 같은 정사각형(1:1)으로 통일(2026-09-14
                        // 확정) — 예전엔 카드 폭을 그대로 채우는 4:5였음. 래퍼에 패딩을 두지
                        // 않아야 폭이 영상/이미지와 완전히 같은 659px가 된다(SoundbarPlayer
                        // 자체 aspect-square가 정사각형을 만듦).
                        <div className="w-full">
                          <SoundbarPlayer
                            src={post.videoSrc}
                            title={post.title || post.caption || "음원"}
                            posterSrc={post.posterSrc}
                            tone={isComplex ? "memo" : "demo"}
                            mode={currentUser ? "global" : "inline"}
                            trackId={post.id}
                            author={author?.name ?? "알 수 없음"}
                            authorId={post.user_id}
                            expiresAt={post.expires_at}
                            viewerId={currentUser?.id}
                          />
                        </div>
                      ) : post.videoSrc ? (
                        // DEMO는 SoundCloud처럼 음원+커버 이미지가 중심이라 영상은 부차적인
                        // 존재로 취급 — 실제 화질을 낮춰 인코딩하는 건 아직 없어서(추후 파이프라인
                        // 필요), 지금은 화면에 작고 빈티지하게 보이도록 필터만 낮춘 스케치.
                        // 크기는 2026-09-14부터 영상만 따로 작게(420px) 누르지 않고 음원·이미지와
                        // 같은 659px 정사각형으로 통일(PostVideo 자체 aspect-square).
                        <div className="w-full saturate-[0.7] sepia-[0.15]">
                          <PostVideo
                            postId={post.id}
                            title={post.title || post.caption || (post.content_type && CONTENT_TYPE_LABEL[post.content_type]) || "영상"}
                            author={author?.name ?? "알 수 없음"}
                            authorId={post.user_id}
                            videoSrc={post.videoSrc}
                            posterSrc={post.posterSrc}
                            tone="demo"
                            expiresAt={post.expires_at}
                            viewerId={currentUser?.id}
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
                    <GuestEngagementRow
                      showViewCount={!isComplex}
                      likeCount={likeCount}
                      commentCount={commentCount}
                    />
                  ) : (
                currentUser && (
                  // 왼쪽 정렬 아이콘 행(사용자 요청) — 조회수 → 하트 → 댓글 순서. 예전엔
                  // 버튼마다 flex-basis로 폭을 균등 분할했는데, 조회수 아이콘까지 더해지며
                  // 폭 합이 100%를 넘어 줄바꿈이 꼬였다(제보: "아이콘 꼬였어"). 이제 전부
                  // gap만으로 나란히 놓는 guest/mock 줄과 같은 방식이라 몇 개가 오든 안전하다.
                  <div className="flex flex-wrap items-center gap-6 border-t border-gray-100 px-4 py-3.5 shrink-0">
                    {!isComplex && (
                      <PostViewCount
                        className="inline-flex items-center gap-1 text-base font-semibold text-gray-600 dark:text-gray-300"
                        iconClassName="h-5 w-5"
                      />
                    )}
                    <LikeButton postId={post.id} userId={currentUser.id} />
                    <CommentPanel postId={post.id} userId={currentUser.id} isDemo={!isComplex} />
                    {!isOwnPost ? (
                      <MessageButton
                        currentUserId={currentUser.id}
                        otherUserId={post.user_id}
                        sourcePostId={post.id}
                        className="inline-flex items-center gap-1 text-base font-semibold text-gray-600 transition hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
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
