"use client";

// DEMO 피드 최상단 — 열자마자 게시물이 바로 안 보이도록 화면 한 판을 비워 힐링 멘트를
// 가운데 띄운다(사용자 요청). 몇 초마다 다음 문구로 부드럽게 페이드된다.
import { useEffect, useState } from "react";

const MESSAGES: { q: string; a: string }[] = [
  {
    q: "당신은 어떤 사람인가요?",
    a: "당신은 음악이라는, 인간이 할 수 있는 가장 가치 있는 일을 하고 있어요.",
  },
  {
    q: "오늘은 어떤 소리를 들으셨나요?",
    a: "그 소리를 붙잡아 곡으로 남기는 건 아무나 하는 일이 아니에요.",
  },
  {
    q: "요즘 마음이 좀 지치셨나요?",
    a: "그래도 계속 만들고 있다는 것, 그것만으로 이미 충분히 잘하고 있어요.",
  },
  {
    q: "왜 음악을 시작했는지 기억나세요?",
    a: "그때의 마음은 지금도 당신 안에 그대로 있어요.",
  },
  {
    q: "아직 완성하지 못한 곡이 마음에 걸리나요?",
    a: "미완성인 채로도 그건 당신이 지나온 시간의 흔적이에요.",
  },
  {
    q: "아무도 안 들어주는 것 같은 날인가요?",
    a: "당신이 만든 소리는 어딘가에 분명히 가닿아 있어요.",
  },
  {
    q: "잘하고 있는 걸까, 자꾸 묻게 되나요?",
    a: "만드는 사람은 늘 그렇게 물어요. 그게 진심이라는 증거예요.",
  },
];

const ROTATE_MS = 7000;
const FADE_MS = 600;

export function FeedHero() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // 새로고침마다 같은 문구부터 보이지 않도록 마운트 시 한 번 랜덤 시작.
    setIdx(Math.floor(Math.random() * MESSAGES.length));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const m = MESSAGES[idx];

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div
        className={`transition-opacity ease-in-out ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <p className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 md:text-2xl">
          {m.q}
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400 md:max-w-md md:text-base">
          {m.a}
        </p>
      </div>
      <span className="mt-4 text-xs text-gray-300 dark:text-gray-600">아래로 내리면 오늘의 작업들이 있어요 ↓</span>
    </section>
  );
}
