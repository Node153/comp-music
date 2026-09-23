"use client";

// NavSidebar 프로필 드롭다운(페이스북 참고) — 아바타 클릭 시 프로필 보기/프로필 수정/
// (관리자면) 관리자 메뉴/로그아웃 노출. 관리자 메뉴는 눌러서 펼치면 세부 페이지 링크가 나온다.
// 버튼은 아바타+이름 한 줄. Help 탭 바로 아래로 위치가 올라오면서(2026-09-16, 사용자 요청)
// 더 이상 화면 맨 아래에 붙어있지 않아 드롭다운도 아래로 펼친다(전엔 bottom-full이었음).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { ADMIN_LINKS } from "@/lib/adminLinks";
import { navRowClass, navLabelClass } from "@/components/ui/styles";

export function ProfileMenu({
  userId,
  userName,
  isAdmin = false,
  isFeed,
  expanded,
  onOpenChange,
}: {
  userId: string;
  userName: string;
  isAdmin?: boolean;
  isFeed: boolean;
  expanded: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  function close() {
    setOpen(false);
    setAdminOpen(false);
    onOpenChange?.(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          onOpenChange?.(next);
        }}
        title="Me"
        aria-label="Me"
        className={navRowClass(open, isFeed, expanded)}
      >
        <Avatar userId={userId} name={userName} className="h-7 w-7 shrink-0 text-xs" />
        <span className={`truncate ${navLabelClass(expanded)}`}>{userName}</span>
      </button>

      {open && (
        <>
          <button
            aria-label="메뉴 닫기"
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          {/* 2026-09-24 수정(사용자 제보 — "좌측 메뉴바 잘리는것") — absolute top-full(버튼
              바로 아래로 펼침)이었는데, 아바타 버튼이 사이드바 아래쪽에 있다 보니 관리자
              메뉴(ADMIN_LINKS 9개)까지 펼치면 목록 길이가 버튼~화면 아래 사이 남은 공간보다
              길어질 때가 있었고, 그러면 내용이 그냥 화면 밖으로 잘려서 스크롤할 방법도 없이
              가려졌다. 버튼 위치 기준(top-full)이 아니라 화면 기준 fixed로 바꿔 플레이어바
              위쪽에 항상 고정된 여백을 두고, max-h+overflow-y-auto로 넘치는 내용은 그 안에서
              스크롤되게 했다 — 화면 크기/버튼 위치와 무관하게 항상 전체 메뉴에 닿을 수 있다. */}
          <div className="fixed bottom-20 left-3 z-50 max-h-[calc(100vh-8rem)] w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950">
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
