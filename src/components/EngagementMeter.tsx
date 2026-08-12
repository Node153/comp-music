"use client";

// VerticalVolumeMeter를 PostEngagementContext의 이번 주 좋아요 수에 연결(댓글은 미포함 — PEAK는
// 좋아요 기준). 좋아요를 누르면 이 컴포넌트가 같은 렌더에서 즉시 반응해서 미터가 움직이고, 이번 주
// 좋아요 수가 peakThreshold(회원 수 비례)를 넘는 순간 VerticalVolumeMeter가 자동으로 PEAK 배지를 띄운다.
import { VerticalVolumeMeter } from "@/components/VerticalVolumeMeter";
import { usePostEngagement } from "@/components/PostEngagementContext";

export function EngagementMeter() {
  const { weeklyLikeCount, peakThreshold } = usePostEngagement();
  const level = weeklyLikeCount / peakThreshold;

  return <VerticalVolumeMeter level={level} />;
}
