"use client";

// 알림 패널 상단의 "푸시 알림 켜기" 안내(0074) — 알림을 보러 온 순간이 권한을 요청하기 가장
// 자연스러운 때라 여기 둔다. 켤 수 있는 상태(available)거나 iPhone 사파리 탭(홈 화면 추가 필요)일
// 때만 보이고, 닫으면 이 브라우저에선 다시 안 띄운다(localStorage — 설정 화면에선 계속 켤 수 있음).
import { useState } from "react";
import { BellIcon, XIcon } from "@/components/icons";
import { usePushStatus } from "@/lib/pushClient";
import { openIosInstallGuide } from "@/components/IosInstallGuide";

const DISMISS_KEY = "comp:push-prompt-dismissed:v1";

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function PushPromptBanner({ onNavigate }: { onNavigate?: () => void }) {
  const { status, busy, enable } = usePushStatus();
  const [dismissed, setDismissed] = useState(() => (typeof window === "undefined" ? true : readDismissed()));

  if (dismissed || (status !== "available" && status !== "ios-needs-install")) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장 못 해도 이번 세션에선 닫힌 상태 유지.
    }
  }

  return (
    <div className="mx-3 mt-3 flex items-start gap-3 rounded-xl bg-gray-100 px-3 py-3 dark:bg-gray-900">
      <BellIcon className="mt-0.5 h-5 w-5 shrink-0 text-gray-900 dark:text-gray-100" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
          {status === "ios-needs-install" ? (
            <>
              <b className="text-gray-900 dark:text-gray-100">홈 화면에 추가</b>하면 좋아요·댓글이 올 때 바로 푸시로
              알려드려요.
            </>
          ) : (
            <>
              <b className="text-gray-900 dark:text-gray-100">푸시 알림</b>을 켜면 앱을 닫아둬도 좋아요·댓글이 오는
              즉시 알려드려요.
            </>
          )}
        </p>
        {status === "ios-needs-install" ? (
          // 캡처 화면으로 한 단계씩 보여주는 팝업(IosInstallGuide) — 알림 패널은 닫고 띄운다.
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              openIosInstallGuide();
            }}
            className="self-start rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-80 dark:bg-white dark:text-black"
          >
            방법 보기
          </button>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="self-start rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-80 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            푸시 알림 켜기
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="푸시 알림 안내 닫기"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-200 dark:hover:bg-gray-800"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
