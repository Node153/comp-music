// 게시물 반응(좋아요+댓글) 수준을 세로 오디오 레벨미터로 시각화("Comp" 컴프레서 브랜딩).
// level이 1을 넘기면 신호가 클리핑된 것처럼 "PEAK" 칩을 띄운다 — PEAK 게시물 = 지금 핫한 게시물.
import { FlameIcon } from "@/components/icons";

const SEGMENTS = 10;

// 쨍한 초록/노랑/빨강 대신 채도 낮춘 매트 톤 — PEAK에 닿아도 색이 밝아지거나 채워지지
// 않고, 이미 매트한 브릭레드가 살짝 깜빡이기만 한다(아래 PEAK 배지도 같은 원칙).
function segmentColor(index: number, litCount: number): string {
  if (index >= litCount) return "bg-white/20";
  const ratio = index / SEGMENTS;
  if (ratio < 0.5) return "bg-[#7a9385]";
  if (ratio < 0.8) return "bg-[#b3a06a]";
  return "bg-[#a85d4f]";
}

export function VerticalVolumeMeter({ level }: { level: number }) {
  const isPeak = level >= 1;
  const clamped = Math.max(0, Math.min(1, level));
  const litCount = Math.max(clamped > 0 ? 1 : 0, Math.round(clamped * SEGMENTS));

  return (
    <div className="flex flex-col items-center gap-1.5">
      {isPeak && (
        <span className="flex animate-pulse items-center gap-0.5 rounded border border-[#a85d4f] px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-[#c98d7f]">
          <FlameIcon className="h-2.5 w-2.5" /> PEAK
        </span>
      )}
      <div className="flex h-28 w-3 flex-col-reverse gap-[3px] rounded-full bg-black/30 p-1 backdrop-blur">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className={`w-full flex-1 rounded-full transition-all duration-500 ${segmentColor(i, litCount)} ${
              isPeak && i >= SEGMENTS - 2 ? "animate-pulse" : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}
