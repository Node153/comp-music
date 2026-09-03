"use client";

// TopNav 우측 프로필 드롭다운(페이스북 참고) — 아바타 클릭 시 프로필 보기/프로필 수정/
// (관리자면) 관리자 메뉴/로그아웃 노출. 관리자 메뉴는 눌러서 펼치면 세부 페이지 링크가 나온다.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { ADMIN_LINKS } from "@/lib/adminLinks";

export function ProfileMenu({
  userId,
  userName,
  isAdmin = false,
}: {
  userId: string;
  userName: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  function close() {
    setOpen(false);
    setAdminOpen(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} title="Me" aria-label="Me" className="block">
        <Avatar userId={userId} name={userName} className="h-9 w-9 text-sm" />
      </button>

      {open && (
        <>
          <button
            aria-label="메뉴 닫기"
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950">
            <Link
              href={`/profile/${userId}`}
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              <Avatar userId={userId} name={userName} className="h-8 w-8 text-xs" />
              <span>
                <span className="block font-medium text-gray-900 dark:text-gray-100">{userName}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">프로필 보기</span>
              </span>
            </Link>
            <Link
              href="/profile/edit"
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm dark:bg-gray-800">
                ⚙️
              </span>
              프로필 수정
            </Link>

            {isAdmin && (
              <>
                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                <button
                  onClick={() => setAdminOpen((v) => !v)}
                  aria-expanded={adminOpen}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm dark:bg-gray-800">
                    🛠️
                  </span>
                  <span className="flex-1">관리자 메뉴</span>
                  <span className={`text-xs text-gray-400 transition-transform ${adminOpen ? "rotate-90" : ""}`}>
                    ▶
                  </span>
                </button>
                {adminOpen && (
                  <div className="mb-1 ml-4 flex flex-col border-l border-gray-100 pl-2 dark:border-gray-800">
                    {ADMIN_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={close}
                        className="rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm dark:bg-gray-800">
                🚪
              </span>
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  );
}
