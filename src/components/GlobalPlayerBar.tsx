"use client";

// 사운드클라우드 참고 — 화면 하단에 항상 고정되는 한 줄짜리 플레이어 바. 실제 재생 엘리먼트가
// 여기 하나뿐이고 (app) 레이아웃에 마운트돼 페이지 이동에도 안 끊긴다.
// 레이아웃은 3분할 그리드로 폭을 고정한다(제목/파형 영역이 트랙마다 흔들리지 않게):
//   왼쪽=트랜스포트 / 가운데=경과시간·파형(탐색)·총시간 / 오른쪽=커버·제목·게시자 + 볼륨·대기열
// 바 자체가 항상 하단에 고정이라 별도 "닫기(X)" 버튼은 없음(사용자 요청) — 재생 정지는
// 재생/일시정지 토글로, 큐 비우기는 QueuePanel 쪽에서.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { usePlaylist } from "@/components/PlaylistContext";
import { useMediaProgress } from "@/lib/useMediaProgress";
import { computeWaveformBars } from "@/lib/waveform";
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ListIcon,
  HeadphonesIcon,
  VolumeIcon,
} from "@/components/icons";

const BAR_COUNT = 160;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// 진폭(0~1)에 따라 재생된 구간 색을 골드 3단계로 — SoundbarPlayer(카드 파형)와 같은 언어.
function demoBandColor(v: number): string {
  if (v < 0.35) return "#8a6a2e";
  if (v < 0.65) return "#c9a668";
  return "#f5d999";
}

// 실제 분석이 끝나기 전(또는 실패 시) 보여줄 프리셋 파형 — 트랙 id로 시드를 고정해 0~1 진폭 배열.
function presetBars(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    bars.push(0.2 + (h % 80) / 100); // 0.2 ~ 0.99
  }
  return bars;
}

export function GlobalPlayerBar() {
  const { track, isPlaying, setIsPlaying, toggle, pause, videoRef, duration, setDuration } =
    useNowPlaying();
  const {
    items: queueItems,
    playAt,
    playNext,
    playPrev,
    hasNext,
    hasPrev,
    queueOpen,
    toggleQueue,
    recentlyPlayed,
  } = usePlaylist();
  const hasQueue = queueItems.length > 0;
  const hasPanel = hasQueue || recentlyPlayed.length > 0;
  const [progress] = useMediaProgress(videoRef, isPlaying);

  // 볼륨 — 아이콘을 누르면 세로 슬라이더가 뜨고(사용자 요청), 드래그로 0~1 사이 조절.
  // 곡이 바뀌어도 유지되게 ref에도 같이 들고 있다가 트랙 로드 시 그대로 적용한다.
  const [volume, setVolume] = useState(1);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume, videoRef]);

  // #1 — 프리셋이 아니라 현재 트랙의 실제 오디오를 분석한 파형.
  const preset = useMemo(() => presetBars(track?.id ?? ""), [track?.id]);
  const [analyzed, setAnalyzed] = useState<number[] | null>(null);
  const bars = analyzed ?? preset;

  useEffect(() => {
    setAnalyzed(null);
    const src = track?.videoSrc;
    if (!src) return;
    let cancelled = false;
    // 같은 출처(/... 로컬 파일)는 바로 fetch, R2 signed URL은 CORS 때문에 서버 프록시 경유.
    const url = src.startsWith("/") ? src : `/api/media/waveform-proxy?url=${encodeURIComponent(src)}`;
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buf) => computeWaveformBars(buf, BAR_COUNT))
      .then((result) => {
        if (!cancelled) setAnalyzed(result);
      })
      .catch(() => {
        // 분석 실패해도 프리셋 파형으로 계속 — 재생엔 지장 없음.
      });
    return () => {
      cancelled = true;
    };
  }, [track?.videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !track) return;
    if (video.src !== track.videoSrc) {
      video.src = track.videoSrc;
      video.currentTime = 0;
    }
    // 곡이 바뀌어도 사용자가 골라둔 볼륨은 유지 — 매번 초기화하지 않는다.
    video.volume = volumeRef.current;
    video.play().catch(() => setIsPlaying(false));
  }, [track, videoRef, setIsPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const commitDuration = (d: number) => {
      if (Number.isFinite(d) && d > 0) setDuration(d);
    };

    const onLoaded = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        commitDuration(video.duration);
        return;
      }
      // 일부 R2 signed URL 스트리밍 응답은 메타데이터 단계에서 duration을 Infinity/NaN으로
      // 보고한다(청크 전송이라 브라우저가 전체 길이를 못 잼) — 끝까지 탐색을 한 번 시도시키면
      // 브라우저가 실제 길이를 계산해 durationchange로 알려주는, 널리 쓰이는 우회법.
      const resumeAt = video.currentTime;
      const onDurationChange = () => {
        video.removeEventListener("durationchange", onDurationChange);
        commitDuration(video.duration);
        video.currentTime = resumeAt;
      };
      video.addEventListener("durationchange", onDurationChange);
      video.currentTime = 1e101;
    };
    // 큐에 다음 곡이 있으면 이어서 재생, 없으면 그 자리에서 멈춘다(바·대기열은 유지 — X로만 닫음).
    const onEnded = () => {
      if (!playNext()) pause();
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef, pause, playNext, setDuration]);

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const playedBarCount = Math.round((pct / 100) * bars.length);

  // React state(duration)가 아니라 <video> 엘리먼트의 실시간 값을 직접 읽는다 — 위 duration
  // 우회 로직이 아직 안 끝났거나 상태 갱신이 한 박자 늦어도 클릭 탐색은 항상 되게.
  const seek = (e: React.MouseEvent<HTMLButtonElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * d;
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} className="hidden" playsInline />
      {/* 바 배경 = DEMO 탭 배경(#fafafa)과 memo 탭 배경(#1c1c1e)의 정확한 중간값(#8b8b8c) —
          사용자 요청: 아이콘이 아니라 사운드바 자체를 이 중립 회색으로.
          배경은 화면 전체 폭을 채우되(fixed inset-x-0), 실제 컨트롤은 max-w로 가운데 묶어서
          넓은 모니터에서 파형이 끝없이 늘어나거나 우측 트랙 정보가 화면 맨 끝으로 밀려나지
          않게 한다(사용자 요청 — 파형 줄이고, 트랙 정보는 파형 바로 오른쪽에 붙여서). */}
      <div className="fixed inset-x-0 bottom-14 z-50 h-16 border-t border-black/15 bg-[#8b8b8c] text-white md:bottom-0">
        <div className="mx-auto grid h-full max-w-[1100px] grid-cols-[36px_minmax(0,1fr)_140px] items-center gap-2 px-3 md:grid-cols-[128px_minmax(0,1fr)_300px] md:gap-4 md:px-4">
          {/* 왼쪽: 트랜스포트 (이전/다음은 데스크톱만 — 모바일은 대기열 패널에서 곡 선택) */}
          <div className="flex items-center gap-1 justify-self-start">
          <button
            onClick={() => playPrev()}
            disabled={!hasPrev}
            aria-label="이전 곡"
            className="hidden h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent md:flex"
          >
            <SkipBackIcon className="h-4 w-4" />
          </button>
          <button
            onClick={track ? toggle : () => playAt(0)}
            disabled={!track && !hasQueue}
            aria-label={isPlaying ? "일시정지" : "재생"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition disabled:opacity-30"
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => playNext()}
            disabled={!hasNext}
            aria-label="다음 곡"
            className="hidden h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent md:flex"
          >
            <SkipForwardIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 가운데: 경과 시간 — 파형(탐색) — 총 시간 */}
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <span className="hidden w-9 shrink-0 text-right text-[11px] tabular-nums text-black/55 md:block">
            {formatTime(progress)}
          </span>
          <button
            onClick={seek}
            disabled={!track}
            className="relative flex h-9 min-w-0 flex-1 items-center gap-px disabled:cursor-default"
            aria-label="탐색 바 (파형)"
          >
            {bars.map((v, i) => (
              <span
                key={i}
                className="w-full flex-1 rounded-[1px]"
                style={{
                  height: `${Math.max(6, v * 100)}%`,
                  background: i < playedBarCount ? demoBandColor(v) : "rgba(255,255,255,0.22)",
                }}
              />
            ))}
            {track && (
              <span
                className="pointer-events-none absolute top-0 h-full w-px bg-[#f5d999]"
                style={{ left: `${pct}%` }}
              />
            )}
          </button>
          <span className="hidden w-9 shrink-0 text-[11px] tabular-nums text-black/55 md:block">
            {formatTime(duration)}
          </span>
        </div>

        {/* 오른쪽: 커버 · 제목 · 게시자 + 볼륨 · 대기열 (폭 고정 열, 파형 바로 옆에 왼쪽 정렬 —
            justify-self를 안 줘서 기본값 stretch로 열 전체를 채우고, flex 기본 정렬(시작 쪽
            packing)로 왼쪽부터 붙는다. 이래야 title의 flex-1/truncate도 실제로 동작한다.) */}
        <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-white/10">
            {track?.posterSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.posterSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <HeadphonesIcon className="h-4 w-4 text-black/45" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-semibold md:text-sm">
              {track ? track.title : "재생 중인 트랙 없음"}
            </span>
            <span className="truncate text-[11px] text-black/55 md:text-xs">
              {track ? track.author : hasQueue ? `대기열 ${queueItems.length}곡` : "—"}
            </span>
          </div>
          <div className="relative hidden md:block">
            {volumeOpen && (
              <>
                {/* 슬라이더 바깥을 누르면 닫히는 투명 오버레이 — RightSidebar 더보기 메뉴와 같은 패턴. */}
                <button
                  aria-label="볼륨 슬라이더 닫기"
                  onClick={() => setVolumeOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 justify-center rounded-lg border border-black/15 bg-[#8b8b8c] px-2 py-3 shadow-xl">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    aria-label="볼륨"
                    className="cursor-pointer accent-white"
                    style={{
                      writingMode: "vertical-lr",
                      direction: "rtl",
                      WebkitAppearance: "slider-vertical",
                      width: 6,
                      height: 96,
                    }}
                  />
                </div>
              </>
            )}
            <button
              onClick={() => setVolumeOpen((v) => !v)}
              aria-label="볼륨"
              aria-pressed={volumeOpen}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition ${
                volumeOpen ? "bg-white/20" : "hover:bg-gray-800"
              }`}
            >
              <VolumeIcon className="h-4 w-4" muted={volume === 0} />
            </button>
          </div>
          <button
            onClick={toggleQueue}
            disabled={!hasPanel}
            aria-label="재생 대기열"
            aria-pressed={queueOpen}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-30 ${
              queueOpen ? "bg-white/20" : "hover:bg-gray-800"
            }`}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
