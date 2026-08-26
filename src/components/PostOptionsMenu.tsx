"use client";

// 게시물 작성자용 "⋯" 메뉴(인스타그램 참고) — 수정/삭제. 지금까지 피드 카드에는 아예
// 없었고(삭제는 별도 "게시물 관리" 페이지에만 있었음), 수정은 RLS(posts_update_self)는
// 이미 허용하는데 화면 자체가 없었다. 미디어 파일 자체는 안 바꾸고(재업로드는 별도 게시물로
// 취급하는 게 자연스러움 — 인스타그램도 사진 교체는 안 됨) 캡션/해시태그만 수정 가능.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALL_GENRES } from "@/lib/genres";
import { field, errorText } from "@/components/ui/styles";
import { DotsIcon } from "@/components/icons";

const MIN_TAGS = 3;

function chipClass(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${
    active ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
  }`;
}

export function PostOptionsMenu({
  postId,
  mediaPath,
  initialCaption,
  initialTags,
}: {
  postId: string;
  mediaPath: string;
  initialCaption: string | null;
  initialTags: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    if (tags.length < MIN_TAGS) {
      setError(`해시태그를 최소 ${MIN_TAGS}개 선택해주세요.`);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("posts")
      .update({ caption: caption.trim() || null, instrument_tags: tags })
      .eq("id", postId);
    setSaving(false);
    if (updateError) {
      setError(`저장 실패: ${updateError.message}`);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm("삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?")) return;
    setDeleting(true);
    await fetch("/api/storage/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: mediaPath }),
    });
    const { error: deleteError } = await supabase.from("posts").delete().eq("id", postId);
    setDeleting(false);
    if (deleteError) {
      window.alert(`삭제 실패: ${deleteError.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="게시물 메뉴"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <DotsIcon className="h-4 w-4 rotate-90" />
        </button>
        {menuOpen && (
          <>
            <button
              aria-label="메뉴 닫기"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 z-50 mt-1 w-32 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-950">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleDelete();
                }}
                disabled={deleting}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-4 dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">게시물 수정</h2>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="캡션"
              className={field}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-400">{tags.length}/{MIN_TAGS}개 이상 선택</span>
              <div className="flex flex-wrap gap-1.5">
                {ALL_GENRES.map((tag) => (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)} className={chipClass(tags.includes(tag))}>
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className={errorText}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
