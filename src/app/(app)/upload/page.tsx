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
import { GiphyPicker } from "@/components/GiphyPicker";
import { LockIcon, EyeIcon, HeartIcon, CommentIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { label as labelClass, errorText, pageCard } from "@/components/ui/styles";
import { ALL_GENRES } from "@/lib/genres";
import { tagColorClass } from "@/lib/feedConstants";
import type { ExpireHours } from "@/types/database";

const MIN_TAGS = 3;

// 게시하기 버튼에 랜덤으로 노출되는 사투리 문구 — SSR과 클라이언트의 Math.random 결과가
// 달라질 수밖에 없어서, 버튼 텍스트 span에 suppressHydrationWarning을 걸고 클라이언트 값을 쓴다.
// 아래 목록은 fallback — 실제로는 마운트 후 submit_phrases 테이블(관리자가 /admin/submit-phrases
// 에서 편집)에서 '노출' 문구를 받아와 그중 하나를 랜덤으로 쓴다.
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

// 단독 게시물은 시간 단위, 협업 게시물은 일 단위(사용자 요청 — "협업게시물은 시간제한
// 말고 기간제한으로 변경, 1d 3d 5d 7d"). 값은 그대로 posts.expire_hours(시간)에 저장되고
// 화면 라벨만 다르다 — 24h(1일)가 두 세트 모두에 있어서 모드를 바꿔도 항상 유효한 기본값.
const SOLO_EXPIRE_HOURS_OPTIONS: { hours: ExpireHours; label: string }[] = [
  { hours: 6, label: "6h" },
  { hours: 12, label: "12h" },
  { hours: 24, label: "24h" },
  { hours: 48, label: "48h" },
];
const COLLAB_EXPIRE_HOURS_OPTIONS: { hours: ExpireHours; label: string }[] = [
  { hours: 24, label: "1d" },
  { hours: 72, label: "3d" },
  { hours: 120, label: "5d" },
  { hours: 168, label: "7d" },
];

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
  // 아이콘은 이모지 대신 EyeIcon(memo 게시물의 "조회자" 기능과 같은 아이콘, 2026-09-15
  // 사용자 요청)을 JSX에서 직접 렌더 — 이 배열의 icon 필드는 이제 specific("🔒")에만 쓰인다.
  { value: "followers", label: "Companion 공개", icon: "" },
  { value: "specific", label: "특정인 공개", icon: "🔒" },
];
// memo 게시 형태 — 화면 표시·선택용 값이고 실제로는 posts.collab_available(boolean)에
// 저장된다(정책 변경, 사용자 요청 — 체크박스 대신 단독/협업 중 하나를 고르는 선택형 버튼).
type ComplexPostMode = "solo" | "collab";
const COMPLEX_POST_MODE_OPTIONS: { value: ComplexPostMode; label: string; icon: string }[] = [
  // 2026-09-15 사용자 요청으로 이름·아이콘 변경(단독->솔로, 협업->콜라보) — 아이콘은
  // 정사각형 버튼 안에 큼직하게 들어가는 이니셜 한 글자(S/C)로.
  { value: "solo", label: "솔로게시물", icon: "S" },
  { value: "collab", label: "콜라보게시물", icon: "C" },
];
// posts.expire_hours는 not null 컬럼이라 demo(영구노출)에도 값이 필요하지만,
// 영구노출 여부는 expires_at(null)로만 판단하므로(feed/page.tsx 쿼리 참고) 이 값 자체는 화면에 노출되지 않는다.
const PERMANENT_POST_EXPIRE_HOURS_PLACEHOLDER: ExpireHours = 48;

// demo는 영상/음원 둘 다, memo는 음원(mp3/wav)만 — memo는 Discord처럼 짧은 스케치를 음원으로만
// 주고받는 공간으로 좁혀서 이미지/영상 업로드 자체를 없앴다(재창작물 스택은 이미 0015부터
// 음원 전용이었고, 이번엔 1차 게시물 업로드도 같은 원칙으로 맞춤).
type DetectedMediaKind = "video" | "audio";
const VIDEO_OR_AUDIO_ACCEPT = "video/mp4,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/x-wav";
const AUDIO_ONLY_ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav";

function detectMediaKind(file: File): DetectedMediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

// 업로드 용량 제한 — Instagram 릴스(650MB)보다 타이트하게 잡음(우리 R2 저장 비용, DEMO는
// 만료 없이 영구 보관이라 무제한 용량이면 계속 쌓임). 음원은 실무상 이 정도 용량을 넘기기
// 어려워 사실상 영상에만 걸리는 제한이다. 영상 길이 제한은 없앰(DEMO는 SoundCloud처럼
// 음원+커버 이미지가 중심이라 영상은 부차적인 존재라 길이보다 용량만 제어).
const MAX_FILE_SIZE_BYTES = 300 * 1024 * 1024;

function formatMB(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

// DEMO 커버 이미지 비율 — Instagram 피드 게시물과 동일한 범위(세로 4:5 ~ 가로 1.91:1)로
// 제한해서 레이아웃이 깨지지 않게 한다.
const MIN_COVER_ASPECT_RATIO = 4 / 5;
const MAX_COVER_ASPECT_RATIO = 1.91;

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = URL.createObjectURL(file);
  });
}

// 그레이는 옅은(box-gray)/중간(main-gray)/짙은(active-gray) + 활성화 박스 전용 demo-bg(#fafafa,
// DEMO 탭 배경색) 4가지만 쓴다(globals.css 참고, 2번째 수정 — 활성화 박스는 이제 데모탭 배경색).
// 이 페이지 밖(예: /profile/manage)에도 재사용되는 공유 스타일(pageCard/labelClass/errorText)은
// 건드리지 않고, 여기서만 색만 이 4가지+검정 글씨로 덮어써(grayField는 아예 새로 정의) 확장한다.
// w-full: pageCard는 max-w만 있어서 카드 폭이 내용물 고유 너비를 따라간다 — 해시태그 검색으로
// 칩 목록이 줄면 폼 전체가 좁아지는 문제가 있어 이 페이지에서는 폭을 항상 max-w까지 고정.
const wideCard = `${pageCard} w-full`;
const blackLabel = `${labelClass} !text-black`;
// 폼 안의 인풋 = "박스 안에 박스"라 옅은 그레이 배경(채색된 박스라 평소엔 테두리 없음),
// 포커스만 활성화 상태를 나타내는 테두리(짙은 그레이)로 보여준다.
const grayField =
  "w-full rounded-xl border border-transparent bg-box-gray px-3.5 py-2.5 text-sm text-black placeholder:text-active-gray focus:border-active-gray focus:outline-none focus:ring-1 focus:ring-active-gray";
const fileInputClass =
  "text-sm text-black file:mr-3 file:rounded-lg file:border-0 file:bg-main-gray file:px-3 file:py-2 file:text-sm file:font-medium file:text-black hover:file:opacity-80";
// 공유 <Button variant="primary">는 기본이 검정 배경(다른 화면들과 공유하는 토큰이라 그대로 둠) —
// 이 화면(그레이 3단계 규칙)에서만 !important로 활성화 박스 색(demo-bg)으로 덮어쓴다.
// !important가 배경색을 고정해버려서 Button 기본 hover:bg-gray-800이 안 먹으니, 다른 버튼들과
// 같은 hover:opacity로 눌렀을 때 짙어지는 느낌을 따로 챙겨준다.
const primaryButtonClass = "!bg-demo-bg !text-black hover:opacity-80";

// 채색(배경)이 있는 박스는 테두리를 따로 안 그린다 — 배경색만으로 구분.
function selectableButtonClass(active: boolean, base: string) {
  const colors = active ? "bg-demo-bg text-black" : "bg-box-gray text-black hover:opacity-80";
  return `${base} ${colors}`;
}

// 게시 형태(단독/협업)·공개 범위(Companion/초대) 버튼 전용 — 정사각형 아이콘 버튼으로
// 디자인(2026-09-15, 사용자 요청). aspect-square라 grid-cols-2 안에서 폭에 맞춰 항상
// 정사각형을 유지 — 큰 아이콘(이모지 또는 S/C 이니셜)이 위, 작은 라벨이 아래.
function squareOptionButtonClass(active: boolean) {
  return `flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm font-medium transition ${
    active ? "bg-demo-bg text-black" : "bg-box-gray text-black hover:opacity-80"
  }`;
}

// 게시 유형 토글 전용 — DEMO(메인 화이트/포인트 골드) vs complex(메인 짙은 그레이/포인트 퍼플)를
// 다른 selectableButtonClass 사용처와 다르게 각자 고유 색으로 구분한다(그레이 규칙과
// 무관한 브랜드 강조색이라 그대로 둔다 — 검정은 금지라 memo 쪽은 active-gray를 쓴다).
// 이 둘은 브랜드 테두리(violet/gold)가 있어 base에 border를 따로 붙여 호출한다.
function uploadTypeButtonClass(value: UploadType, active: boolean, base: string) {
  if (!active) {
    return `${base} bg-box-gray text-black hover:opacity-80`;
  }
  const colors =
    value === "complex"
      ? "border border-violet-500 bg-active-gray text-violet-300"
      : "border border-demo-gold bg-white text-demo-gold";
  return `${base} ${colors}`;
}

// 해시태그 목록 박스는 채색 없이 테두리만(사용자 지시 — "이전처럼") 그려서 안의 바탕은
// 카드 자체 색(main-gray)이 그대로 비친다 — 칩은 그 위에서 옅은 톤(box-gray)으로 도드라지고,
// 선택되면 활성화 박스 색(demo-bg)으로 바뀐다.
function chipButtonClass(active: boolean) {
  const colors = active
    ? "bg-demo-bg text-black"
    : "bg-box-gray text-black hover:opacity-80";
  return `rounded-full px-3 py-1.5 text-sm font-medium transition ${colors}`;
}

// 파일 input을 감춘 큰 dropzone — 클릭·드래그앤드롭 둘 다 지원. 업로드 가능한 확장자를
// 박스 안에 나열해서 별도 라벨 없이 이 박스 하나로 파일 선택 UI를 대체한다.
const UPLOADABLE_FORMATS = "mp3 · wav · mp4 · mov";
const MEMO_UPLOADABLE_FORMATS = "mp3 · wav";

function UploadDropbox({
  file,
  onSelect,
  accept,
  formatsLabel,
}: {
  file: File | null;
  onSelect: (file: File | null) => void;
  accept: string;
  formatsLabel: string;
}) {
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
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-active-gray px-6 py-10 text-center text-active-gray transition ${
        dragOver ? "bg-demo-bg" : "bg-box-gray hover:opacity-80"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-main-gray text-sm font-bold text-black transition hover:opacity-80"
        >
          ×
        </button>
      )}
      <span className="text-3xl" aria-hidden>
        ⬆
      </span>
      {file ? (
        <>
          <p className="max-w-full truncate text-sm font-semibold">{file.name}</p>
          <p className="text-xs">Click or drop to replace</p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-active-gray">Upload</p>
          <p className="text-xs">{formatsLabel}</p>
        </>
      )}
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();

  // 원래는 게시 유형(DEMO/memo)을 바꿀 때마다 피드 Complex 탭(ThemeSync.tsx)처럼 효과음과
  // 함께 페이지 전체를 다크 테마로 전환했는데, 업로드 폼 자체를 고치는 화면에서 그럴 때마다
  // 화면 톤·효과음이 바뀌는 게 번거롭다는 피드백으로 제거 — 이 페이지는 항상 (app)/layout.tsx의
  // PageCanvas 그레이 배경을 그대로 유지하고, 라이트/다크 전환은 다시 /feed에서만 일어난다.
  const [uploadType, setUploadType] = useState<UploadType>("demo");

  // demo 전용 — 영상 또는 음원 파일 하나만 필수로 업로드, 종류는 자동 판별(Complex와 동일한 방식)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<DetectedMediaKind | null>(null);
  const [mediaFileError, setMediaFileError] = useState<string | null>(null);
  // posts.thumbnail_url(원래부터 있던 컬럼, 이제야 처음 사용)에 저장돼 피드에서 영상 poster/커버로 쓰인다.
  // DEMO는 Instagram처럼 커버 이미지가 사실상 메인 비주얼이라 필수로 바꿈.
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverFileError, setCoverFileError] = useState<string | null>(null);
  // 사진이 없는 유저를 위한 대안 — GIPHY에서 GIF를 골라 커버로 쓸 수 있다(GiphyPicker).
  // coverFile과 coverGifUrl은 동시에 하나만 유효(둘 중 하나를 고르면 다른 쪽은 비운다).
  const [coverGifUrl, setCoverGifUrl] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  // Complex 전용 — 영상 또는 음원 파일 하나만 필수로 업로드, 종류는 자동 판별
  const [complexFile, setComplexFile] = useState<File | null>(null);
  const [complexKind, setComplexKind] = useState<DetectedMediaKind | null>(null);
  const [complexFileError, setComplexFileError] = useState<string | null>(null);

  // 작품 제목 — caption(부가 설명, 선택)과 분리된 필수 입력(0052, 2026-09-15 사용자 요청).
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [popularUserTags, setPopularUserTags] = useState<string[]>([]);
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

  const [submitPhrase, setSubmitPhrase] = useState(
    () => SUBMIT_PHRASES[Math.floor(Math.random() * SUBMIT_PHRASES.length)],
  );
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("submit_phrases")
      .select("phrase")
      .eq("active", true)
      .then(({ data }) => {
        const list = (data ?? []).map((r) => r.phrase);
        if (!cancelled && list.length > 0) {
          setSubmitPhrase(list[Math.floor(Math.random() * list.length)]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // InviteUserPicker가 검색 결과에서 본인을 제외하는 데만 씀(초대 자체는 post_access RLS가
  // user_id<>auth.uid()로 어차피 막지만, 검색 결과에서부터 안 보이는 게 자연스럽다).
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [supabase]);

  // 미리보기 헤더(작성자 이름·학교/포지션)용 — feed/page.tsx의 headerMetaLine과 같은 조합.
  // "게시하면 이렇게 보여요"라 실제 카드와 똑같이 상단에 내 이름이 들어가야 한다(사용자 요청).
  const [authorName, setAuthorName] = useState("나");
  const [authorMetaLine, setAuthorMetaLine] = useState("");
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      const [{ data: display }, { data: profile }] = await Promise.all([
        supabase.from("user_display").select("display_name").eq("id", currentUserId).single(),
        supabase
          .from("profiles")
          .select("school, school_public, instruments")
          .eq("user_id", currentUserId)
          .single(),
      ]);
      if (display?.display_name) setAuthorName(display.display_name);
      const visibleSchool = profile?.school_public ? profile.school : null;
      const schoolPositions = [visibleSchool, ...(profile?.instruments ?? [])].filter(Boolean).join(" · ");
      setAuthorMetaLine(schoolPositions ? `${schoolPositions} · 방금` : "방금");
    })();
  }, [currentUserId, supabase]);

  // 실제 업로드된 게시물에서 커스텀 태그(고정 목록 ALL_GENRES에 없는 것)가 얼마나 반복
  // 사용됐는지 집계해서 "인기 사용자 태그"로 노출 — 자유 입력 태그가 2회 이상 쓰이면
  // 자연스럽게 선택 목록에 편입되게 해서, 고정 목록을 처음부터 다 채워두지 않아도 되게 한다.
  useEffect(() => {
    const genreSet = new Set(ALL_GENRES);
    supabase
      .from("posts")
      .select("instrument_tags")
      .eq("status", "published")
      .then(({ data }) => {
        if (!data) return;
        const counts = new Map<string, number>();
        for (const row of data) {
          for (const tag of row.instrument_tags ?? []) {
            if (genreSet.has(tag)) continue;
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }
        const popular = [...counts.entries()]
          .filter(([, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([tag]) => tag);
        setPopularUserTags(popular);
      });
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

  // DEMO 커버 이미지 미리보기용 object URL — 같은 패턴. GIF를 골랐으면 coverGifUrl(이미 완성된
  // URL)을 그대로 쓰고, 직접 올린 사진이면 이 object URL을 쓴다(previewCoverSrc가 둘을 합침).
  const coverObjectUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  useEffect(() => {
    return () => {
      if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
    };
  }, [coverObjectUrl]);
  const previewCoverSrc = coverGifUrl ?? coverObjectUrl;

  function handleUploadTypeChange(next: UploadType) {
    setUploadType(next);
  }

  function handleFileChange(file: File | null) {
    setMediaFileError(null);
    setCoverFile(null);
    setCoverFileError(null);
    setCoverGifUrl(null);
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setMediaFile(null);
      setMediaKind(null);
      setMediaFileError(`파일 용량이 ${formatMB(file.size)}예요. ${formatMB(MAX_FILE_SIZE_BYTES)} 이하만 올릴 수 있어요.`);
      return;
    }
    setMediaFile(file);
    setMediaKind(file ? detectMediaKind(file) : null);
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    setCoverFileError(null);
    if (!file) {
      setCoverFile(null);
      return;
    }
    const { width, height } = await readImageDimensions(file);
    const ratio = width / height;
    if (ratio < MIN_COVER_ASPECT_RATIO || ratio > MAX_COVER_ASPECT_RATIO) {
      setCoverFile(null);
      setCoverFileError("커버 이미지 비율이 적절하지 않아요. 세로 4:5 ~ 가로 1.91:1 사이 비율을 사용해주세요.");
      return;
    }
    setCoverFile(file);
    setCoverGifUrl(null);
  }

  function handleSelectGif(gif: { url: string; width: number; height: number }) {
    setCoverGifUrl(gif.url);
    setCoverFile(null);
    setCoverFileError(null);
    setGifPickerOpen(false);
  }

  // 공동창작 체크 여부로 memo 업로드가 두 갈래로 갈린다(정책 변경, 사용자 요청):
  // 체크(collab) — 기존처럼 음원(mp3/wav)만, 채팅 협업방으로 게시. 미체크 — DEMO와 동일하게
  // 영상/음원 다 허용 + 커버 이미지 필수 + 좋아요/댓글/조회자 목록으로 게시.
  function handleComplexFileChange(file: File | null) {
    setComplexFileError(null);
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setComplexFile(null);
      setComplexKind(null);
      setComplexFileError(`파일 용량이 ${formatMB(file.size)}예요. ${formatMB(MAX_FILE_SIZE_BYTES)} 이하만 올릴 수 있어요.`);
      return;
    }
    const kind = file ? detectMediaKind(file) : null;
    if (file && !kind) {
      setComplexFile(null);
      setComplexKind(null);
      setComplexFileError("영상 또는 음원 파일만 올릴 수 있어요.");
      return;
    }
    if (file && collabAvailable && kind !== "audio") {
      setComplexFile(null);
      setComplexKind(null);
      setComplexFileError("공동창작 게시물은 음원(mp3/wav) 파일만 올릴 수 있어요.");
      return;
    }
    setComplexFile(file);
    setComplexKind(kind);
  }

  // 공동창작을 나중에 켜서 이미 골라둔 영상이 더 이상 허용 안 되는 경우 정리.
  function handleCollabAvailableChange(checked: boolean) {
    setCollabAvailable(checked);
    // 노출 기간 옵션 세트(시간/일)가 모드마다 달라서, 다른 세트에 없는 값을 고른 채로
    // 넘어가지 않게 24h(=1d, 두 세트 공통값)로 리셋한다.
    setExpireHours(24);
    if (checked && complexKind === "video") {
      setComplexFile(null);
      setComplexKind(null);
      setComplexFileError("공동창작 게시물은 음원(mp3/wav) 파일만 올릴 수 있어요.");
    }
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

  // 실제 게시물에서 반복 사용된 커스텀 태그(고정 목록엔 없는 것) — 2회 이상 쓰인 것만,
  // 사용 빈도 내림차순 상위 20개까지만 노출. 마운트 시 1회만 집계(실시간 갱신까진 불필요).
  const filteredPopularUserTags = popularUserTags.filter((tag) =>
    tag.toLowerCase().includes(tagSearch.trim().toLowerCase()),
  );

  // 영상 미리보기 aside는 DEMO 전용 — memo는 이제 음원(mp3/wav)만 올릴 수 있어서 해당 없음.
  const previewVideoSrc = uploadType === "demo" && mediaKind === "video" ? mediaObjectUrl : null;
  // 인스타그램처럼 "게시하면 이렇게 보여요"를 실시간으로 보여주는 미리보기 — 커버 이미지가
  // 이제 DEMO의 메인 비주얼이라, 영상이 없어도(음원만 골랐거나 아직 아무것도 안 골랐어도)
  // 커버+캡션+해시태그만으로 미리보기를 띄운다.
  const showPostPreview = uploadType === "demo" && (previewCoverSrc || mediaFile);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }

    if (uploadType === "complex") {
      if (!complexFile || !complexKind) {
        setError(collabAvailable ? "음원(mp3/wav) 파일을 업로드해주세요." : "영상 또는 음원 파일을 업로드해주세요.");
        return;
      }
      // 공동창작 미체크 = DEMO와 동일한 형태(사용자 요청)라 커버 이미지도 똑같이 필수 —
      // 단, 영상은 그 자체로 보여줄 화면이 있어서 예외(사용자 요청, DEMO와 동일 규칙).
      if (!collabAvailable && complexKind === "audio" && !coverFile && !coverGifUrl) {
        setError("커버 이미지를 올리거나 GIF를 선택해주세요.");
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

      // 공동창작 미체크일 때만 커버 이미지 업로드(DEMO와 동일 로직) — collab는 여전히
      // 채팅 중심이라 커버가 없다. 영상은 커버가 선택이라(위 검증) 안 골랐으면 null 그대로.
      let complexThumbnailPath: string | null = null;
      if (!collabAvailable) {
        try {
          if (coverGifUrl) {
            complexThumbnailPath = coverGifUrl;
          } else if (coverFile) {
            complexThumbnailPath = await uploadFileToR2(coverFile);
          }
        } catch (err) {
          setError(`커버 이미지 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
          setLoading(false);
          return;
        }
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
          thumbnail_url: complexThumbnailPath,
          title: title.trim(),
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
    // 영상은 그 자체로 보여줄 화면이 있어서 커버 이미지 필수에서 예외(사용자 요청).
    if (mediaKind === "audio" && !coverFile && !coverGifUrl) {
      setError("커버 이미지를 올리거나 GIF를 선택해주세요.");
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

    // 커버 이미지는 음원일 때만 필수(위에서 검증됨) — 영상은 그 자체가 화면이라 없어도 됨.
    // thumbnail_url(원래 있던 미사용 컬럼)에 저장한다. GIF를 골랐으면 GIPHY 자체 URL을
    // 그대로 쓰고(resolveMediaUrl이 읽을 때 구분), 직접 올린 사진이면 R2에 업로드해서 key를 저장한다.
    let thumbnailPath: string | null = null;
    try {
      if (coverGifUrl) {
        thumbnailPath = coverGifUrl;
      } else if (coverFile) {
        thumbnailPath = await uploadFileToR2(coverFile);
      }
    } catch (err) {
      setError(`커버 이미지 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      setLoading(false);
      return;
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
        title: title.trim(),
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
    // max-w는 폼(pageCard, 이제 피드 카드와 같은 659px) + gap-6(24px) + 미리보기 카드(659px)가
    // 나란히 들어갈 수 있도록 넉넉히 잡음(2026-09-15, 미리보기·폼 실제 크기화 참고).
    // md:flex-wrap: 폼(659)+미리보기(659)가 뷰포트에 다 못 들어가면(노트북 등 흔한 화면) 가로
    // 스크롤 대신 미리보기가 아래로 줄바꿈되게 한다.
    <div className="mx-auto flex max-w-[1420px] flex-col gap-6 px-4 md:flex-row md:flex-wrap md:items-start md:justify-center">
      <main className={`${wideCard} flex flex-col gap-6 md:mx-0 md:shrink-0`}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={blackLabel}>게시 유형</span>
            <div className="grid grid-cols-2 gap-2">
              {UPLOAD_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUploadTypeChange(option.value)}
                  className={uploadTypeButtonClass(
                    option.value,
                    uploadType === option.value,
                    "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  )}
                >
                  <span className="text-base">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-active-gray">
              {uploadType === "complex"
                ? "Companion공개 또는 특정인초대로 함께 볼 사람을 정할 수 있으며, 시간이 지나면 자동으로 숨김 및 보관 처리돼요."
                : "누구나 볼 수 있는 전체공개 게시물로, 시간 제한 없이 계속 유지돼요."}
            </p>
          </div>

          {/* 공동창작 여부(게시 형태)·공개 범위 — 둘 다 memo 게시 전반의 성격을 정하는 상위
              설정이라 게시 유형 바로 밑, 같은 줄에 나란히 둔다(2026-09-15, 사용자 요청 —
              "게시 유형 밑에 동일선상으로 표시"). 버튼은 정사각형 아이콘 버튼으로(사용자 요청) —
              squareOptionButtonClass 참고. 공개 범위에 딸린 "초대할 사람"·"노출 시간/기간"은
              그대로 아래쪽 원래 위치에 남겨둔다(값 자체는 여기서 이미 정해짐, complexVisibility
              상태 공유). */}
          {uploadType === "complex" && (
            // gap-x-4(칼럼 사이)와 gap-y-1.5(버튼 줄 <-> 설명글) 분리 — 하나의 gap-4였을 때
            // 설명글 위 여백만 다른 섹션(gap-1.5)보다 훨씬 크게 떠 보였다(사용자 지적,
            // 2026-09-15).
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div className="flex flex-col gap-1.5">
                <span className={blackLabel}>게시 형태</span>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLEX_POST_MODE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleCollabAvailableChange(option.value === "collab")}
                      className={squareOptionButtonClass(collabAvailable === (option.value === "collab"))}
                    >
                      {/* 이니셜 한 글자(S/C)에 네모 테두리를 둘러 배지처럼(2026-09-15 사용자 요청). */}
                      <span className="flex h-5 w-5 items-center justify-center rounded border border-black text-xs font-black">
                        {option.icon}
                      </span>
                      <span className="text-xs">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={blackLabel}>공개 범위</span>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLEX_VISIBILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setComplexVisibility(option.value)}
                      className={squareOptionButtonClass(complexVisibility === option.value)}
                    >
                      {option.value === "specific" ? (
                        <LockIcon className="h-6 w-6" />
                      ) : (
                        // memo 게시물의 "조회자" 기능과 같은 EyeIcon(2026-09-15 사용자 요청 —
                        // 예전엔 👥 이모지였음).
                        <EyeIcon className="h-6 w-6" />
                      )}
                      <span className="text-xs">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* 게시 형태 설명글 — 반 폭 컬럼 안에 있으면 줄바꿈이 잦아서 2열 그리드 밖,
                  카드 전체 폭으로 빼 한 줄에 들어가게 했다(2026-09-15, 사용자 요청). */}
              <p className="col-span-2 px-1 text-xs text-active-gray">
                {collabAvailable
                  ? "Companion과 음원을 스택으로 쌓아 함께 곡을 만들 수 있어요. 음원 파일(mp3/wav)만 올려주세요."
                  : "DEMO처럼 영상·음원에 커버 이미지를 더해 올리고, 좋아요·댓글·조회자 목록을 확인할 수 있어요."}
              </p>
            </div>
          )}

          {/* "초대할 사람"은 업로드 바로 위로(2026-09-15, 사용자 요청) — 특정인 공개를
              고르자마자 업로드 전에 누구를 초대할지부터 정하게. */}
          {uploadType === "complex" && complexVisibility === "specific" && (
            <div className="flex flex-col gap-1.5">
              <span className={blackLabel}>초대할 사람</span>
              <InviteUserPicker
                currentUserId={currentUserId ?? ""}
                value={inviteUsers}
                onChange={setInviteUsers}
                inputClassName={grayField}
              />
            </div>
          )}

          {uploadType === "demo" ? (
            // 캡션·해시태그처럼 라벨을 박스 바깥으로(2026-09-15, 사용자 요청 — 통일성).
            <div className="flex flex-col gap-1.5">
              <span className={blackLabel}>업로드</span>
              <div className="flex flex-col gap-3 rounded-xl bg-box-gray p-3">
              <UploadDropbox
                file={mediaFile}
                onSelect={handleFileChange}
                accept={VIDEO_OR_AUDIO_ACCEPT}
                formatsLabel={UPLOADABLE_FORMATS}
              />
              {mediaFile && !mediaKind && (
                <p className="text-sm text-amber-600">
                  영상/음원 형식이 아니에요. mp4·mov 영상이나 mp3·wav 음원 파일을 선택해주세요.
                </p>
              )}
              {mediaFileError && <p className={errorText}>{mediaFileError}</p>}
              {showPostPreview && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="hidden self-start text-xs font-medium text-active-gray hover:underline md:inline"
                >
                  {previewOpen ? "미리보기 접기 ▲" : "미리보기 펼치기 ▼"}
                </button>
              )}
              {mediaFile && mediaKind === "audio" && mediaObjectUrl && (
                <SoundbarPreview
                  key={`${mediaFile.name}-${mediaFile.size}-${mediaFile.lastModified}`}
                  file={mediaFile}
                  src={mediaObjectUrl}
                  tone="demo"
                />
              )}
              {/* 커버 이미지는 음원일 때만 — 영상은 그 자체가 화면이라 버튼 자체를 안 보여준다
                  (사용자 요청: "없어도 되는 게 아니라 없어야 해"). 평소(파일 선택 전)에도 숨김. */}
              {mediaKind === "audio" && (
                <>
                  <div className="flex items-center justify-between border-t border-box-gray pt-3">
                    <span className={blackLabel}>커버 이미지 (필수)</span>
                    <span className="text-xs text-active-gray">세로 4:5~가로 1.91:1</span>
                  </div>
                  {coverGifUrl ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverGifUrl}
                        alt="선택한 GIF"
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCoverGifUrl(null)}
                        className="text-sm"
                      >
                        GIF 제거
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleCoverChange}
                          className={fileInputClass}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setGifPickerOpen(true)}
                          className="shrink-0 text-sm"
                        >
                          GIF로 만들기
                        </Button>
                      </div>
                      {coverObjectUrl && (
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverObjectUrl}
                            alt="선택한 커버 이미지"
                            className="h-24 w-24 rounded-lg object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setCoverFile(null);
                              setCoverFileError(null);
                            }}
                            className="text-sm"
                          >
                            이미지 제거
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {coverFileError && <p className={errorText}>{coverFileError}</p>}
                </>
              )}
              </div>
            </div>
          ) : (
            // 위 demo 분기와 동일하게 라벨을 박스 바깥으로.
            <div className="flex flex-col gap-1.5">
              <span className={blackLabel}>업로드</span>
              <div className="flex flex-col gap-3 rounded-xl bg-box-gray p-3">
              <UploadDropbox
                file={complexFile}
                onSelect={handleComplexFileChange}
                accept={collabAvailable ? AUDIO_ONLY_ACCEPT : VIDEO_OR_AUDIO_ACCEPT}
                formatsLabel={collabAvailable ? MEMO_UPLOADABLE_FORMATS : UPLOADABLE_FORMATS}
              />
              {complexFile && !complexKind && (
                <p className="text-sm text-amber-600">
                  {collabAvailable
                    ? "음원 형식이 아니에요. mp3·wav 파일을 선택해주세요."
                    : "영상/음원 형식이 아니에요. mp4·mov 영상이나 mp3·wav 음원 파일을 선택해주세요."}
                </p>
              )}
              {complexFileError && <p className={errorText}>{complexFileError}</p>}
              {complexFile && complexKind === "audio" && complexObjectUrl && (
                <SoundbarPreview
                  key={`${complexFile.name}-${complexFile.size}-${complexFile.lastModified}`}
                  file={complexFile}
                  src={complexObjectUrl}
                />
              )}
              {/* 공동창작 미체크 = DEMO와 동일한 형태(사용자 요청)라 음원일 때만 커버 이미지
                  버튼을 보여준다 — 영상은 그 자체가 화면이라 버튼 자체를 숨긴다. */}
              {!collabAvailable && complexKind === "audio" && (
                <>
                  <div className="flex items-center justify-between border-t border-box-gray pt-3">
                    <span className={blackLabel}>커버 이미지 (필수)</span>
                    <span className="text-xs text-active-gray">세로 4:5~가로 1.91:1</span>
                  </div>
                  {coverGifUrl ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverGifUrl}
                        alt="선택한 GIF"
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCoverGifUrl(null)}
                        className="text-sm"
                      >
                        GIF 제거
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleCoverChange}
                          className={fileInputClass}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setGifPickerOpen(true)}
                          className="shrink-0 text-sm"
                        >
                          GIF로 만들기
                        </Button>
                      </div>
                      {coverObjectUrl && (
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverObjectUrl}
                            alt="선택한 커버 이미지"
                            className="h-24 w-24 rounded-lg object-cover"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setCoverFile(null);
                              setCoverFileError(null);
                            }}
                            className="text-sm"
                          >
                            이미지 제거
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {coverFileError && <p className={errorText}>{coverFileError}</p>}
                </>
              )}
              </div>
            </div>
          )}

          {/* 제목 — 캡션(부가 설명, 선택)과 분리된 필수 입력(2026-09-15, 사용자 요청 —
              "캡션칸에 작품제목을 적는 란을 구분해줘"). */}
          <div className="flex flex-col gap-1.5">
            <span className={blackLabel}>제목</span>
            <input
              type="text"
              placeholder="작품 제목을 입력해주세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              // Safari가 이 필드를 이름/연락처로 오인해 자동완성 아이콘을 얹는 걸 방지
              // (사용자 제보 — 제목 칸에 사람 아이콘이 떴음).
              autoComplete="off"
              className={grayField}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={blackLabel}>캡션</span>
            <textarea
              placeholder="어떤 작업물인가요?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className={grayField}
            />
          </div>

          {uploadType === "demo" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className={blackLabel}>해시태그</span>
                <span className="text-xs text-active-gray">
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
                      className="flex items-center gap-1 rounded-full bg-demo-bg px-3 py-1.5 text-sm font-medium text-black"
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
                  className={grayField}
                />
                <Button
                  type="button"
                  onClick={addCustomTag}
                  className="shrink-0 px-4 !bg-box-gray !text-black hover:opacity-80"
                >
                  추가
                </Button>
              </div>
              {/* 예전엔 훑어보는 용도로 자동 무한 스크롤(marquee)했는데, 항목이 계속 움직이면
                  원하는 태그를 클릭하기 불편하다는 피드백으로 고정 목록 + 수동 스크롤로 변경. */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-box-gray p-3">
                {filteredGenres.length === 0 && filteredPopularUserTags.length === 0 ? (
                  <p className="py-2 text-sm text-active-gray">
                    일치하는 해시태그가 없어요. Enter나 추가 버튼으로 그대로 추가할 수 있어요.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredPopularUserTags.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-black">
                          🔥 인기 사용자 태그
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {filteredPopularUserTags.map((tag) => (
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
                      </div>
                    )}
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DEMO 안내는 게시 유형 바로 아래 설명글로 통합 — 여기는 memo 전용 설정만 남김.
              공개 범위 선택 버튼과 "초대할 사람"은 위(게시 형태 옆·업로드 위)로 옮겨졌고,
              여기는 노출 시간/기간만 남는다. */}
          {uploadType === "complex" && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={blackLabel}>{collabAvailable ? "노출 기간" : "노출 시간"}</span>
                <div className="grid grid-cols-4 gap-2">
                  {(collabAvailable ? COLLAB_EXPIRE_HOURS_OPTIONS : SOLO_EXPIRE_HOURS_OPTIONS).map((option) => (
                    <button
                      key={option.hours}
                      type="button"
                      onClick={() => setExpireHours(option.hours)}
                      className={selectableButtonClass(
                        expireHours === option.hours,
                        "rounded-xl px-2 py-2 text-sm font-medium transition",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className={errorText}>{error}</p>}
          <Button type="submit" disabled={loading} className={`mt-1 w-full ${primaryButtonClass}`}>
            {loading ? "게시 중..." : <span suppressHydrationWarning>&quot;{submitPhrase}&quot;</span>}
          </Button>
        </form>
      </main>

      {showPostPreview && (
        <aside
          className={`hidden shrink-0 overflow-hidden transition-all duration-300 ease-in-out md:sticky md:top-20 md:flex ${
            previewOpen ? "md:w-[659px] md:opacity-100" : "md:w-0 md:opacity-0"
          }`}
        >
          <div className="flex w-[659px] shrink-0 flex-col gap-2">
            <span className={blackLabel}>미리보기 — 게시하면 이렇게 보여요</span>
            {/* 실제 DEMO 피드 카드(feed/page.tsx)를 그대로 축소 없이 재현한다(2026-09-15,
                사용자 요청 — "실제 게시물 크기 및 상단 하단에 게시자 이름과 캡션, 좋아요
                댓글 칸들이 그대로 들어가야함"). 카드 폭 659px·미디어 정사각형(1:1)은
                feed/page.tsx에서 확정된 DEMO 카드 크기와 동일값을 그대로 씀 — 헤더(아바타
                +이름+메타)와 좋아요·댓글 아이콘 줄까지 실제 카드와 같은 구조로 넣어서
                "이렇게 보여요"가 문자 그대로 맞게 했다. 실제 카드와의 유일한 차이는 세로
                높이(실제는 로그인 전용 oneScreenFeed 프레임 안에서 계산되지만 이 페이지는
                그 프레임 밖이라 내용물 높이 그대로 쌓임)와, 좋아요/댓글이 아직 게시 전이라
                숫자 대신 아이콘만 보여준다는 점(실제로 누를 수도 없어 title 속성으로 안내). */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 p-3">
                <Avatar userId={currentUserId ?? ""} name={authorName} className="h-8 w-8 text-xs" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-gray-800">{authorName}</span>
                  <span className="truncate text-xs text-gray-400">{authorMetaLine}</span>
                </div>
              </div>
              {title && <p className="px-3 pb-0.5 text-sm font-bold text-gray-900">{title}</p>}
              <p className="px-3 pb-2 text-sm text-gray-700">
                {caption || <span className="text-gray-400">캡션이 여기 보여요</span>}
              </p>
              <div className="relative flex w-full items-center justify-center bg-black">
                {previewVideoSrc ? (
                  <video
                    src={previewVideoSrc}
                    poster={previewCoverSrc ?? undefined}
                    controls
                    muted
                    className="aspect-square w-full object-cover"
                  />
                ) : previewCoverSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewCoverSrc}
                    alt="커버 미리보기"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center">
                    <p className="p-6 text-center text-sm text-gray-400">커버 이미지를 올리면 여기에 보여요</p>
                  </div>
                )}
              </div>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                  {selectedTags.map((tag) => (
                    <span key={tag} className={`rounded-full px-2 py-1 text-xs font-medium ${tagColorClass(tag)}`}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="flex items-center gap-6 border-t border-gray-100 px-4 py-3.5 text-base font-semibold text-gray-600"
                title="미리보기라 실제로 누를 수는 없어요"
              >
                <HeartIcon className="h-5 w-5" />
                <CommentIcon className="h-5 w-5" />
              </div>
            </div>
          </div>
        </aside>
      )}

      {gifPickerOpen && (
        <GiphyPicker onSelect={handleSelectGif} onClose={() => setGifPickerOpen(false)} />
      )}
    </div>
  );
}
