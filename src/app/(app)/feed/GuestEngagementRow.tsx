"use client";

// 로그인 전 미리보기(0024)에서 좋아요/댓글 자리 — 숫자만 정적으로 보여주다가, 누르면
// (실제 게시물이든 mock 샘플이든 구분 없이) 가입 유도 안내를 띄운다(행동 기준 트리거).
import { useGuestSignupPrompt } from "@/components/GuestSignupPrompt";

export function GuestEngagementRow({
  likeCount,
  commentCount,
}: {
  likeCount: number;
  commentCount: number;
}) {
  const prompt = useGuestSignupPrompt();

  return (
    <button
      type="button"
      onClick={prompt}
      className="flex w-full items-center gap-6 border-t border-gray-100 px-4 py-3.5 text-left text-base font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
    >
      <span>❤️ {likeCount > 0 ? likeCount : ""}</span>
      <span>💬 {commentCount > 0 ? commentCount : ""}</span>
    </button>
  );
}
