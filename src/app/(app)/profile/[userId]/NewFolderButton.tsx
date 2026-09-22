"use client";

// 게시물 탭 서브탭 바 끝에 붙는 "+ 폴더 추가" 버튼(2026-09, 정태인님 제안) — 누르면 이름
// 입력칸으로 바뀌고, 만들면 그 폴더 탭으로 바로 이동한다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon } from "@/components/icons";

export function NewFolderButton({ userId, onCreated }: { userId: string; onCreated: (folderId: string) => void }) {
  const supabase = createClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("post_folders")
      .insert({ user_id: userId, name: trimmed })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      window.alert(`폴더 생성 실패: ${error?.message ?? "알 수 없는 오류"}`);
      return;
    }
    setEditing(false);
    setName("");
    onCreated(data.id);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 rounded-full border border-box-gray px-3 py-1.5 text-sm font-medium text-active-gray transition hover:opacity-70"
      >
        <PlusIcon className="h-4 w-4" />
        폴더
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      <input
        type="text"
        autoFocus
        placeholder="폴더 이름"
        value={name}
        maxLength={30}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") create();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-28 rounded-lg border border-box-gray px-2 py-1.5 text-sm text-black focus:border-active-gray focus:outline-none"
      />
      <button
        type="button"
        disabled={busy}
        onClick={create}
        className="rounded-lg border border-active-gray px-2.5 py-1.5 text-xs font-medium text-black hover:opacity-80"
      >
        만들기
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="rounded-lg px-2 py-1.5 text-xs text-black hover:opacity-70"
      >
        취소
      </button>
    </div>
  );
}
