"use client";

// S8 업로드 화면 (FEED-01, 02, 05, 07)
// Phase 0: 공개범위 UI 없음(visibility=public 고정), 예약 게시 없음(즉시 게시만) — 1.4
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { SoundbarPreview } from "@/components/SoundbarPreview";
import { field, label as labelClass, errorText, pageTitle, pageCard } from "@/components/ui/styles";
import { ALL_GENRES } from "@/lib/genres";
import type { ExpireHours } from "@/types/database";

const MIN_TAGS = 3;

const EXPIRE_HOURS_OPTIONS: ExpireHours[] = [6, 12, 24, 48];

// TopNav의 피드 탭(♾️ demo / 🌀 Complex)과 동일한 개념 — 어느 피드로 게시할지 선택.
// Complex는 초대·채팅·비공개 게시물이 아직 실제 DB에 없어(feed/page.tsx 참고, 100% mock)
// 여기서도 실제 저장 없이 미리보기만 제공한다. 실제 연동은 데이터 연결 단계에서 진행.
type UploadType = "demo" | "complex";

const UPLOAD_TYPE_OPTIONS: { value: UploadType; label: string; icon: string }[] = [
  { value: "demo", label: "demo", icon: "♾️" },
  { value: "complex", label: "Complex", icon: "🌀" },
];

// demo = 전체공개·노출시간 영구(만료 없음) / Complex = 팔로워공개 or 특정 사람 초대공개·노출시간 필수설정.
// demo는 그래서 노출 시간 UI 자체가 없고, Complex만 아래 공개범위+노출시간을 요구한다.
// feed/page.tsx MockSample.visibility("followers" | "specific")와 동일한 값 이름을 사용 —
// 실제 DB 연동 시 두 화면이 같은 값을 주고받아야 하므로 이름을 맞춰둔다.
type ComplexVisibility = "followers" | "specific";
const COMPLEX_VISIBILITY_OPTIONS: { value: ComplexVisibility; label: string; icon: string }[] = [
  { value: "followers", label: "팔로워 공개", icon: "👥" },
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
const darkPageCard = `${pageCard} dark:border-gray-800 dark:bg-gray-950`;
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

function chipButtonClass(active: boolean) {
  const colors = active
    ? "bg-black text-white dark:bg-white dark:text-black"
    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${colors}`;
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
  // 음원일 때만 씀 — 사운드바는 재생용 위젯이라 미리보기(aside)에는 대신 이 커버 이미지를 보여준다.
  const [complexCoverFile, setComplexCoverFile] = useState<File | null>(null);

  const [caption, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");
  const [expireHours, setExpireHours] = useState<ExpireHours>(24);
  const [complexVisibility, setComplexVisibility] = useState<ComplexVisibility>("followers");
  const [inviteNames, setInviteNames] = useState("");
  // 협업 기능은 Complex 전용 — demo는 해시태그로 대체(사용자 지시: "complex에서는 해시태그 삭제 대신 협업기능 추가")
  const [collabAvailable, setCollabAvailable] = useState(false);
  const [collabRoleNeeded, setCollabRoleNeeded] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Complex 선택 시 피드의 Complex 탭(ThemeSync.tsx)과 동일하게 다크 테마로 전환.
  // ThemeSync는 URL(/feed?feed=complex)만 감시해서 이 페이지의 로컬 상태는 모르기 때문에
  // 별도로 처리 — 다른 화면으로 이동하면 ThemeSync가 그 라우트 기준으로 다시 correct하게 되돌려놓는다.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", uploadType === "complex");
  }, [uploadType]);

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

  const complexCoverUrl = useMemo(
    () => (complexCoverFile ? URL.createObjectURL(complexCoverFile) : null),
    [complexCoverFile],
  );
  useEffect(() => {
    return () => {
      if (complexCoverUrl) URL.revokeObjectURL(complexCoverUrl);
    };
  }, [complexCoverUrl]);

  function handleUploadTypeChange(next: UploadType) {
    setUploadType(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
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

  function handleComplexFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setComplexFile(file);
    setComplexKind(file ? detectMediaKind(file) : null);
    setComplexCoverFile(null);
  }

  function handleComplexCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    setComplexCoverFile(e.target.files?.[0] ?? null);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomTag() {
    const tag = customTagInput.trim().replace(/^#/, "");
    if (!tag) return;
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setCustomTagInput("");
  }

  const filteredGenres = ALL_GENRES.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.trim().toLowerCase()),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (uploadType === "complex") {
      if (!complexFile || !complexKind) {
        setError("음원(mp3/wav) 또는 영상 파일을 업로드해주세요.");
        return;
      }
      if (complexVisibility === "specific") {
        const invited = inviteNames
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);
        if (invited.length === 0) {
          setError("초대할 사람을 최소 1명 입력해주세요.");
          return;
        }
      }
      // Complex는 아직 실제 DB(초대·비공개 범위·채팅 테이블)가 없어 저장하지 않고 미리보기 피드로 이동만 시킨다.
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

    const mediaPath = `${user.id}/${Date.now()}-${mediaFile.name}`;
    const { error: uploadError } = await supabase.storage.from("posts").upload(mediaPath, mediaFile);

    if (uploadError) {
      setError(`업로드 실패: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    // 선택적으로 커버 이미지를 같이 올려서 thumbnail_url(원래 있던 미사용 컬럼)에 저장한다.
    let thumbnailPath: string | null = null;
    if (coverFile) {
      const coverPath = `${user.id}/${Date.now()}-cover-${coverFile.name}`;
      const { error: coverUploadError } = await supabase.storage.from("posts").upload(coverPath, coverFile);
      if (coverUploadError) {
        setError(`커버 이미지 업로드 실패: ${coverUploadError.message}`);
        setLoading(false);
        return;
      }
      thumbnailPath = coverPath;
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
    <div className="flex max-w-[1200px] flex-col gap-6 px-4 md:flex-row md:items-start">
      <main className={`${darkPageCard} flex flex-col gap-6 md:mx-0`}>
        <h1 className={`${pageTitle} dark:text-gray-100`}>영상 업로드</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={darkLabel}>게시 유형</span>
            <div className="grid grid-cols-2 gap-2">
              {UPLOAD_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUploadTypeChange(option.value)}
                  className={selectableButtonClass(
                    uploadType === option.value,
                    "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  )}
                >
                  <span className="text-base">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
            {uploadType === "complex" && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Complex는 아직 미리보기 단계라 실제 게시물로 저장되지 않고, 게시 시 Complex 피드로 이동만 해요.
              </p>
            )}
          </div>

          {uploadType === "demo" ? (
            <div className="flex flex-col gap-1.5">
              <span className={darkLabel}>영상 또는 음원 파일 (mp3/wav) — 필수</span>
              <input
                type="file"
                accept={VIDEO_OR_AUDIO_ACCEPT}
                onChange={handleFileChange}
                className={darkFileInput}
              />
              {mediaFile && !mediaKind && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  영상/음원 형식이 아니에요. mp4·mov 영상이나 mp3·wav 음원 파일을 선택해주세요.
                </p>
              )}
              {durationWarning && (
                <p className="text-sm text-amber-600 dark:text-amber-400">{durationWarning}</p>
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
              <span className={darkLabel}>영상 또는 음원 파일 (mp3/wav) — 필수</span>
              <input
                type="file"
                accept={VIDEO_OR_AUDIO_ACCEPT}
                onChange={handleComplexFileChange}
                className={darkFileInput}
              />
              {complexFile && !complexKind && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  영상/음원 형식이 아니에요. mp4·mov 영상이나 mp3·wav 음원 파일을 선택해주세요.
                </p>
              )}
              {complexFile && complexKind === "audio" && complexObjectUrl && (
                <>
                  <SoundbarPreview
                    key={`${complexFile.name}-${complexFile.size}-${complexFile.lastModified}`}
                    file={complexFile}
                    src={complexObjectUrl}
                  />
                  <span className={darkLabel}>커버 이미지 (선택)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleComplexCoverChange}
                    className={darkFileInput}
                  />
                </>
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

              <input
                type="text"
                placeholder="해시태그 검색"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className={darkField}
              />
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                {filteredGenres.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={chipButtonClass(isSelected)}
                    >
                      #{tag}
                    </button>
                  );
                })}
                {filteredGenres.length === 0 && (
                  <p className="py-2 text-sm text-gray-400 dark:text-gray-500">
                    일치하는 해시태그가 없어요. 직접 입력해보세요.
                  </p>
                )}
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="목록에 없는 해시태그 직접 입력"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
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
            </div>
          )}

          {uploadType === "demo" ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              demo는 전체공개 게시물이라 노출 시간이 영구예요.
            </p>
          ) : (
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
                  <input
                    type="text"
                    placeholder="이름을 쉼표로 구분해서 입력 (예: 오세준, 한지민)"
                    value={inviteNames}
                    onChange={(e) => setInviteNames(e.target.value)}
                    className={darkField}
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
                협업 구함
              </label>
              {collabAvailable && (
                <input
                  type="text"
                  placeholder="찾는 역할 (예: 보컬)"
                  value={collabRoleNeeded}
                  onChange={(e) => setCollabRoleNeeded(e.target.value)}
                  className={darkField}
                />
              )}
            </>
          )}

          {error && <p className={darkErrorText}>{error}</p>}
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading ? "게시 중..." : "게시하기"}
          </Button>
        </form>
      </main>

      {uploadType === "complex" && (
        <aside className="hidden min-w-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:sticky md:top-20 md:flex md:flex-1 md:max-w-[560px]">
          <span className={darkLabel}>미리보기</span>
          {!complexFile && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              영상 또는 음원 파일을 선택하면 여기에 미리보기가 표시돼요.
            </p>
          )}
          {complexFile && complexKind === "video" && complexObjectUrl && (
            <video src={complexObjectUrl} controls muted className="w-full rounded-xl" />
          )}
          {complexFile && complexKind === "audio" && (
            <>
              {complexCoverUrl ? (
                <img src={complexCoverUrl} alt="커버 이미지" className="w-full rounded-xl object-cover" />
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  커버 이미지를 첨부하면 여기에 표시돼요.
                </p>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  );
}
