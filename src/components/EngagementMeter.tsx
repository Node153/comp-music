"use client";

// VerticalVolumeMeter를 PostEngagementContext의 조회수에 연결(2026-09-17 변경, 사용자 요청 —
// 예전엔 이번 주 좋아요 수 기준이었다). 재생이 30초를 넘겨 조회수가 오르면(NowPlayingContext)
// 이 컴포넌트가 같은 렌더에서 즉시 반응해서 미터가 움직이고, 조회수가 PEAK_VIEW_THRESHOLD를
// 넘는 순간 VerticalVolumeMeter가 자동으로 PEAK 배지를 띄운다.
import { VerticalVolumeMeter } from "@/components/VerticalVolumeMeter";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { PEAK_VIEW_THRESHOLD } from "@/lib/feedConstants";

export function EngagementMeter() {
  const { viewCount } = usePostEngagement();
  const level = viewCount / PEAK_VIEW_THRESHOLD;

  return <VerticalVolumeMeter level={level} />;
}
