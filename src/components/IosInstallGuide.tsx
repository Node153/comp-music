"use client";

// iPhone "홈 화면에 추가" 안내 팝업 — 앱 출시 전이라 iPhone은 홈 화면에 추가한 웹 앱에서만 푸시
// 알림(0074)을 받을 수 있다. 실제 iOS Safari 화면 캡처(public/install-guide/step1~4.webp, 사용자
// 제공 2026-09-24)에 누를 곳을 표시해서 한 단계씩 보여준다: ··· → 공유 → 홈 화면에 추가 → 웹 앱으로
// 열기 켠 채 추가 → 홈 화면 아이콘으로 열기.
//
// - IosInstallPrompt: (app) 레이아웃에 마운트. iPhone/iPad Safari 탭(홈 화면 앱 아님)일 때만 잠깐 뒤
//   자동으로 띄운다. 닫으면 3일, 끝까지 보면 7일 뒤 다시, "다시 보지 않기"면 영영 안 띄운다.
//   신규 가입자 기능 안내(FeatureGuideModal)를 아직 안 봤으면 겹치지 않게 이번엔 건너뛴다.
//   카카오톡·인스타그램 같은 앱 안 브라우저에선 홈 화면 추가가 안 돼서 "Safari로 열기" 안내만.
// - openIosInstallGuide(): 다른 곳(알림 설정·알림 패널 배너)에서 같은 팝업을 여는 이벤트.
// - 주소에 ?installGuide=1을 붙이면 기기와 무관하게 강제로 연다(확인·공유용).
import { useEffect, useState } from "react";
import { XIcon } from "@/components/icons";
import { isIOS, isStandalone } from "@/lib/pushClient";

const OPEN_EVENT = "comp:open-install-guide";
const STORAGE_KEY = "comp:ios-install-prompt:v1";
const SNOOZE_DAYS_ON_CLOSE = 3;
const SNOOZE_DAYS_ON_FINISH = 7;

export function openIosInstallGuide() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

// 누를 곳 표시 — 캡처(924×2000) 기준 가운데 좌표와 크기(%).
type Spot = { x: number; y: number; w: number; h: number; round?: boolean };
type Step = { image?: string; title: string; note?: string; spots?: Spot[] };

const STEPS: Step[] = [
  {
    image: "/install-guide/step1.webp",
    title: "Safari 화면 맨 아래 ··· 버튼을 눌러요",
    note: "주소창 옆에 공유 버튼(네모에서 화살표가 나오는 아이콘)이 바로 보이면 그걸 눌러도 돼요.",
    spots: [{ x: 85.2, y: 93.1, w: 14, h: 6.5, round: true }],
  },
  {
    image: "/install-guide/step2.webp",
    title: "메뉴에서 공유를 눌러요",
    spots: [{ x: 62, y: 58.3, w: 56, h: 5.2 }],
  },
  {
    image: "/install-guide/step3.webp",
    title: "아래로 조금 내려서 홈 화면에 추가를 눌러요",
    spots: [{ x: 50, y: 62.95, w: 93, h: 6.4 }],
  },
  {
    image: "/install-guide/step4.webp",
    title: "웹 앱으로 열기가 켜진 걸 확인하고, 오른쪽 위 추가를 눌러요",
    spots: [
      { x: 87.8, y: 36, w: 18, h: 4.4, round: true },
      { x: 87.9, y: 11.25, w: 22, h: 7, round: true },
    ],
  },
  {
    title: "홈 화면에 생긴 Compmusic 아이콘으로 열면 끝!",
  },
];

function isInAppBrowser() {
  return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|everytimeApp/i.test(navigator.userAgent);
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
    // 저장이 막힌 환경(사생활 보호 모드 등) — 이번 세션만 닫힌 걸로 충분.
  }
}

function snooze(days: number) {
  writeState({ ...readState(), snoozeUntil: Date.now() + days * 24 * 3_600_000 });
}

export function IosInstallPrompt({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);

    let timer: number | undefined;
    const forced = new URLSearchParams(window.location.search).get("installGuide") === "1";
    if (forced) {
      timer = window.setTimeout(() => setOpen(true), 300);
    } else if (isIOS() && !isStandalone()) {
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

  if (!open) return null;
  return (
    <IosInstallGuideModal
      onClose={(reason) => {
        if (reason === "never") writeState({ ...readState(), never: true });
        else snooze(reason === "finish" ? SNOOZE_DAYS_ON_FINISH : SNOOZE_DAYS_ON_CLOSE);
        setOpen(false);
      }}
    />
  );
}

function IosInstallGuideModal({ onClose }: { onClose: (reason: "close" | "finish" | "never") => void }) {
  const [step, setStep] = useState(0);
  const [inApp] = useState(() => isInAppBrowser());
  const [copied, setCopied] = useState(false);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/feed`);
      setCopied(true);
    } catch {
      // 복사가 막혀도 안내 문구만으로 진행 가능.
    }
  }

  return (
    // z-[70]: FeatureGuideModal과 같은 이유 — GlobalPlayerBar(z-50)·ExpandedPlayer(z-[60])보다 위.
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 md:items-center md:p-4"
      onClick={() => onClose("close")}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="홈 화면에 추가하는 방법"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-xl md:rounded-3xl dark:bg-gray-950"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div className="flex flex-col">
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">Compmusic을 앱처럼 쓰세요</span>
            <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              홈 화면에 추가하면 좋아요·댓글이 올 때 바로 푸시 알림을 받아요 · 30초면 끝
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClose("close")}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-900"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {inApp ? (
          <div className="flex flex-col gap-3 px-5 pb-5 pt-2">
            <p className="rounded-2xl bg-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-800 dark:bg-gray-900 dark:text-gray-200">
              지금은 카카오톡·인스타그램 같은 <b>앱 안의 브라우저</b>라서 홈 화면에 추가할 수 없어요. 화면의 ··· 메뉴에서{" "}
              <b>&lsquo;Safari로 열기&rsquo;</b>(또는 &lsquo;다른 브라우저로 열기&rsquo;)를 누른 뒤 다시 시도해주세요.
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-80 dark:bg-white dark:text-black"
            >
              {copied ? "복사했어요 — Safari 주소창에 붙여넣으세요" : "링크 복사하기"}
            </button>
          </div>
        ) : (
          <>
            {/* 단계마다 시트 높이가 달라져 버튼이 들썩이지 않게 본문 높이를 캡처 단계 기준으로 고정한다. */}
            <div className="flex h-[calc(min(52dvh,440px)+5.5rem)] min-h-0 flex-col items-center gap-3 overflow-y-auto px-5 pt-2">
              <p className="self-stretch text-sm font-semibold text-gray-900 dark:text-gray-100">
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 align-[1px] text-[11px] font-bold text-white">
                  {step + 1}
                </span>
                {current.title}
              </p>

              {current.image ? (
                // 캡처 비율(924×2000) 그대로 — 표시 박스 안 좌표(%)가 캡처 좌표와 일치해야 표시 위치가 맞는다.
                <div className="relative aspect-[924/2000] h-[min(52dvh,440px)] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={current.image} alt="" className="h-full w-full object-cover" />
                  {current.spots?.map((spot, i) => (
                    <span
                      key={i}
                      className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border-[3px] border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.25)] animate-pulse ${
                        spot.round ? "rounded-full" : "rounded-xl"
                      }`}
                      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
                    />
                  ))}
                </div>
              ) : (
                <>
                {/* 홈 화면에서 찾을 아이콘 — 실제 PWA 아이콘(manifest.ts)과 같은 이미지. */}
                <span className="mt-2 flex flex-col items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/pwa-icon-192.png" alt="" className="h-20 w-20 rounded-[22%] shadow-md" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Compmusic</span>
                </span>
                <ul className="flex flex-col gap-2 self-stretch rounded-2xl bg-gray-100 px-4 py-4 text-sm leading-relaxed text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                  <li>📱 주소창 없이 앱처럼 전체 화면으로 열려요</li>
                  <li>🔔 처음 한 번 로그인한 뒤 <b>알림 설정 → 이 기기에서 푸시 알림 받기 → 켜기</b>를 누르면, 좋아요·댓글이 올 때 바로 알려드려요</li>
                  <li>🔑 홈 화면 앱은 Safari와 로그인이 따로라, 처음 한 번은 다시 로그인해야 해요</li>
                </ul>
                </>
              )}

              {current.note && <p className="self-stretch text-xs text-gray-500 dark:text-gray-400">{current.note}</p>}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-1.5" aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-gray-900 dark:bg-gray-100" : "w-1.5 bg-gray-300 dark:bg-gray-700"}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {step === 0 ? (
                  <button
                    type="button"
                    onClick={() => onClose("never")}
                    className="px-2 py-2 text-xs text-gray-400 transition hover:text-gray-600"
                  >
                    다시 보지 않기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
                  >
                    이전
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (last ? onClose("finish") : setStep((s) => s + 1))}
                  className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-80 dark:bg-white dark:text-black"
                >
                  {last ? "알겠어요" : "다음"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
