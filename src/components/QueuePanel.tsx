"use client";

// 사운드클라우드 "Next up" 참고 — 하단 GlobalPlayerBar에 붙어서 위로 펼쳐지는 패널.
// 두 목록을 한 화면에 쌓지 않고 상단 탭으로 나눈다(사용자 요청):
//  - "담기": + 버튼으로 담은 재생 큐(items)
//  - "최근 들은": 피드에서 재생버튼으로 바로 튼 트랙 히스토리(recentlyPlayed)
// 플레이어 바의 리스트 버튼으로 열고 닫으며(상태는 PlaylistContext), 둘 다 비어 있으면 안 뜬다.
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { usePlaylist, type PlaylistTrack } from "@/components/PlaylistContext";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { XIcon, PlayIcon, PauseIcon, HeadphonesIcon, PlusIcon, CheckIcon } from "@/components/icons";

type Tab = "queue" | "recent";

// 별도 커버 없는 영상 트랙의 썸네일 — 브라우저가 첫 프레임을 알아서 그려주길 기다리는 대신,
// loadeddata 직후 아주 살짝(0.05초) seek해서 확실히 한 프레임을 그리게 강제한다. Safari 등
// 일부 브라우저는 poster 없는 <video>를 그냥 두면 검은 화면으로 남겨두는 경우가 있어서다
// (preload="metadata"만으로는 실제 프레임 데이터를 안 받아오기도 함 — auto로 바꿈).
function VideoFrameThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="auto"
      onLoadedData={(e) => {
        if (e.currentTarget.currentTime === 0) e.currentTarget.currentTime = 0.05;
      }}
      className="h-full w-full object-cover"
    />
  );
}

function QueueRow({
  t,
  current,
  playing,
  onPlay,
  onTogglePlay,
  onRemove,
  queued,
  onToggleQueued,
  dark,
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
  // 패널 전체가 사이트 테마(dark = memo 탭)를 따라가므로(아래 QueuePanel 참고), 행 안의
  // black 계열 텍스트/하이라이트도 전부 이 값 하나로 반전시킨다.
  dark: boolean;
}) {
  const rowActive = dark ? "bg-white/10" : "bg-black/5";
  const rowHover = dark ? "hover:bg-white/5" : "hover:bg-black/5";
  const chipBg = dark ? "bg-white/10" : "bg-black/5";
  const muted = dark ? "text-white/45" : "text-black/45";
  const mutedStrong = dark ? "text-white/55" : "text-black/55";
  const strong = dark ? "text-white" : "text-black";
  const hoverStrong = dark ? "hover:text-white" : "hover:text-black";
  const hoverChip = dark ? "hover:bg-white/10" : "hover:bg-black/10";
  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 transition ${current ? rowActive : rowHover}`}
    >
      <button
        type="button"
        onClick={current ? onTogglePlay : onPlay}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded ${chipBg}`}
        aria-label={current && playing ? "일시정지" : "재생"}
      >
        {t.posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.posterSrc} alt="" className="h-full w-full object-cover" />
        ) : t.mediaType === "video" ? (
          // 별도 커버를 안 올린 영상 게시물 — 헤드폰 아이콘 대신 영상 자체의 첫 프레임을
          // 썸네일처럼 보여준다(재생은 안 시킴, muted라 소리도 안 남).
          <VideoFrameThumbnail src={t.videoSrc} />
        ) : (
          <HeadphonesIcon className={`h-4 w-4 ${muted}`} />
        )}
        {/* 이 스크림은 항상 썸네일(이미지/영상) 위에 뜨는 반투명 검정 오버레이라, 패널이
            밝은 테마여도 안의 재생/일시정지 아이콘은 흰색 고정 — 패널 text color(strong)를
            그대로 물려받게 두면 밝은 테마에서 검정 아이콘이 검정 스크림 위에 묻힌다
            (2026-09-18 수정, "플레이리스트 컬러" 제보로 발견). */}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition ${
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
          className={`flex min-w-0 flex-1 flex-col items-start text-left ${strong}`}
        >
          <span className={`w-full truncate text-xs ${mutedStrong} ${hoverStrong} hover:underline`}>
            {t.author}
          </span>
          <span className={`w-full truncate text-sm ${current ? "font-bold" : "font-semibold"}`}>
            {t.title}
          </span>
        </Link>
      ) : (
        <div className={`flex min-w-0 flex-1 flex-col items-start text-left ${strong}`}>
          <span className={`w-full truncate text-xs ${mutedStrong}`}>{t.author}</span>
          <span className={`w-full truncate text-sm ${current ? "font-bold" : "font-semibold"}`}>
            {t.title}
          </span>
        </div>
      )}
      {/* memo(비공개) 트랙만 노출 만료 시각이 있음 — DEMO는 영구노출이라 안 뜸. */}
      {t.expiresAt && (
        <span className="shrink-0 scale-[0.85]">
          <TimeLimitBadge expiresAt={t.expiresAt} />
        </span>
      )}
      {onToggleQueued && (
        <button
          type="button"
          onClick={onToggleQueued}
          aria-pressed={queued}
          title={queued ? "담기에서 빼기" : "담기에 추가"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
            queued ? strong : `${muted} opacity-0 ${hoverChip} ${hoverStrong} group-hover:opacity-100`
          }`}
        >
          {queued ? <CheckIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="목록에서 빼기"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 ${muted} ${hoverChip} ${hoverStrong}`}
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptyState({ label, dark }: { label: string; dark: boolean }) {
  return <p className={`px-3 py-8 text-center text-xs ${dark ? "text-white/45" : "text-black/45"}`}>{label}</p>;
}

export function QueuePanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // GlobalPlayerBar와 완전히 같은 기준(ThemeSync 참고) — 이 패널도 그 바로 바로 위에 붙어
  // 뜨는 만큼, 둘이 따로 놀면(바는 어두운데 패널만 항상 밝음) 오히려 더 어색해 보인다
  // (2026-09-18, "플레이리스트도 컬러 해결" 제보 — memo 탭에서 바는 어두워졌는데 이 패널만
  // 계속 밝은 채로 남아 튀어 보였다). 담기/최근 들은 목록에 DEMO·memo 트랙이 섞여 있어도
  // 패널 자체의 밝기는 "지금 보고 있는 탭"만 기준으로 삼는다 — 리스트 안 개별 트랙 색은
  // 원래도 반영 안 됐다(각 행은 트랙 자체 브랜드색이 아니라 공통 UI 색만 썼음).
  const isMemoTheme = pathname === "/feed" && searchParams.get("feed") === "complex";
  const panelBg = isMemoTheme ? "bg-[#1c1c1e]" : "bg-demo-bg";
  const panelText = isMemoTheme ? "text-white" : "text-black";
  const panelMuted = isMemoTheme ? "text-white/55" : "text-black/55";
  const panelBorder = isMemoTheme ? "border-white/10" : "border-black/10";
  const panelHover = isMemoTheme ? "hover:bg-white/10" : "hover:bg-black/10";
  const panelHoverText = isMemoTheme ? "hover:text-white" : "hover:text-black";
  const panelUnderline = isMemoTheme ? "bg-white" : "bg-black";
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
    <div className="fixed right-1 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 w-[300px] max-w-[calc(100vw_-_0.5rem)] md:right-4 md:bottom-[68px] md:w-[340px]">
      {/* 크기 고정: 가로 3 : 세로 4 비율(세로로 긴 카드) — 내용이 늘어나도 카드 크기는 그대로,
          목록만 안에서 스크롤된다(아래 min-h-0 + overflow-y-auto). */}
      <div
        className={`flex aspect-[3/4] max-h-[80svh] flex-col overflow-hidden rounded-xl border shadow-2xl ${panelBg} ${panelText} ${panelBorder}`}
      >
        <div className="flex items-center gap-3 px-4 pt-3">
          <span className="flex-1 text-base font-bold">재생 목록</span>
          <button
            type="button"
            onClick={() => setQueueOpen(false)}
            aria-label="닫기"
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${panelMuted} ${panelHover} ${panelHoverText}`}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 상단 탭 — 최근 들은 / 담기 */}
        <div className={`flex items-center gap-1 border-b px-3 pt-2 ${panelBorder}`}>
          <button
            type="button"
            onClick={() => setPickedTab("recent")}
            className={`relative px-2 pb-2 text-sm font-semibold transition ${
              activeTab === "recent" ? panelText : `${panelMuted} ${panelHoverText}`
            }`}
          >
            최근 들은{recentlyPlayed.length > 0 && ` (${recentlyPlayed.length})`}
            {activeTab === "recent" && (
              <span className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full ${panelUnderline}`} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPickedTab("queue")}
            className={`relative px-2 pb-2 text-sm font-semibold transition ${
              activeTab === "queue" ? panelText : `${panelMuted} ${panelHoverText}`
            }`}
          >
            담기{items.length > 0 && ` (${items.length})`}
            {activeTab === "queue" && (
              <span className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full ${panelUnderline}`} />
            )}
          </button>
          <div className="flex-1" />
          {/* "담기" 탭은 게시물 헤더 체크로도 뺄 수 있어서 여기엔 비우기를 안 둠(사용자 요청). */}
          {activeTab === "recent" && (
            <button
              type="button"
              onClick={clearRecent}
              disabled={recentlyPlayed.length === 0}
              className={`mb-2 text-[11px] font-medium transition disabled:opacity-0 ${panelMuted} ${panelHoverText}`}
            >
              비우기
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {activeTab === "queue" ? (
            items.length === 0 ? (
              <EmptyState label="담아둔 트랙이 없어요 — 게시물 헤더의 + 로 담아보세요" dark={isMemoTheme} />
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
                  dark={isMemoTheme}
                />
              ))
            )
          ) : recentlyPlayed.length === 0 ? (
            <EmptyState label="아직 재생한 트랙이 없어요" dark={isMemoTheme} />
          ) : (
            recentlyPlayed.map((t) => (
              <QueueRow
                key={t.id}
                t={t}
                current={track?.id === t.id}
                playing={isPlaying}
                onPlay={() => playNow(t)}
                dark={isMemoTheme}
                onTogglePlay={toggle}
                onRemove={() => removeRecent(t.id)}
                // memo(비공개) 트랙은 담기 금지(사용자 요청) — expiresAt이 있으면 memo
                // 트랙이라는 뜻이라(DEMO는 영구노출이라 안 붙음) +/체크 토글 자체를 안 넘겨서
                // 그 자리에 타임뱃지만 남게 한다.
                queued={t.expiresAt ? undefined : has(t.id)}
                onToggleQueued={t.expiresAt ? undefined : () => (has(t.id) ? remove(t.id) : add(t))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
