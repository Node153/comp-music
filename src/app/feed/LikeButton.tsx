"use client";

// INTERACT-01: 게시물당 사용자 1회, 토글 가능
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LikeButton({
  postId,
  userId,
  initialLiked,
  initialCount,
}: {
  postId: string;
  userId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);

    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));

    const { error } = nextLiked
      ? await supabase.from("likes").insert({ post_id: postId, user_id: userId })
      : await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);

    if (error) {
      // 실패 시 낙관적 업데이트 롤백
      setLiked(!nextLiked);
      setCount((c) => c + (nextLiked ? -1 : 1));
    }

    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      className="flex flex-col items-center gap-1 text-white"
      aria-pressed={liked}
    >
      <span className={`text-2xl ${liked ? "" : "opacity-60"}`}>{liked ? "❤️" : "🤍"}</span>
      <span className="text-xs">{count}</span>
    </button>
  );
}
