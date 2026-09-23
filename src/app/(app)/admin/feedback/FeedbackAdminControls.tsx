"use client";

// 관리자 피드백 한 건의 처리 상태·답변 편집(0063). 저장하면 admin_updated_at이 갱신돼 작성자
// 알림 패널에 "피드백이 반영됐어요/답변했어요"가 뜨고, /help 채팅엔 realtime UPDATE로 바로 반영된다.
// "반영됨"으로 바꿀 때는 선택적으로 공지사항(announcements)에 반영 소식을 같이 올릴 수 있다 —
// 비공개 피드백 원문이 공지로 새지 않도록 기본은 꺼져 있고, 공지 문구는 관리자가 직접 다듬는다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback";
import { field, errorText } from "@/components/ui/styles";

export function FeedbackAdminControls({
  id,
  content,
  initialStatus,
  initialReply,
  adminUpdatedAt,
}: {
  id: string;
  content: string;
  initialStatus: FeedbackStatus;
  initialReply: string;
  adminUpdatedAt: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FeedbackStatus>(initialStatus);
  const [reply, setReply] = useState(initialReply);
  const [announce, setAnnounce] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("💬 여러분의 의견이 반영됐어요");
  const [announceContent, setAnnounceContent] = useState(
    `보내주신 의견을 반영했어요.\n\n“${content.length > 80 ? `${content.slice(0, 80)}…` : content}”\n\n`,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = status !== initialStatus || reply.trim() !== initialReply.trim();
  const becameDone = status === "done" && initialStatus !== "done";

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
    if (becameDone && announce && announceTitle.trim() && announceContent.trim()) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: annError } = user
        ? await supabase
            .from("announcements")
            .insert({ author_id: user.id, title: announceTitle.trim(), content: announceContent.trim() })
        : { error: { message: "로그인 정보 없음" } };
      if (annError) {
        setSaving(false);
        setError(`상태는 저장됐지만 공지 등록 실패: ${annError.message}`);
        router.refresh();
        return;
      }
    }
    setSaving(false);
    setAnnounce(false);
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
      {becameDone && (
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
            공지사항에 반영 소식도 올리기
          </label>
          {announce && (
            <>
              <input
                type="text"
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="공지 제목"
                className={field}
              />
              <textarea
                value={announceContent}
                onChange={(e) => setAnnounceContent(e.target.value)}
                rows={4}
                placeholder="공지 내용"
                className={field}
              />
              <p className="text-xs text-gray-500">
                전체 회원에게 공개돼요. 비공개 피드백이면 원문 인용을 지우거나 다듬어 주세요.
              </p>
            </>
          )}
        </div>
      )}
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
