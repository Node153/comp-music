"use client";

// 관리자 페이지 공통 좌측 사이드바 — 세부 메뉴 링크. 데스크톱은 왼쪽 고정 세로 목록,
// 모바일은 콘텐츠 위 가로 스크롤 pill.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_LINKS } from "@/lib/adminLinks";

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* 데스크톱: 왼쪽 세로 사이드바 */}
      <aside className="hidden w-48 shrink-0 md:block">
        <nav className="sticky top-20 flex flex-col gap-0.5">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            관리자 메뉴
          </p>
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                isActive(link.href)
                  ? "bg-gray-900 font-medium text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* 모바일: 콘텐츠 위 가로 스크롤 pill */}
      <div className="-mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
              isActive(link.href)
                ? "border-gray-900 bg-gray-900 font-medium text-white"
                : "border-gray-200 text-gray-600"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </>
  );
}
