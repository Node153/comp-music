"use client";

// 로그인 전 미리보기(0024)의 가입 유도 — 그냥 둘러보는 동안은 막지 않다가, 좋아요/댓글처럼
// 뭔가 해보려는 순간(행동 기준) 안내를 띄운다. 아무것도 안 눌러도 35초 지나면 한 번은
// 가볍게 보여준다(시간 기준 백업, 인스타그램 참고). 닫기 버튼으로 언제든 닫을 수 있고,
// 닫아도 계속 둘러볼 수 있다 — 파일럿 초기엔 강제로 막기보다 자연스럽게 설득하는 쪽이 낫다.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { XIcon } from "@/components/icons";

const AUTO_SHOW_DELAY_MS = 35_000;

const GuestSignupPromptContext = createContext<(() => void) | null>(null);

// Provider 밖(예: 로그인된 화면)에서 실수로 써도 안전하게 아무 일도 안 하도록 no-op 폴백.
export function useGuestSignupPrompt() {
  return useContext(GuestSignupPromptContext) ?? (() => {});
}

export function GuestSignupPromptProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  function prompt() {
    shownRef.current = true;
    setOpen(true);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!shownRef.current) prompt();
    }, AUTO_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GuestSignupPromptContext.Provider value={prompt}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="-mt-4 flex flex-col items-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-lg font-bold text-white dark:bg-white dark:text-black">
                Comp
              </span>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                가입하면 더 많은 걸 할 수 있어요
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                좋아요·댓글을 남기고, memo(비공개 공간)에서 아는 사람들과 작업물을 나눠보세요.
              </p>
              <div className="mt-2 flex w-full flex-col gap-2">
                <Link
                  href="/signup"
                  className="rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                >
                  가입하기
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-900"
                >
                  로그인
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </GuestSignupPromptContext.Provider>
  );
}
