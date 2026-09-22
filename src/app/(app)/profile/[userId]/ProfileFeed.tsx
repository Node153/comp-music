"use client";

// 데스크톱 프로필 오른쪽 컬럼(3단계, 페이스북 참고) — "자기 피드"라는 표현대로, 왼쪽 3열
// 썸네일 그리드(PostsGrid, 모바일 전용) 대신 세로로 넘기는 실제 피드 카드를 보여준다.
// 현재/보관된 필터는 그대로 유지하고, 폴더는 큐레이션 도구 성격이 강해 기존
// FolderView(썸네일 그리드 + 담기/빼기)를 그대로 재사용한다 — 피드 카드로 안 바꿈.
// 밑줄 탭 대신 알약 필터 칩으로(2026-09, PostsGrid.tsx와 동일한 이유 — ProfileTabs 탭
// 밑줄과 2단으로 겹쳐 보이지 않게).
import { useState } from "react";
import type { ContentType } from "@/types/database";
import { FolderView, type FolderData } from "./FolderView";
import { NewFolderButton } from "./NewFolderButton";
import { ProfileFeedPostCard } from "./ProfileFeedPostCard";
import { HeartIcon, FolderIcon } from "@/components/icons";

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
  // 작성자 정보를 공유 prop이 아니라 게시물 하나하나에 싣는다 — "좋아요" 필터(사운드클라우드
  // Likes 탭 참고, 2026-09)는 이 프로필 주인이 아니라 다른 사람 게시물도 섞여 나오기 때문.
  authorName: string;
  authorId: string;
};

export function ProfileFeed({
  posts,
  likedPosts,
  folders,
  isOwnProfile,
  userId,
  currentUserId,
}: {
  posts: FeedPost[];
  likedPosts: FeedPost[];
  folders: FolderData[];
  isOwnProfile: boolean;
  userId: string;
  currentUserId: string | null;
}) {
  const [tab, setTab] = useState<string>("current");

  const currentPosts = posts.filter((post) => !post.isExpired);
  const expiredPosts = posts.filter((post) => post.isExpired);
  const activeFolder = folders.find((f) => f.id === tab);
  const visiblePosts = tab === "current" ? currentPosts : tab === "expired" ? expiredPosts : likedPosts;

  return (
    <div className="min-w-0">
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
            <ProfileFeedPostCard key={post.id} post={post} currentUserId={currentUserId} showAuthor={tab === "liked"} />
          ))}
          {visiblePosts.length === 0 && (
            <p className="py-10 text-center text-sm text-active-gray">
              {tab === "current" ? "현재 게시물이 없습니다" : tab === "expired" ? "보관된 게시물이 없습니다" : "좋아요한 게시물이 없습니다"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
