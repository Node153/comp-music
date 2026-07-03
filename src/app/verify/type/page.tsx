"use client";

// S3 인증유형 선택 (AUTH-02)
import { useRouter } from "next/navigation";

export default function VerifyTypePage() {
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">어떤 유형으로 인증할까요?</h1>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => router.push("/verify/documents?type=student")}
          className="rounded border px-3 py-2 text-left"
        >
          전공생
        </button>
        <button
          onClick={() => router.push("/verify/documents?type=activist")}
          className="rounded border px-3 py-2 text-left"
        >
          활동자
        </button>
      </div>
    </main>
  );
}
