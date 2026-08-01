"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (pending) return;
    if (!confirm("이 공지를 삭제할까요?")) return;
    setPending(true);
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    setPending(false);
    if (!error) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      삭제
    </button>
  );
}
