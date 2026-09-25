"use client";

// 앨범 커버 — MusicBrainz(Cover Art Archive)는 커버가 없는 앨범도 있어서 로드 실패 시 원판 아이콘.
// 화면 크기의 두 배 해상도를 받아 레티나에서도 흐리지 않게 한다.
import { useState } from "react";
import { artworkAt } from "@/lib/albumChart";
import { DiscIcon } from "@/components/icons";

export function AlbumCover({ url, px, className }: { url: string | null; px: number; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : artworkAt(url, px * 2 > 300 ? 600 : 200);
  if (!src) {
    return (
      <span className={`${className} flex shrink-0 items-center justify-center bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500`}>
        <DiscIcon className="h-1/2 w-1/2" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 bg-gray-100 object-cover dark:bg-gray-800`}
    />
  );
}
