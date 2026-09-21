"use client";

// 대화창을 실제로 열었을 때만 읽음 처리 (prefetch로 인한 오탐 방지, MarkNotificationsSeen과 동일 패턴)
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function MarkMessagesRead({ conversationId }: { conversationId: string }) {
  const supabase = createClient();

  useEffect(() => {
    async function markRead() {
      await supabase.rpc("mark_messages_read", { p_conversation_id: conversationId });
    }
    void markRead();
  }, [conversationId, supabase]);

  return null;
}
