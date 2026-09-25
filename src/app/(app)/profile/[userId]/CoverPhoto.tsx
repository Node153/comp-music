"use client";

// 프로필 커버 사진(0075, 페이스북 프로필 참고 — 사용자 요청). 예전엔 자리만 예약한 flat
// 플레이스홀더였다. 업로드는 프로필 사진(ProfilePhotoForm)과 같은 방식: R2에 올리고
// profiles.cover_image_url에 key만 upsert, 표시는 /api/cover/[userId]. 본인이 바꾼 직후엔
// ?v=로 매번 다른 URL을 써서 그 라우트의 max-age 캐시와 무관하게 새 사진이 바로 보인다.
// 커버가 없을 땐 페이스북처럼 아래쪽이 살짝 어두워지는 회색 그라데이션만 둔다.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import { PROFILE_COVER_MAX_SIDE, resizeImageFile } from "@/lib/resizeImage";
import { CameraIcon, TrashIcon } from "@/components/icons";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

export function CoverPhoto({
  userId,
  hasCover,
  isOwnProfile,
}: {
  userId: string;
  hasCover: boolean;
  isOwnProfile: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(0);
  const [showCover, setShowCover] = useState(hasCover);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(key: string | null) {
    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, cover_image_url: key }, { onConflict: "user_id" });
    if (updateError) throw updateError;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 올릴 수 있어요.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      // 올리기 전에 긴 변 1600px로 줄인다(resizeImage.ts — 커버 트래픽 절감). 용량 제한은 줄인 뒤 결과에.
      const resized = await resizeImageFile(file, { maxSide: PROFILE_COVER_MAX_SIDE });
      if (resized.size > MAX_FILE_SIZE_BYTES) {
        setError("파일이 너무 커요 (최대 8MB).");
        return;
      }
      await save(await uploadFileToR2(resized));
      setShowCover(true);
      setVersion((v) => v + 1);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("커버 사진을 삭제할까요?")) return;
    setUploading(true);
    setError(null);
    try {
      await save(null);
      setShowCover(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    // pageCard의 p-6 패딩을 음수 마진으로 상쇄해 카드 가장자리까지 꽉 채운다(데스크톱은
    // 카드 위쪽 둥근 모서리를 따라감).
    <div className="relative -mx-6 -mt-6 h-40 overflow-hidden bg-box-gray sm:h-56 md:h-[300px] md:rounded-t-lg">
      {showCover ? (
        <img
          key={version}
          src={`/api/cover/${userId}${version ? `?v=${version}` : ""}`}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setShowCover(false)}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-b from-box-gray from-45% to-active-gray/35" />
      )}

      {isOwnProfile && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {showCover && (
            <button
              type="button"
              disabled={uploading}
              onClick={handleRemove}
              aria-label="커버 사진 삭제"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-black shadow-sm transition hover:opacity-80 disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-black shadow-sm transition hover:opacity-80 disabled:opacity-50"
          >
            <CameraIcon className="h-4 w-4" />
            {uploading ? "업로드 중..." : showCover ? "커버 사진 변경" : "커버 사진 추가"}
          </button>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>
      )}
      {error && (
        <p className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
