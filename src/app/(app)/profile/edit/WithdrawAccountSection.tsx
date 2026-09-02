"use client";

// 회원 탈퇴(terms 제12조) — 완전 삭제가 아니라 개인정보 파기+비활성화(0046_account_withdrawal
// 참고). 게시물 삭제(DeletePostButton)와 달리 파급 범위가 계정 전체라 confirm 한 번으로는
// 부족하다고 판단해 "펼쳐서 결과를 먼저 보여주고 + 마지막에 한 번 더 확인" 2단계로 뒀다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { errorText } from "@/components/ui/styles";

export function WithdrawAccountSection() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw() {
    if (!window.confirm("정말 탈퇴하시겠어요? 되돌릴 수 없어요.")) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.rpc("withdraw_own_account");
    if (error) {
      setError(`탈퇴 처리에 실패했어요: ${error.message}`);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!open) {
    return (
      <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-gray-400 hover:text-red-600"
        >
          회원 탈퇴
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <p className="text-sm font-semibold text-red-700 dark:text-red-400">탈퇴하면 이렇게 처리돼요</p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-red-700/90 dark:text-red-400/90">
        <li>실명·생년월일·프로필 정보가 삭제돼요</li>
        <li>DEMO에 올린 게시물·댓글·좋아요가 모두 삭제돼요(복구 불가)</li>
        <li>memo에서 나눈 대화·공동 작업물은 상대방을 위해 남지만, 내 이름은 "탈퇴한 사용자"로 바뀌어요</li>
        <li>같은 계정으로 다시 로그인할 수 없어요</li>
      </ul>
      {error && <p className={errorText}>{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={loading}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "처리 중..." : "탈퇴하기"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={loading}
          className="rounded-full px-4 py-2 text-sm text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-900"
        >
          취소
        </button>
      </div>
    </div>
  );
}
