"use client";

// INTERACT-01: 게시물당 사용자 1회, 토글 가능
// liked 상태는 PostEngagementContext에서 공유 — 더블탭 좋아요(usePostLike)와 같은 값을
// 봐야 버튼으로 누르든 더블탭하든 화면이 항상 일치한다(초기값은 Provider의 initialLiked).
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { HeartIcon } from "@/components/icons";

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
  const { likeCount, setLikeCount, setWeeklyLikeCount, liked, setLiked } = usePostEngagement();
  const [pending, setPending] = useState(false);
  // 버튼을 눌러 좋아요를 켤 때 "Kick!" 문구가 잠깐 떠올랐다 사라지는 연출(사용자 요청).
  // key를 매번 새 값으로 바꿔야 연속으로 눌러도 애니메이션이 다시 재생된다.
  const [kickKey, setKickKey] = useState<number | null>(null);

  async function toggle() {
    if (pending) return;
    setPending(true);

    const nextLiked = !liked;
    setLiked(nextLiked);
    if (nextLiked) setKickKey((k) => (k ?? 0) + 1);
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
    <span className="relative inline-flex">
      {kickKey !== null && (
        <span
          key={kickKey}
          onAnimationEnd={() => setKickKey(null)}
          className="pointer-events-none absolute left-1/2 top-0 z-10 animate-kick-pop whitespace-nowrap text-sm font-extrabold text-red-600"
        >
          Kick!
        </span>
      )}
      <button
        onClick={toggle}
        aria-pressed={liked}
        className={`inline-flex items-center gap-1 text-base font-semibold transition ${
          liked ? "text-red-600" : "text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
        } ${className}`}
      >
        <HeartIcon className="h-5 w-5" filled={liked} />
        {likeCount > 0 ? likeCount : ""}
      </button>
    </span>
  );
}
