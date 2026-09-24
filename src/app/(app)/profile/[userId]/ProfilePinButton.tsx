"use client";

// 프로필 상단 고정(0075, 페이스북 "하이라이트" 자리 — 사용자 요청). memo 탭 PinButton
// (post_pins, 보는 사람 본인 화면에만 적용)과 달리 작성자가 자기 프로필에 거는 공개 고정이라
// posts.profile_pinned_at을 직접 쓴다(posts_update_self RLS). 최대 3개 제한은 DB 트리거가
// 막고, 여기선 그 에러 문구를 그대로 띄운다. 정렬·왼쪽 "상단 고정" 카드가 같이 바뀌어야 해서
// 성공하면 서버 컴포넌트를 다시 실행한다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PinIcon } from "@/components/icons";

export function ProfilePinButton({ postId, pinned }: { postId: string; pinned: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const { error } = await supabase
      .from("posts")
      .update({ profile_pinned_at: pinned ? null : new Date().toISOString() })
      .eq("id", postId);
    setPending(false);
    if (error) {
      alert(error.message.includes("최대 3개") ? "상단 고정은 최대 3개까지 할 수 있어요." : "고정하지 못했어요.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={pinned}
      title={pinned ? "상단 고정 해제" : "프로필 상단에 고정"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-box-gray disabled:opacity-50 ${
        pinned ? "text-black" : "text-active-gray"
      }`}
    >
      <PinIcon className="h-4 w-4" filled={pinned} />
    </button>
  );
}
