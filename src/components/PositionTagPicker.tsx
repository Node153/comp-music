"use client";

// 프로필 "포지션(무엇을 하는 사람인지)" 다중 선택 칩 — 업로드 폼 해시태그 칩과 같은 톤.
// 자유 텍스트 "전공"을 없애고 이걸로 대체(profiles.instruments 컬럼에 저장).
import { useState } from "react";
import { ROLE_TAGS } from "@/lib/genres";
import { label as labelClass } from "@/components/ui/styles";

function chipClass(active: boolean) {
  const colors = active
    ? "bg-black text-white"
    : "bg-gray-100 text-gray-600 hover:bg-gray-200";
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${colors}`;
}

export function PositionTagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleTags = showAll ? ROLE_TAGS : ROLE_TAGS.slice(0, 16);

  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>포지션</span>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button key={tag} type="button" onClick={() => toggle(tag)} className={chipClass(true)}>
              #{tag} ✕
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {visibleTags
          .filter((tag) => !value.includes(tag))
          .map((tag) => (
            <button key={tag} type="button" onClick={() => toggle(tag)} className={chipClass(false)}>
              #{tag}
            </button>
          ))}
        {!showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-400 transition hover:text-gray-600"
          >
            더 보기 (+{ROLE_TAGS.length - 16})
          </button>
        )}
      </div>
    </div>
  );
}
