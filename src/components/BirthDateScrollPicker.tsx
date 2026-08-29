"use client";

// 생년월일 입력 — 브라우저 기본 <input type="date"> 캘린더 팝업 대신 스크롤 휠(년/월/일 3열)
// 형태로 바꿔달라는 요청(사용자 요청, signup/onboarding 공통 사용). 네이티브 앱의 날짜 선택
// UI(iOS 스타일 wheel picker)를 흉내낸 것 — CSS scroll-snap으로 각 열이 한 칸씩 딱딱 멈추게
// 하고, 가운데 멈춘 값을 선택값으로 취급한다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;
// 위아래로 (보이는 줄 수 - 1)/2 만큼 여백을 줘야 맨 위/맨 아래 값도 가운데까지 스크롤된다.
const PADDING = (ITEM_HEIGHT * (VISIBLE_COUNT - 1)) / 2;

function daysInMonth(year: number, month: number) {
  // month는 1~12. new Date(y, m, 0)은 m월의 마지막 날(=m-1월에서 0번째 날)을 돌려준다.
  return new Date(year, month, 0).getDate();
}

function Column({
  items,
  suffix,
  selectedIndex,
  onSelect,
}: {
  items: number[];
  suffix: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 프로그램적으로 scrollTo한 직후 발생하는 scroll 이벤트를 "사용자가 스크롤했다"고
  // 오인해서 재계산하지 않도록 막는 플래그.
  const programmatic = useRef(false);

  // 외부에서 selectedIndex가 바뀌면(초기값 세팅, 연/월이 바뀌어 일자 목록이 짧아진 경우 등)
  // 스크롤 위치를 그 값에 맞춰 이동시킨다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) {
      programmatic.current = true;
      el.scrollTo({ top: target, behavior: "auto" });
      requestAnimationFrame(() => {
        programmatic.current = false;
      });
    }
  }, [selectedIndex, items.length]);

  const handleScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // 스크롤이 멈춘 뒤(관성 스크롤 포함) 가운데에 가장 가까운 값을 선택값으로 확정한다.
    settleTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el || programmatic.current) return;
      const index = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
      onSelect(index);
    }, 120);
  }, [items.length, onSelect]);

  return (
    <div className="relative w-full">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="no-scrollbar h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ paddingTop: PADDING, paddingBottom: PADDING }}
      >
        {items.map((item, i) => (
          <div
            key={item}
            onClick={() => onSelect(i)}
            className={`flex h-10 cursor-pointer snap-center items-center justify-center text-base transition-colors ${
              i === selectedIndex ? "font-semibold text-gray-900" : "text-gray-300"
            }`}
          >
            {item}
            {suffix}
          </div>
        ))}
      </div>
      {/* 가운데 선택 영역을 시각적으로 표시(위아래 구분선) — 클릭/스크롤 이벤트는 통과시킨다. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-gray-200"
        style={{ height: ITEM_HEIGHT }}
      />
    </div>
  );
}

export function BirthDateScrollPicker({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  /** "" 또는 "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  /** "YYYY-MM-DD" */
  minDate: string;
  /** "YYYY-MM-DD" */
  maxDate: string;
}) {
  const minYear = Number(minDate.slice(0, 4));
  const maxYear = Number(maxDate.slice(0, 4));

  // 초기값 — 이미 값이 있으면 그대로 쓰고, 없으면 스크롤을 덜 하도록 20년 전(음악 활동
  // 연령대에 가까운 기본값)을 기본 위치로 잡는다. 휠 피커는 네이티브 캘린더 입력과 달리
  // "완전히 빈 상태"가 없으므로(항상 어딘가에 멈춰있음) 최초 마운트 시점에 한 번
  // onChange가 호출된다 — <input type="date">처럼 진짜 빈 값을 유지할 수는 없다.
  const initial = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      return { year: y, month: m, day: d };
    }
    const fallbackYear = Math.min(maxYear, Math.max(minYear, maxYear - 20));
    return { year: fallbackYear, month: 1, day: 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i),
    [minYear, maxYear],
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(
    () => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
    [year, month],
  );

  // 연/월이 바뀌어 그 달의 마지막 날짜보다 선택된 일자가 크면(예: 31일 선택 중 2월로 전환)
  // day 상태 자체는 그대로 두고 표시/출력값만 Math.min(day, days.length)로 보정한다(아래
  // Column과 onChange 두 곳). day를 직접 덮어쓰지 않으므로 다시 31일이 있는 달로 돌아가면
  // 사용자가 원래 고른 날짜가 그대로 복원된다.
  useEffect(() => {
    const mm = String(month).padStart(2, "0");
    const dd = String(Math.min(day, days.length)).padStart(2, "0");
    onChange(`${year}-${mm}-${dd}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  return (
    <div className="flex gap-1 rounded-xl border border-gray-300 px-2">
      <Column items={years} suffix="년" selectedIndex={years.indexOf(year)} onSelect={(i) => setYear(years[i])} />
      <Column
        items={months}
        suffix="월"
        selectedIndex={months.indexOf(month)}
        onSelect={(i) => setMonth(months[i])}
      />
      <Column
        items={days}
        suffix="일"
        selectedIndex={Math.min(day, days.length) - 1}
        onSelect={(i) => setDay(days[i])}
      />
    </div>
  );
}
