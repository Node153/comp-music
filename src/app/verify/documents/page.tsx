"use client";

// S4 인증서류 업로드 (AUTH-03)
// ⚠️ 서류 심사는 DOCUMENT_VERIFICATION_ENABLED=false로 임시로 꺼져있다(2026-08-19, 사용자
// 요청 — "추후에 진행할 것"). 꺼진 상태에서는 이 화면이 프로필 정보(학교/포지션/장르)만 받고
// /api/verify/skip-review로 즉시 승인시킨다. 아래 서류 업로드 관련 로직은 지우지 않고 그대로
// 남겨뒀으니, 다시 켤 땐 플래그만 true로 바꾸면 된다.
// 전공생: 재학증명서/학생증/졸업증명서, 활동자: 음반발매·음원링크·공연포스터·크레딧
// 파일당 10MB 제한(이미지/PDF), 최소 1종 이상 필수. 제출 후 verifications row 생성(status=pending) → /status
// 학교/포지션/좋아하는 장르도 여기서 같이 받는다 — 프로필 수정 화면은 가입 이후 아무도
// 자발적으로 안 들어가서(ProfileDetailsForm.tsx 참고) 필수로 거치는 이 단계에 붙여야 실제로
// 채워진다. profiles 행은 verifications insert와 별개로 upsert(둘 다 같은 currentUser
// 트랜잭션은 아니지만, 실패해도 인증 제출 자체는 막지 않도록 별도 처리) — 단, 좋아하는
// 장르는 정확히 3개를 요구하는 명시적 요구사항이라 이것만 예외적으로 제출 전 필수 검증한다
// (school/instruments처럼 빈 채로 넘어가는 게 허용 안 됨).
// 회원가입(/signup)이 아니라 여기서 받는 이유: 가입 시점엔 아직 user_type을 안 정했고
// (profiles.user_type not null이라 그 전엔 행 자체를 못 만듦) 이메일 확인 대기 중이면
// 세션도 없어서 RLS insert가 안 된다.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PositionTagPicker } from "@/components/PositionTagPicker";
import { GenreTagPicker } from "@/components/GenreTagPicker";
import { field, label, errorText, pageTitle, mutedText, card } from "@/components/ui/styles";
import type { UserType } from "@/types/database";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ⚠️ 임시 조치(2026-08-19, 사용자 요청) — "추후에 진행할 것"이라 서류 업로드/심사 코드는
// 지우지 않고 이 플래그로만 껐다. 다시 켤 땐 true로 바꾸면 끝 — 아래 로직이 전부 그 경우를
// 그대로 지원한다. 꺼진 상태에서는: 서류 업로드 UI 자체를 안 보여주고, verifications 행도
// 안 만들고, 제출 즉시 /api/verify/skip-review로 바로 승인 처리 후 /feed로 보낸다.
const DOCUMENT_VERIFICATION_ENABLED = false;

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
  const [school, setSchool] = useState("");
  const [instruments, setInstruments] = useState<string[]>([]);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
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

    if (favoriteGenres.length !== 3) {
      setError("좋아하는 장르를 정확히 3개 선택해주세요.");
      return;
    }

    if (DOCUMENT_VERIFICATION_ENABLED) {
      const filled = rows.filter((row) => row.file || row.url.trim());
      if (filled.length === 0) {
        setError("최소 1종 이상의 서류를 제출해야 합니다.");
        return;
      }
      if (filled.some((row) => row.file && row.file.size > MAX_FILE_SIZE)) {
        setError("파일당 10MB 이하만 업로드할 수 있습니다.");
        return;
      }
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

    if (DOCUMENT_VERIFICATION_ENABLED) {
      const uploaded: { doc_type: string; file_url: string }[] = [];

      for (const row of rows.filter((row) => row.file || row.url.trim())) {
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
          uploaded.push({ doc_type: row.docType, file_url: path });
        } else {
          uploaded.push({ doc_type: row.docType, file_url: row.url.trim() });
        }
      }

      const { error: insertError } = await supabase.from("verifications").insert({
        user_id: user.id,
        type: userType,
        documents: uploaded,
      });

      if (insertError) {
        setLoading(false);
        setError(`제출 실패: ${insertError.message}`);
        return;
      }
    }

    // 학교/포지션은 프로필 노출용 부가 정보라 여기서 실패해도 인증 제출 자체는 막지 않는다.
    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        user_type: userType,
        school: school.trim() || null,
        instruments: instruments.length > 0 ? instruments : null,
        favorite_genres: favoriteGenres,
      },
      { onConflict: "user_id" },
    );

    if (DOCUMENT_VERIFICATION_ENABLED) {
      setLoading(false);
      router.push("/status");
      return;
    }

    // 서류 심사 없이 즉시 승인(임시 조치) — service-role이 필요해 서버 라우트를 거친다.
    const skipRes = await fetch("/api/verify/skip-review", { method: "POST" });
    setLoading(false);
    if (!skipRes.ok) {
      const body = await skipRes.json().catch(() => ({}));
      setError(body.error ?? "승인 처리에 실패했어요. 다시 시도해주세요.");
      return;
    }
    router.push("/feed");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>{DOCUMENT_VERIFICATION_ENABLED ? "인증 서류 업로드" : "프로필 정보 입력"}</h1>
        <p className={mutedText}>
          {userType === "student" ? "전공생" : "활동자"}
          {DOCUMENT_VERIFICATION_ENABLED ? " 인증 — 최소 1종 이상 제출" : ""}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className={`flex flex-col gap-4 ${card}`}>
          <div className="flex flex-col gap-1.5">
            <span className={label}>{userType === "activist" ? "출신 학교 (선택)" : "학교"}</span>
            <input
              type="text"
              placeholder="학교명"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className={field}
            />
          </div>
          <PositionTagPicker value={instruments} onChange={setInstruments} />
          <GenreTagPicker value={favoriteGenres} onChange={setFavoriteGenres} />
        </div>
        {DOCUMENT_VERIFICATION_ENABLED && (
          <>
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
          </>
        )}
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
