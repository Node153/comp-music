"use client";

// 관리자 피드백 한 건의 처리 상태·답변 편집(0063). 저장하면 admin_updated_at이 갱신돼 작성자
// 알림 패널에 "피드백이 반영됐어요/답변했어요"가 뜨고, /help 채팅엔 realtime UPDATE로 바로 반영된다.
// 반영 소식 공지는 여기서 한 건씩 올리지 않고, 목록에서 여러 건을 골라 AnnounceSelection의
// "반영 공지 만들기"로 한 번에 만든다(0067 — 같은 요청 여러 건 → 공지 하나).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback";
import { field, errorText } from "@/components/ui/styles";

export function FeedbackAdminControls({
  id,
  initialStatus,
  initialReply,
  adminUpdatedAt,
}: {
  id: string;
  initialStatus: FeedbackStatus;
  initialReply: string;
  adminUpdatedAt: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FeedbackStatus>(initialStatus);
  const [reply, setReply] = useState(initialReply);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = status !== initialStatus || reply.trim() !== initialReply.trim();

  async function save() {
    if (!changed || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("feedback_messages")
      .update({ status, admin_reply: reply.trim() || null, admin_updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) {
      setSaving(false);
      setError(`저장 실패: ${updateError.message}`);
      return;
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FEEDBACK_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              status === s.value ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s.label}
          </button>
        ))}
        {adminUpdatedAt && (
          <span className="ml-auto text-xs text-gray-400">
            마지막 처리 {new Date(adminUpdatedAt).toLocaleString("ko-KR")}
          </span>
        )}
      </div>
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="작성자에게 보낼 답변 (선택) — 비공개 피드백이면 작성자만, 공개면 전체 회원이 봅니다"
        className={field}
      />
      {error && <p className={errorText}>{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={!changed || saving}
        className="self-end rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
      >
        {saving ? "저장 중..." : "저장하고 작성자에게 알리기"}
      </button>
    </div>
  );
}
