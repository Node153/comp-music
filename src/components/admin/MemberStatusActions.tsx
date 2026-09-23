"use client";

// 회원 관리 화면의 회원별 조치 — 대기 회원 빠른 승인/반려 버튼 + "관리" 모달(정지·해제·
// 상태 변경·권한 변경). 모든 변경은 admin_set_member_status / admin_set_member_role(0064)
// security definer 함수로만 한다 — 함수 안에서 admin_actions 감사 로그를 남기고, 본인 변경·
// 마지막 관리자 강등·사유 누락 같은 규칙도 DB에서 강제한다(여기 UI 검사는 편의용일 뿐).
// 서류 심사가 꺼져있는 동안(featureFlags.ts) 서류 없이 바로 승인/반려하는 경로이기도 하다.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, errorText, label } from "@/components/ui/styles";

const SUSPEND_OPTIONS = [
  { value: "1", label: "1일" },
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
  { value: "permanent", label: "영구" },
] as const;

type Mode = "status" | "role";

export function MemberStatusActions({
  userId,
  name,
  status,
  role,
  isSelf,
}: {
  userId: string;
  name: string;
  status: string;
  role: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 승인 자체는 성공했는데 알림 메일만 실패한 경우 — 버튼 상태가 바뀌어도 이 경고만은 남겨서
  // 관리자가 놓치지 않게 한다.
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("status");
  const [nextStatus, setNextStatus] = useState("");
  const [duration, setDuration] = useState<string>("7");
  const [reason, setReason] = useState("");

  if (status === "withdrawn" || isSelf) {
    return emailWarning ? <p className="text-xs text-amber-600">{emailWarning}</p> : null;
  }

  async function notifyApproval() {
    try {
      const res = await fetch("/api/admin/notify-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setEmailWarning(`승인은 됐지만 알림 메일 발송에 실패했어요: ${body.error ?? res.status}`);
      }
    } catch {
      setEmailWarning("승인은 됐지만 알림 메일 발송에 실패했어요 (네트워크 오류)");
    }
  }

  async function setStatus(target: string, why: string | null, until: string | null) {
    setError(null);
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("admin_set_member_status", {
      p_target: userId,
      p_status: target,
      p_reason: why,
      p_until: until,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    // 대기/반려에서 처음 승인될 때만 "이제 이용할 수 있어요" 메일 — 정지 해제는 제외.
    if (target === "approved" && (status === "pending" || status === "rejected")) {
      await notifyApproval();
    }
    router.refresh();
    return true;
  }

  async function submit() {
    if (mode === "role") {
      setError(null);
      setLoading(true);
      const { error: rpcError } = await supabase.rpc("admin_set_member_role", {
        p_target: userId,
        p_role: role === "admin" ? "user" : "admin",
        p_reason: reason,
      });
      setLoading(false);
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      router.refresh();
      closeModal();
      return;
    }
    const until =
      nextStatus === "suspended" && duration !== "permanent"
        ? new Date(Date.now() + Number(duration) * 24 * 60 * 60 * 1000).toISOString()
        : null;
    if (await setStatus(nextStatus, reason.trim() || null, until)) closeModal();
  }

  function openModal(m: Mode, s = "") {
    setMode(m);
    setNextStatus(s);
    setReason("");
    setDuration("7");
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
  }

  // 현재 상태에서 갈 수 있는 상태들
  const transitions: { value: string; label: string; danger?: boolean }[] =
    status === "pending"
      ? [
          { value: "approved", label: "승인" },
          { value: "rejected", label: "반려", danger: true },
        ]
      : status === "approved"
        ? [
            { value: "suspended", label: "이용 정지", danger: true },
            { value: "rejected", label: "반려로 변경", danger: true },
          ]
        : status === "suspended"
          ? [{ value: "approved", label: "정지 해제" }]
          : status === "rejected"
            ? [
                { value: "approved", label: "승인으로 변경" },
                { value: "pending", label: "대기로 되돌리기" },
              ]
            : [];

  const reasonRequired = mode === "role" || nextStatus === "suspended";
  const canSubmit =
    !loading && (mode === "role" || nextStatus !== "") && (!reasonRequired || reason.trim() !== "");

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1.5">
        {status === "pending" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => setStatus("approved", null, null)}
            className="rounded-lg bg-black px-2.5 py-1 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "처리 중..." : "승인"}
          </button>
        )}
        <button
          type="button"
          onClick={() => openModal("status")}
          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
        >
          관리
        </button>
      </div>
      {error && !open && <p className="text-xs text-red-600">{error}</p>}
      {emailWarning && <p className="text-xs text-amber-600">{emailWarning}</p>}

      {/* 테이블 셀(overflow 스크롤 컨테이너) 안에서 열리므로 body로 포털 — 조상에 transform 등이
          있으면 fixed가 뷰포트 기준이 아니게 되는 문제를 피한다. */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 md:items-center"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex w-full max-w-md flex-col gap-4 whitespace-normal rounded-2xl bg-white p-5 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{name} 회원 관리</h2>
              <p className="text-xs text-gray-500">모든 조치는 활동 로그에 기록돼요.</p>
            </div>

            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
              {(["status", "role"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => openModal(m)}
                  className={`flex-1 rounded-lg py-1.5 transition ${
                    mode === m ? "bg-white font-semibold text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {m === "status" ? "상태" : "권한"}
                </button>
              ))}
            </div>

            {mode === "status" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {transitions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setNextStatus(t.value)}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        nextStatus === t.value
                          ? t.danger
                            ? "border-red-500 bg-red-50 font-semibold text-red-700"
                            : "border-black bg-black font-semibold text-white"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {nextStatus === "suspended" && (
                  <div className="flex flex-col gap-1.5">
                    <span className={label}>정지 기간</span>
                    <div className="flex gap-2">
                      {SUSPEND_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setDuration(o.value)}
                          className={`flex-1 rounded-xl border py-2 text-sm transition ${
                            duration === o.value
                              ? "border-black font-semibold text-gray-900"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      정지 중에는 서비스를 이용할 수 없고, 기간이 끝나면 다음 접속 시 자동으로 풀려요.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-700">
                현재 권한: <strong>{role === "admin" ? "관리자" : "일반"}</strong> →{" "}
                <strong>{role === "admin" ? "일반" : "관리자"}</strong>
                {role !== "admin" && (
                  <span className="mt-1 block text-xs text-amber-600">
                    관리자는 모든 회원 정보와 관리자 메뉴에 접근할 수 있어요.
                  </span>
                )}
              </p>
            )}

            {(mode === "role" || nextStatus !== "") && (
              <label className="flex flex-col gap-1.5">
                <span className={label}>
                  사유 {reasonRequired ? <span className="text-red-600">*</span> : <span className="text-gray-400">(선택)</span>}
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={
                    nextStatus === "suspended"
                      ? "본인에게도 표시돼요. 예: 커뮤니티 가이드라인 3조 위반(타인 비방)"
                      : nextStatus === "rejected"
                        ? "본인에게도 표시돼요."
                        : "관리 기록용"
                  }
                  className={field}
                />
              </label>
            )}

            {error && <p className={errorText}>{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={closeModal}>
                취소
              </Button>
              <Button
                type="button"
                variant={mode === "status" && (nextStatus === "suspended" || nextStatus === "rejected") ? "danger" : "primary"}
                disabled={!canSubmit}
                onClick={submit}
              >
                {loading ? "처리 중..." : "적용"}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
