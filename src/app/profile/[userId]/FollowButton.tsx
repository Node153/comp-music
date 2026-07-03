"use client";

// PROFILE-02: 단방향 팔로우/언팔로우
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FollowButton({
  currentUserId,
  targetUserId,
  initialFollowing,
}: {
  currentUserId: string;
  targetUserId: string;
  initialFollowing: boolean;
}) {
  const supabase = createClient();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);

    const next = !following;
    setFollowing(next);

    const { error } = next
      ? await supabase
          .from("follows")
          .insert({ follower_id: currentUserId, followee_id: targetUserId })
      : await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("followee_id", targetUserId);

    if (error) setFollowing(!next);
    setPending(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        following ? "border" : "bg-black text-white"
      }`}
    >
      {following ? "팔로잉" : "팔로우"}
    </button>
  );
}
