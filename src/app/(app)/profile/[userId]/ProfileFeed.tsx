"use client";

// 프로필 "자기 피드"(3단계, 페이스북 참고) — 데스크톱 오른쪽 컬럼과 모바일 게시물 탭
// (ProfileTabs, 2026-09-23부터 3열 그리드 대신 이걸 씀) 둘 다 세로로 넘기는 실제 피드
// 카드를 보여준다. 현재/보관된 필터는 그대로 유지하고, 폴더는 큐레이션 도구 성격이 강해
// 기존 FolderView(썸네일 그리드 + 담기/빼기)를 그대로 재사용한다 — 피드 카드로 안 바꿈.
// 밑줄 탭 대신 알약 필터 칩으로(2026-09 — ProfileTabs 탭 밑줄과 2단으로 겹쳐 보이지 않게).
import { useEffect, useRef, useState } from "react";
import type { ContentType } from "@/types/database";
import type { Kicker } from "@/components/PostEngagementContext";
import { FolderView, type FolderData } from "./FolderView";
import { NewFolderButton } from "./NewFolderButton";
import { ProfileFeedPostCard } from "./ProfileFeedPostCard";
import { HeartIcon, FolderIcon, KickIcon } from "@/components/icons";

export const SHOW_PINNED_POST_EVENT = "profile:show-pinned-post";

export type FeedPost = {
  id: string;
  title: string | null;
  videoSrc: string | null;
  posterSrc: string | null;
  media_type: string;
  content_type: ContentType | null;
  instrument_tags: string[] | null;
  caption: string | null;
  isExpired: boolean;
  view_count: number;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  // Kick(0071)은 DEMO(public) 게시물에만 — 카드가 KickButton을 띄울지 판단용.
  visibility: string;
  kickCount: number;
  kickedByMe: boolean;
  kickers: Kicker[];
  // 작성자 정보를 공유 prop이 아니라 게시물 하나하나에 싣는다 — "좋아요" 필터(사운드클라우드
  // Likes 탭 참고, 2026-09)는 이 프로필 주인이 아니라 다른 사람 게시물도 섞여 나오기 때문.
  authorName: string;
  authorId: string;
  // 작성자가 프로필 상단에 고정한 시각(0075) — 좋아요/Kick 필터에 섞인 남의 글도 값은
  // 실려 오지만, 고정 표시는 이 프로필 주인 글의 "현재 게시물" 목록에서만 의미가 있다.
  pinnedAt: string | null;
};

export function ProfileFeed({
  posts,
  likedPosts,
  kickedPosts,
  folders,
  isOwnProfile,
  userId,
  currentUserId,
}: {
  posts: FeedPost[];
  likedPosts: FeedPost[];
  // 이 프로필 주인이 Kick한 게시물(Kick 로그, 최신순) — 주마다 한 곡씩 쌓인다.
  kickedPosts: FeedPost[];
  folders: FolderData[];
  isOwnProfile: boolean;
  userId: string;
  currentUserId: string | null;
}) {
  const [tab, setTab] = useState<string>("current");

  // 상단 고정(0075) — 페이스북처럼 "현재 게시물" 맨 위에 모은다. 고정은 작성자의 명시적
  // 선택이라 노출시간이 끝난(보관된) 게시물이어도 맨 위에 그대로 보여준다.
  const pinnedPosts = posts
    .filter((post) => post.pinnedAt)
    .sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? ""));
  const currentPosts = posts.filter((post) => !post.isExpired);
  const currentFeed = [...pinnedPosts, ...currentPosts.filter((post) => !post.pinnedAt)];

  // 왼쪽 "상단 고정" 카드(PinnedPostsCard)의 썸네일을 누르면 SHOW_PINNED_POST_EVENT가 온다 —
  // 다른 필터를 보고 있었으면 현재 게시물로 돌아온 뒤 그 카드로 스크롤한다. 모바일/데스크톱
  // ProfileFeed가 둘 다 마운트돼 있어서(한쪽은 display:none) DOM id 대신 이 인스턴스 안에서만 찾는다.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onShow(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      setTab("current");
      requestAnimationFrame(() =>
        rootRef.current
          ?.querySelector(`[data-post-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
    window.addEventListener(SHOW_PINNED_POST_EVENT, onShow);
    return () => window.removeEventListener(SHOW_PINNED_POST_EVENT, onShow);
  }, []);
  const expiredPosts = posts.filter((post) => post.isExpired);
  const activeFolder = folders.find((f) => f.id === tab);
  const visiblePosts =
    tab === "current" ? currentFeed : tab === "expired" ? expiredPosts : tab === "kicked" ? kickedPosts : likedPosts;
  const showAuthor = tab === "liked" || tab === "kicked";

  return (
    <div ref={rootRef} className="min-w-0">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("current")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === "current"
              ? "bg-black text-white"
              : "border border-box-gray text-active-gray hover:opacity-70"
          }`}
        >
          현재 게시물 <span className={tab === "current" ? "text-white/70" : "text-active-gray"}>{currentPosts.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("expired")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === "expired"
              ? "bg-black text-white"
              : "border border-box-gray text-active-gray hover:opacity-70"
          }`}
        >
          보관된 게시물 <span className={tab === "expired" ? "text-white/70" : "text-active-gray"}>{expiredPosts.length}</span>
        </button>
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setTab("liked")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === "liked" ? "bg-black text-white" : "border border-box-gray text-active-gray hover:opacity-70"
            }`}
          >
            <HeartIcon className="h-3.5 w-3.5" filled={tab === "liked"} />
            좋아요 <span className={tab === "liked" ? "text-white/70" : "text-active-gray"}>{likedPosts.length}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab("kicked")}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            tab === "kicked" ? "bg-black text-white" : "border border-box-gray text-active-gray hover:opacity-70"
          }`}
        >
          <KickIcon className={`h-3.5 w-3.5 ${tab === "kicked" ? "text-amber-400" : ""}`} filled={tab === "kicked"} />
          Kick <span className={tab === "kicked" ? "text-white/70" : "text-active-gray"}>{kickedPosts.length}</span>
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => setTab(folder.id)}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === folder.id
                ? "bg-black text-white"
                : "border border-box-gray text-active-gray hover:opacity-70"
            }`}
          >
            <FolderIcon className="h-3.5 w-3.5" />
            {folder.name}{" "}
            <span className={tab === folder.id ? "text-white/70" : "text-active-gray"}>{folder.postIds.length}</span>
          </button>
        ))}
        {isOwnProfile && <NewFolderButton userId={userId} onCreated={(id) => setTab(id)} />}
      </div>

      {activeFolder ? (
        <FolderView
          folder={activeFolder}
          posts={posts}
          isOwnProfile={isOwnProfile}
          onDeleted={() => setTab("current")}
        />
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {visiblePosts.map((post) => (
            <ProfileFeedPostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              showAuthor={showAuthor}
              canPin={isOwnProfile && !showAuthor}
            />
          ))}
          {visiblePosts.length === 0 && (
            <p className="py-10 text-center text-sm text-active-gray">
              {tab === "current"
                ? "현재 게시물이 없습니다"
                : tab === "expired"
                  ? "보관된 게시물이 없습니다"
                  : tab === "kicked"
                    ? "Kick한 게시물이 없습니다"
                    : "좋아요한 게시물이 없습니다"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
