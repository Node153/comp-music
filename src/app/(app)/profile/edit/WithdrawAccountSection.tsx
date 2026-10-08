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
    // 내 게시물의 첨부 파일(R2)은 DB 함수가 못 지워서 여기서 먼저 지운다 — 게시물 직접 삭제
    // (DeletePostButton)와 같은 서버 라우트. 게시물 행은 아래 RPC가 공개 범위와 무관하게 전부 지운다(0095).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: posts } = await supabase
        .from("posts")
        .select("video_url, image_url, audio_url, thumbnail_url")
        .eq("user_id", user.id);
      const keys = (posts ?? [])
        .flatMap((p) => [p.video_url, p.image_url, p.audio_url, p.thumbnail_url])
        .filter((key): key is string => !!key && key.startsWith(`${user.id}/`));
      await Promise.allSettled(
        keys.map((key) =>
          fetch("/api/storage/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          }),
        ),
      );
    }
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
      <div className="mt-6 border-t border-box-gray pt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-black hover:text-red-600"
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
        <li>내가 올린 게시물은 공개 범위와 상관없이 첨부 파일, 달린 댓글·좋아요·Kick과 함께 모두 삭제돼요(복구 불가)</li>
        <li>다른 회원의 글에 남긴 댓글, 나눈 메시지, 명반 추천은 상대방을 위해 남지만, 내 이름은 &quot;탈퇴한 사용자&quot;로 바뀌어요</li>
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
          className="rounded-full px-4 py-2 text-sm text-black transition hover:bg-box-gray"
        >
          취소
        </button>
      </div>
    </div>
  );
}
