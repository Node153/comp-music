"use client";

// DEMO 첫 화면(FeedHero) 가운데 "▶ 안 들은 Drop N곡 이어듣기"(2026-09-25) — 들르기만 하고
// 곡은 안 트는 회원이 많아서(파일럿 초반 34명 중 좋아요·댓글 남긴 회원 6명), 스크롤 없이 한 번에
// 연속 재생으로 들어가게 한다. 곡마다 기존 재생 기록·조회수·재생 알림(업로더에게 "N명이 들었어요")이
// 그대로 쌓인다 — 조회수는 여전히 실제로 30초 이상 들어야 올라가서 PEAK 계산은 그대로 둔다.
import { useEffect, useState } from "react";
import { usePlaylistOptional, type PlaylistTrack } from "@/components/PlaylistContext";
import { PlayIcon } from "@/components/icons";

export function UnheardPlayAll() {
  const playlist = usePlaylistOptional();
  const [tracks, setTracks] = useState<PlaylistTrack[] | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feed/unheard")
      .then((res) => (res.ok ? res.json() : { tracks: [] }))
      .then((data: { tracks?: PlaylistTrack[] }) => {
        if (!cancelled) setTracks(data.tracks ?? []);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!playlist || !tracks || tracks.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => {
        playlist.playAll(tracks);
        setStarted(true);
      }}
      className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-80 dark:bg-white dark:text-black md:text-base"
    >
      <PlayIcon className="h-4 w-4" />
      {started ? `안 들은 Drop ${tracks.length}곡 재생 중` : `안 들은 Drop ${tracks.length}곡 이어듣기`}
    </button>
  );
}
