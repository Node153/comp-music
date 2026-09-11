"use client";

// 사운드클라우드 "Next up" 참고 — 하단 GlobalPlayerBar에 붙어서 위로 펼쳐지는 패널.
// 두 목록을 한 화면에 쌓지 않고 상단 탭으로 나눈다(사용자 요청):
//  - "담기": + 버튼으로 담은 재생 큐(items)
//  - "최근 들은": 피드에서 재생버튼으로 바로 튼 트랙 히스토리(recentlyPlayed)
// 플레이어 바의 리스트 버튼으로 열고 닫으며(상태는 PlaylistContext), 둘 다 비어 있으면 안 뜬다.
import { useState } from "react";
import Link from "next/link";
import { usePlaylist, type PlaylistTrack } from "@/components/PlaylistContext";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { XIcon, PlayIcon, PauseIcon, HeadphonesIcon, PlusIcon, CheckIcon } from "@/components/icons";

type Tab = "queue" | "recent";

function QueueRow({
  t,
  current,
  playing,
  onPlay,
  onTogglePlay,
  onRemove,
  queued,
  onToggleQueued,
}: {
  t: PlaylistTrack;
  current: boolean;
  playing: boolean;
  onPlay: () => void;
  onTogglePlay: () => void;
  onRemove: () => void;
  // "최근 들은" 탭 전용 — 담기 큐에 바로 추가/이미 담김 표시.
  queued?: boolean;
  onToggleQueued?: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 transition ${
        current ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <button
        type="button"
        onClick={current ? onTogglePlay : onPlay}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-white/10"
        aria-label={current && playing ? "일시정지" : "재생"}
      >
        {t.posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.posterSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <HeadphonesIcon className="h-4 w-4 text-black/45" />
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/45 transition ${
            current ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {current && playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        </span>
      </button>
      {/* 커버 클릭 = 재생, 여기(게시자/제목) 클릭 = 게시자 프로필로 이동. */}
      {t.authorId ? (
        <Link
          href={`/profile/${t.authorId}`}
          className="flex min-w-0 flex-1 flex-col items-start text-left"
        >
          <span className="w-full truncate text-xs text-black/55 hover:text-black hover:underline">
            {t.author}
          </span>
          <span className={`w-full truncate text-sm ${current ? "font-bold" : "font-semibold"}`}>
            {t.title}
          </span>
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span className="w-full truncate text-xs text-black/55">{t.author}</span>
          <span className={`w-full truncate text-sm ${current ? "font-bold" : "font-semibold"}`}>
            {t.title}
          </span>
        </div>
      )}
      {onToggleQueued && (
        <button
          type="button"
          onClick={onToggleQueued}
          aria-pressed={queued}
          title={queued ? "담기에서 빼기" : "담기에 추가"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
            queued
              ? "text-white"
              : "text-black/45 opacity-0 hover:bg-gray-800 hover:text-white group-hover:opacity-100"
          }`}
        >
          {queued ? <CheckIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="목록에서 빼기"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-black/45 opacity-0 transition hover:bg-gray-800 hover:text-white group-hover:opacity-100"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="px-3 py-8 text-center text-xs text-black/45">{label}</p>;
}

export function QueuePanel() {
  const {
    items,
    has,
    add,
    currentIndex,
    playAt,
    remove,
    recentlyPlayed,
    playNow,
    removeRecent,
    clearRecent,
    queueOpen,
    setQueueOpen,
  } = usePlaylist();
  const { track, isPlaying, toggle } = useNowPlaying();
  // 사용자가 직접 고르기 전까지는 내용 있는 쪽을 기본 탭으로 — 둘 다 있으면 "최근 들은" 우선.
  const [pickedTab, setPickedTab] = useState<Tab | null>(null);
  const activeTab: Tab = pickedTab ?? (recentlyPlayed.length > 0 ? "recent" : "queue");

  if (!queueOpen || (items.length === 0 && recentlyPlayed.length === 0)) return null;

  return (
    <div className="fixed right-1 bottom-[124px] z-40 w-[300px] max-w-[calc(100vw_-_0.5rem)] md:right-4 md:bottom-[68px] md:w-[340px]">
      {/* 크기 고정: 가로 3 : 세로 4 비율(세로로 긴 카드) — 내용이 늘어나도 카드 크기는 그대로,
          목록만 안에서 스크롤된다(아래 min-h-0 + overflow-y-auto). */}
      {/* 하단 사운드바와 같은 색으로 통일 — DEMO 배경(#fafafa)·memo 배경(#1c1c1e)의 정확한
          중간값(#8b8b8c). */}
      <div className="flex aspect-[3/4] max-h-[80svh] flex-col overflow-hidden rounded-xl border border-black/15 bg-[#8b8b8c] text-white shadow-2xl">
        <div className="flex items-center gap-3 px-4 pt-3">
          <span className="flex-1 text-base font-bold">재생 목록</span>
          <button
            type="button"
            onClick={() => setQueueOpen(false)}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-full text-black/55 transition hover:bg-gray-800 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 상단 탭 — 최근 들은 / 담기 */}
        <div className="flex items-center gap-1 border-b border-black/15 px-3 pt-2">
          <button
            type="button"
            onClick={() => setPickedTab("recent")}
            className={`relative px-2 pb-2 text-sm font-semibold transition ${
              activeTab === "recent" ? "text-white" : "text-black/55 hover:text-black"
            }`}
          >
            최근 들은{recentlyPlayed.length > 0 && ` (${recentlyPlayed.length})`}
            {activeTab === "recent" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPickedTab("queue")}
            className={`relative px-2 pb-2 text-sm font-semibold transition ${
              activeTab === "queue" ? "text-white" : "text-black/55 hover:text-black"
            }`}
          >
            담기{items.length > 0 && ` (${items.length})`}
            {activeTab === "queue" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />
            )}
          </button>
          <div className="flex-1" />
          {/* "담기" 탭은 게시물 헤더 체크로도 뺄 수 있어서 여기엔 비우기를 안 둠(사용자 요청). */}
          {activeTab === "recent" && (
            <button
              type="button"
              onClick={clearRecent}
              disabled={recentlyPlayed.length === 0}
              className="mb-2 text-[11px] font-medium text-black/55 transition hover:text-white disabled:opacity-0"
            >
              비우기
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {activeTab === "queue" ? (
            items.length === 0 ? (
              <EmptyState label="담아둔 트랙이 없어요 — 게시물 헤더의 + 로 담아보세요" />
            ) : (
              items.map((t, i) => (
                <QueueRow
                  key={t.id}
                  t={t}
                  current={i === currentIndex}
                  playing={isPlaying}
                  onPlay={() => playAt(i)}
                  onTogglePlay={toggle}
                  onRemove={() => remove(t.id)}
                />
              ))
            )
          ) : recentlyPlayed.length === 0 ? (
            <EmptyState label="아직 재생한 트랙이 없어요" />
          ) : (
            recentlyPlayed.map((t) => (
              <QueueRow
                key={t.id}
                t={t}
                current={track?.id === t.id}
                playing={isPlaying}
                onPlay={() => playNow(t)}
                onTogglePlay={toggle}
                onRemove={() => removeRecent(t.id)}
                queued={has(t.id)}
                onToggleQueued={() => (has(t.id) ? remove(t.id) : add(t))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
