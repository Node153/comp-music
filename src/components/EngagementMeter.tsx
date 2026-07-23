"use client";

// VerticalVolumeMeter를 PostEngagementContext의 실시간 좋아요/댓글 수에 연결.
// 좋아요를 누르거나 댓글을 달면 이 컴포넌트가 같은 렌더에서 즉시 반응해서 미터가 움직이고,
// 합계가 PEAK_THRESHOLD를 넘는 순간 VerticalVolumeMeter 내부 로직이 자동으로 PEAK 배지를 띄운다.
import { VerticalVolumeMeter } from "@/components/VerticalVolumeMeter";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { PEAK_THRESHOLD } from "@/lib/feedConstants";

export function EngagementMeter() {
  const { likeCount, commentCount } = usePostEngagement();
  const level = (likeCount + commentCount) / PEAK_THRESHOLD;

  return <VerticalVolumeMeter level={level} />;
}
