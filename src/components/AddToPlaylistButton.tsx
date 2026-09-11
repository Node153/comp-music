"use client";

// DEMO 게시물 헤더 우측의 라인 "+" 버튼 — 누르면 미니 플레이리스트 큐에 담고,
// 이미 담겨 있으면 체크 표시로 바뀌며 다시 누르면 뺀다. 색은 안 쓰고(흑백 컨셉)
// 담긴 상태는 아이콘 모양과 굵기로만 구분한다.
//
// 이 게시물이 이미 담기/최근들은에 들어있다면(예: 며칠 전에 담아뒀던 트랙) videoSrc를 지금
// 서버가 새로 내려준 signed URL로 슬쩍 갱신한다 — R2 signed URL은 시간 제한이 있어서, 오래
// localStorage에 남아있던 항목은 그 사이 링크가 만료돼 "플레이리스트에서 누르면 재생이
// 안 되는데 게시물을 직접 누르면 되는" 문제가 있었다(게시물 쪽은 페이지를 새로 열 때마다
// 항상 새 signed URL을 받으니까). 이 버튼은 재생 가능한 게시물마다 매번 마운트되므로,
// 피드에 다시 뜨는 순간 조용히 최신 링크로 맞춰준다.
import { useEffect } from "react";
import { usePlaylist, type PlaylistTrack } from "@/components/PlaylistContext";
import { PlusIcon, CheckIcon } from "@/components/icons";

export function AddToPlaylistButton({ track }: { track: PlaylistTrack }) {
  const { has, add, remove, refresh } = usePlaylist();
  const added = has(track.id);

  useEffect(() => {
    refresh(track);
    // track 객체 자체가 아니라 videoSrc가 바뀔 때만(같은 게시물이 리렌더될 때마다 새 함수/
    // 객체 참조로 재실행되지 않게) — refresh 자체는 변경 없으면 상태를 안 건드리니 안전하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, track.videoSrc]);

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
