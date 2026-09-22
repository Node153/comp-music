"use client";

// 프로필 하단 탭 바(페이스북 참고) — 게시물/소개/Companion 세 탭을 전환한다.
// 탭 바 시각 스타일은 원래 PostsGrid의 현재/만료 서브탭 톤(border-b-2 언더라인)을 그대로 가져왔다 —
// 게시물 탭 안에서는 그 서브탭이 한 단계 더 있는 중첩 구조.
import { useState } from "react";
import { PostsGrid } from "./PostsGrid";
import type { ProfilePost } from "./PostTile";
import type { FolderData } from "./FolderView";
import { AboutSection, type AboutProfile } from "./AboutSection";
import { CompanionPreview, type CompanionPerson } from "./CompanionPreview";

type Tab = "posts" | "about" | "companions";

const TABS: { key: Tab; label: string }[] = [
  { key: "posts", label: "게시물" },
  { key: "about", label: "소개" },
  { key: "companions", label: "Companion" },
];

export function ProfileTabs({
  posts,
  likedPosts,
  folders,
  profile,
  isOwnProfile,
  userId,
  companionCount,
  companionPreview,
}: {
  posts: ProfilePost[];
  likedPosts: ProfilePost[];
  folders: FolderData[];
  profile: AboutProfile | null;
  isOwnProfile: boolean;
  userId: string;
  companionCount: number;
  companionPreview: CompanionPerson[];
}) {
  const [tab, setTab] = useState<Tab>("posts");

  return (
    <div className="mt-6">
      <div className="flex border-b border-box-gray">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 border-b-2 px-2 py-2.5 text-sm transition ${
              tab === t.key
                ? "border-black font-semibold text-black"
                : "border-transparent font-medium text-active-gray hover:opacity-70"
            }`}
          >
            {t.label}
            {t.key === "companions" && <span className="text-active-gray"> {companionCount}</span>}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <PostsGrid posts={posts} likedPosts={likedPosts} folders={folders} isOwnProfile={isOwnProfile} userId={userId} />
      )}
      {tab === "about" && <AboutSection profile={profile} isOwnProfile={isOwnProfile} />}
      {tab === "companions" && (
        <CompanionPreview userId={userId} isOwnProfile={isOwnProfile} count={companionCount} people={companionPreview} />
      )}
    </div>
  );
}
