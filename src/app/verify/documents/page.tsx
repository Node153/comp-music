"use client";

// S4 인증서류 업로드 (AUTH-03)
// 전공생: 재학증명서/학생증/졸업증명서, 활동자: 음반발매·음원링크·공연포스터·크레딧
// 파일당 10MB 제한(이미지/PDF), 최소 1종 이상 필수. 제출 후 verifications row 생성(status=pending) → /status
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, errorText, pageTitle, mutedText, card } from "@/components/ui/styles";
import type { UserType } from "@/types/database";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const DOC_TYPE_OPTIONS: Record<UserType, { value: string; label: string; isUrl?: boolean }[]> = {
  student: [
    { value: "transcript", label: "재학증명서" },
    { value: "student_id", label: "학생증" },
    { value: "diploma", label: "졸업증명서" },
  ],
  activist: [
    { value: "release", label: "음반발매 증빙" },
    { value: "music_link", label: "음원링크", isUrl: true },
    { value: "poster", label: "공연포스터" },
    { value: "credit", label: "크레딧 증빙" },
  ],
};

type DocRow = { docType: string; file: File | null; url: string };

function VerifyDocumentsForm() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const userType: UserType = typeParam === "activist" ? "activist" : "student";
  const options = DOC_TYPE_OPTIONS[userType];

  const [rows, setRows] = useState<DocRow[]>([
    { docType: options[0].value, file: null, url: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!typeParam) router.replace("/verify/type");
  }, [typeParam, router]);

  if (!typeParam) return null;

  function updateRow(index: number, patch: Partial<DocRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { docType: options[0].value, file: null, url: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const filled = rows.filter((row) => row.file || row.url.trim());
    if (filled.length === 0) {
      setError("최소 1종 이상의 서류를 제출해야 합니다.");
      return;
    }
    if (filled.some((row) => row.file && row.file.size > MAX_FILE_SIZE)) {
      setError("파일당 10MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const documents: { doc_type: string; file_url: string }[] = [];

    for (const row of filled) {
      if (row.file) {
        const path = `${user.id}/${Date.now()}-${row.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("verification-documents")
          .upload(path, row.file);
        if (uploadError) {
          setError(`업로드 실패: ${uploadError.message}`);
          setLoading(false);
          return;
        }
        documents.push({ doc_type: row.docType, file_url: path });
      } else {
        documents.push({ doc_type: row.docType, file_url: row.url.trim() });
      }
    }

    const { error: insertError } = await supabase.from("verifications").insert({
      user_id: user.id,
      type: userType,
      documents,
    });

    setLoading(false);

    if (insertError) {
      setError(`제출 실패: ${insertError.message}`);
      return;
    }

    router.push("/status");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>인증 서류 업로드</h1>
        <p className={mutedText}>
          {userType === "student" ? "전공생" : "활동자"} 인증 — 최소 1종 이상 제출
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {rows.map((row, i) => {
          const option = options.find((o) => o.value === row.docType) ?? options[0];
          return (
            <div key={i} className={`flex flex-col gap-2 ${card}`}>
              <select
                value={row.docType}
                onChange={(e) => updateRow(i, { docType: e.target.value, file: null, url: "" })}
                className={field}
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {option.isUrl ? (
                <input
                  key="url"
                  type="url"
                  placeholder="https://..."
                  value={row.url}
                  onChange={(e) => updateRow(i, { url: e.target.value })}
                  className={field}
                />
              ) : (
                <input
                  key="file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => updateRow(i, { file: e.target.files?.[0] ?? null })}
                  className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
              )}
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="self-end text-xs text-gray-400 hover:text-red-600"
                >
                  삭제
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={addRow}
          className="rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-400 hover:bg-gray-50"
        >
          + 서류 추가
        </button>
        {error && <p className={errorText}>{error}</p>}
        <Button type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? "제출 중..." : "제출하기"}
        </Button>
      </form>
    </main>
  );
}

export default function VerifyDocumentsPage() {
  return (
    <Suspense fallback={null}>
      <VerifyDocumentsForm />
    </Suspense>
  );
}
