"use client";

// FEED-11: 작성자 직접 삭제. 하드 삭제(스토리지 파일 + posts row), 복구 불가 확인 필수.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeletePostButton({ postId, mediaPath }: { postId: string; mediaPath: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm("삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?")) return;

    setLoading(true);
    // R2는 클라이언트에서 직접 못 지워서(자격증명 노출 방지) 서버 라우트를 거친다.
    await fetch("/api/storage/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: mediaPath }),
    });
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    setLoading(false);

    if (error) {
      window.alert(`삭제 실패: ${error.message}`);
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur transition hover:bg-red-600 disabled:opacity-50"
    >
      삭제
    </button>
  );
}
