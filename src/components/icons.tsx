// TopNav 아이콘 전용 — 이모지 대신 순수 선(stroke) 아이콘을 써서 색이 안 섞이게 한다.
// currentColor라 부모 text-color(그레이/hover/다크모드)를 그대로 물려받는다.
type IconProps = { className?: string };

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// 피드백(/help) 메뉴 — 예전 ?(도움말) 아이콘은 "의견 남기는 곳"으로 안 읽혀서 교체(2026-09-23).
// 메시지(ChatIcon, 둥근 말풍선)와 헷갈리지 않게 네모 말풍선 + 느낌표.
export function FeedbackIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="12" y1="7" x2="12" y2="11" />
      <line x1="12" y1="14" x2="12.01" y2="14" />
    </svg>
  );
}

// DEMO/memo 탭 아이콘 — 예전엔 ☀/☾ 문자를 썼는데, iOS Safari는 ☀(U+2600)를 컬러 이모지로
// 강제 렌더링해서 데스크톱(단색 글자, 탭 색을 그대로 물려받음)과 모양·색이 달라졌다
// (2026-09-23 제보). 데스크톱 글자 모양(속이 찬 해+광선 / 속이 찬 초승달)을 그대로 SVG로
// 옮겨서 어느 브라우저에서든 똑같이, currentColor로 탭 색을 따라가게 했다.
export function SunIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// 업로드 칸의 굵은 위쪽 화살표 — ⬆(U+2B06)도 ☀와 같은 이유로 iOS에서 파란 이모지 버튼으로
// 바뀌어 보여서, 데스크톱 글자 모양(속이 찬 화살표)을 SVG로 옮겼다.
export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// 이하 12종 — 이모지로 되어 있던 UI 아이콘을 선 아이콘으로 교체(색은 아직 안 입힘,
// 나중에 시그니처 컬러 정하면 currentColor 상속 구조라 부모 text-color만 바꾸면 됨).
// mock 게시물 악기 그림(🎸🥁🎹 등)은 이번 대상에서 제외.

export function HeartIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} className={className} aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

// Kick(0071) — 킥드럼 정면(울림판 + 가운데 로고 원 + 받침 다리 두 개). 다리가 없으면 작은
// 크기에서 바이닐/과녁처럼 읽혀서 꼭 둔다. filled면 울림판을 채우고 로고 원은 흰 선으로 남긴다.
export function KickIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="10.5" r="8" fill={filled ? "currentColor" : "none"} />
      <circle cx="12" cy="10.5" r="3" stroke={filled ? "white" : "currentColor"} />
      <line x1="6.4" y1="16.2" x2="4.2" y2="21" />
      <line x1="17.6" y1="16.2" x2="19.8" y2="21" />
    </svg>
  );
}

export function CommentIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.5 0 2.5-1 2.5-2.5 0-1-.5-2-1.5-3 1.5.3 3 1.7 3 3.5 0 2.2-1.8 4-4 4s-4-1.8-4-4c0-1.5.8-2.7 1.5-3.5z" />
      <path d="M12 3s-1 2.5-1 4.5c0 1 .5 1.5 1 2 .5-.8 1.5-2.5 1.5-4C13.5 4 12 3 12 3z" />
      <path d="M17 13c0 3.9-2.6 7-6.5 7-4 0-6.5-2.8-6.5-6.5 0-3 1.8-5 3-6.5-.3 1.5 0 2.7.8 3.5.4-2 1.7-4.5 4-6 -.5 2 0 3.5 1.2 4.8 1.2 1.2 4 2.2 4 3.7z" />
    </svg>
  );
}

export function HeadphonesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function EditIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function DiceIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" className={className} aria-hidden="true">
      <path d="M7 4v16l14-8z" stroke="none" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" stroke="none" />
      <rect x="14" y="4" width="4" height="16" stroke="none" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function ExpandIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function DotsIcon({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" className={className} aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" stroke="none" />
      <circle cx="12" cy="12" r="1.5" stroke="none" />
      <circle cx="12" cy="19" r="1.5" stroke="none" />
    </svg>
  );
}

export function BackArrowIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function SkipBackIcon({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" className={className} aria-hidden="true">
      <path d="M18 5v14l-11-7z" stroke="none" />
      <rect x="4" y="5" width="2.5" height="14" stroke="none" />
    </svg>
  );
}

export function SkipForwardIcon({ className }: IconProps) {
  return (
    <svg {...base} fill="currentColor" className={className} aria-hidden="true">
      <path d="M6 5v14l11-7z" stroke="none" />
      <rect x="17.5" y="5" width="2.5" height="14" stroke="none" />
    </svg>
  );
}

export function PinIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} className={className} aria-hidden="true">
      <path d="M12 17v5" strokeLinecap="round" />
      <path d="M9 3h6l-1 6 3.5 3.5a1 1 0 0 1-.7 1.7H6.2a1 1 0 0 1-.7-1.7L9 9z" />
    </svg>
  );
}

export function VolumeIcon({ className, muted = false }: IconProps & { muted?: boolean }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <polygon points="4 9 8 9 12 5 12 19 8 15 4 15 4 9" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <line x1="16.5" y1="9.5" x2="21" y2="14.5" />
          <line x1="21" y1="9.5" x2="16.5" y2="14.5" />
        </>
      ) : (
        <>
          <path d="M16 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 6a9 9 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

// 프로필 소개 요약(2026-09) — 활동유형/학교/지역에 쓰던 애플 이모지(🎓🎤🏫📍)를 다른 아이콘과
// 같은 선(stroke) 톤으로 교체.
export function GraduationCapIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </svg>
  );
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
      <path d="M9 22h6" />
    </svg>
  );
}

export function SchoolIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

// 프로필 게시물 탭의 폴더 칩 아이콘(2026-09) — 현재/보관된/좋아요 같은 상태 필터와 달리
// "사용자가 직접 모은 묶음"이라는 걸 아이콘으로 구분해준다(사용자 피드백 — 텍스트만
// 나열되어 있어 구분이 안 된다).
export function FolderIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

// ── 피드백 화면 아이콘(2026-09-24) — 이모지(📣🐞💡👍🔒 등)는 OS/브라우저마다 컬러·모양이 달라서
// 전부 선 아이콘으로 교체. currentColor라 흑백 톤을 그대로 따른다.
export function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function BugIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="8" y="6" width="8" height="14" rx="4" />
      <path d="M9 7.5 7 5M15 7.5 17 5M12 10v10M4 13h4M16 13h4M5 19l3-2M19 19l-3-2M5 8l3 2M19 8l-3 2" />
    </svg>
  );
}

export function FrownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

export function LightbulbIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
    </svg>
  );
}

export function InboxIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function PauseCircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="14" y1="15" x2="14" y2="9" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function CornerDownRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function ThumbsUpIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 10v12" />
      <path
        fill={filled ? "currentColor" : "none"}
        d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"
      />
    </svg>
  );
}

// 업데이트 소식(0067) — "업데이트" 공지 카드, "직접 써보기" 바로가기.
export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// 피드백 페이지 "지금 만드는 중"(0068).
export function HammerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" />
      <path d="M17.64 15 22 10.64" />
      <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" />
    </svg>
  );
}

// 기여 랭킹 1위(0069).
export function CrownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-2 11H5z" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

// 프로필 커버 사진 추가 버튼(0075, 페이스북 "커버 사진 추가" 참고).
export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

// 프로필 "링크" 카드(0075) — 인스타그램 링크 표시용.
export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// 댓글 패널 원탭 반응 칩(0076)의 이모지(🎹🔁🤝)도 브라우저마다 모양이 달라서 선 아이콘으로 교체.
export function PianoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <line x1="7" y1="5" x2="7" y2="13" />
      <line x1="11" y1="5" x2="11" y2="13" />
      <line x1="15" y1="5" x2="15" y2="13" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </svg>
  );
}

export function RepeatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function HandshakeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" />
      <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
      <path d="M3 4h8" />
    </svg>
  );
}

// PWA 설치 안내(IosInstallGuide)의 이모지(📱🔑)도 선 아이콘으로 교체. 🔔은 기존 BellIcon 재사용.
export function SmartphoneIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
