import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-black text-white hover:bg-gray-800 disabled:hover:bg-black disabled:opacity-50",
  secondary:
    "border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-50",
  danger:
    "border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50",
  ghost: "text-gray-500 hover:text-gray-900 disabled:opacity-50",
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
