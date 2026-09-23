"use client";

// 게스트(비로그인) 모바일 전용 하단 고정 바(2026-09-23, 사용자 요청) — 로그인 유저의
// BottomNav와 자리·무게감을 맞춰서, 게스트가 스크롤만 계속할 때 화면 상하가 전부 뎅그러니
// 콘텐츠만 있는 허전한 느낌을 줄인다. 메뉴 기능은 없고(게스트는 갈 곳이 로그인/가입뿐이라
// 진짜 탭을 흉내내는 건 오히려 낚시처럼 느껴질 수 있음) 항상 같은 가입 유도 문구+버튼만
// 보여준다 — feed/page.tsx 안에 있는 인라인 배너(스크롤하면 같이 넘어감)와 달리 이건
// 계속 떠 있는다.
import Link from "next/link";

export function GuestBottomBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-[#1c1c1e] md:hidden">
      <p className="text-xs text-gray-600 dark:text-gray-400">가입하면 좋아요·Kick·댓글 남기고 memo도 볼 수 있어요</p>
      <Link
        href="/signup"
        className="shrink-0 rounded-full bg-black px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        가입하기
      </Link>
    </div>
  );
}
