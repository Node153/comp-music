"use client";

// 프로필 필드별 "공개" 체크박스 — ProfileDetailsForm(프로필 수정)과 verify/documents(가입 인증
// 단계) 둘 다에서 같은 필드(학교 등)를 다루므로 공유한다.
export function VisibilityToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-black"
      />
      공개
    </label>
  );
}
