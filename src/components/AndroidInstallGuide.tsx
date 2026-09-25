"use client";

// Android 앱 설치 안내 팝업 — iPhone(IosInstallGuide)과 달리 Android는 크롬·삼성 인터넷이 PWA 설치를
// 직접 지원하고, 푸시도 설치 없이 브라우저에서 바로 된다. 그래서 세 갈래로 나눈다:
//   1) 브라우저가 beforeinstallprompt를 줬으면(크롬·삼성 인터넷, manifest.ts 설치 조건 충족) → "앱 설치"
//      버튼 한 번으로 네이티브 설치 창을 띄운다.
//   2) 못 받았으면(아직 조건 판정 전, 이미 거절 등) → 브라우저별(크롬/삼성 인터넷) 메뉴 따라하기.
//   3) 카카오톡·인스타그램 같은 앱 안 브라우저 → 설치가 안 되니 바깥 브라우저로 열기 버튼.
// 어느 경우든 아래에 "푸시 알림도 켜기"를 같이 둔다(Android는 설치 안 해도 푸시 가능).
//
// AndroidInstallPrompt: (app) 레이아웃에 마운트. Android이고 홈 화면 앱(standalone)이 아닐 때 잠깐
// 뒤 자동으로 띄운다. 닫으면 3일, 설치 완료(appinstalled)나 "다시 보지 않기"면 영영 안 띄운다.
// 신규 가입자 기능 안내(FeatureGuideModal)를 아직 안 봤으면 이번엔 건너뛴다(겹침 방지).
// 주소에 ?installGuide=android(또는 Android 기기에서 ?installGuide=1)를 붙이면 강제로 연다.
import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckIcon, XIcon } from "@/components/icons";
import { isStandalone, usePushStatus } from "@/lib/pushClient";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "comp:android-install-prompt:v1";
const OPEN_EVENT = "comp:open-android-install-guide";
const SNOOZE_DAYS_ON_CLOSE = 3;

// 다른 곳(알림 설정)에서 같은 팝업을 여는 이벤트.
export function openAndroidInstallGuide() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// beforeinstallprompt는 페이지 로드 직후 한 번 오고 다시 안 오므로, 팝업이 뜨기 전에 오더라도
// 놓치지 않게 모듈이 로드될 때부터 받아둔다. preventDefault로 크롬 기본 미니 배너는 숨긴다
// (우리 팝업이 대신 안내하므로).
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();
function emit() {
  subscribers.forEach((fn) => fn());
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    writeState({ ...readState(), never: true });
    emit();
  });
}
function useDeferredPrompt() {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => deferredPrompt,
    () => null,
  );
}

// 다른 곳(오른쪽 사이드바 설치 광고, InstallAdCard)에서도 같은 네이티브 설치 창을 쓴다 — 데스크톱
// 크롬·엣지도 설치 조건이 맞으면 같은 beforeinstallprompt를 준다.
export const useNativeInstallPrompt = useDeferredPrompt;

export async function promptNativeInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  deferredPrompt = null;
  emit();
  return outcome;
}

export function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

type BrowserKind = "kakao" | "inapp" | "samsung" | "chrome";
function detectBrowser(): BrowserKind {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|everytimeApp|; wv\)/i.test(ua)) return "inapp";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  return "chrome";
}

function readState(): { snoozeUntil?: number; never?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeState(state: { snoozeUntil?: number; never?: boolean }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장이 막힌 환경 — 이번 세션만 닫힌 걸로 충분.
  }
}

export function AndroidInstallPrompt({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    let timer: number | undefined;
    const param = new URLSearchParams(window.location.search).get("installGuide");
    if (param === "android" || (param === "1" && isAndroid())) {
      timer = window.setTimeout(() => setOpen(true), 300);
    } else if (isAndroid() && !isStandalone()) {
      const state = readState();
      let featureGuideSeen = true;
      try {
        featureGuideSeen = localStorage.getItem(`comp:feature-guide-seen:${userId}:v1`) === "1";
      } catch {
        featureGuideSeen = true;
      }
      if (!state.never && (state.snoozeUntil ?? 0) < Date.now() && featureGuideSeen) {
        timer = window.setTimeout(() => setOpen(true), 2500);
      }
    }
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      if (timer) window.clearTimeout(timer);
    };
  }, [userId]);

  // 이용 통계(0079) — 설치 안내가 뜬 횟수와 결과.
  useEffect(() => {
    if (open) track("install_prompt_shown", { props: { platform: "android" } });
  }, [open]);

  if (!open) return null;
  return (
    <AndroidInstallModal
      onClose={(reason) => {
        track("install_prompt_result", { props: { platform: "android", result: reason } });
        if (reason === "never") writeState({ ...readState(), never: true });
        else if (reason === "close") writeState({ ...readState(), snoozeUntil: Date.now() + SNOOZE_DAYS_ON_CLOSE * 86_400_000 });
        setOpen(false);
      }}
    />
  );
}

function AndroidInstallModal({ onClose }: { onClose: (reason: "close" | "never" | "installed") => void }) {
  const deferred = useDeferredPrompt();
  const [browser] = useState(detectBrowser);
  const [installed, setInstalled] = useState(false);
  const push = usePushStatus();

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    track("install_prompt_result", { props: { platform: "android", result: `native_${outcome}` } });
    deferredPrompt = null;
    emit();
    if (outcome === "accepted") {
      writeState({ ...readState(), never: true });
      setInstalled(true);
    }
  }

  function openExternal() {
    const url = `${window.location.origin}/feed`;
    // 카카오톡은 자체 스킴으로 기본 브라우저에서 열 수 있고, 그 외 앱 안 브라우저는 크롬 intent로 연다.
    window.location.href =
      browser === "kakao"
        ? `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
        : `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  return (
    // z-[70]: FeatureGuideModal·IosInstallGuide와 같은 이유 — GlobalPlayerBar(z-50)·ExpandedPlayer(z-[60])보다 위.
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 md:items-center md:p-4"
      onClick={() => onClose("close")}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compmusic 앱 설치 안내"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-5 shadow-xl md:rounded-3xl dark:bg-gray-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">Compmusic을 앱으로 설치하세요</span>
            <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              홈 화면에서 바로 열리고, 좋아요·댓글이 오면 알림으로 알려드려요
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClose(installed ? "installed" : "close")}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-900"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 설치될 앱 카드 — 실제 PWA 아이콘·이름(manifest.ts)과 같게. */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pwa-icon-192.png" alt="" className="h-12 w-12 rounded-[22%] shadow-sm" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Compmusic</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">compmusic.kr · 설치 용량 거의 없음</span>
          </div>
          {installed ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckIcon className="h-4 w-4" />
              설치됨
            </span>
          ) : (
            deferred &&
            browser !== "kakao" &&
            browser !== "inapp" && (
              <button
                type="button"
                onClick={install}
                className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:opacity-80 dark:bg-white dark:text-black"
              >
                앱 설치
              </button>
            )
          )}
        </div>

        {installed ? (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            설치됐어요! 홈 화면(또는 앱 목록)의 Compmusic 아이콘으로 열어보세요.
          </p>
        ) : browser === "kakao" || browser === "inapp" ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              지금은 {browser === "kakao" ? "카카오톡" : "앱"} 안의 브라우저라 설치할 수 없어요. Chrome(또는 삼성 인터넷)으로
              열면 바로 설치할 수 있어요.
            </p>
            <button
              type="button"
              onClick={openExternal}
              className="rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-80 dark:bg-white dark:text-black"
            >
              {browser === "kakao" ? "다른 브라우저로 열기" : "Chrome으로 열기"}
            </button>
          </div>
        ) : deferred ? (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            &lsquo;앱 설치&rsquo;를 누르고 뜨는 창에서 한 번 더 &lsquo;설치&rsquo;를 누르면 끝이에요.
          </p>
        ) : (
          <ManualSteps browser={browser} />
        )}

        {/* Android는 설치 안 해도 브라우저에서 바로 푸시를 받을 수 있다(0074). */}
        {push.status === "available" && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <span className="text-xs text-gray-600 dark:text-gray-400">설치 전에도 알림은 바로 켤 수 있어요</span>
            <button
              type="button"
              onClick={push.enable}
              disabled={push.busy}
              className="shrink-0 rounded-full bg-gray-100 px-3.5 py-2 text-xs font-semibold text-gray-900 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-100"
            >
              푸시 알림 켜기
            </button>
          </div>
        )}
        {push.status === "subscribed" && (
          <p className="mt-4 inline-flex items-center gap-1 border-t border-gray-100 pt-4 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
            <CheckIcon className="h-3.5 w-3.5 text-green-600" />이 기기에서 푸시 알림을 받고 있어요
          </p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onClose("never")}
            className="py-2 text-xs text-gray-400 transition hover:text-gray-600"
          >
            다시 보지 않기
          </button>
          <button
            type="button"
            onClick={() => onClose(installed ? "installed" : "close")}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            {installed ? "닫기" : "나중에"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 설치 버튼을 못 받았을 때의 메뉴 따라하기 — 브라우저별 실제 메뉴 위치를 간단한 그림(목업)으로.
function ManualSteps({ browser }: { browser: "samsung" | "chrome" }) {
  const steps =
    browser === "samsung"
      ? [
          { text: <>화면 맨 아래 <b>≡ 메뉴</b>를 눌러요</>, mock: <BottomBarMock /> },
          { text: <><b>현재 페이지 추가</b>(또는 &lsquo;페이지 추가&rsquo;)를 눌러요</>, mock: <MenuMock items={["북마크", "현재 페이지 추가", "방문 기록"]} highlight={1} /> },
          { text: <><b>홈 화면</b>을 고르면 끝!</>, mock: <MenuMock items={["북마크", "홈 화면", "빠른 실행"]} highlight={1} /> },
        ]
      : [
          { text: <>주소창 오른쪽 <b>⋮</b>(점 세 개)를 눌러요</>, mock: <TopBarMock /> },
          { text: <><b>홈 화면에 추가</b>(또는 &lsquo;앱 설치&rsquo;)를 눌러요</>, mock: <MenuMock items={["새 탭", "방문 기록", "홈 화면에 추가"]} highlight={2} /> },
          { text: <>뜨는 창에서 <b>설치</b>(또는 &lsquo;추가&rsquo;)를 누르면 끝!</>, mock: <DialogMock /> },
        ];

  return (
    <ol className="mt-4 flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-200">{step.text}</span>
          <span className="w-28 shrink-0">{step.mock}</span>
        </li>
      ))}
    </ol>
  );
}

const mockFrame = "flex h-14 w-full flex-col justify-center rounded-lg border border-gray-200 bg-white px-2 dark:border-gray-800 dark:bg-gray-900";
const mockHighlight = "rounded-md ring-2 ring-amber-500";

function TopBarMock() {
  return (
    <span className={mockFrame}>
      <span className="flex items-center gap-1">
        <span className="h-4 flex-1 rounded-full bg-gray-100 px-1.5 text-[8px] leading-4 text-gray-500 dark:bg-gray-800">compmusic.kr</span>
        <span className={`px-1 text-sm font-bold leading-4 text-gray-700 dark:text-gray-200 ${mockHighlight}`}>⋮</span>
      </span>
    </span>
  );
}

function BottomBarMock() {
  return (
    <span className={`${mockFrame} justify-end pb-1.5`}>
      <span className="flex items-center justify-between text-[10px] text-gray-500">
        <span>‹</span>
        <span>›</span>
        <span>⌂</span>
        <span className={`px-1 font-bold text-gray-700 dark:text-gray-200 ${mockHighlight}`}>≡</span>
      </span>
    </span>
  );
}

function MenuMock({ items, highlight }: { items: string[]; highlight: number }) {
  return (
    <span className={`${mockFrame} gap-0.5 py-1`}>
      {items.map((item, i) => (
        <span
          key={item}
          className={`truncate px-1 text-[8px] leading-3 text-gray-600 dark:text-gray-300 ${i === highlight ? `${mockHighlight} font-semibold text-gray-900 dark:text-white` : ""}`}
        >
          {item}
        </span>
      ))}
    </span>
  );
}

function DialogMock() {
  return (
    <span className={`${mockFrame} gap-1`}>
      <span className="text-[8px] font-semibold text-gray-800 dark:text-gray-100">Compmusic 앱 설치</span>
      <span className="flex justify-end gap-1.5 text-[8px]">
        <span className="text-gray-400">취소</span>
        <span className={`px-1 font-semibold text-gray-900 dark:text-white ${mockHighlight}`}>설치</span>
      </span>
    </span>
  );
}
