"use client";

// AUTH-04/06: 승인/반려 처리 시 users.status 갱신(+감사 로그) + reviewer_id/reviewed_at 기록
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, errorText } from "@/components/ui/styles";

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

    // users.status는 감사 로그가 남는 admin_set_member_status(0064)로만 바꾼다.
    const { error: userError } = await supabase.rpc("admin_set_member_status", {
      p_target: userId,
      p_status: decision,
      p_reason: decision === "rejected" ? reason : null,
    });

    setLoading(false);

    if (verificationError || userError) {
      setError((verificationError ?? userError)?.message ?? "처리 중 오류가 발생했습니다.");
      return;
    }

    if (decision === "approved") {
      // 승인 자체는 이미 끝났으니 메일 발송 실패로 화면 이동까지 막진 않되, 실패 사실은
      // 알 수 있게 잠깐 멈춰서 보여준다.
      try {
        const res = await fetch("/api/admin/notify-approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(`승인은 됐지만 알림 메일 발송에 실패했어요: ${body.error ?? res.status}`);
          setTimeout(() => {
            router.push("/admin/verifications");
            router.refresh();
          }, 2500);
          return;
        }
      } catch {
        setError("승인은 됐지만 알림 메일 발송에 실패했어요 (네트워크 오류)");
        setTimeout(() => {
          router.push("/admin/verifications");
          router.refresh();
        }, 2500);
        return;
      }
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
        rows={2}
        className={field}
      />
      {error && <p className={errorText}>{error}</p>}
      <div className="flex gap-2">
        <Button disabled={loading} onClick={() => review("approved")} className="flex-1">
          승인
        </Button>
        <Button
          variant="danger"
          disabled={loading || !reason.trim()}
          onClick={() => review("rejected")}
          className="flex-1"
        >
          반려
        </Button>
      </div>
    </div>
  );
}
