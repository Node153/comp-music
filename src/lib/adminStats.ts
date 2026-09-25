// /admin/stats가 받는 admin_stats()(0080) 결과 모양 + 화면 표시용 라벨/포맷 도우미.

type KN = { k: string; n: number };

export type AdminStats = {
  range: { days: number; since: string; include_admins: boolean; collect_started_at: string | null };
  overview: {
    visitors: number;
    member_visitors: number;
    logged_in_anons: number;
    sessions: number;
    median_session_active_s: number;
    total_active_s: number;
    total_listen_s: number;
    member_active_s: number;
    member_days: number;
  };
  actives: { dau: number; wau: number; mau: number };
  members: { approved: number; pending: number; signups_in_range: number };
  daily: { d: string; members: number; visitors: number; active_s: number; uploads: number; reactions: number }[];
  heatmap: { dow: number; h: number; visitors: number; active_s: number }[];
  devices: { type: KN[]; os: KN[]; browser: KN[]; pwa_visitors: number };
  sources: { k: string; sessions: number; visitors: number }[];
  link_opens: KN[];
  listening: {
    impressions: number;
    impression_pairs: number;
    impression_to_play: number;
    play_starts: number;
    play_pairs: number;
    play_ends: number;
    listened_30s: number;
    completed: number;
    median_listened_s: number;
    median_pct: number;
    member_play_pairs: number;
    member_play_reacted: number;
    shares: number;
    share_methods: Record<string, number>;
  };
  creators: {
    posts: number;
    uploaders: number;
    repeat_uploaders: number;
    active_members: number;
    no_reaction_posts: number;
    no_reaction_older_24h: number;
    older_24h: number;
    reacted_within_24h: number;
    median_hours_to_first: number;
    avg_reactions: number;
    avg_listeners: number;
    reaction_mix: Record<string, number>;
  };
  retention: { week: string; size: number; w: (number | null)[] }[];
  network: { members: number; b0: number; b1_2: number; b3_5: number; b6: number; median: number };
  top_posts: {
    id: string;
    title: string;
    author: string;
    visibility: string;
    impressions: number;
    plays: number;
    completed: number;
    avg_listened_s: number | null;
  }[];
  uploads: { submits: number; errors: number; posts: number; top_errors: KN[] };
  installs: {
    shown: Record<string, number>;
    results: { platform: string; result: string; n: number }[];
    installed: number;
  };
};

const SOURCE_LABELS: Record<string, string> = {
  direct: "직접 방문·북마크",
  push: "푸시 알림",
  push_open: "푸시 알림 · 보러 가기 버튼",
  push_upload: "푸시 알림 · 새 Drop 버튼",
  email_reaction: "반응 알림 메일",
  email_reaction_upload: "반응 알림 메일 · 새 Drop",
  email_kick: "Kick 알림 메일",
  email_digest: "알림 모아보기 메일",
  email_weekly: "주간 리포트 메일",
  email_weekly_upload: "주간 리포트 메일 · 새 Drop",
  email_approval: "가입 승인 메일",
  share_story: "공유 · 인스타 스토리",
  share_copy: "공유 · 링크 복사",
  share_native: "공유 · 다른 앱",
  album_promo_sidebar: "명반 추천 배너 · 사이드바",
  album_promo_feed: "명반 추천 배너 · 피드(모바일)",
};

export function sourceLabel(key: string): string {
  if (key.startsWith("ref:")) return `외부 링크 · ${key.slice(4)}`;
  return SOURCE_LABELS[key] ?? key;
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "모바일",
  tablet: "태블릿",
  desktop: "PC",
  unknown: "알 수 없음",
};

export function deviceLabel(key: string): string {
  return DEVICE_LABELS[key] ?? key;
}

const INSTALL_RESULT_LABELS: Record<string, string> = {
  close: "닫기(며칠 뒤 다시)",
  finish: "안내 끝까지 봄",
  never: "다시 보지 않기",
  installed: "설치 완료",
  native_accepted: "설치 창에서 설치",
  native_dismissed: "설치 창에서 취소",
};

export function installResultLabel(key: string): string {
  return INSTALL_RESULT_LABELS[key] ?? key;
}

export const SHARE_METHOD_LABELS: Record<string, string> = {
  story: "인스타 스토리",
  story_download: "스토리 파일 저장",
  copy: "링크 복사",
  native: "다른 앱",
};

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}분 ${s % 60}초` : `${m}분`;
  const h = s / 3600;
  return `${h < 10 ? h.toFixed(1) : Math.round(h)}시간`;
}

export function pct(part: number, whole: number): string {
  if (!whole) return "–";
  const v = (part / whole) * 100;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;
}
