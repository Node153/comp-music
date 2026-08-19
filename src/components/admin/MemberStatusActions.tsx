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

  if (status !== "pending") return null;

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
