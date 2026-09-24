"use client";

// INTERACT-01: 게시물당 사용자 1회, 토글 가능 — 단, Kick(0071)한 게시물은 좋아요가 켜진 채
// 잠긴다(Kick 번복 불가 규칙의 연장, DB likes_delete_self 정책도 같은 조건으로 막음).
// liked 상태는 PostEngagementContext에서 공유 — 더블탭 좋아요(usePostLike)와 같은 값을
// 봐야 버튼으로 누르든 더블탭하든 화면이 항상 일치한다(초기값은 Provider의 initialLiked).
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { HeartIcon } from "@/components/icons";
import { notifyReaction } from "@/lib/notifyReaction";

export function LikeButton({
  postId,
  userId,
  className = "",
}: {
  postId: string;
  userId: string;
  className?: string;
}) {
  const supabase = createClient();
  const { likeCount, setLikeCount, setWeeklyLikeCount, liked, setLiked, kicked } = usePostEngagement();
  const [pending, setPending] = useState(false);
  // 좋아요를 켤 때마다 하트가 톡 튀는 작은 연출 — key를 바꿔 애니메이션을 다시 건다.
  // (예전엔 여기서 카드 중앙 "Kick!" 연출을 띄웠는데, 이제 그건 Kick 전용이다.)
  const [bumpKey, setBumpKey] = useState(0);
  const locked = kicked && liked;

  async function toggle() {
    if (pending || locked) return;
    setPending(true);

    const nextLiked = !liked;
    setLiked(nextLiked);
    if (nextLiked) setBumpKey((k) => k + 1);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    // 지금 누르는 좋아요/취소는 항상 "이번 주" 안에서 일어나는 일이라 weeklyLikeCount도 같이
    // 맞춰준다 — 다만 몇 주 전에 눌러둔 좋아요를 지금 취소하는 경우엔 그 좋아요가 애초에
    // weeklyLikeCount에 안 잡혀있었을 수 있어 미세하게 어긋날 수 있다(다음 새로고침에 정정됨).
    setWeeklyLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));

    const { error } = nextLiked
      ? await supabase.from("likes").insert({ post_id: postId, user_id: userId })
      : await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);

    if (!error && nextLiked) notifyReaction({ kind: "like", postId });
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
      aria-label="좋아요"
      title={locked ? "Kick한 게시물은 좋아요를 취소할 수 없어요" : undefined}
      className={`inline-flex items-center gap-1 text-base font-semibold transition ${
        liked ? "text-red-600" : "text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
      } ${locked ? "cursor-default" : ""} ${className}`}
    >
      <HeartIcon key={bumpKey} className={`h-5 w-5 ${bumpKey > 0 ? "animate-like-bump" : ""}`} filled={liked} />
      {likeCount > 0 ? likeCount : ""}
    </button>
  );
}
