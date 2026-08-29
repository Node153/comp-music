"use client";

// 생년월일 입력 — 브라우저 기본 <input type="date"> 대신 커스텀 드롭다운을 쓴다. 처음엔
// 화면에 스크롤 휠 3열을 항상 펼쳐놓았는데(사용자 요청 반영 전 버전), "그냥 숫자 눌렀을 때
// 드롭다운 스크롤이 나오면 되는데"라는 피드백을 받고 지금 형태로 바꿈 — 평소엔 다른
// 입력칸처럼 닫혀있는 필드로 보이다가, 클릭하면 그 아래로 스크롤 휠(년/월/일 3열, iOS 스타일
// wheel picker) 드롭다운이 펼쳐진다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { field } from "@/components/ui/styles";

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;
// 위아래로 (보이는 줄 수 - 1)/2 만큼 여백을 줘야 맨 위/맨 아래 값도 가운데까지 스크롤된다.
const PADDING = (ITEM_HEIGHT * (VISIBLE_COUNT - 1)) / 2;

function daysInMonth(year: number, month: number) {
  // month는 1~12. new Date(y, m, 0)은 m월의 마지막 날(=m-1월에서 0번째 날)을 돌려준다.
  return new Date(year, month, 0).getDate();
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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

  // 외부에서 selectedIndex가 바뀌면(드롭다운을 열 때 초기 위치 세팅, 연/월이 바뀌어 일자
  // 목록이 짧아진 경우 등) 스크롤 위치를 그 값에 맞춰 이동시킨다.
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

  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 휠의 내부 상태 — value가 비어있는 동안(아직 한 번도 선택 안 함)에도 휠 자체는 어딘가에
  // 멈춰있어야 하므로, 스크롤을 덜 하도록 20년 전(음악 활동 연령대에 가까운 기본값)을
  // 초기 위치로 잡는다. 다만 실제로 부모 state(value)에는 사용자가 최소 한 칸이라도
  // 직접 움직여야 반영된다(아래 커밋 useEffect의 isFirstChange 참고) — <input type="date">처럼
  // "아직 선택 안 함" 상태를 유지하기 위함.
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
  const isFirstChange = useRef(true);

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
  // Column과 커밋 로직 두 곳). day를 직접 덮어쓰지 않으므로 다시 31일이 있는 달로 돌아가면
  // 사용자가 원래 고른 날짜가 그대로 복원된다.
  useEffect(() => {
    // 마운트 시 1회는 건너뛴다 — 사용자가 휠을 한 번이라도 실제로 움직여야만
    // 부모(form) state에 값이 반영되게 하기 위함.
    if (isFirstChange.current) {
      isFirstChange.current = false;
      return;
    }
    const mm = String(month).padStart(2, "0");
    const dd = String(Math.min(day, days.length)).padStart(2, "0");
    onChange(`${year}-${mm}-${dd}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  // 드롭다운 바깥을 클릭하면 닫는다.
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayText = value ? `${year}년 ${month}월 ${Math.min(day, days.length)}일` : "";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`${field} flex items-center justify-between text-left ${
          displayText ? "" : "text-gray-400"
        }`}
      >
        {displayText || "생년월일을 선택해주세요"}
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <div className="flex gap-1">
            <Column
              items={years}
              suffix="년"
              selectedIndex={years.indexOf(year)}
              onSelect={(i) => setYear(years[i])}
            />
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
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="mt-2 w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
