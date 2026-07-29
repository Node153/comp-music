import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

// dark: 변형은 이 컴포넌트를 쓰는 화면이 다크 테마로 전환될 때(예: 업로드 폼의 Complex 선택,
// ThemeSync.tsx의 Complex 피드)를 대비한 것 — 평소 라이트 전용 화면에서는 절대 활성화되지 않는다.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-black text-white hover:bg-gray-800 disabled:hover:bg-black disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:disabled:hover:bg-white",
  secondary:
    "border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800",
  danger:
    "border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40",
  ghost: "text-gray-500 hover:text-gray-900 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-100",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    variant === "ghost"
      ? "text-sm font-medium transition"
      : "rounded-xl px-4 py-2.5 text-sm font-medium transition";

  return <button className={`${base} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />;
}
