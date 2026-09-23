"use client";

// 자동 생성된 릴리즈 노트 초안(0070) 게시 — status를 published로 바꾸고 created_at을 지금으로
// 올려서, 회원 쪽에서 "새 소식"(피드백 아이콘 점·홈 배너)으로 잡히게 한다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PublishDraftButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function publish() {
    if (pending) return;
    if (!confirm("이 초안을 회원에게 게시할까요?")) return;
    setPending(true);
    const now = new Date().toISOString();
    const { error } = await createClient()
      .from("announcements")
      .update({ status: "published", created_at: now, updated_at: now })
      .eq("id", id);
    setPending(false);
    if (error) alert(`게시 실패: ${error.message}`);
    else router.refresh();
  }

  return (
    <button
      type="button"
      onClick={publish}
      disabled={pending}
      className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "게시 중..." : "게시"}
    </button>
  );
}
