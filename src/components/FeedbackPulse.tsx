"use client";

// 상황별 짧은 설문 카드(0065 feedback_pulses) — 트랙을 올려본 뒤 / 가입 7일째에 우하단에 작게
// 뜬다. 이모지 한 번 탭 → (선택) 한 줄 → 보내기. "다음에"도 기록해서 다시 묻지 않는다.
// 띄울지 말지는 /api/feedback/pulse가 판정(최근 7일 안에 물었으면 안 묻는 등). 페이지 진입
// 직후 바로 뜨면 방해라 잠깐 기다렸다가 묻고, 작업 중일 화면(업로드/피드백/관리자)에선 안 띄운다.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PULSE_QUESTIONS, PULSE_SCORES, type PulseTrigger } from "@/lib/feedback";

const SHOW_DELAY_MS = 20_000;
const SKIP_PATH_PREFIXES = ["/upload", "/help", "/admin", "/status"];
// 한 탭(세션)에서 판정 요청은 한 번만 — 화면 이동마다 API를 두드리지 않게.
const SESSION_KEY = "comp:feedback-pulse-checked";

export function FeedbackPulse({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [trigger, setTrigger] = useState<PulseTrigger | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState(false);
  const skipHere = SKIP_PATH_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (skipHere || trigger) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch("/api/feedback/pulse")
        .then((res) => (res.ok ? res.json() : { trigger: null }))
        .then((data: { trigger: PulseTrigger | null }) => {
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {}
          if (!cancelled && data.trigger) setTrigger(data.trigger);
        })
        .catch(() => {});
    }, SHOW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [skipHere, trigger]);

  async function submit(finalScore: number | null) {
    if (!trigger || sending) return;
    setSending(true);
    await createClient()
      .from("feedback_pulses")
      .insert({ user_id: userId, trigger, score: finalScore, comment: comment.trim() || null });
    setSending(false);
    if (finalScore === null) {
      setTrigger(null);
      return;
    }
    setThanks(true);
    setTimeout(() => setTrigger(null), 2000);
  }

  if (!trigger || skipHere) return null;

  return (
    // 모바일: 하단 사운드바(64px)+탭바(56px) 위 · 데스크톱: 사운드바 위 우하단.
    <div
      role="dialog"
      aria-label="짧은 설문"
      className="fixed bottom-[8.25rem] right-3 z-40 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-950 md:bottom-20 md:right-5"
    >
      {thanks ? (
        <p className="py-2 text-center text-sm text-gray-800 dark:text-gray-200">의견 고마워요! 🙏</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{PULSE_QUESTIONS[trigger]}</p>
            <button
              type="button"
              onClick={() => submit(null)}
              disabled={sending}
              className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
            >
              다음에
            </button>
          </div>
          <div className="mt-3 flex justify-between">
            {PULSE_SCORES.map((s) => (
              <button
                key={s.score}
                type="button"
                onClick={() => setScore(s.score)}
                aria-pressed={score === s.score}
                title={s.label}
                className={`flex w-14 flex-col items-center gap-0.5 rounded-xl py-1.5 transition ${
                  score === s.score ? "bg-gray-900 text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-gray-900"
                }`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <span className="text-[10px]">{s.label}</span>
              </button>
            ))}
          </div>
          {score !== null && (
            <div className="mt-3 flex flex-col gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                placeholder={score <= 2 ? "어떤 점이 아쉬웠나요? (선택)" : "한 줄 남겨주셔도 좋아요 (선택)"}
                className="rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none dark:border-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => submit(score)}
                disabled={sending}
                className="self-end rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
              >
                보내기
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
