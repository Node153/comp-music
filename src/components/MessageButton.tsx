"use client";

// DM-01: 게시물 상세 또는 프로필에서 1:1 대화 시작
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findOrCreateConversation } from "@/lib/conversations";

export function MessageButton({
  currentUserId,
  otherUserId,
  sourcePostId,
  className,
  children,
}: {
  currentUserId: string;
  otherUserId: string;
  sourcePostId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);

    try {
      const conversationId = await findOrCreateConversation(supabase, currentUserId, otherUserId);
      const query = sourcePostId ? `?sourcePostId=${sourcePostId}` : "";
      router.push(`/messages/${conversationId}${query}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className={className}>
      {children}
    </button>
  );
}
