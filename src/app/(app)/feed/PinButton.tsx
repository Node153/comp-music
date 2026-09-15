"use client";

// memo 탭 합작 게시물 고정(사용자 요청) — 본인 글이거나 invite_only로 초대된 글은
// feed/page.tsx가 기본으로 상단 고정하지만, 이 버튼으로 그 자동 고정을 포함해 아무 합작
// 게시물이나 직접 켜고 끌 수 있다(0055 — post_pins.pinned가 행이 있으면 자동 규칙을
// 덮어쓴다). like처럼 다른 사람에게도 보이는 공개 행동이 아니라 본인 화면에만 영향을
// 주는 개인화 설정이라 카운트 표시가 없다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PinIcon } from "@/components/icons";

export function PinButton({
  postId,
  userId,
  initialPinned,
}: {
  postId: string;
  userId: string;
  initialPinned: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);

    const nextPinned = !pinned;
    setPinned(nextPinned);

    // 항상 upsert — 자동 고정된 글(행 없음)을 해제하는 것도, 이미 있는 오버라이드 행을
    // 다시 뒤집는 것도 같은 한 번의 쓰기로 처리한다.
    const { error } = await supabase
      .from("post_pins")
      .upsert({ post_id: postId, user_id: userId, pinned: nextPinned }, { onConflict: "post_id,user_id" });

    if (error) {
      setPinned(!nextPinned);
    } else {
      // 고정 여부는 좋아요처럼 그 자리에서 카운트만 바뀌는 게 아니라 피드 정렬 순서 자체가
      // 바뀌어야 해서, 서버 컴포넌트를 다시 실행해 새 순서로 받아온다.
      router.refresh();
    }

    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={pinned}
      title={pinned ? "고정 해제" : "이 게시물을 memo 상단에 고정"}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-gray-800 ${
        pinned
          ? "text-violet-600 dark:text-violet-300"
          : "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
      }`}
    >
      <PinIcon className="h-4 w-4" filled={pinned} />
    </button>
  );
}
