"use client";

// 회원에게 메일 보내기 모달 — 상세 패널(한 명)과 하단 일괄 작업 바(선택한 여러 명)에서 연다.
// 실제 발송은 /api/admin/send-member-email(RESEND 키는 서버 전용). 본문의 {이름}은 받는 사람
// 실명으로 바뀐다. 템플릿을 고르면 제목/본문이 채워지고 그대로 고쳐 쓸 수 있다.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const TEMPLATES = [
  {
    key: "approval_contact",
    label: "승인 요청 안내",
    subject: "[Compmusic] 가입 승인을 위해 초대해준 운영자에게 연락 부탁드려요",
    body: `안녕하세요, {이름}님. Compmusic에 가입해주셔서 감사합니다.

Compmusic은 운영자의 초대를 받은 분들만 이용할 수 있어서, 가입 시 입력한 이름으로 본인 확인을 거쳐 승인하고 있어요. 그런데 가입하신 정보만으로는 어떤 분인지 확인이 어려워 아직 승인 대기 중입니다.

번거로우시겠지만 Compmusic에 초대해준 운영자에게 직접 연락해서 가입했다고 알려주세요. 확인되는 대로 바로 승인해드릴게요.

감사합니다.
Compmusic 운영팀`,
  },
  { key: "blank", label: "직접 작성", subject: "", body: "" },
] as const;

export type EmailRecipient = { id: string; name: string };

export function MemberEmailComposer({
  recipients,
  onClose,
  onSent,
}: {
  recipients: EmailRecipient[];
  onClose: () => void;
  onSent?: (message: string) => void;
}) {
  const [template, setTemplate] = useState<string>(TEMPLATES[0].key);
  const [subject, setSubject] = useState<string>(TEMPLATES[0].subject);
  const [body, setBody] = useState<string>(TEMPLATES[0].body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  function pickTemplate(key: string) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setTemplate(key);
    setSubject(t.subject);
    setBody(t.body);
  }

  async function send() {
    if (!subject.trim() || !body.trim()) {
      setError("제목과 본문을 입력해주세요");
      return;
    }
    const who = recipients.length === 1 ? `${recipients[0].name}님에게` : `${recipients.length}명에게`;
    if (!confirm(`${who} 메일을 보낼까요?`)) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/admin/send-member-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: recipients.map((r) => r.id), subject, body }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { sent?: number; failed?: string[]; error?: string } | null;
    setSending(false);
    if (!res?.ok || !data) {
      setError(data?.error ?? "발송에 실패했어요");
      return;
    }
    const failed = data.failed ?? [];
    onSent?.(failed.length ? `${data.sent}명 발송, 실패: ${failed.join(", ")}` : `${data.sent}명에게 메일을 보냈어요`);
    onClose();
  }

  const names = recipients.map((r) => r.name);
  const input =
    "w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] text-gray-900 focus:border-gray-900 focus:outline-none";

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 md:items-center"
      // 포털이어도 React 이벤트는 부모(상세 패널 배경)로 버블링돼 패널까지 닫히므로 여기서 끊는다.
      onClick={(e) => {
        e.stopPropagation();
        if (!sending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="메일 보내기"
        className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">메일 보내기</h2>
          <p className="text-xs text-gray-500" title={names.join(", ")}>
            받는 사람: {names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}명`}
          </p>
        </div>

        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickTemplate(t.key)}
              className={`flex-1 rounded-lg py-1.5 transition ${
                template === t.key ? "bg-white font-semibold text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">제목</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">본문</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            maxLength={5000}
            className={`${input} resize-y leading-relaxed`}
          />
          <span className="text-[11px] text-gray-400">{"{이름}"}은 받는 사람의 가입 이름으로 바뀌어요. 보낸 기록은 관리자 메모에 남아요.</span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !subject.trim() || !body.trim()}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
          >
            {sending ? "보내는 중..." : "보내기"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
