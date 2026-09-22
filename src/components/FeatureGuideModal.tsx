"use client";

// 신규 유저 첫 방문 가이드 — DEMO/memo 탭, PEAK, 노크 기능을 4단계 팝업으로 소개한다.
// 모달 뼈대(모바일 bottom-sheet: items-end / 데스크톱 중앙: md:items-center, 배경 클릭 시
// 닫힘)는 GuestSignupPrompt.tsx와 같은 패턴을 그대로 따른다. 서버에 "봤는지" 상태를 둘
// 만큼 중요한 기능은 아니라 localStorage 플래그 하나로 충분(comp:demo-playlist:v1과 같은
// 네이밍 컨벤션) — 계정별로 한 번만 보이게 userId를 키에 포함한다(같은 브라우저를 여러
// 계정이 쓰는 경우 대비).
import { useEffect, useState } from "react";
import { FlameIcon, XIcon } from "@/components/icons";

type PanelKind = "demo" | "memo" | "peak" | "knock";

type Step = {
  panel: PanelKind;
  eyebrow: string;
  title: string;
  desc: string;
  tag: string;
};

const STEPS: Step[] = [
  {
    panel: "demo",
    eyebrow: "1 · 4 — DEMO 탭",
    title: "☀ 낮엔 데모, 다 보여드려요",
    desc: "전체공개 게시물이 모이는 곳이에요. 노출 시간이 영구라서 언제 들어와도 구경할 수 있어요.",
    tag: "전체공개 · 노출 시간 영구",
  },
  {
    panel: "memo",
    eyebrow: "2 · 4 — memo 탭",
    title: "☾ 밤엔 memo, Companion끼리만",
    desc: "Companion으로 연결된 사람들에게만 보이는 공간이에요. 노출 시간을 직접 정해서 살짝만 열어둘 수 있어요.",
    tag: "Companion 공개 · 노출 시간 설정 필수",
  },
  {
    panel: "peak",
    eyebrow: "3 · 4 — PEAK",
    title: "볼륨이 꽉 차면, PEAK",
    desc: "조회수랑 Kick이 쌓이면 볼륨미터가 가득 차면서 PEAK 배지가 붙어요. 지금 제일 핫한 게시물이라는 뜻이에요.",
    tag: "우측 사이드바 · 실시간 PEAK에서 모아보기",
  },
  {
    panel: "knock",
    eyebrow: "4 · 4 — 노크",
    title: "🚪 몰래 보기 없기, 노크하고 보기",
    desc: "비공개(초대전용) 게시물은 잠겨 있어요. 문을 두드리듯 노크하면 작성자에게 열람 요청이 가요.",
    tag: "초대전용 게시물 · 요청 승인 후 열람",
  },
];

function eyebrowColor(panel: PanelKind) {
  if (panel === "demo") return "text-demo-gold";
  if (panel === "memo") return "text-violet-500";
  if (panel === "peak") return "text-[#a85d4f]";
  return "text-active-gray dark:text-gray-400";
}

// PEAK 막대 색은 VerticalVolumeMeter.tsx의 매트 톤(초록→골드→브릭레드)을 그대로 가져와
// 실제 볼륨미터와 같은 배지로 보이게 했다.
function Panel({ step }: { step: Step }) {
  if (step.panel === "demo") {
    return (
      <div className="flex h-36 items-center justify-center bg-demo-gold/15">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow">☀</span>
      </div>
    );
  }
  if (step.panel === "memo") {
    return (
      <div className="flex h-36 items-center justify-center bg-[#1c1c1e]">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2a2a2d] text-3xl text-violet-400 shadow">
          ☾
        </span>
      </div>
    );
  }
  if (step.panel === "peak") {
    return (
      <div className="relative flex h-36 items-center justify-center bg-demo-bg">
        <span className="absolute top-4 flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
          <FlameIcon className="h-3 w-3 text-[#a85d4f]" /> PEAK
        </span>
        <div className="flex items-end gap-1.5">
          {[14, 22, 32, 42, 30, 20].map((h, i) => (
            <span
              key={i}
              className="w-2 rounded-t-full"
              style={{ height: h, background: i < 2 ? "#7a9385" : i < 4 ? "#b3a06a" : "#a85d4f" }}
            />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-36 items-center justify-center bg-box-gray">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow">🚪</span>
    </div>
  );
}

export function FeatureGuideModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(`comp:feature-guide-seen:${userId}:v1`) !== "1") setOpen(true);
    } catch {
      // localStorage 접근 불가 환경(사생활 보호 모드 등)이면 그냥 안 띄운다 — 매번 뜨는
      // 것보다 안전한 폴백.
    }
  }, [userId]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(`comp:feature-guide-seen:${userId}:v1`, "1");
    } catch {}
  }

  if (!open) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <Panel step={s} />
          <button
            onClick={dismiss}
            aria-label="닫기"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-gray-700 hover:bg-white"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-6 pb-2 pt-5">
          <p className={`mb-2 text-[11px] font-bold uppercase tracking-wide ${eyebrowColor(s.panel)}`}>{s.eyebrow}</p>
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">{s.title}</h2>
          <p className="mb-3 text-sm leading-relaxed text-active-gray dark:text-gray-400">{s.desc}</p>
          <span className="inline-block rounded-lg bg-box-gray px-2.5 py-1 text-[11px] font-medium text-active-gray dark:bg-gray-800 dark:text-gray-300">
            {s.tag}
          </span>
        </div>

        <div className="flex items-center justify-between px-6 pb-5 pt-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`${i + 1}번째로 이동`}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-black dark:bg-white" : "w-1.5 bg-box-gray dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!isLast && (
              <button
                onClick={dismiss}
                className="text-sm font-medium text-active-gray hover:text-gray-900 dark:hover:text-gray-100"
              >
                건너뛰기
              </button>
            )}
            <button
              onClick={() => (isLast ? dismiss() : setStep((i) => i + 1))}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {isLast ? "시작하기" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
