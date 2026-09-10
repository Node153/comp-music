"use client";

// 사운드클라우드 "Next up" 참고 — 하단 GlobalPlayerBar에 붙어서 위로 펼쳐지는 재생 대기열 패널.
// 플레이어 바의 큐 버튼으로 열고 닫으며(상태는 PlaylistContext), 큐가 비어 있으면 안 뜬다.
// 재생 자체는 바가 맡고 여기서는 순서·선택만 담당. 다크 테마는 사운드바와 통일.
import { usePlaylist } from "@/components/PlaylistContext";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { XIcon, PlayIcon, PauseIcon, HeadphonesIcon } from "@/components/icons";

export function QueuePanel() {
  const { items, currentIndex, playAt, remove, clear, queueOpen, setQueueOpen } = usePlaylist();
  const { isPlaying, toggle } = useNowPlaying();

  if (!queueOpen || items.length === 0) return null;

  return (
    <div className="fixed right-1 bottom-[124px] z-40 w-[320px] max-w-[calc(100vw_-_0.5rem)] md:right-4 md:bottom-[68px] md:w-[380px]">
      <div className="flex max-h-[60vh] flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#1c1c1e] text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
          <span className="flex-1 text-base font-bold">다음 트랙</span>
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-gray-400 transition hover:text-white"
          >
            비우기
          </button>
          <button
            type="button"
            onClick={() => setQueueOpen(false)}
            aria-label="대기열 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto py-1">
          {items.map((t, i) => {
            const isCurrent = i === currentIndex;
            return (
              <li key={t.id}>
                <div
                  className={`group flex items-center gap-3 px-3 py-2 transition ${
                    isCurrent ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => (isCurrent ? toggle() : playAt(i))}
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-white/10"
                    aria-label={isCurrent && isPlaying ? "일시정지" : "재생"}
                  >
                    {t.posterSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.posterSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <HeadphonesIcon className="h-4 w-4 text-gray-500" />
                    )}
                    <span
                      className={`absolute inset-0 flex items-center justify-center bg-black/45 transition ${
                        isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <PauseIcon className="h-4 w-4" />
                      ) : (
                        <PlayIcon className="h-4 w-4" />
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playAt(i)}
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                  >
                    <span className="w-full truncate text-xs text-gray-400">{t.author}</span>
                    <span
                      className={`w-full truncate text-sm ${isCurrent ? "font-bold" : "font-semibold"}`}
                    >
                      {t.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    aria-label="대기열에서 빼기"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 opacity-0 transition hover:bg-gray-800 hover:text-white group-hover:opacity-100"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
