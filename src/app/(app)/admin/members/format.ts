import { ONLINE_WINDOW_MS } from "@/lib/presence";

// 회원 관리 표·상세 패널 공용 표시 헬퍼(클라이언트/서버 양쪽에서 씀).

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 표에 넣을 짧은 날짜 — 올해면 "9.23", 아니면 "25.9.23".
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const sameYear =
    new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit" }) ===
    d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit" });
  return sameYear ? `${get("month")}.${get("day")}` : `${get("year")}.${get("month")}.${get("day")}`;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  return formatShortDate(iso);
}

export const STATUS_PILL: Record<string, { label: string; className: string; dot: string }> = {
  pending: { label: "대기", className: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  approved: { label: "승인", className: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  rejected: { label: "반려", className: "bg-red-50 text-red-600", dot: "bg-red-500" },
  suspended: { label: "정지", className: "bg-red-600 text-white", dot: "bg-white" },
  withdrawn: { label: "탈퇴", className: "bg-gray-100 text-gray-400", dot: "bg-gray-300" },
};

// presence.ts와 같은 "접속 중" 기준(2분 이내 활동).
export function isOnline(lastSeenAt: string | null): boolean {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}
