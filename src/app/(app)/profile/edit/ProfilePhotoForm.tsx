"use client";

// 프로필 사진 업로드 — profiles.profile_image_url(0001부터 있던 컬럼, 지금까지 아무 화면도
// 안 씀)에 R2 key를 저장한다. 실제 표시는 /api/avatar/[userId] + <Avatar>가 앱 전체에서
// 공통으로 처리하므로, 여기서는 업로드/제거만 하면 된다.
// upsert가 아니라 update만 쓴다 — profiles.user_type이 not null이라 upsert가 새 행을 만들 땐
// 그 값을 같이 줘야 하는데 여긴 모른다. verify/documents에서 이미 행을 만들어두므로(예외:
// 서류 없이 SQL로 바로 승인된 파일럿 테스터는 행이 없을 수 있음 — 이 경우 update가 조용히
// 아무 일도 안 하고 넘어간다) 정상 사용자는 문제없다.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import { Avatar } from "@/components/Avatar";
import { label, errorText } from "@/components/ui/styles";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function ProfilePhotoForm() {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [photoVersion, setPhotoVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: row } = await supabase.from("users").select("name").eq("id", data.user.id).single();
      if (row?.name) setName(row.name);
    });
  }, [supabase]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("파일이 너무 커요 (최대 5MB).");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const key = await uploadFileToR2(file);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_image_url: key })
        .eq("user_id", userId);
      if (updateError) throw updateError;
      setPhotoVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!userId) return;
    setUploading(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ profile_image_url: null })
      .eq("user_id", userId);
    setUploading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPhotoVersion((v) => v + 1);
  }

  if (!userId) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className={label}>프로필 사진</span>
      <div className="flex items-center gap-3">
        <Avatar key={photoVersion} userId={userId} name={name || "?"} className="h-16 w-16 text-xl" />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "사진 바꾸기"}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={handleRemove}
            className="rounded-xl px-3.5 py-2 text-sm text-gray-400 transition hover:text-red-600 disabled:opacity-50"
          >
            제거
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
