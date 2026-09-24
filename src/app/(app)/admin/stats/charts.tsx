// /admin/stats 전용 차트 조각 — 전부 서버 컴포넌트(클라이언트 JS 없음). 마우스를 올리면 브라우저
// 기본 툴팁(title)으로 정확한 값이 보이고, 값은 항상 글자로도 옆에 적어서 색에만 의존하지 않게 한다.
// 색은 한 가지 계열(파랑)만 쓴다 — 크기(많고 적음)를 보여주는 차트뿐이라 여러 색이 필요 없다.
// 파랑 단계는 dataviz 기본 팔레트의 순차(sequential) 램프.

const BLUE_RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
export const BAR_COLOR = "#2a78d6";

// 0~1 비율 → 램프 색. 0은 회색 빈칸.
export function rampColor(ratio: number): string {
  if (!(ratio > 0)) return "#f3f4f6";
  const i = Math.min(BLUE_RAMP.length - 1, Math.max(0, Math.round(ratio * (BLUE_RAMP.length - 1))));
  return BLUE_RAMP[i];
}

function rampText(ratio: number): string {
  return ratio > 0.5 ? "#ffffff" : "#111827";
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3.5 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div>;
}

// 가로 막대 목록 — 항목 이름 / 막대 / 값(비율). 기기·유입 등.
export function HBarList({
  rows,
  total,
  unit = "",
  emptyText = "아직 데이터가 없어요",
}: {
  rows: { label: string; value: number; note?: string }[];
  total?: number;
  unit?: string;
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-gray-400">{emptyText}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const sum = total ?? rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const share = sum ? Math.round((r.value / sum) * 100) : 0;
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm md:grid-cols-[minmax(0,13rem)_1fr_auto]">
            <span className="truncate text-gray-700" title={r.label}>
              {r.label}
            </span>
            <span className="h-3 rounded-r bg-gray-100" title={`${r.label}: ${r.value.toLocaleString()}${unit} (${share}%)`}>
              <span
                className="block h-full rounded-r"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, backgroundColor: BAR_COLOR }}
              />
            </span>
            <span className="whitespace-nowrap text-right tabular-nums text-gray-900">
              {r.value.toLocaleString()}
              {unit}
              <span className="ml-1 text-xs text-gray-500">{r.note ?? `${share}%`}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// 일별 세로 막대(한 계열). 날짜 라벨은 폭에 맞춰 듬성듬성.
export function DailyColumns({
  data,
  label,
  format = (v: number) => v.toLocaleString(),
}: {
  data: { d: string; v: number }[];
  label: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(...data.map((x) => x.v), 1);
  const every = data.length > 45 ? 14 : data.length > 14 ? 7 : 1;
  const total = data.reduce((a, x) => a + x.v, 0);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="tabular-nums">최대 {format(max === 1 && total === 0 ? 0 : max)}</span>
      </div>
      <div className="flex h-28 items-end gap-[2px] border-b border-gray-200" role="img" aria-label={label}>
        {data.map((x) => (
          <div
            key={x.d}
            className="group relative flex h-full flex-1 items-end"
            title={`${x.d.slice(5).replace("-", "/")} · ${format(x.v)}`}
          >
            <div
              className="w-full rounded-t-[3px] group-hover:opacity-80"
              style={{ height: x.v > 0 ? `${Math.max(3, (x.v / max) * 100)}%` : "0%", backgroundColor: BAR_COLOR }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-gray-400">
        {data.map((x, i) => (
          <span key={x.d} className="flex-1 overflow-visible whitespace-nowrap">
            {i % every === 0 ? x.d.slice(5).replace("-", "/") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// 요일 × 시간 히트맵(한국 시간). 칸 색 = 그 시간에 방문을 시작한 사람 수.
export function Heatmap({ cells }: { cells: { dow: number; h: number; visitors: number; active_s: number }[] }) {
  const map = new Map(cells.map((c) => [`${c.dow}-${c.h}`, c]));
  const max = Math.max(...cells.map((c) => c.visitors), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-[2px] text-[10px]">
        <thead>
          <tr>
            <th className="w-6" />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="font-normal text-gray-400">
                {h % 3 === 0 ? h : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DOW_LABELS.map((dl, i) => (
            <tr key={dl}>
              <th className="pr-1 text-right font-normal text-gray-500">{dl}</th>
              {Array.from({ length: 24 }, (_, h) => {
                const c = map.get(`${i + 1}-${h}`);
                const v = c?.visitors ?? 0;
                const ratio = v / max;
                return (
                  <td
                    key={h}
                    className="h-6 rounded-[3px] text-center tabular-nums"
                    style={{ backgroundColor: rampColor(ratio), color: rampText(ratio) }}
                    title={`${dl}요일 ${h}시 · 방문 ${v}명${c ? ` · 활동 ${Math.round(c.active_s / 60)}분` : ""}`}
                  >
                    {v > 0 && max <= 99 ? v : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
        <span>적음</span>
        <span className="flex">
          {[0.08, 0.25, 0.42, 0.58, 0.75, 1].map((r) => (
            <span key={r} className="h-3 w-5" style={{ backgroundColor: rampColor(r) }} />
          ))}
        </span>
        <span>많음 (최대 {max}명)</span>
      </div>
    </div>
  );
}

// 단계별 퍼널 — 첫 단계 대비 비율과 직전 단계 대비 전환율을 함께.
export function Funnel({ steps }: { steps: { label: string; value: number; hint?: string }[] }) {
  const first = steps[0]?.value || 0;
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const width = first ? Math.max(2, (s.value / first) * 100) : 0;
        return (
          <li key={s.label} className="text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-gray-700">
                {s.label}
                {s.hint && <span className="ml-1 text-xs text-gray-400">{s.hint}</span>}
              </span>
              <span className="whitespace-nowrap tabular-nums text-gray-900">
                {s.value.toLocaleString()}
                {prev !== null && (
                  <span className="ml-1.5 text-xs text-gray-500">
                    직전 대비 {prev ? `${Math.round((s.value / prev) * 100)}%` : "–"}
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 rounded-r bg-gray-100" title={`${s.label}: ${s.value.toLocaleString()}`}>
              <div className="h-full rounded-r" style={{ width: `${width}%`, backgroundColor: BAR_COLOR }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// 가입 주차별 리텐션 — 칸 = 가입 k주 뒤에 활동한 비율. 색 진하기 = 비율.
export function RetentionTable({ rows }: { rows: { week: string; size: number; w: (number | null)[] }[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-400">최근 8주 사이 가입자가 없어요</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="px-2 py-1 text-left font-medium">가입 주(월요일)</th>
            <th className="px-2 py-1 text-right font-medium">가입</th>
            {Array.from({ length: 8 }, (_, k) => (
              <th key={k} className="px-1 py-1 text-center font-medium">
                {k === 0 ? "가입 주" : `+${k}주`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.week}>
              <td className="px-2 py-1 text-gray-700">{r.week.slice(5).replace("-", "/")}</td>
              <td className="px-2 py-1 text-right tabular-nums text-gray-900">{r.size}</td>
              {r.w.map((n, k) => {
                if (n === null) return <td key={k} className="rounded-[3px] bg-white" />;
                const ratio = r.size ? n / r.size : 0;
                return (
                  <td
                    key={k}
                    className="rounded-[3px] px-1 py-1.5 text-center tabular-nums"
                    style={{ backgroundColor: rampColor(ratio), color: rampText(ratio) }}
                    title={`${r.week} 가입 ${r.size}명 중 ${k === 0 ? "가입 주" : `${k}주 뒤`} 활동 ${n}명`}
                  >
                    {Math.round(ratio * 100)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
