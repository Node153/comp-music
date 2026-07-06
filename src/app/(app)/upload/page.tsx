"use client";

// S8 업로드 화면 (FEED-01, 02, 05, 07)
// Phase 0: 공개범위 UI 없음(visibility=public 고정), 예약 게시 없음(즉시 게시만) — 1.4
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ContentType, ExpireHours } from "@/types/database";

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "composition", label: "작곡" },
  { value: "performance", label: "연주" },
  { value: "practice", label: "연습" },
  { value: "rehearsal", label: "리허설" },
  { value: "improv", label: "즉흥" },
  { value: "ensemble", label: "합주" },
];

const EXPIRE_HOURS_OPTIONS: ExpireHours[] = [6, 12, 24, 48];

// FEED-01: 임시값(60초), 확정 필요 — 넘어도 업로드는 막지 않고 경고만 표시
const SOFT_MAX_DURATION_SECONDS = 60;

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [instrumentTagsInput, setInstrumentTagsInput] = useState("");
  const [expireHours, setExpireHours] = useState<ExpireHours>(24);
  const [collabAvailable, setCollabAvailable] = useState(false);
  const [collabRoleNeeded, setCollabRoleNeeded] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setVideoFile(file);
    setDurationWarning(null);
    if (file) {
      const duration = await readVideoDuration(file);
      if (duration > SOFT_MAX_DURATION_SECONDS) {
        setDurationWarning(
          `영상 길이가 ${Math.round(duration)}초입니다. 권장 길이(${SOFT_MAX_DURATION_SECONDS}초)를 초과했어요.`,
        );
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const instrumentTags = instrumentTagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!videoFile) {
      setError("영상을 선택해주세요.");
      return;
    }
    if (!contentType) {
      setError("콘텐츠 유형을 선택해주세요.");
      return;
    }
    if (instrumentTags.length === 0) {
      setError("악기 태그를 최소 1개 입력해주세요.");
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

    const videoPath = `${user.id}/${Date.now()}-${videoFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("posts")
      .upload(videoPath, videoFile);

    if (uploadError) {
      setError(`업로드 실패: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + expireHours * 60 * 60 * 1000);

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        video_url: videoPath,
        caption: caption || null,
        content_type: contentType,
        instrument_tags: instrumentTags,
        collab_available: collabAvailable,
        collab_role_needed: collabAvailable ? collabRoleNeeded || null : null,
        status: "published",
        published_at: publishedAt.toISOString(),
        expire_hours: expireHours,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    setLoading(false);

    if (insertError || !post) {
      setError(`게시 실패: ${insertError?.message ?? "알 수 없는 오류"}`);
      return;
    }

    router.push("/feed");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 p-6 pb-20">
      <h1 className="text-xl font-semibold">영상 업로드</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="file"
          accept="video/mp4,video/quicktime"
          onChange={handleVideoChange}
          className="rounded border px-3 py-2"
        />
        {durationWarning && <p className="text-sm text-amber-600">{durationWarning}</p>}

        <textarea
          placeholder="캡션"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="rounded border px-3 py-2"
        />

        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value as ContentType)}
          className="rounded border px-3 py-2"
        >
          <option value="" disabled>
            콘텐츠 유형
          </option>
          {CONTENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="악기 태그 (쉼표로 구분, 예: 피아노, 보컬)"
          value={instrumentTagsInput}
          onChange={(e) => setInstrumentTagsInput(e.target.value)}
          className="rounded border px-3 py-2"
        />

        <select
          value={expireHours}
          onChange={(e) => setExpireHours(Number(e.target.value) as ExpireHours)}
          className="rounded border px-3 py-2"
        >
          {EXPIRE_HOURS_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h}시간
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={collabAvailable}
            onChange={(e) => setCollabAvailable(e.target.checked)}
          />
          협업 구함
        </label>
        {collabAvailable && (
          <input
            type="text"
            placeholder="찾는 역할 (예: 보컬)"
            value={collabRoleNeeded}
            onChange={(e) => setCollabRoleNeeded(e.target.value)}
            className="rounded border px-3 py-2"
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? "게시 중..." : "게시하기"}
        </button>
      </form>
    </main>
  );
}
