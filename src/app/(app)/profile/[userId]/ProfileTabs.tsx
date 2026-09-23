"use client";

// 프로필 하단 탭 바(페이스북 참고) — 게시물/소개/Companion 세 탭을 전환한다.
// 게시물 탭은 데스크톱과 같은 ProfileFeed(한 게시물씩 세로로 넘기는 피드 카드)를 쓴다 —
// 예전엔 3열 썸네일 그리드(콜라주)였는데 눌러도 아무 반응이 없어서, DEMO 피드처럼 게시물을
// 크게 보고 바로 재생/좋아요/댓글할 수 있게 바꿨다(2026-09-23 사용자 요청). 폴더만은
// 큐레이션 도구라 ProfileFeed 안에서 기존 썸네일 그리드(FolderView)를 그대로 쓴다.
import { useState } from "react";
import { ProfileFeed, type FeedPost } from "./ProfileFeed";
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
  currentUserId,
  companionCount,
  companionPreview,
}: {
  posts: FeedPost[];
  likedPosts: FeedPost[];
  folders: FolderData[];
  profile: AboutProfile | null;
  isOwnProfile: boolean;
  userId: string;
  currentUserId: string | null;
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
        <div className="mt-4">
          <ProfileFeed
            posts={posts}
            likedPosts={likedPosts}
            folders={folders}
            isOwnProfile={isOwnProfile}
            userId={userId}
            currentUserId={currentUserId}
          />
        </div>
      )}
      {tab === "about" && <AboutSection profile={profile} isOwnProfile={isOwnProfile} />}
      {tab === "companions" && (
        <CompanionPreview userId={userId} isOwnProfile={isOwnProfile} count={companionCount} people={companionPreview} />
      )}
    </div>
  );
}
