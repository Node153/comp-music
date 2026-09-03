import { AdminSidebar } from "@/components/AdminSidebar";

// 관리자 페이지(/admin/*) 공통 레이아웃. (app) 라우트 그룹 안이라 상단바(TopNav)·하단
// 탭바는 상위 레이아웃이 붙여주고, 여기서는 세부 메뉴 좌측 사이드바만 얹는다.
// 접근 제어는 proxy.ts(/admin/* 는 role=admin만)가 담당한다.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 md:flex-row md:gap-6 md:px-6">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
