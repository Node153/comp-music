import Link from "next/link";

// 관리자 페이지(/admin/*)는 (app) 라우트 그룹 밖이라 TopNav/BottomNav가 없어서, 지금까지
// 들어오면 앱으로 돌아갈 방법이 URL 직접 입력밖에 없었다. 모든 관리자 페이지 상단에
// 공통 "뒤로가기"를 붙인다 — 진입점인 /help(관리자 메뉴 섹션)로 보낸다.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-4xl px-6 pt-6">
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <span aria-hidden>←</span> 관리자 메뉴
        </Link>
      </div>
      {children}
    </>
  );
}
