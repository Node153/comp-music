// 관리자 전용 페이지 목록 — /help의 관리자 섹션과 TopNav 프로필 드롭다운이 함께 쓴다.
// 실제 접근 제어는 proxy.ts(/admin/* 는 role=admin만)가 담당하고, 이 목록은 링크 노출용.
export const ADMIN_LINKS: { href: string; label: string }[] = [
  { href: "/admin/members", label: "회원 관리" },
  { href: "/admin/verifications", label: "심사 대기열" },
  { href: "/admin/announcements", label: "공지사항 관리" },
  { href: "/admin/feedback", label: "피드백 보기" },
  { href: "/admin/login-screen", label: "로그인 화면 설정" },
  { href: "/admin/feed-hero", label: "피드 힐링 멘트 관리" },
  { href: "/admin/submit-phrases", label: "게시하기 문구 관리" },
];
