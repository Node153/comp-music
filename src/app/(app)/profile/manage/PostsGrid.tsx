"use client";

// 게시물 관리 그리드 — 현재 게시물 / 만료된 게시물 세부탭으로 분리(2026-09).
import { useState } from "react";
import { DeletePostButton } from "./DeletePostButton";

type ManagedPost = {
  id: string;
  videoSrc: string | null;
  posterSrc?: string | null;
  media_type: string;
  caption: string | null;
  mediaPath: string;
  isExpired: boolean;
};

export function PostsGrid({ posts }: { posts: ManagedPost[] }) {
  const [tab, setTab] = useState<"current" | "expired">("current");

  const currentPosts = posts.filter((post) => !post.isExpired);
  const expiredPosts = posts.filter((post) => post.isExpired);
  const visiblePosts = tab === "current" ? currentPosts : expiredPosts;

  return (
    <div className="mt-6">
      <div className="flex border-b border-box-gray">
        <button
          type="button"
          onClick={() => setTab("current")}
          className={`flex-1 border-b-2 px-2 py-2.5 text-sm transition ${
            tab === "current"
              ? "border-black font-semibold text-black"
              : "border-transparent font-medium text-active-gray hover:opacity-70"
          }`}
        >
          현재 게시물 <span className="text-active-gray">{currentPosts.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("expired")}
          className={`flex-1 border-b-2 px-2 py-2.5 text-sm transition ${
            tab === "expired"
              ? "border-black font-semibold text-black"
              : "border-transparent font-medium text-active-gray hover:opacity-70"
          }`}
        >
          보관된 게시물 <span className="text-active-gray">{expiredPosts.length}</span>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {visiblePosts.map((post) => (
          <div key={post.id} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-box-gray">
            {post.videoSrc && post.media_type === "image" ? (
              <img src={post.videoSrc} alt="" className="h-full w-full object-cover" />
            ) : post.videoSrc && post.media_type === "audio" ? (
              post.posterSrc ? (
                <img src={post.posterSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-demo-bg p-3 text-center">
                  <span className="text-2xl">🎵</span>
                  {post.caption && (
                    <span className="line-clamp-3 text-xs text-black">{post.caption}</span>
                  )}
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
            <DeletePostButton postId={post.id} mediaPath={post.mediaPath} />
          </div>
        ))}
        {visiblePosts.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-active-gray">
            {tab === "current" ? "현재 게시물이 없습니다" : "보관된 게시물이 없습니다"}
          </p>
        )}
      </div>
    </div>
  );
}
