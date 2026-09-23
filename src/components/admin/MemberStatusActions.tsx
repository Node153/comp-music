"use client";

// 서류 심사가 꺼져있는 동안(featureFlags.ts) 관리자가 회원 관리 화면에서 서류 없이 바로
// 승인/반려하기 위한 액션. AdminReviewForm.tsx(/admin/verifications)와 같은 패턴 —
// users_update_admin RLS 정책(관리자 세션이면 users.status 갱신 허용)에 기대어 일반 클라이언트로
// 처리한다(service-role 불필요). status가 pending일 때만 노출.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MemberStatusActions({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 승인 자체는 성공했는데 알림 메일만 실패한 경우 — status가 이미 pending이 아니게 돼서
  // 버튼 자체는 사라지지만, 이 경고만은 남겨서 관리자가 놓치지 않게 한다.
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  if (status !== "pending") {
    return emailWarning ? <p className="text-xs text-amber-600">{emailWarning}</p> : null;
  }

  async function decide(decision: "approved" | "rejected") {
    setError(null);
    setLoading(decision);
    const { error: updateError } = await supabase
      .from("users")
      .update({ status: decision })
      .eq("id", userId);
    setLoading(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (decision === "approved") {
      // 승인 자체는 이미 끝났으니 메일 발송 실패가 화면 진행을 막진 않되, 조용히 묻히지
      // 않도록 경고 문구로 남긴다.
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

    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => decide("approved")}
          className="rounded-lg bg-black px-2.5 py-1 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {loading === "approved" ? "처리 중..." : "승인"}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => decide("rejected")}
          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          {loading === "rejected" ? "처리 중..." : "반려"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
