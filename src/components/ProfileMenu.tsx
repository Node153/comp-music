"use client";

// TopNav 우측 프로필 드롭다운(페이스북 참고) — 아바타 클릭 시 프로필 보기/로그아웃 메뉴 노출
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProfileMenu({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600 transition hover:brightness-95"
      >
        {userName.slice(0, 1) || "👤"}
      </button>

      {open && (
        <>
          <button
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            <Link
              href={`/profile/${userId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-gray-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                {userName.slice(0, 1)}
              </span>
              <span>
                <span className="block font-medium text-gray-900">{userName}</span>
                <span className="block text-xs text-gray-500">프로필 보기</span>
              </span>
            </Link>
            <div className="my-1 border-t border-gray-100" />
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm">
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
