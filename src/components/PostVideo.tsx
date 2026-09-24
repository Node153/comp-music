"use client";

// 피드 카드 안의 영상 미리보기 — 항상 muted라 실제 소리는 나지 않고,
// 재생 버튼을 누르면 하단 GlobalPlayerBar가 실제 소리를 재생해 페이지 이동에도 안 끊긴다.
//
// tone="demo"는 인스타그램 참고 검토 후 나온 두 가지 변경 — object-cover로 프레임을
// 꽉 채우고(원본 비율과 안 맞으면 자동으로 살짝 잘림), 브라우저 기본 <video controls>
// 대신 MockPlayOverlay와 같은 커스텀 재생 버튼을 쓴다(브라우저마다 다르게 생긴 네이티브
// 컨트롤이 앱 톤과 안 맞는다는 지적). tone="memo"(기본값)는 예전 방식 그대로.
import { useEffect, useRef, useState } from "react";
import { useNowPlaying } from "@/components/NowPlayingContext";
import { usePlaylistOptional, usePageTrack, PAGE_TRACK_ATTR } from "@/components/PlaylistContext";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { useDoubleTap } from "@/lib/useDoubleTap";
import { usePostLike } from "@/lib/usePostLike";
import { useHeartBurst } from "@/components/HeartBurst";
import { PlayIcon, PauseIcon } from "@/components/icons";

export function PostVideo({
  postId,
  title,
  author,
  authorId,
  videoSrc,
  posterSrc,
  tone = "memo",
  expiresAt,
  // 지금 보고 있는 사람(뷰어)의 id — 더블탭 좋아요 대상. 게스트(비로그인)는 undefined라
  // 그 경우 더블탭 감지 없이 원래대로 클릭 즉시 재생/일시정지만 한다.
  viewerId,
}: {
  postId: string;
  title: string;
  author: string;
  authorId?: string;
  videoSrc: string;
  posterSrc?: string | null;
  tone?: "demo" | "memo";
  // memo(비공개) 영상 게시물의 노출 만료 시각 — 오디오(SoundbarPlayer)처럼 재생목록/최근들은에
  // 그대로 실어서 남은 시간 뱃지를 보여준다. DEMO는 영구노출이라 안 넘어옴(undefined).
  expiresAt?: string | null;
  viewerId?: string;
}) {
  const { track, play, pause, videoRef: globalVideoRef, lastCountedView } = useNowPlaying();
  const playlist = usePlaylistOptional();
  const { setViewCount } = usePostEngagement();
  const { likeOnly } = usePostLike(postId, viewerId ?? "");
  const { burst, element: heartBurstEl } = useHeartBurst();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const processedViewRef = useRef<number | null>(null);

  // DEMO 조회수(0053/0054) — 30초 이상 재생돼 서버에 실제로 카운트된 순간만 화면 숫자를
  // 낙관적으로 올린다(NowPlayingContext가 재생 시작 지점과 무관하게 중앙에서 판정).
  useEffect(() => {
    if (!lastCountedView || lastCountedView.id !== postId) return;
    if (processedViewRef.current === lastCountedView.at) return;
    processedViewRef.current = lastCountedView.at;
    setViewCount((c) => c + 1);
  }, [lastCountedView, postId, setViewCount]);

  // 이 게시물이 하단 사운드바(전역 <video>, 소리를 실제로 내는 쪽)의 현재 트랙일 때,
  // 바에서 탐색(seek)하면 여기 보이는 음소거 미리보기 영상도 같은 위치로 맞춘다 — 둘은
  // 서로 다른 <video> 엘리먼트라 안 그러면 소리는 A 지점, 화면은 B 지점을 보여주게
  // 된다(사용자 제보: "특정 지점으로 재생하면 영상이랑 싱크가 안맞음").
  useEffect(() => {
    if (track?.id !== postId) return;
    const globalVideo = globalVideoRef.current;
    const localVideo = videoRef.current;
    if (!globalVideo || !localVideo) return;
    const syncTime = () => {
      if (Math.abs(localVideo.currentTime - globalVideo.currentTime) > 0.3) {
        localVideo.currentTime = globalVideo.currentTime;
      }
    };
    globalVideo.addEventListener("seeked", syncTime);
    return () => globalVideo.removeEventListener("seeked", syncTime);
  }, [track?.id, postId, globalVideoRef]);

  const trackData = {
    id: postId,
    title,
    author,
    authorId,
    videoSrc,
    posterSrc: posterSrc ?? null,
    expiresAt,
    mediaType: "video" as const,
  };
  // 하단 바에서 앞 곡이 끝나면 화면상 다음 카드로 이어 재생되도록 후보 등록.
  usePageTrack(trackData);

  function handlePlay() {
    setIsPlaying(true);
    // 오디오 게시물(SoundbarPlayer)처럼 영상 게시물도 재생하면 "최근 들은"에 기록되게 —
    // 여기서 넘기는 값은 이 렌더에서 서버가 방금 내려준 것이라 이미 최신(signed URL 등)이라
    // skipRefresh. 로그인 상태(PlaylistProvider 있음)가 아니면(게스트) 그냥 재생만 한다.
    if (playlist) playlist.playNow(trackData, { skipRefresh: true });
    else play(trackData);
  }

  function handlePause() {
    setIsPlaying(false);
    if (track?.id === postId) pause();
  }

  function togglePlayPause() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  // 더블탭 좋아요(인스타그램 참고) — 로그인 상태에서만 활성화. 첫 클릭을 300ms 미뤄뒀다가
  // 그 안에 두 번째 클릭이 없으면 원래대로 재생/일시정지, 있으면 좋아요만 실행한다.
  // 게스트는 좋아요 자체가 불가능하므로 지연 없이 바로 재생/일시정지.
  const handleDoubleTapLike = useDoubleTap(togglePlayPause, () => {
    burst();
    void likeOnly();
  });
  const overlayOnClick = viewerId ? handleDoubleTapLike : togglePlayPause;

  // iOS Safari는 한 번도 재생 안 한 <video>의 첫 프레임을 그리지 않아서, 커버(poster) 없는 영상
  // 게시물이 빈 칸으로 보였다(2026-09-23 제보, 모바일 프로필). #t=0.1 미디어 프래그먼트를 붙이면
  // 브라우저가 그 지점으로 탐색해서 프레임을 그린다 — 프래그먼트는 서버로 안 가서 R2 서명
  // URL엔 영향 없음. 실제 소리를 내는 전역 플레이어는 track.videoSrc(원본)를 쓰므로 무관.
  const previewSrc = posterSrc ? videoSrc : `${videoSrc}#t=0.1`;

  if (tone === "demo") {
    return (
      <div {...{ [PAGE_TRACK_ATTR]: postId }} className="relative">
        <video
          ref={videoRef}
          src={previewSrc}
          poster={posterSrc ?? undefined}
          className="aspect-square w-full object-cover"
          muted
          playsInline
          preload="metadata"
          onPlay={handlePlay}
          onPause={handlePause}
        />
        <button
          type="button"
          onClick={overlayOnClick}
          aria-label={isPlaying ? "일시정지" : "재생"}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/20"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            {isPlaying ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="h-7 w-7" />}
          </span>
        </button>
        {heartBurstEl}
      </div>
    );
  }

  return (
    <video
      {...{ [PAGE_TRACK_ATTR]: postId }}
      src={previewSrc}
      poster={posterSrc ?? undefined}
      className="max-h-[780px] w-auto max-w-full object-contain"
      controls
      muted
      playsInline
      preload="metadata"
      onPlay={handlePlay}
      onPause={handlePause}
    />
  );
}
