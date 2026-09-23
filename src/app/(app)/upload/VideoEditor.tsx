"use client";

// 업로드 화면의 영상 편집 — 인스타그램 "편집" 단계 참고(2026-09-23, 사용자 요청):
// 다듬기(시작/끝 핸들로 구간 선택), 소리(원본 소리 끄기·음원 넣기, 09-24), 커버 사진(영상
// 프레임 중 하나 고르기, 또는 컴퓨터에서 이미지 선택). 여기서는 고르고 미리보기만 하고, 실제
// 편집은 게시 시점에 editVideoFile(ffmpeg.wasm)이 한 번만 수행한다.
//
// 로컬 blob URL이라 canvas로 프레임을 읽어도 CORS 문제가 없다(R2 영상에서 프레임을 못 읽는
// 문제와 무관 — 아직 업로드 전 파일).
import { useEffect, useMemo, useRef, useState } from "react";
import { PlayIcon, PauseIcon } from "@/components/icons";

const STRIP_FRAME_COUNT = 10;
const STRIP_HEIGHT = 64;
// 다듬기 최소 길이(초) — 핸들 두 개가 겹쳐서 0초짜리 영상이 되는 걸 막는다.
const MIN_TRIM_SECONDS = 1;

export type TrimRange = { start: number; end: number };

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

// 편집용 숨은 <video>에서 특정 시점 프레임을 JPEG File로 뽑는다(커버 사진). 정사각형
// 크롭은 기존 커버 이미지와 똑같이 게시 시점에 cropImageFileToSquare가 한다.
async function captureFrame(src: string, time: number): Promise<File | null> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("load failed"));
  });
  await seekTo(video, time);
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width) return null;
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  video.removeAttribute("src");
  video.load();
  return blob ? new File([blob], "cover.jpg", { type: "image/jpeg" }) : null;
}

export function VideoEditor({
  src,
  trim,
  onTrimChange,
  onDuration,
  coverTime,
  onCoverFrame,
  customCover,
  onPickCustomCover,
  muteOriginal,
  onMuteOriginalChange,
  musicFile,
  onMusicFileChange,
}: {
  src: string;
  trim: TrimRange | null;
  onTrimChange: (next: TrimRange) => void;
  onDuration: (duration: number) => void;
  // 프레임 커버로 고른 시점 — null이면 아직 안 고름(= 다듬기 시작점을 따라감).
  coverTime: number | null;
  // time=null은 "직접 고른 게 아니라 기본값(시작점 프레임)으로 잡힌 커버"라는 뜻 — 부모가
  // coverTime을 null로 유지해야 이후 시작점을 옮겨도 기본 커버가 계속 따라간다.
  onCoverFrame: (time: number | null, file: File) => void;
  // 컴퓨터에서 고른 커버 이미지가 있으면 프레임 스트립 대신 이걸 보여준다(위치 조정 UI 포함).
  customCover: React.ReactNode | null;
  onPickCustomCover: (e: React.ChangeEvent<HTMLInputElement>) => void;
  muteOriginal: boolean;
  onMuteOriginalChange: (muted: boolean) => void;
  // 넣을 음원 — 다듬은 구간 시작과 함께 0초부터 재생되고, 영상 길이에 맞춰 잘린다.
  musicFile: File | null;
  onMusicFileChange: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trimStripRef = useRef<HTMLDivElement>(null);
  const coverStripRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [playing, setPlaying] = useState(false);
  // 드래그 중인 대상 — 커버 드래그 중엔 놓을 때까지 프레임 캡처를 미룬다(매 이동마다 캡처하면 무겁다).
  const [dragging, setDragging] = useState<"start" | "end" | "cover" | null>(null);
  const [dragCoverTime, setDragCoverTime] = useState<number | null>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [musicDuration, setMusicDuration] = useState(0);
  const [musicError, setMusicError] = useState<string | null>(null);
  const musicUrl = useMemo(() => (musicFile ? URL.createObjectURL(musicFile) : null), [musicFile]);
  useEffect(() => {
    return () => {
      if (musicUrl) URL.revokeObjectURL(musicUrl);
    };
  }, [musicUrl]);

  // 원본 소리 끄기는 미리보기에도 그대로 — muted는 React prop으로는 첫 렌더에만 반영돼서 직접 건다.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muteOriginal;
  }, [muteOriginal]);

  const range = trim ?? { start: 0, end: duration };
  const effectiveCoverTime = dragCoverTime ?? coverTime ?? range.start;

  // 필름 스트립 썸네일 — 숨은 video를 순서대로 seek하며 작은 canvas에 그려 data URL로 모은다.
  useEffect(() => {
    let cancelled = false;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;
    (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error("load failed"));
        });
        const total = video.duration;
        if (!Number.isFinite(total) || total <= 0) throw new Error("no duration");
        const canvas = document.createElement("canvas");
        const h = STRIP_HEIGHT * 2;
        canvas.height = h;
        canvas.width = Math.round((h * video.videoWidth) / Math.max(1, video.videoHeight));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const out: string[] = [];
        for (let i = 0; i < STRIP_FRAME_COUNT; i++) {
          if (cancelled) return;
          await seekTo(video, ((i + 0.5) * total) / STRIP_FRAME_COUNT);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          out.push(canvas.toDataURL("image/jpeg", 0.7));
          // 하나씩 채워지는 게 보이도록 중간 결과도 반영.
          if (!cancelled) setFrames([...out]);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        video.removeAttribute("src");
        video.load();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // 아직 커버를 직접 안 골랐으면(coverTime=null) 다듬기 시작점 프레임을 기본 커버로 잡는다 —
  // 인스타그램처럼 첫 장면이 기본 커버. 시작 핸들을 놓을 때마다 따라간다.
  const startForDefaultCover = dragging === "start" ? null : range.start;
  useEffect(() => {
    if (coverTime !== null || customCover || !duration || startForDefaultCover === null) return;
    let cancelled = false;
    captureFrame(src, startForDefaultCover).then((file) => {
      if (!cancelled && file) onCoverFrame(null, file);
    });
    return () => {
      cancelled = true;
    };
    // onCoverFrame은 부모가 매 렌더 새로 만드는 함수라 의존성에서 뺀다(값이 바뀔 때만 캡처).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, duration, startForDefaultCover, coverTime, customCover]);

  function timeFromPointer(clientX: number, strip: HTMLDivElement | null) {
    if (!strip || !duration) return 0;
    const rect = strip.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }

  function previewAt(time: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = time;
  }

  // 미리보기 음원을 영상 위치에 맞춘다 — 음원의 0초 = 다듬은 구간의 시작. 영상이 재생 중이고
  // 음원 길이 안쪽일 때만 소리를 낸다(실제 결과물도 음원이 끝나면 그 뒤는 음원 없음).
  function syncMusic() {
    const video = videoRef.current;
    const music = musicRef.current;
    if (!video || !music) return;
    const t = video.currentTime - range.start;
    const inRange = t >= 0 && (!musicDuration || t < musicDuration);
    if (Math.abs(music.currentTime - t) > 0.25 && inRange) music.currentTime = t;
    if (!video.paused && inRange) {
      if (music.paused) void music.play().catch(() => {});
    } else if (!music.paused) {
      music.pause();
    }
  }

  function handleMusicPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setMusicError("음원 파일(mp3·wav)만 넣을 수 있어요.");
      return;
    }
    setMusicError(null);
    setMusicDuration(0);
    onMusicFileChange(file);
  }

  function handleTrimPointerDown(which: "start" | "end") {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(which);
    };
  }

  function handleTrimPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging !== "start" && dragging !== "end") return;
    const t = timeFromPointer(e.clientX, trimStripRef.current);
    const minLen = Math.min(MIN_TRIM_SECONDS, duration);
    const next =
      dragging === "start"
        ? { start: Math.min(t, range.end - minLen), end: range.end }
        : { start: range.start, end: Math.max(t, range.start + minLen) };
    onTrimChange(next);
    previewAt(dragging === "start" ? next.start : next.end);
  }

  function handleCoverPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging("cover");
    const t = Math.min(range.end, Math.max(range.start, timeFromPointer(e.clientX, coverStripRef.current)));
    setDragCoverTime(t);
    previewAt(t);
  }

  function handleCoverPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging !== "cover") return;
    const t = Math.min(range.end, Math.max(range.start, timeFromPointer(e.clientX, coverStripRef.current)));
    setDragCoverTime(t);
    previewAt(t);
  }

  async function handlePointerUp() {
    const wasCover = dragging === "cover";
    const t = dragCoverTime;
    setDragging(null);
    if (wasCover && t !== null) {
      const file = await captureFrame(src, t);
      if (file) onCoverFrame(t, file);
      setDragCoverTime(null);
    }
  }

  // 다듬기 구간을 줄였을 때 이미 고른 커버 프레임이 구간 밖으로 밀려나면 구간 안으로 당긴다
  // — 잘린 영상에 없는 장면이 커버가 되면 안 된다.
  useEffect(() => {
    if (coverTime === null || dragging || !duration) return;
    const clamped = Math.min(range.end, Math.max(range.start, coverTime));
    if (Math.abs(clamped - coverTime) < 0.01) return;
    let cancelled = false;
    captureFrame(src, clamped).then((file) => {
      if (!cancelled && file) onCoverFrame(clamped, file);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, coverTime, dragging, duration, src]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < range.start || video.currentTime >= range.end - 0.05) {
        video.currentTime = range.start;
      }
      void video.play();
    } else {
      video.pause();
    }
  }

  if (loadError) {
    return (
      <p className="rounded-xl bg-main-gray px-3 py-2.5 text-xs text-active-gray">
        이 브라우저에서 미리볼 수 없는 영상 형식이라 다듬기·소리·커버 편집을 쓸 수 없어요. 영상은 원본 그대로 올라가요.
      </p>
    );
  }

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
  const strip = (
    <div className="absolute inset-0 flex">
      {Array.from({ length: STRIP_FRAME_COUNT }, (_, i) =>
        frames[i] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={frames[i]} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
        ) : (
          <div key={i} className="h-full min-w-0 flex-1 animate-pulse bg-canvas-gray" />
        ),
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 편집 미리보기 — 다듬은 구간 안에서만 반복 재생된다. */}
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="auto"
          className="aspect-video w-full object-contain"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              setDuration(d);
              onDuration(d);
            }
          }}
          onPlay={() => {
            setPlaying(true);
            syncMusic();
          }}
          onPause={() => {
            setPlaying(false);
            musicRef.current?.pause();
          }}
          onSeeked={syncMusic}
          onTimeUpdate={(e) => {
            const video = e.currentTarget;
            if (!video.paused && video.currentTime >= range.end) video.currentTime = range.start;
            syncMusic();
          }}
          onClick={togglePlay}
        />
        {!playing && (
          <button
            type="button"
            aria-label="재생"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white">
              <PlayIcon className="h-7 w-7" />
            </span>
          </button>
        )}
        {playing && (
          <button
            type="button"
            aria-label="일시정지"
            onClick={togglePlay}
            className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <PauseIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-black">다듬기</span>
        <div
          ref={trimStripRef}
          onPointerMove={handleTrimPointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ height: STRIP_HEIGHT }}
          className="relative touch-none select-none overflow-hidden rounded-lg"
        >
          {strip}
          {/* 구간 밖은 어둡게 덮어서 잘려나갈 부분임을 보여준다. */}
          <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${pct(range.start)}%` }} />
          <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${100 - pct(range.end)}%` }} />
          <div
            className="pointer-events-none absolute inset-y-0 rounded-lg border-y-[3px] border-white"
            style={{ left: `${pct(range.start)}%`, right: `${100 - pct(range.end)}%` }}
          />
          {(["start", "end"] as const).map((which) => (
            <div
              key={which}
              role="slider"
              aria-label={which === "start" ? "시작 지점" : "끝 지점"}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(which === "start" ? range.start : range.end)}
              onPointerDown={handleTrimPointerDown(which)}
              className={`absolute inset-y-0 flex w-4 cursor-ew-resize items-center justify-center bg-white ${
                which === "start" ? "rounded-l-lg" : "-translate-x-full rounded-r-lg"
              }`}
              style={{ left: `${pct(which === "start" ? range.start : range.end)}%` }}
            >
              <span className="h-5 w-0.5 rounded-full bg-black/70" />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-active-gray">
          <span>{formatTime(range.start)}</span>
          <span className="font-medium text-black">{formatTime(range.end - range.start)} 선택됨</span>
          <span>{formatTime(range.end)}</span>
        </div>
        <p className="text-[11px] text-active-gray">
          영상 구조에 따라 시작점이 1초 남짓 앞당겨지거나, 게시할 때 다듬는 데 시간이 걸릴 수 있어요.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-black">소리</span>
        <div className="flex items-center justify-between rounded-xl bg-main-gray px-3 py-2.5">
          <span className="text-sm text-black">원본 소리</span>
          <button
            type="button"
            role="switch"
            aria-checked={!muteOriginal}
            aria-label="원본 소리 켜기"
            onClick={() => onMuteOriginalChange(!muteOriginal)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              muteOriginal ? "bg-canvas-gray" : "bg-active-gray"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                muteOriginal ? "left-0.5" : "left-[22px]"
              }`}
            />
          </button>
        </div>
        <input
          ref={musicInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav"
          onChange={handleMusicPick}
          className="hidden"
        />
        {musicFile && musicUrl ? (
          <div className="flex items-center gap-3 rounded-xl bg-main-gray px-3 py-2.5">
            <span className="text-lg" aria-hidden>
              ♪
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-black">{musicFile.name}</span>
              <span className="text-[11px] text-active-gray">
                {musicDuration > 0 && musicDuration < range.end - range.start - 0.05
                  ? `음원(${formatTime(musicDuration)})이 영상보다 짧아서 ${formatTime(musicDuration)} 이후엔 ${
                      muteOriginal ? "소리가 없어요" : "원본 소리만 나와요"
                    }`
                  : `영상 길이(${formatTime(range.end - range.start)})에 맞춰 잘려요`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => musicInputRef.current?.click()}
              className="shrink-0 text-xs font-semibold text-black hover:opacity-80"
            >
              변경
            </button>
            <button
              type="button"
              onClick={() => {
                musicRef.current?.pause();
                onMusicFileChange(null);
              }}
              className="shrink-0 text-xs font-semibold text-active-gray hover:opacity-80"
            >
              제거
            </button>
            <audio
              ref={musicRef}
              src={musicUrl}
              preload="auto"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d)) setMusicDuration(d);
              }}
              className="hidden"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => musicInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-active-gray bg-box-gray px-3 py-2.5 text-sm font-bold text-active-gray transition-colors hover:bg-canvas-gray"
          >
            ♪ 음원 넣기
            <span className="text-[11px] font-normal">mp3 · wav</span>
          </button>
        )}
        {musicError && <p className="text-xs text-red-600">{musicError}</p>}
        <p className="text-[11px] text-active-gray">
          {musicFile && !muteOriginal
            ? "원본 소리와 음원이 함께 섞여요. 음원만 쓰려면 원본 소리를 꺼주세요."
            : "음원은 다듬은 영상의 시작부터 재생되고, 영상이 끝나는 지점에서 잘려요."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-black">커버 사진</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPickCustomCover}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-blue-600 hover:opacity-80"
          >
            컴퓨터에서 선택
          </button>
        </div>
        {customCover ?? (
          <>
            <div
              ref={coverStripRef}
              onPointerDown={handleCoverPointerDown}
              onPointerMove={handleCoverPointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ height: STRIP_HEIGHT }}
              className="relative cursor-pointer touch-none select-none overflow-hidden rounded-lg"
            >
              {strip}
              <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${pct(range.start)}%` }} />
              <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${100 - pct(range.end)}%` }} />
              {/* 선택된 프레임 표시 — 인스타그램처럼 흰 테두리 박스가 스트립 위를 움직인다. */}
              <div
                className="pointer-events-none absolute inset-y-0 w-12 -translate-x-1/2 rounded-md border-[3px] border-white shadow-lg"
                style={{ left: `clamp(24px, ${pct(effectiveCoverTime)}%, calc(100% - 24px))` }}
              />
            </div>
            <p className="text-[11px] text-active-gray">스트립을 눌러 커버로 쓸 장면을 고르세요</p>
          </>
        )}
      </div>
    </div>
  );
}
