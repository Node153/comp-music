"use client";

// 좋아요 버튼(LikeButton)을 눌렀을 때 게시물 카드 중앙에 "Kick!" 문구가 크게 나타났다
// 사라지는 연출(사용자 요청, HeartBurst의 더블탭 하트 연출과 같은 패턴). 트리거는
// PostEngagementContext(kickKey)를 통해 LikeButton과 공유하고, 이 컴포넌트는 게시물
// article(관계있는 relative 컨테이너) 안 아무 곳에나 한 번만 넣어주면 inset-0으로 덮는다.
import { usePostEngagement } from "@/components/PostEngagementContext";

export function KickBurst() {
  const { kickKey, clearKick } = usePostEngagement();

  if (kickKey === null) return null;

  return (
    <span
      key={kickKey}
      onAnimationEnd={clearKick}
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      <span className="animate-heart-pop text-6xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
        Kick!
      </span>
    </span>
  );
}
