"use client";

// 프로필 탭 게시물 그리드 — 현재 게시물 / 보관된 게시물 필터(2026-09) + 사용자 정의 폴더
// (2026-09, 정태인님 제안 — 인스타그램 하이라이트/페이스북 앨범처럼 기존 게시물을 골라 담는
// 묶음). ProfileTabs(게시물/소개/Companion) 탭 밑줄과 시각적으로 겹쳐 보이지 않도록(레퍼런스
// 4곳 다 프로필에서 탭을 2단으로 안 겹침, 2026-09 검토) 밑줄 탭 대신 알약 모양 필터 칩으로.
import { useState } from "react";
import { PostTile, type ProfilePost } from "./PostTile";
import { FolderView, type FolderData } from "./FolderView";
import { NewFolderButton } from "./NewFolderButton";
import { HeartIcon, FolderIcon } from "@/components/icons";

export function PostsGrid({
  posts,
  likedPosts,
  folders,
  isOwnProfile,
  userId,
}: {
  posts: ProfilePost[];
  likedPosts: ProfilePost[];
  folders: FolderData[];
  isOwnProfile: boolean;
  userId: string;
}) {
  const [tab, setTab] = useState<string>("current");

  const currentPosts = posts.filter((post) => !post.isExpired);
  const expiredPosts = posts.filter((post) => post.isExpired);
  const activeFolder = folders.find((f) => f.id === tab);
  const visiblePosts = tab === "current" ? currentPosts : tab === "expired" ? expiredPosts : tab === "liked" ? likedPosts : [];

  return (
    <div className="mt-4">
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
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {visiblePosts.map((post) => (
            <PostTile key={post.id} post={post} />
          ))}
          {visiblePosts.length === 0 && (
            <p className="col-span-3 py-10 text-center text-sm text-active-gray">
              {tab === "current"
                ? "현재 게시물이 없습니다"
                : tab === "expired"
                  ? "보관된 게시물이 없습니다"
                  : "좋아요한 게시물이 없습니다"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
