import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { getAdminIds } from "@/lib/admins";
import { getR2SignedUrl, resolveMediaUrl } from "@/lib/r2/storage";
import { EngagementMeter } from "@/components/EngagementMeter";
import { PostEngagementProvider } from "@/components/PostEngagementContext";
import { PostVideo } from "@/components/PostVideo";
import { SoundbarPlayer } from "@/components/SoundbarPlayer";
import { ComplexPostChat, type ChatMessage } from "@/components/ComplexPostChat";
import { ComplexAccessGate } from "@/components/ComplexAccessGate";
import { PostFocusToggle } from "@/components/PostFocusToggle";
import { AddToPlaylistButton } from "@/components/AddToPlaylistButton";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { PostViewedBy } from "@/components/PostViewedBy";
import { PostCaption } from "@/components/PostCaption";
import { PostViewCount } from "@/components/PostViewCount";
import { ListenInsight } from "@/components/ListenInsight";
import { DoubleTapLikeArea } from "@/components/DoubleTapLikeArea";
import { KickBurst } from "@/components/KickBurst";
import { LikeButton } from "./LikeButton";
import { KickButton } from "./KickButton";
import { KickersLine } from "./KickersLine";
import { PinButton } from "./PinButton";
import { CommentPanel } from "./CommentPanel";
import { ShareButton } from "./ShareButton";
import { GuestEngagementRow } from "./GuestEngagementRow";
import { CommentIcon, EyeIcon, LockIcon } from "@/components/icons";
import { feedbackFocusText } from "@/lib/feedbackFocus";
import type { ContentType, Database } from "@/types/database";
import { tagColorClass, peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";
import { timeAgo } from "@/lib/timeAgo";

// 피드 게시물 카드 렌더링 — 첫 페이지(page.tsx, 서버 렌더)와 무한 스크롤 추가 페이지
// (actions.ts loadMoreFeed, 서버 액션이 JSX를 그대로 돌려줌)가 같은 코드를 쓰도록 page.tsx에서
// 분리했다(2026-09-24). 게시물 목록만 받아 그에 딸린 작성자·좋아요·댓글·접근권한 등을 한 번에
// 조회해서 카드 배열을 만든다 — 어떤 게시물을 어떤 순서로 보여줄지는 feedQuery.ts가 정한다.

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  composition: "작곡",
  performance: "연주",
  practice: "연습",
  rehearsal: "리허설",
  improv: "즉흥",
  ensemble: "합주",
};

const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;


export type FeedPostRow = Database["public"]["Tables"]["posts"]["Row"];

export type FeedRenderCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  currentUser: { id: string } | null;
  currentUserName: string;
  myCompanionIds: Set<string>;
};

// 로그인 회원은 고정 카드 프레임(아래 articleSnapClass), 비로그인 미리보기는 자연 높이.
export function isOneScreenFeed(currentUser: { id: string } | null) {
  return !!currentUser;
}

export async function renderFeedPosts(posts: FeedPostRow[], ctx: FeedRenderCtx): Promise<React.ReactNode[]> {
  const { supabase, currentUser, currentUserName, myCompanionIds } = ctx;
  if (posts.length === 0) return [];
  const oneScreenFeed = isOneScreenFeed(currentUser);

  // 2026-09-25(사용자 요청) memo가 DEMO에 합쳐져서, 옛 memo 탭 단위 분기(isComplex)를 이제
  // 글마다 판단한다 — 비공개(Companion·특정인 공개) 글인지, 콜라보(채팅·재창작 스택) 글인지.
  const postIds = posts.map((p) => p.id);
  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const publicPostIds = posts.filter((p) => p.visibility === "public").map((p) => p.id);
  const publicAuthorIds = [...new Set(posts.filter((p) => p.visibility === "public").map((p) => p.user_id))];
  const privateAuthorIds = [...new Set(posts.filter((p) => p.visibility !== "public").map((p) => p.user_id))];
  const collabPostIds = posts.filter((p) => p.collab_available).map((p) => p.id);

  // 이름 표시는 공개 범위에 따라 다르다 — 비공개 글은 user_display 뷰(0018)로 뷰어가 Companion이면
  // 실명, 아니면 닉네임(옛 memo 규칙). 전체공개 글은 누구나 보는 공간이라 뷰어가 작성자의
  // Companion이어도 닉네임만 보여준다(사용자 요청) — public_post_authors(0024)는 애초에
  // 닉네임만 내려주고 로그인 여부도 안 가려서 그대로 쓸 수 있다.
  // 게시물 목록이 정해지면 그에 딸린 조회들(작성자·프로필·좋아요·댓글)과 PEAK 기준치용
  // 회원 수는 서로 독립이라 한 번에 병렬로 — 예전엔 5개를 순차 await 했다.
  const [
    { data: users },
    { data: privateUsers },
    { data: profiles },
    { data: likeRows },
    { data: commentRows },
    { count: approvedMemberCount },
    { data: pinRows },
    { data: kickRows },
  ] = await Promise.all([
    publicAuthorIds.length > 0
      ? supabase.from("public_post_authors").select("id, display_name").in("id", publicAuthorIds)
      : { data: [] as { id: string; display_name: string }[] },
    currentUser && privateAuthorIds.length > 0
      ? supabase.from("user_display").select("id, display_name").in("id", privateAuthorIds)
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
    // 콜라보 게시물 고정 오버라이드(post_pins, 0054/0055) — 행이 있으면 그 pinned 값이
    // 아래 isAutoPinnedCollab 자동 규칙을 덮어쓴다(양방향: 자동 고정 해제도, 그 외 글을
    // 고정하는 것도 같은 테이블).
    currentUser && collabPostIds.length > 0
      ? supabase.from("post_pins").select("post_id, pinned").eq("user_id", currentUser.id).in("post_id", collabPostIds)
      : { data: [] as { post_id: string; pinned: boolean }[] },
    // Kick(0071)은 전체공개 글 전용. 로그인 회원은 누가 Kick했는지(닉네임)까지 공개 — post_kickers RPC.
    // 게스트는 숫자만(kicks_select_public_posts 정책).
    publicPostIds.length > 0
      ? currentUser
        ? supabase.rpc("post_kickers", { pids: publicPostIds })
        : supabase.from("kicks").select("post_id, user_id").in("post_id", publicPostIds)
      : { data: [] as { post_id: string; user_id: string; nickname?: string }[] },
  ]);

  const userMap = new Map((users ?? []).map((u) => [u.id, { id: u.id, name: u.display_name }]));
  const privateUserMap = new Map((privateUsers ?? []).map((u) => [u.id, { id: u.id, name: u.display_name }]));
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
  const kickCountMap = new Map<string, number>();
  const kickersMap = new Map<string, { id: string; name: string }[]>();
  const kickedByMeSet = new Set<string>();
  for (const row of (kickRows ?? []) as { post_id: string; user_id: string; nickname?: string }[]) {
    kickCountMap.set(row.post_id, (kickCountMap.get(row.post_id) ?? 0) + 1);
    if (row.nickname) {
      kickersMap.set(row.post_id, [...(kickersMap.get(row.post_id) ?? []), { id: row.user_id, name: row.nickname }]);
    }
    if (currentUser && row.user_id === currentUser.id) kickedByMeSet.add(row.post_id);
  }
  const commentCountMap = new Map<string, number>();
  for (const row of commentRows ?? []) {
    commentCountMap.set(row.post_id, (commentCountMap.get(row.post_id) ?? 0) + 1);
  }

  // 비공개 글 접근 제어 — followers/invite_only 게시물의 실제 열람 가능 여부를 계산한다.
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

  // 피드 상단 자동 고정 대상(사용자 요청) — 콜라보 게시물 중 "내 글이거나 특정인으로서
  // 초대된 글"만. 처음엔 합작 게시물 전부를 고정했는데, Companion 공개(followers)로
  // 그냥 보이는 남의 합작 글까지 전부 고정되는 건 과하다는 지적을 받고 범위를 좁혔다 —
  // 그 외 합작 게시물은 보는 사람이 원하면 PinButton(post_pins, 0054)으로 직접 고정한다.
  function isAutoPinnedCollab(post: { id: string; user_id: string; visibility: string; collab_available: boolean }) {
    if (!post.collab_available || !currentUser) return false;
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
  if (currentUser) {
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

  // 열람 가능한 콜라보·특정인 공개 게시물의 채팅+재창작물 스택을 서버에서 미리 가져온다(초기
  // 렌더용 — ComplexPostChat의 "새로고침" 버튼만 /api/complex/chat을 다시 부른다). 채팅 RLS가 승인
  // 회원만 허용이라 게스트는 부르지 않는다.
  const accessiblePostIds = currentUser
    ? posts.filter((p) => (p.collab_available || p.visibility === "invite_only") && canViewMediaFor(p)).map((p) => p.id)
    : [];
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

  // 게시물 프레임 높이 규칙.
  //   · 모바일(md 미만): 2026-09-23 사용자 요청으로 릴스/쇼츠식 한 화면=한 게시물 스냅
  //     스크롤을 걷어내고 일반 스크롤로 바꿨다 — 게시물마다 내용물 높이 그대로 자연스럽게
  //     쌓이고, 위아래로 자유롭게 스크롤한다(스냅 없음). 이전엔 프레임 높이를 100svh에서
  //     상하단 바들을 뺀 값으로 딱 맞춰 스냅시켰었는데, 그 계산 전부를 걷어냈다.
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
  //     memo(합작 포함) 카드는 데스크톱에서 안의 채팅 목록이 스크롤 프레임으로 878px 고정이
  //     계속 필요해서 그대로 둔다(아래 articleSnapClass, md:에만 적용).
  //   · 비로그인 미리보기는 상단바/탭바 구성이 달라(GuestTopNav만) 높이 계산이 어긋나므로
  //     기존 카드 피드(자연 높이)를 그대로 둔다.
  // 모바일: 스냅·고정 높이 없이 article이 내용물 높이 그대로 쌓인다(위 설명 참고).
  // 데스크톱: 카드 659×878px 고정(위 설명 참고) — memo(합작 포함)도 2026-09-14부터 같은
  //   폭 캡을 적용해 DEMO와 동일한 카드 크기 기준을 따른다(사용자 요청, "합작 게시물도
  //   우리가 정한 게시물 크기 기준으로"). 합작 게시물의 "집중 모드"(확대, PostFocusToggle)는
  //   position:fixed로 뷰포트 전체를 덮어써서 article의 max-width와 무관하게 커지므로,
  //   평소엔 이 좁은 카드 안에 미디어/채팅을 절반씩 나눠 담아도 필요할 때 확대해서 볼 수 있다.
  // 2026-09-25부터 memo 탭이 없어져서 고정 프레임은 채팅이 있는 콜라보 글에만 건다.
  const articleSnapClassFor = (chatFrame: boolean) => !oneScreenFeed
    ? ""
    : chatFrame
      // memo: 데스크톱에서만 article 자체를 flex-col 고정 프레임(878px)으로 만들어야 안의
      // ComplexPostChat이 grow로 남는 세로 공간을 흡수해서 메시지 입력칸을 프레임 맨 아래로
      // 밀어낼 수 있다(사용자 요청). 채팅이 프레임보다 길면 article의 overflow-y-auto가
      // 그대로 스크롤을 맡는다(내부 이중 스크롤 없음). 모바일은 고정 프레임이 없어서 채팅
      // 목록이 페이지 스크롤에 자연스럽게 얹힌다.
      ? "flex flex-col shrink-0 md:overflow-y-auto md:h-[878px] md:mx-auto md:w-full md:max-w-[659px]"
      // DEMO는 md:h-auto — 878px로 늘리지 않고 내용물 높이 그대로(위 설명 참고).
      : "flex shrink-0 flex-col md:h-auto md:mx-auto md:w-full md:max-w-[659px]";

  return postsWithVideo.map((post) => {
          // Companion 공개·특정인 공개(옛 memo) 글 — Kick·PEAK·공유·플레이리스트 담기는 전체공개 전용.
          const isPrivate = post.visibility !== "public";
          const author = (isPrivate ? privateUserMap.get(post.user_id) : undefined) ?? userMap.get(post.user_id);
          const profile = profileMap.get(post.user_id);
          const isOwnPost = currentUser?.id === post.user_id;
          // 콜라보(채팅·재창작 스택) 화면 — 채팅은 승인 회원만 쓸 수 있어서 게스트에겐 일반 카드로.
          const isCollabRoom = post.collab_available && !!currentUser;
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
          // 붙인다. 옛 memo(비공개 글)는 담기 금지(사용자 요청 — 한 번 "합작 제외하고 허용"으로
          // 열었다가 다시 완전히 막기로 정정받음) — !isPrivate로 전체공개 글만 남긴다.
          const playlistSrc = post.videoSrc;
          const playlistTrack =
            !!currentUser && !isPrivate && post.media_type !== "image" && playlistSrc
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

          const useInlineChatLayout = isCollabRoom;
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
            isCollabRoom && currentUser ? (
              <PinButton postId={post.id} userId={currentUser.id} initialPinned={isPinned(post)} />
            ) : undefined;

          return (
            <article
              key={post.id}
              id={post.id}
              data-post-id={post.id}
              className={`relative scroll-mt-20 overflow-hidden border-y border-gray-200 bg-white transition-shadow md:rounded-2xl md:border dark:border-gray-800 dark:bg-gray-950 target:ring-2 target:ring-red-400 ${articleSnapClassFor(isCollabRoom)}`}
            >
              <PostEngagementProvider
                initialLikeCount={likeCount}
                initialCommentCount={commentCount}
                initialWeeklyLikeCount={weeklyLikeCount}
                initialViewCount={post.view_count}
                initialLiked={likedByMeSet.has(post.id)}
                initialKickCount={kickCountMap.get(post.id) ?? 0}
                initialKicked={kickedByMeSet.has(post.id)}
                initialKickers={kickersMap.get(post.id)}
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
                isComplex={isCollabRoom}
                optionsMenu={
                  isOwnPost ? (
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

              {(isPrivate || post.collab_available || post.feedback_focus) && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 pb-2">
                  {/* 피드백 받기(0089) — 작성자가 원하는 의견 분야와 한 줄 요청. */}
                  {post.feedback_focus && (
                    <span
                      title={post.feedback_note ?? undefined}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <CommentIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">피드백 환영 · {feedbackFocusText(post.feedback_focus)}</span>
                    </span>
                  )}
                  {post.feedback_note && (
                    <span className="w-full truncate text-xs text-gray-500 dark:text-gray-400">
                      &ldquo;{post.feedback_note}&rdquo;
                    </span>
                  )}
                  {isPrivate && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      {post.visibility === "invite_only" ? <LockIcon className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
                      {post.visibility === "invite_only" ? "특정인 공개" : "Companion 공개"}
                    </span>
                  )}
                  {post.collab_available && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      콜라보
                    </span>
                  )}
                </div>
              )}

              {post.visibility === "invite_only" ? (
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
                  {/* (옛 memo 피드 시절 주석) "Companion 공개"(followers) 라벨은 없앴었다 — memo가 DEMO에
                      합쳐진 뒤(2026-09-25)로는 캡션 아래 공개 범위 칩으로 다시 표시한다. 옛 설명: memo 피드에 뜨는 글은 이제
                      전부(followers/invite_only 가리지 않고) 방장과 Companion인 사람에게만
                      보이므로, 굳이 이 유형만 따로 표시할 이유가 없다(위 posts 필터 참고). */}
                  {useInlineChatLayout ? null : (
                    <div
                      className={`relative flex w-full items-center justify-center bg-black ${
                        // article이 md:h-auto(내용물 높이 그대로)라 미디어 박스가 남는 공간을
                        // 흡수할 필요 자체가 없다 — 그냥 657px 정사각형 그대로 두면 카드도 딱
                        // 그만큼만 높아지고 여백이 아예 안 생긴다(2026-09-14 최종 확정, 위
                        // feedListClass 설명 참고). 옛 memo 비합작 카드는 878px 고정 프레임이라
                        // md:flex-1로 남는 공간을 흡수했는데, memo가 DEMO에 합쳐지며(2026-09-25)
                        // 고정 프레임은 채팅이 있는 콜라보 글에만 남아 이 분기는 DEMO 방식 하나다.
                        // max-h-[40svh]는 breakpoint 없이 항상 걸리는 값이라(모바일 릴스 프레임용)
                        // flex-1을 안 쓰는 DEMO 분기에서도 md:max-h-none으로 반드시 지워줘야
                        // 한다 — 안 그러면 이 값(990px 기준 396px)이 657px 정사각 미디어보다
                        // 작아서 desktop에서도 영상이 그 안에 잘려 들어간다(재배포 직후 실측
                        // 으로 또 발견·수정 — DEMO/memo 두 분기 모두 이 override가 필요).
                        oneScreenFeed ? "max-md:shrink-0 overflow-hidden max-h-[40svh] md:max-h-none" : ""
                      }`}
                    >
                      {!isPrivate && (
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
                            tone="demo"
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
                    {(post.instrument_tags ?? []).map((tag) => (
                        <Link
                          key={tag}
                          href={`/feed?feed=completion&tag=${encodeURIComponent(tag)}`}
                          className={`rounded-full px-2 py-1 text-xs font-medium transition hover:opacity-70 ${tagColorClass(tag)}`}
                        >
                          #{tag}
                        </Link>
                      ))}
                  </div>

                  {isCollabRoom ? (
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
                      showViewCount
                      likeCount={likeCount}
                      kickCount={kickCountMap.get(post.id) ?? 0}
                      commentCount={commentCount}
                    />
                  ) : (
                currentUser && (
                  // 왼쪽 정렬 아이콘 행(사용자 요청) — 조회수 → 하트 → 댓글 순서. 예전엔
                  // 버튼마다 flex-basis로 폭을 균등 분할했는데, 조회수 아이콘까지 더해지며
                  // 폭 합이 100%를 넘어 줄바꿈이 꼬였다(제보: "아이콘 꼬였어"). 이제 전부
                  // gap만으로 나란히 놓는 guest/mock 줄과 같은 방식이라 몇 개가 오든 안전하다.
                  <div className="border-t border-gray-100 shrink-0">
                  <div className="flex flex-wrap items-center gap-6 px-4 py-3.5">
                    {!isPrivate && (
                      <PostViewCount
                        className="inline-flex items-center gap-1 text-base font-semibold text-gray-600 dark:text-gray-300"
                        iconClassName="h-5 w-5"
                      />
                    )}
                    <LikeButton postId={post.id} userId={currentUser.id} />
                    {/* Kick(0071) — 하트 바로 옆, DEMO 전용 */}
                    {!isPrivate && <KickButton postId={post.id} userId={currentUser.id} isOwnPost={isOwnPost} />}
                    <CommentPanel
                      postId={post.id}
                      userId={currentUser.id}
                      isDemo={!isPrivate}
                      isOwnPost={isOwnPost}
                      feedbackFocus={feedbackFocusText(post.feedback_focus)}
                    />
                    {/* 공유(0076) — PEAK 진행 알림의 행동 버튼, 외부 유입 경로. DEMO 전용. */}
                    {!isPrivate && <ShareButton postId={post.id} title={post.title || post.caption || "Drop"} />}
                    {isOwnPost && isPrivate && (
                      // memo 공동창작 미체크 본인 글은 이 자리에 조회자 목록(인스타
                      // 스토리 참고, 사용자 요청) — DEMO 본인 글은 이 슬롯 자체가 없다.
                      <PostViewedBy
                        postId={post.id}
                        currentUserId={currentUser.id}
                        isOwnPost
                      />
                    )}
                  </div>
                  {!isPrivate && <KickersLine currentUserId={currentUser.id} className="-mt-1.5 px-4 pb-3" />}
                  {/* 업로더용 들은 기록(0084) — 내 DEMO 글에만. */}
                  {!isPrivate && isOwnPost && <ListenInsight postId={post.id} className="-mt-1.5 px-4 pb-3" />}
                  </div>
                )
              )}
                </>
              )}
              </PostFocusToggle>
              </PostEngagementProvider>
            </article>
          );
  });
}

// "안 들은 게시물 → 들은 게시물" 경계(feedQuery.ts pendingDivider).
export function FeedCaughtUpDivider() {
  return (
    <div className="flex items-center gap-3 px-4 py-6 md:mx-auto md:w-full md:max-w-[659px] md:px-0">
      <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      <span className="flex flex-col items-center gap-1 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ✓
        </span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">새 게시물을 모두 확인했어요</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">아래는 이미 들어본 게시물이에요</span>
      </span>
      <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}
