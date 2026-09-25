"use client";

// 오른쪽 사이드바 "앱 설치" 광고 카드(2026-09-25, 사용자 요청 — 웹앱 설치 유도가 중요해서 팝업과 별개로
// 사이드바에 광고처럼 상시 노출). 오른쪽 사이드바는 태블릿·데스크톱(md 이상)에서만 보이므로:
//   - 데스크톱: 폰 카메라로 찍는 QR(public/install-qr.svg → /feed?installGuide=1&src=install_qr, 폰에서
//     열면 기기에 맞는 설치 안내 팝업이 바로 뜸) + 크롬·엣지가 설치를 지원하면 "이 컴퓨터에도 설치"
//   - iPad·Android 태블릿: 그 기기용 설치 안내 팝업(IosInstallGuide/AndroidInstallGuide)을 여는 버튼
// 이미 설치한 앱으로 열었으면(standalone) 안 보이고, 닫으면 7일 동안 숨긴다. 기기 판정은 브라우저에서만
// 가능해서 서버 렌더에선 아무것도 안 그린다(하이드레이션 불일치 방지).
import { useEffect, useState, useSyncExternalStore } from "react";
import { BellIcon, XIcon } from "@/components/icons";
import { isIOS, isStandalone } from "@/lib/pushClient";
import { isAndroid, openAndroidInstallGuide, promptNativeInstall, useNativeInstallPrompt } from "@/components/AndroidInstallGuide";
import { openIosInstallGuide } from "@/components/IosInstallGuide";
import { track } from "@/lib/analytics";

const HIDE_KEY = "comp:install-ad-hidden-until:v1";
const HIDE_DAYS = 7;

type Mode = "hidden" | "desktop" | "ios" | "android";

function readMode(): Mode {
  if (isStandalone()) return "hidden";
  try {
    if (Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now()) return "hidden";
  } catch {
    // 저장소를 못 읽으면 그냥 보여준다.
  }
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  return "desktop";
}

const noopSubscribe = () => () => {};

export function InstallAdCard() {
  const initialMode = useSyncExternalStore(noopSubscribe, readMode, () => "hidden" as Mode);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const nativePrompt = useNativeInstallPrompt();
  const mode = dismissed ? "hidden" : initialMode;

  // 이용 통계(0079) — 설치 팝업과 같은 이벤트에 platform=sidebar_ad로 구분해 센다.
  useEffect(() => {
    if (initialMode !== "hidden") track("install_prompt_shown", { props: { platform: "sidebar_ad", device: initialMode } });
  }, [initialMode]);

  if (mode === "hidden") return null;

  function dismiss() {
    track("install_prompt_result", { props: { platform: "sidebar_ad", result: "close" } });
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      // 이번 화면에서만 닫힘.
    }
    setDismissed(true);
  }

  async function installHere() {
    const outcome = await promptNativeInstall();
    track("install_prompt_result", { props: { platform: "sidebar_ad", result: `native_${outcome}` } });
    if (outcome === "accepted") setInstalled(true);
  }

  function openGuide() {
    track("install_prompt_result", { props: { platform: "sidebar_ad", result: "open_guide" } });
    if (mode === "ios") openIosInstallGuide();
    else openAndroidInstallGuide();
  }

  return (
    <section
      aria-label="Compmusic 앱 설치"
      // 라이트 톤(2026-09-25 사용자 요청) — 따뜻한 크림색 바탕 + 골드 포인트. memo 탭(다크 테마)에서도
      // 같은 밝은 카드로 둬서 광고처럼 눈에 띄게 한다.
      className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 text-gray-900 shadow-sm"
    >
      {/* 광고 느낌의 은은한 빛 번짐 */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/40 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800">
          Compmusic 앱
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="설치 안내 닫기"
          className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-black/5 hover:text-gray-700"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 잠금화면 알림 목업 — 설치하면 이렇게 받는다는 걸 한눈에 */}
      <div className="relative mt-3 flex items-center gap-2.5 rounded-xl bg-white/90 px-2.5 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pwa-icon-192.png" alt="" className="h-8 w-8 shrink-0 rounded-[22%]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span className="truncate">첫 좋아요가 왔어요 ♥</span>
            <span className="shrink-0 font-normal text-gray-400">방금</span>
          </span>
          <span className="truncate text-[11px] text-gray-500">누군가 회원님의 Drop을 좋아해요</span>
        </span>
      </div>

      <p className="relative mt-3 text-[15px] font-bold leading-snug">
        반응이 오면
        <br />폰이 먼저 알려줘요
      </p>
      <ul className="relative mt-1.5 flex flex-col gap-0.5 text-[11px] text-gray-600">
        <li className="flex items-center gap-1.5">
          <BellIcon className="h-3 w-3 text-amber-500" />
          좋아요·댓글 즉시 푸시 알림
        </li>
        <li>♪ 화면을 꺼도 이어지는 재생</li>
        <li>⌂ 홈 화면에서 바로 열기</li>
      </ul>

      {installed ? (
        <p className="relative mt-3 rounded-xl bg-white px-3 py-2 text-xs text-gray-700 ring-1 ring-black/5">설치됐어요! 폰에도 설치하면 알림을 받을 수 있어요.</p>
      ) : mode === "desktop" ? (
        <>
          <div className="relative mt-3 flex items-center gap-3 rounded-xl bg-white p-2.5 text-gray-900 ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/install-qr.svg" alt="Compmusic 설치 안내 QR 코드" className="h-20 w-20 shrink-0" />
            <span className="text-[11px] leading-snug text-gray-700">
              <b className="text-gray-900">폰 카메라로 스캔</b>하면 설치 방법이 바로 떠요
            </span>
          </div>
          {nativePrompt && (
            <button
              type="button"
              onClick={installHere}
              className="relative mt-2 w-full rounded-full bg-gray-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-700"
            >
              이 컴퓨터에도 설치
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={openGuide}
          className="relative mt-3 w-full rounded-full bg-gray-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-700"
        >
          {mode === "ios" ? "홈 화면에 추가하는 방법" : "앱 설치하기"}
        </button>
      )}
    </section>
  );
}
