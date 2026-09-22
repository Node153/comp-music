// 게시물 그리드 타일 — PostsGrid(현재/보관된)와 FolderView(폴더)가 공유하는 순수 표시 컴포넌트.
// overlay는 폴더 편집 중 우상단에 얹는 ✕(빼기)/＋(담기) 버튼 자리.
export type ProfilePost = {
  id: string;
  videoSrc: string | null;
  // 오디오/영상 게시물의 커버 이미지(2026-09 버그 수정 — 이 필드가 없어서 커버를 올린
  // 오디오 게시물도 무조건 🎵 이모지로만 뜨고 있었다. page.tsx는 이미 이 값을 계산해서
  // 넘겨주고 있었는데 타입에서 빠져 있어 여기서 그냥 버려지고 있었음). 인스타그램 그리드처럼
  // 실제 사진/커버가 보이게 하려면 필수.
  posterSrc?: string | null;
  media_type: string;
  caption: string | null;
  isExpired: boolean;
};

export function PostTile({ post, overlay }: { post: ProfilePost; overlay?: React.ReactNode }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-box-gray">
      {post.videoSrc && post.media_type === "image" ? (
        <img src={post.videoSrc} alt="" className="h-full w-full object-cover" />
      ) : post.videoSrc && post.media_type === "audio" ? (
        post.posterSrc ? (
          <img src={post.posterSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
            <span className="text-2xl">🎵</span>
            {post.caption && <span className="line-clamp-3 text-xs text-black">{post.caption}</span>}
          </div>
        )
      ) : post.videoSrc ? (
        <video
          src={post.videoSrc}
          poster={post.posterSrc ?? undefined}
          className="h-full w-full object-cover"
          muted
          preload="metadata"
        />
      ) : null}
      {overlay && <div className="absolute right-1 top-1">{overlay}</div>}
    </div>
  );
}
