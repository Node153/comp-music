"use client";

// mock 게시물(실제 영상 파일이 없는 데모 데이터) 중 재생 가능하도록 지정된 것만
// 재생 버튼을 얹어서 하단 GlobalPlayerBar로 넘겨준다. Demo 게시물만 재생 가능하게
// 하기 위해 이 오버레이는 demoVideoSrc가 있는 게시물에만 렌더링된다(feed/page.tsx에서 제어).
import { useNowPlaying } from "@/components/NowPlayingContext";
import { usePlaylistOptional } from "@/components/PlaylistContext";
import { PlayIcon, PauseIcon } from "@/components/icons";

export function MockPlayOverlay({
  postId,
  title,
  author,
  authorId,
  videoSrc,
}: {
  postId: string;
  title: string;
  author: string;
  authorId?: string;
  videoSrc: string;
}) {
  const { track, isPlaying, play, toggle, pause } = useNowPlaying();
  const playlist = usePlaylistOptional();
  const isThisTrack = track?.id === postId;
  const isThisPlaying = isThisTrack && isPlaying;

  // 로그인 상태(PlaylistProvider 있음)면 "최근 들은"에 기록, 게스트면 그냥 재생만.
  const startPlay = () =>
    playlist
      ? playlist.playNow({ id: postId, title, author, authorId, videoSrc })
      : play({ id: postId, title, author, authorId, videoSrc });

  return (
    <button
      onClick={() => (isThisPlaying ? pause() : isThisTrack ? toggle() : startPlay())}
      aria-label={isThisPlaying ? "일시정지" : "재생"}
      className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/20"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
        {isThisPlaying ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="h-7 w-7" />}
      </span>
    </button>
  );
}
