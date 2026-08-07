"use client";

// S8 업로드 화면 (FEED-01, 02, 05, 07)
// Phase 0: 공개범위 UI 없음(visibility=public 고정), 예약 게시 없음(즉시 게시만) — 1.4
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadFileToR2 } from "@/lib/uploadToR2";
import { Button } from "@/components/ui/Button";
import { SoundbarPreview } from "@/components/SoundbarPreview";
import { InviteUserPicker, type PickedUser } from "@/components/InviteUserPicker";
import { field, label as labelClass, errorText, pageTitle, pageCard } from "@/components/ui/styles";
import { ALL_GENRES } from "@/lib/genres";
import type { ExpireHours } from "@/types/database";

const MIN_TAGS = 3;

// 게시하기 버튼에 랜덤으로 노출되는 사투리 문구 — SSR과 클라이언트의 Math.random 결과가
// 달라질 수밖에 없어서, 버튼 텍스트 span에 suppressHydrationWarning을 걸고 클라이언트 값을 쓴다.
const SUBMIT_PHRASES = [
  "그냥 해부러. 뭣 땜시 그라고 고민헌디?",
  "뭣 허고 있냐? 그냥 해부러라.",
  "아따, 그냥 질러부러! 뭘 그리 재고 있냐?",
  "뭐 하노? 그냥 해뿌라.",
  "마, 그냥 해라. 뭘 그리 고민하노?",
  "와 그라노? 그냥 질러라.",
  "그냥 혀~ 뭘 그리 고민혀.",
  "에이, 그냥 해버려유. 뭘 그려.",
  "그냥 혀유~ 될 겨.",
];

const EXPIRE_HOURS_OPTIONS: ExpireHours[] = [6, 12, 24, 48];

// TopNav의 피드 탭(♾️ demo / 🌀 Complex)과 동일한 개념 — 어느 피드로 게시할지 선택.
// 둘 다 실제 posts에 저장됨(0012_complex_access_and_chat) — Complex는 visibility로 구분되고
// 초대는 post_access, 채팅은 post_chat_messages에 별도로 쌓인다.
type UploadType = "demo" | "complex";

const UPLOAD_TYPE_OPTIONS: { value: UploadType; label: string; icon: string }[] = [
  { value: "demo", label: "DEMO", icon: "☀" },
  { value: "complex", label: "memo", icon: "☾" },
];

// demo = 전체공개·노출시간 영구(만료 없음) / Complex = 팔로워공개 or 특정 사람 초대공개·노출시간 필수설정.
// demo는 그래서 노출 시간 UI 자체가 없고, Complex만 아래 공개범위+노출시간을 요구한다.
// "specific"은 화면 표시용 값이고 실제 posts.visibility에는 "invite_only"로 저장한다(0012 —
// Phase 1의 "private"는 "나만 보기"에 가까운 다른 의미라 값을 분리해뒀음).
type ComplexVisibility = "followers" | "specific";
const COMPLEX_VISIBILITY_OPTIONS: { value: ComplexVisibility; label: string; icon: string }[] = [
  // "followers" 저장값은 0012 그대로 두고 의미만 Companion 공개로 재정의(0017_companions).
  { value: "followers", label: "Companion 공개", icon: "👥" },
  { value: "specific", label: "초대한 사람만", icon: "🔒" },
];
// posts.expire_hours는 not null 컬럼이라 demo(영구노출)에도 값이 필요하지만,
// 영구노출 여부는 expires_at(null)로만 판단하므로(feed/page.tsx 쿼리 참고) 이 값 자체는 화면에 노출되지 않는다.
const PERMANENT_POST_EXPIRE_HOURS_PLACEHOLDER: ExpireHours = 48;

// demo·Complex 둘 다 "영상 또는 음원 파일 하나 → MIME 타입으로 자동 판별"하는 같은 방식을 쓴다
// (0011_posts_audio_media_type). Complex 쪽은 아직 mock 미리보기라(위 주석 참고) 실제 저장은 안 됨.
type DetectedMediaKind = "video" | "audio";
const VIDEO_OR_AUDIO_ACCEPT = "video/mp4,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/x-wav";

function detectMediaKind(file: File): DetectedMediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

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

// 아래 dark: 조합은 Complex 선택 시 <html>에 .dark가 붙는 것에 반응하는 용도.
// 이 페이지 밖(예: /profile/manage)에도 재사용되는 공유 스타일(pageCard/labelClass/field)은
// 건드리지 않고, 여기서만 dark: 클래스를 덧붙여 확장한다.
// w-full: pageCard는 max-w만 있어서 카드 폭이 내용물 고유 너비를 따라간다 — 해시태그 검색으로
// 칩 목록이 줄면 폼 전체가 좁아지는 문제가 있어 이 페이지에서는 폭을 항상 max-w까지 고정.
const darkPageCard = `${pageCard} w-full dark:border-gray-800 dark:bg-gray-950`;
const darkLabel = `${labelClass} dark:text-gray-300`;
const darkField = `${field} dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-white dark:focus:ring-white`;
const darkErrorText = `${errorText} dark:text-red-400`;
const darkFileInput =
  "text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-400 dark:file:bg-gray-800 dark:file:text-gray-200 dark:hover:file:bg-gray-700";

function selectableButtonClass(active: boolean, base: string) {
  const colors = active
    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";
  return `${base} ${colors}`;
}

// 게시 유형 토글 전용 — DEMO(메인 화이트/포인트 옐로우) vs complex(메인 블랙/포인트 퍼플)를
// 다른 selectableButtonClass 사용처와 다르게 각자 고유 색으로 구분한다.
function uploadTypeButtonClass(value: UploadType, active: boolean, base: string) {
  if (!active) {
    return `${base} border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800`;
  }
  const colors =
    value === "complex"
      ? "border-violet-500 bg-black text-violet-300"
      : "border-yellow-400 bg-white text-yellow-600";
  return `${base} ${colors}`;
}

function chipButtonClass(active: boolean) {
  const colors = active
    ? "bg-black text-white dark:bg-white dark:text-black"
    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${colors}`;
}

// 파일 input을 감춘 큰 dropzone — 클릭·드래그앤드롭 둘 다 지원. 업로드 가능한 확장자를
// 박스 안에 나열해서 별도 라벨 없이 이 박스 하나로 파일 선택 UI를 대체한다.
const UPLOADABLE_FORMATS = "mp3 · wav · mp4 · mov";

function UploadDropbox({ file, onSelect }: { file: File | null; onSelect: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onSelect(e.dataTransfer.files?.[0] ?? null);
      }}
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
        dragOver
          ? "border-black bg-gray-50 dark:border-white dark:bg-gray-900"
          : "border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-900"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_OR_AUDIO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          onSelect(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {file && (
        <button
          type="button"
          aria-label="파일 제거"
          title="파일 제거"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ×
        </button>
      )}
      <span className="text-3xl" aria-hidden>
        ⬆
      </span>
      {file ? (
        <>
          <p className="max-w-full truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
            {file.name}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Click or drop to replace</p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">Upload</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{UPLOADABLE_FORMATS}</p>
        </>
      )}
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [uploadType, setUploadType] = useState<UploadType>("demo");

  // demo 전용 — 영상 또는 음원 파일 하나만 필수로 업로드, 종류는 자동 판별(Complex와 동일한 방식)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<DetectedMediaKind | null>(null);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);
  // posts.thumbnail_url(원래부터 있던 컬럼, 이제야 처음 사용)에 저장돼 피드에서 영상 poster/커버로 쓰인다.
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Complex 전용 — 영상 또는 음원 파일 하나만 필수로 업로드, 종류는 자동 판별
  const [complexFile, setComplexFile] = useState<File | null>(null);
  const [complexKind, setComplexKind] = useState<DetectedMediaKind | null>(null);

  const [caption, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [expireHours, setExpireHours] = useState<ExpireHours>(24);
  const [complexVisibility, setComplexVisibility] = useState<ComplexVisibility>("followers");
  const [inviteUsers, setInviteUsers] = useState<PickedUser[]>([]);
  // 협업 기능은 Complex 전용 — demo는 해시태그로 대체(사용자 지시: "complex에서는 해시태그 삭제 대신 협업기능 추가")
  const [collabAvailable, setCollabAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 미리보기 aside는 영상 업로드일 때만 나타나고, 버튼으로 접었다 폈다 할 수 있음(음원은 폼 안
  // 사운드바로 이미 충분해서 aside 자체가 안 뜸).
  const [previewOpen, setPreviewOpen] = useState(true);

  const [submitPhrase] = useState(
    () => SUBMIT_PHRASES[Math.floor(Math.random() * SUBMIT_PHRASES.length)],
  );

  // Complex 선택 시 피드의 Complex 탭(ThemeSync.tsx)과 동일하게 다크 테마로 전환.
  // ThemeSync는 URL(/feed?feed=complex)만 감시해서 이 페이지의 로컬 상태는 모르기 때문에
  // 별도로 처리 — 다른 화면으로 이동하면 ThemeSync가 그 라우트 기준으로 다시 correct하게 되돌려놓는다.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", uploadType === "complex");
  }, [uploadType]);

  // InviteUserPicker가 검색 결과에서 본인을 제외하는 데만 씀(초대 자체는 post_access RLS가
  // user_id<>auth.uid()로 어차피 막지만, 검색 결과에서부터 안 보이는 게 자연스럽다).
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [supabase]);

  // demo 음원 파일의 사운드바 재생용 object URL — Complex와 동일한 useMemo+cleanup-effect 패턴.
  const mediaObjectUrl = useMemo(() => (mediaFile ? URL.createObjectURL(mediaFile) : null), [mediaFile]);
  useEffect(() => {
    return () => {
      if (mediaObjectUrl) URL.revokeObjectURL(mediaObjectUrl);
    };
  }, [mediaObjectUrl]);

  // Complex 파일의 미리보기용 object URL — 파일이 바뀔 때마다 새로 계산하고, 예전 URL은 정리만 따로 한다
  // (setState를 effect 본문에서 동기 호출하지 않도록 useMemo로 값 계산과 정리를 분리).
  const complexObjectUrl = useMemo(
    () => (complexFile ? URL.createObjectURL(complexFile) : null),
    [complexFile],
  );
  useEffect(() => {
    return () => {
      if (complexObjectUrl) URL.revokeObjectURL(complexObjectUrl);
    };
  }, [complexObjectUrl]);

  function handleUploadTypeChange(next: UploadType) {
    setUploadType(next);
  }

  async function handleFileChange(file: File | null) {
    setMediaFile(file);
    setDurationWarning(null);
    setCoverFile(null);
    const kind = file ? detectMediaKind(file) : null;
    setMediaKind(kind);
    if (file && kind === "video") {
      const duration = await readVideoDuration(file);
      if (duration > SOFT_MAX_DURATION_SECONDS) {
        setDurationWarning(
          `영상 길이가 ${Math.round(duration)}초입니다. 권장 길이(${SOFT_MAX_DURATION_SECONDS}초)를 초과했어요.`,
        );
      }
    }
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCoverFile(e.target.files?.[0] ?? null);
  }

  function handleComplexFileChange(file: File | null) {
    setComplexFile(file);
    setComplexKind(file ? detectMediaKind(file) : null);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  // 검색창이 직접 입력을 겸한다 — Enter/추가를 누르면 입력한 텍스트가 그대로 태그로 추가됨.
  function addCustomTag() {
    const tag = tagSearch.trim().replace(/^#/, "");
    if (!tag) return;
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagSearch("");
  }

  const filteredGenres = ALL_GENRES.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.trim().toLowerCase()),
  );

  // demo·Complex 둘 다 영상일 때만 옆 미리보기 aside를 씀(음원은 폼 안 사운드바로 충분).
  const previewVideoSrc =
    uploadType === "demo"
      ? mediaKind === "video"
        ? mediaObjectUrl
        : null
      : complexKind === "video"
        ? complexObjectUrl
        : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (uploadType === "complex") {
      if (!complexFile || !complexKind) {
        setError("음원(mp3/wav) 또는 영상 파일을 업로드해주세요.");
        return;
      }
      if (complexVisibility === "specific" && inviteUsers.length === 0) {
        setError("초대할 사람을 최소 1명 선택해주세요.");
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

      let complexMediaPath: string;
      try {
        complexMediaPath = await uploadFileToR2(complexFile);
      } catch (err) {
        setError(`업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
        setLoading(false);
        return;
      }

      const publishedAt = new Date();
      const expiresAt = new Date(publishedAt.getTime() + expireHours * 60 * 60 * 1000);

      const { data: complexPost, error: complexInsertError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          media_type: complexKind,
          video_url: complexKind === "video" ? complexMediaPath : null,
          image_url: null,
          audio_url: complexKind === "audio" ? complexMediaPath : null,
          caption: caption || null,
          visibility: complexVisibility === "specific" ? "invite_only" : "followers",
          collab_available: collabAvailable,
          collab_role_needed: null,
          status: "published",
          published_at: publishedAt.toISOString(),
          expire_hours: expireHours,
          expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();

      if (complexInsertError || !complexPost) {
        setError(`게시 실패: ${complexInsertError?.message ?? "알 수 없는 오류"}`);
        setLoading(false);
        return;
      }

      // 특정인 초대 — post_access에 invited 상태로 일괄 등록(0012). 초대 인원별로 DB row 하나씩,
      // (post_id,user_id) unique라 중복 선택은 InviteUserPicker에서 이미 걸러짐.
      if (complexVisibility === "specific" && inviteUsers.length > 0) {
        const { error: accessError } = await supabase.from("post_access").insert(
          inviteUsers.map((invitee) => ({
            post_id: complexPost.id,
            user_id: invitee.id,
            status: "invited" as const,
          })),
        );
        if (accessError) {
          setError(`게시는 됐지만 초대 등록에 실패했어요: ${accessError.message}`);
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      router.push("/feed?feed=complex");
      return;
    }

    if (!mediaFile || !mediaKind) {
      setError("영상 또는 음원(mp3/wav)을 업로드해주세요.");
      return;
    }
    if (selectedTags.length < MIN_TAGS) {
      setError(`해시태그를 최소 ${MIN_TAGS}개 선택해주세요.`);
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

    // R2로 이전(2026-07-29) — presigned PUT URL을 발급받아 브라우저가 R2에 직접 업로드.
    let mediaPath: string;
    try {
      mediaPath = await uploadFileToR2(mediaFile);
    } catch (err) {
      setError(`업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      setLoading(false);
      return;
    }

    // 선택적으로 커버 이미지를 같이 올려서 thumbnail_url(원래 있던 미사용 컬럼)에 저장한다.
    let thumbnailPath: string | null = null;
    if (coverFile) {
      try {
        thumbnailPath = await uploadFileToR2(coverFile);
      } catch (err) {
        setError(`커버 이미지 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
        setLoading(false);
        return;
      }
    }

    const publishedAt = new Date();

    // demo(전체공개)는 노출시간 영구 — expires_at을 null로 둬야 피드 쿼리에서 만료 취급을 안 한다.
    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        media_type: mediaKind,
        video_url: mediaKind === "video" ? mediaPath : null,
        image_url: null,
        audio_url: mediaKind === "audio" ? mediaPath : null,
        thumbnail_url: thumbnailPath,
        caption: caption || null,
        instrument_tags: selectedTags,
        status: "published",
        published_at: publishedAt.toISOString(),
        expire_hours: PERMANENT_POST_EXPIRE_HOURS_PLACEHOLDER,
        expires_at: null,
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
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 md:flex-row md:items-start md:justify-center">
      <main className={`${darkPageCard} flex flex-col gap-6 md:mx-0 md:shrink-0`}>
        {/* 스티커처럼 살짝 기울인 하드 섀도우 박스 — DEMO(옐로우)/memo(바이올렛) 포인트 컬러를 따라간다. */}
        <h1
          className={`${pageTitle} mx-auto w-fit -rotate-2 rounded-xl border-2 border-black bg-yellow-300 px-5 py-2 shadow-[4px_4px_0_0_#000] transition-colors dark:border-violet-400 dark:bg-black dark:text-violet-300 dark:shadow-[4px_4px_0_0_#7c3aed]`}
        >
          Drop Zone
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={darkLabel}>게시 유형</span>
            <div className="grid grid-cols-2 gap-2">
              {UPLOAD_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUploadTypeChange(option.value)}
                  className={uploadTypeButtonClass(
                    option.value,
                    uploadType === option.value,
                    "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition",
                  )}
                >
                  <span className="text-base">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
            {uploadType === "complex" ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                memo는 Companion공개 또는 특정인초대로만 게시돼요. 노출 시간이 지나면 자동으로
                피드에서 사라집니다.
              </p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                DEMO는 전체공개로 게시돼요. 노출 시간 제한 없이 피드에 영구 노출됩니다.
              </p>
            )}
          </div>

          {uploadType === "demo" ? (
            <div className="flex flex-col gap-1.5">
              <span className={darkLabel}>업로드</span>
              <UploadDropbox file={mediaFile} onSelect={handleFileChange} />
              {mediaFile && !mediaKind && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  영상/음원 형식이 아니에요. mp4·mov 영상이나 mp3·wav 음원 파일을 선택해주세요.
                </p>
              )}
              {durationWarning && (
                <p className="text-sm text-amber-600 dark:text-amber-400">{durationWarning}</p>
              )}
              {mediaFile && mediaKind === "video" && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="hidden self-start text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 md:inline"
                >
                  {previewOpen ? "미리보기 접기 ▲" : "미리보기 펼치기 ▼"}
                </button>
              )}
              {mediaFile && mediaKind === "audio" && mediaObjectUrl && (
                <SoundbarPreview
                  key={`${mediaFile.name}-${mediaFile.size}-${mediaFile.lastModified}`}
                  file={mediaFile}
                  src={mediaObjectUrl}
                />
              )}
              {mediaFile && mediaKind && (
                <>
                  <span className={darkLabel}>커버 이미지 (선택)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCoverChange}
                    className={darkFileInput}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className={darkLabel}>업로드</span>
              <UploadDropbox file={complexFile} onSelect={handleComplexFileChange} />
              {complexFile && !complexKind && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  영상/음원 형식이 아니에요. mp4·mov 영상이나 mp3·wav 음원 파일을 선택해주세요.
                </p>
              )}
              {complexFile && complexKind === "video" && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="hidden self-start text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 md:inline"
                >
                  {previewOpen ? "미리보기 접기 ▲" : "미리보기 펼치기 ▼"}
                </button>
              )}
              {complexFile && complexKind === "audio" && complexObjectUrl && (
                <SoundbarPreview
                  key={`${complexFile.name}-${complexFile.size}-${complexFile.lastModified}`}
                  file={complexFile}
                  src={complexObjectUrl}
                />
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className={darkLabel}>캡션</span>
            <textarea
              placeholder="어떤 작업물인가요?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className={darkField}
            />
          </div>

          {uploadType === "demo" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className={darkLabel}>해시태그</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {selectedTags.length}/{MIN_TAGS}개 이상 선택
                </span>
              </div>

              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
                    >
                      #{tag}
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="해시태그 검색 또는 직접 입력"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  className={darkField}
                />
                <Button type="button" onClick={addCustomTag} className="shrink-0 px-4">
                  추가
                </Button>
              </div>
              {/* 예전엔 훑어보는 용도로 자동 무한 스크롤(marquee)했는데, 항목이 계속 움직이면
                  원하는 태그를 클릭하기 불편하다는 피드백으로 고정 목록 + 수동 스크롤로 변경. */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                {filteredGenres.length === 0 ? (
                  <p className="py-2 text-sm text-gray-400 dark:text-gray-500">
                    일치하는 해시태그가 없어요. Enter나 추가 버튼으로 그대로 추가할 수 있어요.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {filteredGenres.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={chipButtonClass(selectedTags.includes(tag))}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DEMO 안내는 게시 유형 바로 아래 설명글로 통합 — 여기는 memo 전용 설정만 남김. */}
          {uploadType === "complex" && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={darkLabel}>공개 범위</span>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLEX_VISIBILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setComplexVisibility(option.value)}
                      className={selectableButtonClass(
                        complexVisibility === option.value,
                        "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                      )}
                    >
                      <span className="text-base">{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {complexVisibility === "specific" && (
                <div className="flex flex-col gap-1.5">
                  <span className={darkLabel}>초대할 사람</span>
                  <InviteUserPicker
                    currentUserId={currentUserId ?? ""}
                    value={inviteUsers}
                    onChange={setInviteUsers}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <span className={darkLabel}>노출 시간</span>
                <div className="grid grid-cols-4 gap-2">
                  {EXPIRE_HOURS_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setExpireHours(h)}
                      className={selectableButtonClass(
                        expireHours === h,
                        "rounded-xl border px-2 py-2 text-sm font-medium transition",
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 text-sm dark:border-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={collabAvailable}
                  onChange={(e) => setCollabAvailable(e.target.checked)}
                  className="h-4 w-4 accent-black dark:accent-white"
                />
                공동창작
              </label>
              <p className="-mt-1 px-1 text-xs text-gray-400 dark:text-gray-500">
                Companion이 음원을 스택처럼 이어 쌓으며 함께 곡을 만들 수 있어요.
              </p>
            </>
          )}

          {error && <p className={darkErrorText}>{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "게시 중..." : <span suppressHydrationWarning>{submitPhrase}</span>}
          </Button>
        </form>
      </main>

      {previewVideoSrc && (
        <aside
          className={`hidden shrink-0 overflow-hidden transition-all duration-300 ease-in-out md:sticky md:top-20 md:flex ${
            previewOpen ? "md:w-[560px] md:opacity-100" : "md:w-0 md:opacity-0"
          }`}
        >
          <div className="flex w-[560px] shrink-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <span className={darkLabel}>미리보기</span>
            <video src={previewVideoSrc} controls muted className="w-full rounded-xl" />
          </div>
        </aside>
      )}
    </div>
  );
}
