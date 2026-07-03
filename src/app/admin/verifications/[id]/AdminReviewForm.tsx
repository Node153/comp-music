"use client";

// AUTH-04/06: 승인/반려 처리 시 users.status 갱신 + reviewer_id/reviewed_at 기록
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminReviewForm({
  verificationId,
  userId,
}: {
  verificationId: string;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: "approved" | "rejected") {
    setError(null);
    setLoading(true);

    const {
      data: { user: admin },
    } = await supabase.auth.getUser();

    const { error: verificationError } = await supabase
      .from("verifications")
      .update({
        status: decision,
        reviewer_id: admin?.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: decision === "rejected" ? reason : null,
      })
      .eq("id", verificationId);

    const { error: userError } = await supabase
      .from("users")
      .update({ status: decision })
      .eq("id", userId);

    setLoading(false);

    if (verificationError || userError) {
      setError((verificationError ?? userError)?.message ?? "처리 중 오류가 발생했습니다.");
      return;
    }

    router.push("/admin/verifications");
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <textarea
        placeholder="반려 사유 (반려 시 필수)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded border px-3 py-2"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => review("approved")}
          className="flex-1 rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          승인
        </button>
        <button
          type="button"
          disabled={loading || !reason.trim()}
          onClick={() => review("rejected")}
          className="flex-1 rounded border px-3 py-2 disabled:opacity-50"
        >
          반려
        </button>
      </div>
    </div>
  );
}
