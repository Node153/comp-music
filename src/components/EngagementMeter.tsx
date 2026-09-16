"use client";

// VerticalVolumeMeter를 PostEngagementContext의 조회수+좋아요에 연결(2026-09-17 변경, 사용자
// 요청 — 예전엔 이번 주 좋아요 수 기준이었다). 좋아요 1개는 조회수 10으로 환산(peakScore,
// RightSidebar의 PEAK 목록과 같은 공식)해서 합산 점수가 PEAK_VIEW_THRESHOLD를 넘으면
// VerticalVolumeMeter가 자동으로 PEAK 배지를 띄운다. 재생 30초 경과(조회수)나 좋아요 클릭
// 둘 다 같은 렌더에서 즉시 반영된다.
import { VerticalVolumeMeter } from "@/components/VerticalVolumeMeter";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { PEAK_VIEW_THRESHOLD, peakScore } from "@/lib/feedConstants";

export function EngagementMeter() {
  const { viewCount, likeCount } = usePostEngagement();
  const level = peakScore(viewCount, likeCount) / PEAK_VIEW_THRESHOLD;

  return <VerticalVolumeMeter level={level} />;
}
