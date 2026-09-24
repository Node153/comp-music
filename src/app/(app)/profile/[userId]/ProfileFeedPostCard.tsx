"use client";

// 데스크톱 프로필 오른쪽 컬럼의 "자기 피드" 카드(3단계, 페이스북 참고) — 메인 피드
// (feed/page.tsx)의 DEMO 카드와 같은 미디어·좋아요·댓글 컴포넌트를 그대로 재사용한다.
// 다만 프로필 안이라 항상 이 프로필 주인의 글만 보여주므로 memo/합작/샘플/작성자 헤더 같은
// 피드 전용 개념(PostFocusToggle, ComplexAccessGate, EngagementMeter 등)은 들어오지 않는다.
import { PostEngagementProvider } from "@/components/PostEngagementContext";
import { KickBurst } from "@/components/KickBurst";
import { PostCaption } from "@/components/PostCaption";
import { PostVideo } from "@/components/PostVideo";
import { SoundbarPlayer } from "@/components/SoundbarPlayer";
import { DoubleTapLikeArea } from "@/components/DoubleTapLikeArea";
import { PostViewCount } from "@/components/PostViewCount";
import { GuestEngagementRow } from "@/app/(app)/feed/GuestEngagementRow";
import { LikeButton } from "@/app/(app)/feed/LikeButton";
import { KickButton } from "@/app/(app)/feed/KickButton";
import { KickersLine } from "@/app/(app)/feed/KickersLine";
import { CommentPanel } from "@/app/(app)/feed/CommentPanel";
import { tagColorClass } from "@/lib/feedConstants";
import Link from "next/link";
import type { ContentType } from "@/types/database";
import type { FeedPost } from "./ProfileFeed";
import { ProfilePinButton } from "./ProfilePinButton";
import { PinIcon } from "@/components/icons";

// feed/page.tsx의 CONTENT_TYPE_LABEL과 동일 — 그 파일은 page.tsx라 export가 없어 그대로 복사.
const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  composition: "작곡",
  performance: "연주",
  practice: "연습",
  rehearsal: "리허설",
  improv: "즉흥",
  ensemble: "합주",
};

export function ProfileFeedPostCard({
  post,
  currentUserId,
  showAuthor = false,
  canPin = false,
}: {
  post: FeedPost;
  currentUserId: string | null;
  // 본인 프로필의 본인 글에서만(0075) — 좋아요/Kick 필터의 남의 글엔 안 붙는다.
  canPin?: boolean;
  // "좋아요"·"Kick" 필터에서만 켠다 — 현재/보관된/폴더는 항상 이 프로필 주인의 글이라 다시 밝힐
  // 필요가 없다(2026-09, 사운드클라우드 Likes 탭 참고).
  showAuthor?: boolean;
}) {
  // Kick(0071)은 DEMO(전체공개) 게시물 전용.
  const isDemo = post.visibility === "public";
  // 제목 위에 한 줄(작성자 이름 또는 "상단 고정 게시물")이 이미 있으면 제목 위 여백을 줄인다.
  const hasTopLabel = showAuthor || !!post.pinnedAt;
  return (
    <PostEngagementProvider
      initialLikeCount={post.likeCount}
      initialCommentCount={post.commentCount}
      initialWeeklyLikeCount={0}
      initialViewCount={post.view_count}
      initialLiked={post.likedByMe}
      initialKickCount={post.kickCount}
      initialKicked={post.kickedByMe}
      initialKickers={post.kickers}
      peakThreshold={0}
    >
      <article
        data-post-id={post.id}
        className="relative scroll-mt-6 overflow-hidden rounded-xl border border-box-gray"
      >
        <KickBurst />
        {canPin && (
          <div className="absolute right-1.5 top-1.5 z-10">
            <ProfilePinButton postId={post.id} pinned={!!post.pinnedAt} />
          </div>
        )}
        {post.pinnedAt && !showAuthor && (
          <p className="flex items-center gap-1 px-3 pt-3 text-xs font-semibold text-active-gray">
            <PinIcon className="h-3.5 w-3.5" filled />
            상단 고정 게시물
          </p>
        )}
        {showAuthor && (
          <Link
            href={`/profile/${post.authorId}`}
            className="block px-3 pt-3 text-xs font-medium text-active-gray hover:underline"
          >
            {post.authorName}
          </Link>
        )}
        {post.title && (
          <p
            className={`px-3 pb-0.5 ${hasTopLabel ? "pt-1" : "pt-3"} ${canPin ? "pr-11" : ""} text-sm font-bold text-black`}
          >
            {post.title}
          </p>
        )}
        {post.caption && (
          <PostCaption
            text={post.caption}
            className={`px-3 ${post.title ? "" : `${hasTopLabel ? "pt-1" : "pt-3"} ${canPin ? "pr-11" : ""}`} pb-2 text-sm text-black`}
          />
        )}

        <div className="relative flex w-full items-center justify-center bg-black">
          {post.videoSrc && post.media_type === "image" ? (
            currentUserId ? (
              <DoubleTapLikeArea postId={post.id} userId={currentUserId}>
                <img src={post.videoSrc} alt={post.title || post.caption || "이미지 게시물"} className="w-full object-cover" />
              </DoubleTapLikeArea>
            ) : (
              <img src={post.videoSrc} alt={post.title || post.caption || "이미지 게시물"} className="w-full object-cover" />
            )
          ) : post.videoSrc && post.media_type === "audio" ? (
            <div className="w-full">
              <SoundbarPlayer
                src={post.videoSrc}
                title={post.title || post.caption || "음원"}
                posterSrc={post.posterSrc}
                tone="demo"
                mode={currentUserId ? "global" : "inline"}
                trackId={post.id}
                author={post.authorName}
                viewerId={currentUserId ?? undefined}
              />
            </div>
          ) : post.videoSrc ? (
            <div className="w-full">
              <PostVideo
                postId={post.id}
                title={post.title || post.caption || "영상"}
                author={post.authorName}
                videoSrc={post.videoSrc}
                posterSrc={post.posterSrc}
                tone="demo"
                viewerId={currentUserId ?? undefined}
              />
            </div>
          ) : (
            <p className="py-24 text-sm text-active-gray">미디어를 불러올 수 없습니다</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          {post.content_type && (
            <span className="rounded-full border border-box-gray px-2 py-1 text-xs text-black">
              {CONTENT_TYPE_LABEL[post.content_type]}
            </span>
          )}
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

        {!currentUserId ? (
          <GuestEngagementRow
            likeCount={post.likeCount}
            kickCount={isDemo ? post.kickCount : undefined}
            commentCount={post.commentCount}
          />
        ) : (
          <div className="border-t border-main-gray">
            <div className="flex flex-wrap items-center gap-6 px-4 py-3.5">
              <PostViewCount className="inline-flex items-center gap-1 text-sm font-semibold text-black" iconClassName="h-4 w-4" />
              <LikeButton postId={post.id} userId={currentUserId} />
              {isDemo && (
                <KickButton postId={post.id} userId={currentUserId} isOwnPost={post.authorId === currentUserId} />
              )}
              <CommentPanel postId={post.id} userId={currentUserId} isDemo isOwnPost={post.authorId === currentUserId} />
            </div>
            {isDemo && <KickersLine currentUserId={currentUserId} className="-mt-1.5 px-4 pb-3" />}
          </div>
        )}
      </article>
    </PostEngagementProvider>
  );
}
