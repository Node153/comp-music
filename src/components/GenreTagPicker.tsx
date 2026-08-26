"use client";

// 인증 서류 화면(가입 직후 필수 단계)에서 받는 "좋아하는 장르" — 정확히 3개 선택 강제.
// PositionTagPicker(무제한 다중 선택)와 톤은 같지만, 4개째부터는 선택 자체를 막고
// (먼저 하나를 빼야 새로 고를 수 있음) 안내 문구로 몇 개 남았는지 알려준다.
import { useState } from "react";
import { GENRE_TAGS } from "@/lib/genres";
import { label as labelClass } from "@/components/ui/styles";
import { XIcon } from "@/components/icons";

const REQUIRED_COUNT = 3;

function chipClass(active: boolean, disabled: boolean) {
  if (active)
    return "inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white transition";
  if (disabled) return "rounded-full bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-300";
  return "rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-200";
}

export function GenreTagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleTags = showAll ? GENRE_TAGS : GENRE_TAGS.slice(0, 16);
  const isFull = value.length >= REQUIRED_COUNT;

  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
      return;
    }
    if (isFull) return; // 3개 다 찼으면 새로 못 고름 — 먼저 하나를 빼야 함
    onChange([...value, tag]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>
        좋아하는 장르 <span className="font-normal text-gray-400">(정확히 3개)</span>
      </span>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button key={tag} type="button" onClick={() => toggle(tag)} className={chipClass(true, false)}>
              #{tag} <XIcon className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {visibleTags
          .filter((tag) => !value.includes(tag))
          .map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={isFull}
              onClick={() => toggle(tag)}
              className={chipClass(false, isFull)}
            >
              #{tag}
            </button>
          ))}
        {!showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-400 transition hover:text-gray-600"
          >
            더 보기 (+{GENRE_TAGS.length - 16})
          </button>
        )}
      </div>
      <p className="px-1 text-xs text-gray-400">{value.length}/{REQUIRED_COUNT}개 선택됨</p>
    </div>
  );
}
