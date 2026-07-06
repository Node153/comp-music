"use client";

// S3 인증유형 선택 (AUTH-02)
import { useRouter } from "next/navigation";
import { pageTitle, mutedText } from "@/components/ui/styles";

const TYPE_OPTIONS = [
  { type: "student", icon: "🎓", title: "전공생", desc: "재학증명서·학생증·졸업증명서 등으로 인증" },
  { type: "activist", icon: "🎤", title: "활동자", desc: "음반발매·음원링크·공연포스터 등으로 인증" },
];

export default function VerifyTypePage() {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>어떤 유형으로 인증할까요?</h1>
        <p className={mutedText}>선택한 유형에 맞는 서류를 다음 화면에서 제출합니다</p>
      </div>
      <div className="flex flex-col gap-3">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.type}
            onClick={() => router.push(`/verify/documents?type=${option.type}`)}
            className="flex items-center gap-4 rounded-2xl border border-gray-200 p-4 text-left transition hover:border-black hover:bg-gray-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl">
              {option.icon}
            </span>
            <span className="flex flex-col">
              <span className="font-semibold text-gray-900">{option.title}</span>
              <span className="text-xs text-gray-500">{option.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
