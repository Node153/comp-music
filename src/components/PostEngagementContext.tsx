"use client";

// 게시물 하나(카드)당 좋아요/댓글 수를 공유하는 컨텍스트 — LikeButton/CommentPanel이 값을 바꾸면
// EngagementMeter(볼륨미터+PEAK 배지)가 같은 렌더 트리 안에서 즉시 반응하게 하기 위함.
import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

type PostEngagementContextValue = {
  likeCount: number;
  commentCount: number;
  setLikeCount: Dispatch<SetStateAction<number>>;
  setCommentCount: Dispatch<SetStateAction<number>>;
};

const PostEngagementContext = createContext<PostEngagementContextValue | null>(null);

export function PostEngagementProvider({
  initialLikeCount,
  initialCommentCount,
  children,
}: {
  initialLikeCount: number;
  initialCommentCount: number;
  children: React.ReactNode;
}) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);

  return (
    <PostEngagementContext.Provider value={{ likeCount, commentCount, setLikeCount, setCommentCount }}>
      {children}
    </PostEngagementContext.Provider>
  );
}

export function usePostEngagement() {
  const ctx = useContext(PostEngagementContext);
  if (!ctx) throw new Error("usePostEngagement은 PostEngagementProvider 안에서만 사용할 수 있어요");
  return ctx;
}
