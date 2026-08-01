"use client";

// /away 페이지의 피드백 제출 폼 — feedback 테이블(0021_announcements_and_feedback)에 저장.
// 관리자는 /admin/feedback에서 목록으로 확인한다.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, errorText } from "@/components/ui/styles";

export function FeedbackForm({ userId }: { userId: string }) {
  const supabase = createClient();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase
      .from("feedback")
      .insert({ user_id: userId, content: trimmed });
    setSubmitting(false);
    if (insertError) {
      setError(`전송 실패: ${insertError.message}`);
      return;
    }
    setContent("");
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        placeholder="불편했던 점, 있었으면 하는 기능, 무엇이든 편하게 남겨주세요."
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSent(false);
        }}
        rows={4}
        className={field}
      />
      {error && <p className={errorText}>{error}</p>}
      {sent && <p className="text-sm text-green-600">피드백이 전달됐어요. 감사합니다!</p>}
      <Button type="submit" disabled={submitting || !content.trim()} className="self-end px-5">
        {submitting ? "보내는 중..." : "보내기"}
      </Button>
    </form>
  );
}
