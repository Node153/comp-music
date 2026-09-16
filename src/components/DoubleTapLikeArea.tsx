"use client";

// 이미지 게시물처럼 자체 클릭 동작이 없는 미디어를 감싸서 더블탭(=더블클릭, PC도 동일)
// 하면 좋아요가 눌리게 한다(인스타그램 참고, "모르는 사람 게시물에도 좋아요를 쉽게"
// 요청). 영상(PostVideo)·음원(SoundbarPlayer)은 이미 단일 클릭이 재생/일시정지를 맡고
// 있어서 각자 내부에서 useDoubleTap을 직접 써 단일탭과 충돌하지 않게 처리한다 — 여긴
// 그럴 필요가 없는 순수 이미지 전용.
import { useDoubleTap } from "@/lib/useDoubleTap";
import { usePostLike } from "@/lib/usePostLike";
import { useHeartBurst } from "@/components/HeartBurst";

export function DoubleTapLikeArea({
  postId,
  userId,
  className = "",
  children,
}: {
  postId: string;
  userId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { likeOnly } = usePostLike(postId, userId);
  const { burst, element } = useHeartBurst();

  const handleTap = useDoubleTap(undefined, () => {
    burst();
    void likeOnly();
  });

  return (
    <div className={`relative w-full ${className}`} onClick={handleTap}>
      {children}
      {element}
    </div>
  );
}
