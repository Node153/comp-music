"use client";

// 데스크톱 왼쪽 컬럼 "상단 고정" 카드(0075, 페이스북 "하이라이트" 카드 참고) — 작성자가 고정한
// 게시물(최대 3개)을 정사각형 썸네일로 보여주고, 누르면 오른쪽 피드의 그 카드로 스크롤한다.
// 고정/해제 자체는 각 게시물 카드의 핀 버튼(ProfilePinButton)에서 한다.
import { HeadphonesIcon, PlayIcon, PinIcon } from "@/components/icons";
import { SHOW_PINNED_POST_EVENT, type FeedPost } from "./ProfileFeed";

export function PinnedPostsCard({ posts, isOwnProfile }: { posts: FeedPost[]; isOwnProfile: boolean }) {
  const pinned = posts
    .filter((post) => post.pinnedAt)
    .sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? ""));
  if (pinned.length === 0 && !isOwnProfile) return null;

  return (
    <section className="rounded-xl border border-box-gray p-4">
      <h2 className="text-base font-bold text-black">상단 고정</h2>
      {pinned.length === 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-active-gray">
          <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          게시물 오른쪽 위 핀 버튼으로 대표 게시물을 최대 3개까지 프로필 맨 위에 고정할 수 있어요.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {pinned.map((post) => {
            const thumb = post.posterSrc ?? (post.media_type === "image" ? post.videoSrc : null);
            const label = post.title || post.caption || "게시물";
            return (
              <button
                key={post.id}
                type="button"
                title={label}
                onClick={() => window.dispatchEvent(new CustomEvent(SHOW_PINNED_POST_EVENT, { detail: post.id }))}
                className="group relative aspect-square overflow-hidden rounded-lg bg-box-gray text-left"
              >
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-active-gray">
                    {post.media_type === "audio" ? <HeadphonesIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-medium leading-tight text-white">
                  <span className="line-clamp-2">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
