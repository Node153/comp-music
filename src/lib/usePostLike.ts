"use client";

// 더블탭 좋아요(인스타그램 참고) — 항상 "좋아요"만 하고 취소는 안 한다(이미 좋아요
// 상태면 DB 호출 없이 하트 애니메이션만 보여준다). LikeButton과 같은 PostEngagementContext
// 상태(liked/likeCount/weeklyLikeCount)를 공유해서, 버튼으로 누르든 더블탭하든 화면이
// 항상 같은 값을 보여준다.
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { notifyReaction } from "@/lib/notifyReaction";

export function usePostLike(postId: string, userId: string) {
  const { liked, setLiked, setLikeCount, setWeeklyLikeCount } = usePostEngagement();

  const likeOnly = useCallback(async () => {
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    setWeeklyLikeCount((c) => c + 1);

    const { error } = await createClient().from("likes").insert({ post_id: postId, user_id: userId });
    if (!error) notifyReaction({ kind: "like", postId });
    if (error) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      setWeeklyLikeCount((c) => Math.max(0, c - 1));
    }
  }, [liked, setLiked, setLikeCount, setWeeklyLikeCount, postId, userId]);

  return { liked, likeOnly };
}
