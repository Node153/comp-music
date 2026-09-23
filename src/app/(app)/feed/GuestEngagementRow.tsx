"use client";

// 로그인 전 미리보기(0024)에서 좋아요/댓글 자리 — 숫자만 정적으로 보여주다가, 누르면
// (실제 게시물이든 mock 샘플이든 구분 없이) 가입 유도 안내를 띄운다(행동 기준 트리거).
import { useGuestSignupPrompt } from "@/components/GuestSignupPrompt";
import { HeartIcon, CommentIcon, KickIcon } from "@/components/icons";
import { PostViewCount } from "@/components/PostViewCount";

export function GuestEngagementRow({
  likeCount,
  kickCount,
  commentCount,
  showViewCount = true,
}: {
  likeCount: number;
  // Kick(0071)은 DEMO 전용 — memo 카드에선 안 넘겨서 아이콘 자체를 숨긴다.
  kickCount?: number;
  commentCount: number;
  showViewCount?: boolean;
}) {
  const prompt = useGuestSignupPrompt();

  return (
    <button
      type="button"
      onClick={prompt}
      className="flex w-full items-center gap-6 border-t border-gray-100 px-4 py-3.5 text-left text-base font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
    >
      {showViewCount && <PostViewCount className="inline-flex items-center gap-1" iconClassName="h-4 w-4" />}
      <span className="inline-flex items-center gap-1"><HeartIcon className="h-4 w-4" /> {likeCount > 0 ? likeCount : ""}</span>
      {kickCount !== undefined && (
        <span className="inline-flex items-center gap-1"><KickIcon className="h-4 w-4" /> {kickCount > 0 ? kickCount : ""}</span>
      )}
      <span className="inline-flex items-center gap-1"><CommentIcon className="h-4 w-4" /> {commentCount > 0 ? commentCount : ""}</span>
    </button>
  );
}
