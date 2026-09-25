"use client";

// 사운드클라우드 참고 — 화면 하단에 항상 고정되는 한 줄짜리 플레이어 바. 실제 재생 엘리먼트가
// 여기 하나뿐이고 (app) 레이아웃에 마운트돼 페이지 이동에도 안 끊긴다.
// 레이아웃은 3분할 그리드: 가운데(파형)를 피드 게시물 폭(760px)으로 고정하고 좌우를 같은
// 1fr로 둬서 파형이 화면 정중앙에 오게 하고, 나머지 아이콘은 그 파형 기준 좌우에 붙인다
// (사용자 요청 — 트랜스포트는 왼쪽 열의 오른쪽 끝에, 트랙정보·볼륨·대기열은 오른쪽 열의
// 왼쪽 끝에, 둘 다 파형과 맞닿게).
// 바 자체가 항상 하단에 고정이라 별도 "닫기(X)" 버튼은 없음(사용자 요청) — 재생 정지는
// 재생/일시정지 토글로, 큐 비우기는 QueuePanel 쪽에서.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { usePlaylist } from "@/components/PlaylistContext";
import { useMediaProgress } from "@/lib/useMediaProgress";
import { computeWaveformBars } from "@/lib/waveform";
import { ExpandedPlayer } from "@/components/ExpandedPlayer";
import { useScrub } from "@/lib/useScrub";
import { useMediaSession } from "@/lib/useMediaSession";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    track,
    isPlaying,
    setIsPlaying,
    toggle,
    pause,
    videoRef,
    duration,
    setDuration,
  } = useNowPlaying();
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
  // 잠금화면·알림창·이어폰 버튼 재생 컨트롤 + 백그라운드 재생 안정화(useMediaSession.ts).
  useMediaSession({ track, isPlaying, setIsPlaying, pause, mediaRef: videoRef, playNext, playPrev, hasNext, hasPrev });
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

  // 풀스크린 플레이어(사운드클라우드 참고, 2026-09-23 추가) — 바의 커버·제목 영역을 탭하면
  // 열린다. 트랙이 바뀌어도 열린 채 유지(다음 곡 자동재생 등), 트랙이 아예 없어지면(정지)
  // 닫을 화면이 없으므로 같이 닫는다.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!track) setExpanded(false);
  }, [track]);

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
    // 같은 src라 메타데이터 이벤트가 다시 안 오는 경우에도 이미 아는 길이로 다시 맞춘다.
    if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
    // ⚠️ 한때 "음소거로 먼저 재생 후 해제" 우회를 넣었었는데, 재생 시작 직후 unmute를
    // 비동기(.then) 콜백에서 하면 브라우저가 그 unmute를 사용자 제스처 밖의 행동으로 보고
    // 오히려 재생을 멈춰버리는 걸 로컬에서 재현·확인해서 되돌렸다(같은 테스트 방식으로
    // 이 트릭 넣기 전엔 항상 재생됐고, 넣은 뒤엔 재현되게 깨졌음 — 명확한 회귀).
    video.play().catch(() => setIsPlaying(false));
  }, [track, videoRef, setIsPlaying, setDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // loadedmetadata·durationchange 둘 다 그냥 듣기만 한다 — 이전에 "duration이 Infinity로
    // 잡히는 스트림을 강제로 끝까지 탐색시켜(currentTime=1e101) 우회"하는 로직이 있었는데,
    // R2 signed URL에 그 탐색이 실패 범위 요청(Range)으로 튕기면서 오히려 재생 자체가 멈추는
    // 회귀가 생겼다(사용자 제보: "재생 버튼은 동작하나 소리가 안 남"). 재생을 절대 건드리지
    // 않는 안전한 방식으로 되돌림 — duration이 늦게 잡히거나 부정확해도 재생 자체는 항상 된다.
    const onDurationKnown = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
    };
    // 큐에 다음 곡이 있으면 이어서 재생, 없으면 그 자리에서 멈춘다(바·대기열은 유지 — X로만 닫음).
    const onEnded = () => {
      if (!playNext()) pause();
    };
    video.addEventListener("loadedmetadata", onDurationKnown);
    video.addEventListener("durationchange", onDurationKnown);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("loadedmetadata", onDurationKnown);
      video.removeEventListener("durationchange", onDurationKnown);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef, pause, playNext, setDuration]);

  // 바 배경은 "재생 중인 트랙의 종류"가 아니라 ThemeSync.tsx와 완전히 같은 식(pathname +
  // ?feed=complex)으로 계산한 "지금 보고 있는 사이트 테마"를 따른다(2026-09-18 수정 —
  // 트랙 기준으로 했더니 곡을 하나도 안 튼 대기 상태·memo 탭 안에서는 항상 밝은 채로 안
  // 바뀐다는 제보). 이러면 ThemeSync가 <html>에 .dark를 붙이는 바로 그 순간에 바 색도 같이
  // 바뀌고, 탭 전환 중엔 globals.css의 .theme-transition(4s ease)이 <html> 하위 전부에
  // 걸리므로 이 바도 자동으로 같은 그라데이션을 타고 부드럽게 전환된다(별도 트랜지션 코드
  // 불필요 — DEMO/memo 탭 전환 시에만 느려지고 평소 hover 등은 그대로 빠름).
  const isMemoTheme = pathname === "/feed" && searchParams.get("feed") === "complex";
  const barBg = isMemoTheme ? "bg-[#1c1c1e]" : "bg-demo-bg";
  const barText = isMemoTheme ? "text-white" : "text-black";
  const barMuted = isMemoTheme ? "text-white/55" : "text-black/55";
  const barBorder = isMemoTheme ? "border-white/10" : "border-black/10";
  const barHover = isMemoTheme ? "hover:bg-white/10" : "hover:bg-black/10";
  const barActive = isMemoTheme ? "bg-white/20" : "bg-black/10";
  const coverBg = isMemoTheme ? "bg-white/10" : "bg-black/10";
  const coverIcon = isMemoTheme ? "text-white/45" : "text-black/45";
  const barAccent = isMemoTheme ? "accent-white" : "accent-black";
  // 재생 버튼은 항상 바와 반대색 필 — 바가 밝아지면(DEMO) 흰 버튼이 묻히므로 검정 필+흰
  // 아이콘으로 뒤집는다(memo는 기존 그대로 흰 필+검정 아이콘).
  const playButtonBg = isMemoTheme ? "bg-white text-black" : "bg-black text-white";
  const unplayedBarColor = isMemoTheme ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.16)";
  // 파형 포인트 컬러(재생된 구간·플레이헤드)만은 여전히 "지금 재생 중인 트랙 자체"의 종류를
  // 따른다 — memo(비공개) 오디오/영상 게시물은 expiresAt(노출 만료 시각)을 들고 있다(DEMO는
  // 영구노출이라 안 붙는 필드). 바 색(사이트 테마)과 트랙 색(브랜드 포인트)은 서로 다른
  // 기준이라 각자 트랙을 memo 탭 밖에서 재생해도(예: 대기열에 담아뒀다 DEMO 탭에서 이어
  // 재생) 파형은 그 트랙 고유의 색을 유지한다. 골드와 마찬가지로 진폭(v)에 따라 3단계로
  // 2026-09-26(사용자 요청) — memo가 DEMO에 통합되면서 노출기간(expiresAt) 있는 글도 이제
  // 평범한 DEMO 게시물이라 expiresAt으로 memo/violet을 가르던 예전 기준은 더 이상 맞지 않다.
  // 재생 파형은 항상 DEMO 골드 하나로 통일.
  const playedColor = demoBandColor;
  const playheadColor = "#f5d999";

  // React state(duration)가 아니라 <video> 엘리먼트의 실시간 값을 직접 읽는다 — 위 duration
  // 우회 로직이 아직 안 끝났거나 상태 갱신이 한 박자 늦어도 탐색은 항상 되게.
  const { scrubRatio, scrubHandlers } = useScrub((ratio) => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    video.currentTime = ratio * d;
  });
  // 드래그 중엔 손가락 위치를 그대로 보여준다(플레이헤드·재생 구간·경과 시간).
  const shownProgress = scrubRatio !== null ? scrubRatio * duration : progress;

  const pct = scrubRatio !== null ? scrubRatio * 100 : duration > 0 ? (progress / duration) * 100 : 0;
  const playedBarCount = Math.round((pct / 100) * bars.length);

  return (
    <>
      {/* 소리 전용 전역 엘리먼트 — <audio>라서 iOS·Android 모두 앱을 내리거나 화면을 꺼도 계속
          재생되고(예전 <video>는 iOS가 백그라운드에서 멈춤), 잠금화면·알림창 컨트롤은
          useMediaSession이 붙인다. controls가 없는 <audio>는 원래 화면에 안 그려져서 따로 숨길
          필요가 없다(재생에는 영향 없음). */}
      <audio ref={videoRef} preload="auto" aria-hidden="true" />
      {/* 바 배경 = 지금 보고 있는 사이트 테마(isMemoTheme, ThemeSync와 동일 기준)를 따라감
          (2026-09-18) — DEMO는 데모탭 배경(demo-bg, #fafafa)으로 밝게, memo 탭은 memo/complex
          배경(#1c1c1e)으로 어둡게. 배경이 바뀌므로 아이콘·글씨·파형 미재생 구간·재생 버튼
          색은 전부 isMemoTheme 하나로 자동 반전(barText/barMuted/barBorder/barHover/
          barActive/coverBg/coverIcon/playButtonBg, 위 선언부 참고) — 가독성이 항상 유지된다.
          재생 중인 파형(playedColor/playheadColor)은 2026-09-26부터 트랙 종류와 무관하게
          항상 DEMO 골드 하나(memo 통합으로 violet 트랙 구분이 없어짐).
          데스크톱 레이아웃: 파형(가운데 열)을 고정폭(900px — feed/page.tsx <main>의
          max-w-[900px]과 동일 값, 게시물 카드(760px)보다 조금 더 넓게)으로 두고, 좌우 열을
          똑같은 minmax(0,1fr)로 줘서 파형이 "화면 자체의" 정중앙에 오게 만든다(사용자 요청 —
          파형이 정렬 기준, 나머지 아이콘은 그 파형 양옆에 붙임). 좌우 폭이 같은 1fr이라 안의
          내용물 크기와 무관하게 가운데 열은 항상 정확히 화면 중앙에 위치한다. */}
      <div
        // 전엔 md 이상에서 NavSidebar를 피해 md:left-[72px]로 시작점을 밀어냈는데, 그래도
        // 사이드바 폭 트랜지션 중 사운드바 왼쪽이 가려 보이는 문제가 계속 있었다(2026-09-16
        // 재제보 — "어느 페이지에서도 잘리면 안 됨"). 근본 원인을 없애려고 NavSidebar 쪽을
        // bottom-16까지만 뻗게 줄여서(NavSidebar.tsx 참고) 이 바와 세로로 아예 안 겹치게
        // 했으므로, 여기 있던 left 오프셋도 걷어내고 항상 화면 맨 왼쪽부터 꽉 채운다 — 두
        // 요소가 물리적으로 안 겹치니 어떤 z-index/트랜지션 상황에서도 가려질 수가 없다.
        // 모바일 바 높이는 최대한 줄인다(2026-09-23 사용자 요청 — "높이를 최대한 줄여봐") —
        // h-16(64px) 대신 h-11(44px). 데스크톱은 그대로 h-16 유지, 안의 커버·재생버튼·파형도
        // 이 높이에 맞춰 모바일에서만 한 단계씩 축소(각 요소 className 참고).
        // z-40(BottomNav와 동일): 예전 z-50이었을 땐 레이아웃상 페이지 콘텐츠보다 DOM이 뒤라
        // 같은 z-50인 모달·바텀시트(댓글창·알림·가이드 팝업·집중모드 등) 위를 덮어 그 하단
        // 입력칸/버튼을 가렸다(2026-09-23). 모달이 항상 이 바 위로 오도록 한 단계 내렸다.
        className={`fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 grid h-11 grid-cols-[32px_minmax(0,1fr)_120px] items-center gap-1.5 border-t px-2.5 transition-colors md:bottom-0 md:h-16 md:grid-cols-[minmax(0,1fr)_900px_minmax(0,1fr)] md:gap-4 md:px-4 ${barBg} ${barText} ${barBorder}`}
      >
        {/* 왼쪽: 트랜스포트 (이전/다음은 데스크톱만 — 모바일은 대기열 패널에서 곡 선택).
            justify-self-end로 이 넓은 왼쪽 열의 오른쪽 끝(=파형 바로 옆)에 붙인다. */}
        <div className="flex items-center gap-1 justify-self-end">
          <button
            onClick={() => playPrev()}
            disabled={!hasPrev}
            aria-label="이전 곡"
            className={`hidden h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30 disabled:hover:bg-transparent md:flex ${barHover}`}
          >
            <SkipBackIcon className="h-4 w-4" />
          </button>
          <button
            onClick={track ? toggle : () => playAt(0)}
            disabled={!track && !hasQueue}
            aria-label={isPlaying ? "일시정지" : "재생"}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30 md:h-9 md:w-9 ${playButtonBg}`}
          >
            {isPlaying ? (
              <PauseIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
            ) : (
              <PlayIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
            )}
          </button>
          <button
            onClick={() => playNext()}
            disabled={!hasNext}
            aria-label="다음 곡"
            className={`hidden h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30 disabled:hover:bg-transparent md:flex ${barHover}`}
          >
            <SkipForwardIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 가운데: 경과 시간 — 파형(탐색) — 총 시간 */}
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <span className={`hidden w-9 shrink-0 text-right text-[11px] tabular-nums md:block ${barMuted}`}>
            {formatTime(shownProgress)}
          </span>
          <button
            {...scrubHandlers}
            disabled={!track}
            className="relative flex h-8 min-w-0 flex-1 touch-none items-center gap-px disabled:cursor-default md:h-9"
            aria-label="탐색 바 (파형)"
          >
            {bars.map((v, i) => (
              <span
                key={i}
                className="w-full flex-1 rounded-[1px]"
                style={{
                  height: `${Math.max(6, v * 100)}%`,
                  background: i < playedBarCount ? playedColor(v) : unplayedBarColor,
                }}
              />
            ))}
            {track && (
              <span
                className="pointer-events-none absolute top-0 h-full w-px"
                style={{ left: `${pct}%`, background: playheadColor }}
              />
            )}
          </button>
          <span className={`hidden w-9 shrink-0 text-[11px] tabular-nums md:block ${barMuted}`}>
            {formatTime(duration)}
          </span>
        </div>

        {/* 오른쪽: 커버 · 제목 · 게시자 + 볼륨 · 대기열 (폭 고정 열, 파형 바로 옆에 왼쪽 정렬 —
            justify-self를 안 줘서 기본값 stretch로 열 전체를 채우고, flex 기본 정렬(시작 쪽
            packing)로 왼쪽부터 붙는다. 이래야 title의 flex-1/truncate도 실제로 동작한다.) */}
        <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => track && setExpanded(true)}
            disabled={!track}
            aria-label="플레이어 펼치기"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default md:gap-2"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded md:h-9 md:w-9 ${coverBg}`}
            >
              {track?.posterSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.posterSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <HeadphonesIcon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${coverIcon}`} />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-semibold md:text-sm">
                {track ? track.title : "재생 중인 트랙 없음"}
              </span>
              <span className={`truncate text-[11px] md:text-xs ${barMuted}`}>
                {track ? track.author : hasQueue ? `대기열 ${queueItems.length}곡` : "—"}
              </span>
            </div>
          </button>
          <div className="relative hidden md:block">
            {volumeOpen && (
              <>
                {/* 슬라이더 바깥을 누르면 닫히는 투명 오버레이 — RightSidebar 더보기 메뉴와 같은 패턴. */}
                <button
                  aria-label="볼륨 슬라이더 닫기"
                  onClick={() => setVolumeOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div
                  className={`absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 justify-center rounded-lg border px-2 py-3 shadow-xl ${barBg} ${barBorder}`}
                >
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    aria-label="볼륨"
                    className={`cursor-pointer ${barAccent}`}
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
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                volumeOpen ? barActive : barHover
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
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-30 ${
              queueOpen ? barActive : barHover
            }`}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && track && (
        <ExpandedPlayer
          track={track}
          isPlaying={isPlaying}
          toggle={toggle}
          playPrev={playPrev}
          playNext={playNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          bars={bars}
          playedBarCount={playedBarCount}
          playedColor={playedColor}
          unplayedBarColor={unplayedBarColor}
          playheadColor={playheadColor}
          pct={pct}
          scrubHandlers={scrubHandlers}
          progress={shownProgress}
          duration={duration}
          onClose={() => setExpanded(false)}
          hasPanel={hasPanel}
          queueOpen={queueOpen}
          toggleQueue={toggleQueue}
        />
      )}
    </>
  );
}
