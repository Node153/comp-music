// PEAK 게시물 = 지금 핫한 게시물. (좋아요+댓글) 합이 이 값을 넘으면 미터가 PEAK를 찍는다.
// 서버(feed/page.tsx)와 클라이언트(EngagementMeter.tsx)가 같은 기준을 써야 해서 공용 상수로 뺌.
export const PEAK_THRESHOLD = 50;
