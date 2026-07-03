"use client";

// 대화창을 실제로 열었을 때만 읽음 처리 (prefetch로 인한 오탐 방지, MarkNotificationsSeen과 동일 패턴)
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function MarkMessagesRead({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const supabase = createClient();

  useEffect(() => {
    async function markRead() {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", currentUserId)
        .is("read_at", null);
    }
    void markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  return null;
}
