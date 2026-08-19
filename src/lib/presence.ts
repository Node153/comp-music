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

// 실제 프로필 색상 개념이 따로 없어서 id를 해시해 고정 팔레트에서 하나 골라 쓴다 — 같은
// 사람은 새로고침해도 항상 같은 색.
const AVATAR_COLORS = [
  "bg-amber-700",
  "bg-sky-700",
  "bg-fuchsia-900",
  "bg-orange-400",
  "bg-emerald-700",
  "bg-indigo-700",
  "bg-rose-700",
  "bg-teal-700",
];

export function avatarColorFor(id: string) {
  const hash = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
