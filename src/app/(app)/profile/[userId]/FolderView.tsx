"use client";

// 프로필 게시물 탭의 커스텀 폴더 뷰(2026-09, 정태인님 제안) — 현재/보관된처럼 자동 분류가
// 아니라 본인이 고른 게시물만 모은 묶음. 방문자는 그리드만 읽기 전용으로 보고, 본인은 이름
// 변경/삭제/게시물 추가·제거까지 여기서 한다. DeletePostButton.tsx와 동일한 패턴 —
// 클라이언트에서 직접 supabase mutation 후 router.refresh(), 에러는 window.alert.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PostTile, type ProfilePost } from "./PostTile";
import { EditIcon, TrashIcon, XIcon, PlusIcon } from "@/components/icons";

export type FolderData = { id: string; name: string; postIds: string[] };

export function FolderView({
  folder,
  posts,
  isOwnProfile,
  onDeleted,
}: {
  folder: FolderData;
  posts: ProfilePost[];
  isOwnProfile: boolean;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(folder.name);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const folderPosts = posts.filter((p) => folder.postIds.includes(p.id));
  const addablePosts = posts.filter((p) => !folder.postIds.includes(p.id));

  async function saveRename() {
    const name = nameInput.trim();
    if (!name || busy) return;
    setBusy(true);
    const { error } = await supabase.from("post_folders").update({ name }).eq("id", folder.id);
    setBusy(false);
    if (error) {
      window.alert(`이름 변경 실패: ${error.message}`);
      return;
    }
    setRenaming(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`'${folder.name}' 폴더를 삭제할까요? 안에 담긴 게시물 자체는 삭제되지 않습니다.`)) return;
    setBusy(true);
    const { error } = await supabase.from("post_folders").delete().eq("id", folder.id);
    setBusy(false);
    if (error) {
      window.alert(`삭제 실패: ${error.message}`);
      return;
    }
    onDeleted();
    router.refresh();
  }

  async function removePost(postId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("post_folder_items")
      .delete()
      .eq("folder_id", folder.id)
      .eq("post_id", postId);
    setBusy(false);
    if (error) {
      window.alert(`제거 실패: ${error.message}`);
      return;
    }
    router.refresh();
  }

  async function addPost(postId: string) {
    setBusy(true);
    const { error } = await supabase.from("post_folder_items").insert({ folder_id: folder.id, post_id: postId });
    setBusy(false);
    if (error) {
      window.alert(`추가 실패: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4">
      {isOwnProfile && (
        <div className="flex items-center justify-between gap-2">
          {renaming ? (
            <div className="flex flex-1 items-center gap-1.5">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={30}
                className="flex-1 rounded-lg border border-box-gray px-2.5 py-1.5 text-sm text-black focus:border-active-gray focus:outline-none"
              />
              <button
                type="button"
                disabled={busy}
                onClick={saveRename}
                className="rounded-lg border border-active-gray px-2.5 py-1.5 text-xs font-medium text-black hover:opacity-80"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setNameInput(folder.name);
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs text-black hover:opacity-70"
              >
                취소
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-black hover:opacity-70"
              >
                <EditIcon className="h-3.5 w-3.5" />
                이름 변경
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-sm text-black hover:text-red-600"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                폴더 삭제
              </button>
            </>
          )}
        </div>
      )}

      <div className={`grid grid-cols-3 gap-1.5 ${isOwnProfile ? "mt-3" : ""}`}>
        {folderPosts.map((post) => (
          <PostTile
            key={post.id}
            post={post}
            overlay={
              isOwnProfile ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removePost(post.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="폴더에서 빼기"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              ) : undefined
            }
          />
        ))}
        {folderPosts.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-active-gray">아직 담긴 게시물이 없습니다</p>
        )}
      </div>

      {isOwnProfile && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-black hover:opacity-70"
          >
            <PlusIcon className="h-4 w-4" />
            게시물 추가
          </button>
          {adding && (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {addablePosts.map((post) => (
                <PostTile
                  key={post.id}
                  post={post}
                  overlay={
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => addPost(post.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label="폴더에 담기"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              ))}
              {addablePosts.length === 0 && (
                <p className="col-span-3 py-6 text-center text-sm text-active-gray">
                  추가할 수 있는 게시물이 없습니다
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
