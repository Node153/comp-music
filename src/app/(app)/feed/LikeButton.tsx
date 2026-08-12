"use client";

// INTERACT-01: 게시물당 사용자 1회, 토글 가능
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostEngagement } from "@/components/PostEngagementContext";

export function LikeButton({
  postId,
  userId,
  initialLiked,
  className = "",
}: {
  postId: string;
  userId: string;
  initialLiked: boolean;
  className?: string;
}) {
  const supabase = createClient();
  const { likeCount, setLikeCount, setWeeklyLikeCount } = usePostEngagement();
  const [liked, setLiked] = useState(initialLiked);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);

    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    // 지금 누르는 좋아요/취소는 항상 "이번 주" 안에서 일어나는 일이라 weeklyLikeCount도 같이
    // 맞춰준다 — 다만 몇 주 전에 눌러둔 좋아요를 지금 취소하는 경우엔 그 좋아요가 애초에
    // weeklyLikeCount에 안 잡혀있었을 수 있어 미세하게 어긋날 수 있다(다음 새로고침에 정정됨).
    setWeeklyLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));

    const { error } = nextLiked
      ? await supabase.from("likes").insert({ post_id: postId, user_id: userId })
      : await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);

    if (error) {
      // 실패 시 낙관적 업데이트 롤백
      setLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
      setWeeklyLikeCount((c) => Math.max(0, c + (nextLiked ? -1 : 1)));
    }

    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={liked}
      className={`flex items-center justify-center gap-2 py-3.5 text-base font-semibold transition hover:bg-gray-50 ${
        liked ? "text-red-600" : "text-gray-600"
      } ${className}`}
    >
      <span className="text-lg">{liked ? "❤️" : "🤍"}</span>
      좋아요{likeCount > 0 ? ` ${likeCount}` : ""}
    </button>
  );
}
