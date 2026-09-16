"use client";

// 게시물 하나(카드)당 좋아요/댓글 수를 공유하는 컨텍스트 — LikeButton/CommentPanel이 값을 바꾸면
// EngagementMeter(볼륨미터+PEAK 배지)가 같은 렌더 트리 안에서 즉시 반응하게 하기 위함.
import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

type PostEngagementContextValue = {
  likeCount: number;
  commentCount: number;
  // 이번 주(캘린더) 좋아요 수 — PEAK 판정 전용(EngagementMeter). likeCount(전체 누적, 화면 표시용)와
  // 분리해서 지난주 이전 좋아요가 새로고침 없이 계속 PEAK로 잡히는 걸 막는다.
  weeklyLikeCount: number;
  // 회원 수 비례 PEAK 기준치 — 페이지 로드 시 서버에서 계산해 내려온 값(게시물마다 동일), 정적.
  peakThreshold: number;
  // DEMO 조회수(0053) — NowPlayingContext가 30초 이상 재생됐을 때 올려서, 새로고침
  // 없이도 바로 화면에 반영되게 한다(서버 RPC도 같이 호출해 실제 값도 올림).
  viewCount: number;
  // 이 게시물을 내가 좋아요 눌렀는지 — LikeButton(버튼 토글)과 더블탭 좋아요(DoubleTapLike류)가
  // 같은 값을 공유해야 버튼으로 누르든 더블탭하든 화면이 항상 일치한다.
  liked: boolean;
  setLikeCount: Dispatch<SetStateAction<number>>;
  setCommentCount: Dispatch<SetStateAction<number>>;
  setWeeklyLikeCount: Dispatch<SetStateAction<number>>;
  setViewCount: Dispatch<SetStateAction<number>>;
  setLiked: Dispatch<SetStateAction<boolean>>;
};

const PostEngagementContext = createContext<PostEngagementContextValue | null>(null);

export function PostEngagementProvider({
  initialLikeCount,
  initialCommentCount,
  initialWeeklyLikeCount,
  initialViewCount,
  initialLiked,
  peakThreshold,
  children,
}: {
  initialLikeCount: number;
  initialCommentCount: number;
  initialWeeklyLikeCount: number;
  initialViewCount?: number;
  initialLiked?: boolean;
  peakThreshold: number;
  children: React.ReactNode;
}) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [weeklyLikeCount, setWeeklyLikeCount] = useState(initialWeeklyLikeCount);
  const [viewCount, setViewCount] = useState(initialViewCount ?? 0);
  const [liked, setLiked] = useState(initialLiked ?? false);

  return (
    <PostEngagementContext.Provider
      value={{
        likeCount,
        commentCount,
        weeklyLikeCount,
        peakThreshold,
        viewCount,
        liked,
        setLikeCount,
        setCommentCount,
        setWeeklyLikeCount,
        setViewCount,
        setLiked,
      }}
    >
      {children}
    </PostEngagementContext.Provider>
  );
}

export function usePostEngagement() {
  const ctx = useContext(PostEngagementContext);
  if (!ctx) throw new Error("usePostEngagement은 PostEngagementProvider 안에서만 사용할 수 있어요");
  return ctx;
}
