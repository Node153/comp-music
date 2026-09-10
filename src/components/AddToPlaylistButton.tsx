"use client";

// DEMO 게시물 헤더 우측의 라인 "+" 버튼 — 누르면 미니 플레이리스트 큐에 담고,
// 이미 담겨 있으면 체크 표시로 바뀌며 다시 누르면 뺀다. 색은 안 쓰고(흑백 컨셉)
// 담긴 상태는 아이콘 모양과 굵기로만 구분한다.
import { usePlaylist, type PlaylistTrack } from "@/components/PlaylistContext";
import { PlusIcon, CheckIcon } from "@/components/icons";

export function AddToPlaylistButton({ track }: { track: PlaylistTrack }) {
  const { has, add, remove } = usePlaylist();
  const added = has(track.id);

  return (
    <button
      type="button"
      onClick={() => (added ? remove(track.id) : add(track))}
      aria-pressed={added}
      title={added ? "플레이리스트에서 빼기" : "플레이리스트에 담기"}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
        added
          ? "text-gray-900 dark:text-gray-100"
          : "text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      }`}
    >
      {added ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
    </button>
  );
}
