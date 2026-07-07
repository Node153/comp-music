// "Comp"(컴프레서) 브랜딩을 반영한 볼륨미터 UI. 접속 중인 Companion 수가 많을수록
// 막대가 더 많이/높이 켜지는 오디오 레벨미터 형태. 실제 접속 상태 연동 전 시각적 표현.
const BAR_COUNT = 8;

function barColor(index: number, litCount: number): string {
  if (index >= litCount) return "bg-gray-200";
  const ratio = index / BAR_COUNT;
  if (ratio < 0.5) return "bg-emerald-500";
  if (ratio < 0.8) return "bg-amber-500";
  return "bg-red-500";
}

export function VolumeBar({ level }: { level: number }) {
  const clamped = Math.max(0, Math.min(1, level));
  const litCount = Math.max(clamped > 0 ? 1 : 0, Math.round(clamped * BAR_COUNT));

  return (
    <div className="flex h-4 items-end gap-[3px]" title={`활동 레벨 ${Math.round(clamped * 100)}%`}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-all duration-500 ${barColor(i, litCount)} ${
            i < litCount ? "animate-pulse" : ""
          }`}
          style={{ height: `${((i + 1) / BAR_COUNT) * 100}%` }}
        />
      ))}
    </div>
  );
}
