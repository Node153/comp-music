"use client";

// 배경음악 업로드/제거 — R2에 올린 뒤 그 key를 site_settings(login_bgm_key)에 저장하는 것까지가
// 이 폼의 일. RLS(site_settings_write_admin)가 관리자만 쓸 수 있게 이미 막아주므로, 여기서는
// 별도 권한 검사 없이 이 화면 자체가 /admin(proxy.ts, role=admin) 아래에 있다는 것만 믿는다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import { Button } from "@/components/ui/Button";
import { errorText, mutedText } from "@/components/ui/styles";

const BGM_SETTING_KEY = "login_bgm_key";
const ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav";
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export function BgmUploadForm({
  adminUserId,
  currentPreviewUrl,
  currentUpdatedAt,
}: {
  adminUserId: string;
  currentPreviewUrl: string | null;
  currentUpdatedAt: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setError("오디오 파일(mp3, wav)만 올릴 수 있어요.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`파일이 너무 커요 (최대 ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB).`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const key = await uploadFileToR2(file);
      const { error: upsertError } = await supabase.from("site_settings").upsert({
        key: BGM_SETTING_KEY,
        value: key,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("배경음악을 제거하고 기본 곡으로 되돌릴까요?")) return;
    setUploading(true);
    setError(null);
    const { error: deleteError } = await supabase.from("site_settings").delete().eq("key", BGM_SETTING_KEY);
    setUploading(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
      {currentPreviewUrl ? (
        <div className="flex flex-col gap-2">
          <span className={mutedText}>
            현재 곡{currentUpdatedAt && ` · ${new Date(currentUpdatedAt).toLocaleString("ko-KR")} 업데이트`}
          </span>
          <audio controls src={currentPreviewUrl} className="w-full" />
        </div>
      ) : (
        <p className={mutedText}>아직 올린 곡이 없어요 — 로그인 화면엔 기본 데모 트랙이 재생돼요.</p>
      )}

      <div className="flex items-center gap-2">
        <label className="cursor-pointer">
          <span
            className={`inline-flex rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              uploading ? "cursor-not-allowed bg-gray-100 text-gray-400" : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            {uploading ? "업로드 중..." : "새 곡 올리기"}
          </span>
          <input type="file" accept={ACCEPT} onChange={handleFileChange} disabled={uploading} className="hidden" />
        </label>
        {currentPreviewUrl && (
          <Button type="button" variant="danger" onClick={handleRemove} disabled={uploading}>
            제거
          </Button>
        )}
      </div>

      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
