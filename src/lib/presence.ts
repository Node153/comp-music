// 온라인/자리비움/오프라인 판정 — PresenceHeartbeat가 60초마다 갱신하는 users.last_seen_at(0025)
// 기준 근사치. RightSidebar와 메시지 화면(리스트+대화창)이 전부 이 기준을 공유해서 "온라인"의
// 의미가 화면마다 어긋나지 않게 한다.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
export const AWAY_WINDOW_MS = 15 * 60 * 1000;

export type PresenceStatus = "online" | "away" | "offline";

export function presenceStatus(lastSeenAt: string | null): PresenceStatus {
  if (!lastSeenAt) return "offline";
  const elapsed = Date.now() - new Date(lastSeenAt).getTime();
  if (elapsed <= ONLINE_WINDOW_MS) return "online";
  if (elapsed <= AWAY_WINDOW_MS) return "away";
  return "offline";
}

// 사람마다 다른 색을 주던 무지개 팔레트는 걷어냈다 — DEMO(주황)/memo(보라) 두 브랜드
// 컬러 외에는 색을 최대한 죽이자는 방향이라, 실제 프로필 사진이 생기기 전까지는 전부
// 같은 무채색 원으로 통일한다(사진 업로드 기능은 별도 작업으로 나중에).
export function avatarColorFor(_id: string) {
  return "bg-gray-500 dark:bg-gray-600";
}
