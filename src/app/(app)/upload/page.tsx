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
import { LockIcon, EyeIcon, HeartIcon, CommentIcon, SearchIcon, SunIcon, MoonIcon, ArrowUpIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { label as labelClass, errorText, pageCard } from "@/components/ui/styles";
import { ALL_GENRES } from "@/lib/genres";
import { tagColorClass } from "@/lib/feedConstants";
import type { ExpireHours } from "@/types/database";
import { editVideoFile } from "@/lib/trimVideo";
import { VideoEditor, type TrimRange } from "./VideoEditor";

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

const UPLOAD_TYPE_OPTIONS: {
  value: UploadType;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
}[] = [
  { value: "demo", label: "DEMO", Icon: SunIcon },
  { value: "complex", label: "memo", Icon: MoonIcon },
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

// 커버 이미지는 피드/미리보기 어디서든 1:1 정사각형(2026-09-14 확정, feed/page.tsx의
// DEMO 카드 통일)으로만 보여지므로, 예전처럼 특정 비율 범위(세로 4:5~가로 1.91:1)를 벗어나면
// 업로드 자체를 막는 건 더 이상 맞지 않다(사용자 지적 — "업로드 불가하면 안 됨"). 대신
// 어떤 비율의 이미지가 와도 가운데를 기준으로 정사각형으로 크롭해서 저장한다(2026-09-16).
// GIF 커버(GiphyPicker로 고르는 쪽)는 File이 아니라 외부 URL 참조라 여기서 크롭할 대상 자체가
// 없다 — 어차피 표시할 때 object-cover+aspect-square라 화면에서는 이미 정사각형으로 보인다.
// position(0~100%, 기본 50/50=가운데)으로 어느 부분을 크롭할지 고를 수 있다 — 업로드 화면의
// 드래그 위치 조정 UI가 이 값을 넘긴다(2026-09-16, 사용자 요청).
function cropImageFileToSquare(
  file: File,
  position: { x: number; y: number } = { x: 50, y: 50 },
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const maxSx = img.naturalWidth - size;
      const maxSy = img.naturalHeight - size;
      const sx = maxSx * (position.x / 100);
      const sy = maxSy * (position.y / 100);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(img.src);
      if (!ctx) {
        // 크롭 실패해도 업로드 자체를 막진 않는다 — 원본 그대로 폴백(화면에선 어차피
        // object-cover가 정사각형으로 잘라 보여준다).
        resolve(file);
        return;
      }
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
      // 투명 배경(PNG)은 png로, 그 외엔 jpeg로 — canvas 기본 포맷은 png라 사진(jpeg 원본)까지
      // png로 내보내면 용량이 불필요하게 커진다.
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: outputType }) : file),
        outputType,
        0.92,
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

// 그레이는 배경 4단계(box-gray/main-gray/canvas-gray + 활성화 박스 전용 demo-bg, #fafafa
// DEMO 탭 배경색)와 텍스트/보더 전용 active-gray만 쓴다(globals.css 참고, 2026-09-16 재조정
// — 배경 4단계는 전부 데모탭 기준 살짝 어두운 밝은 톤, active-gray는 글씨·테두리용으로 유지).
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
// 네이티브 <input type="file">를 그대로 쓰면 브라우저 기본 버튼("Choose File" 등)이 file:
// 유사요소로만 살짝 꾸며져서 다른 화면 요소들과 톤이 안 맞고 허접해 보였다(사용자 지적,
// 2026-09-16) — UploadDropbox와 같은 패턴(숨긴 input + 직접 만든 버튼)으로 바꿈.
// 위 CoverFileButton(가로로 긴 작은 버튼+파일명 텍스트 한 줄) 시도가 오히려 더 허접해
// 보인다는 피드백(2026-09-16) — 위 메인 업로드 박스(UploadDropbox)와 같은 점선 정사각형
// 언어로 통일해서, 파일 고르기 전/후 모두 CoverPositionPicker와 같은 자리·같은 크기(160px
// 정사각형)의 요소가 서로 바뀌어 끼워지는 느낌으로 만든다 — 더 정돈되고 일관돼 보인다.
function CoverFileButton({ onChange }: { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* input은 button 밖 형제로 — <button> 안에 <input>은 유효하지 않은 마크업. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{ width: 160, height: 160 }}
        className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-active-gray bg-box-gray text-center text-active-gray transition-colors hover:bg-canvas-gray"
      >
        <ArrowUpIcon className="h-6 w-6" />
        <span className="text-sm font-bold">이미지 선택</span>
        <span className="text-[11px]">PNG · JPG · WEBP</span>
      </button>
    </>
  );
}

// CoverFileButton과 같은 자리에 나란히 두는 두 번째 선택지 — "GIF로 만들기"가 텍스트
// 버튼 하나뿐이라 선택하고 싶게 안 생겼다는 피드백(2026-09-16) — 같은 정사각형 점선
// 언어로 맞춰서 둘이 진짜 "둘 중 하나 고르는" 카드처럼 보이게 했다.
function GifPickerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: 160, height: 160 }}
      className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-active-gray bg-box-gray text-center text-active-gray transition-colors hover:bg-canvas-gray"
    >
      <SearchIcon className="h-6 w-6" />
      <span className="text-sm font-bold">GIF 검색</span>
      <span className="text-[11px]">GIPHY에서 찾기</span>
    </button>
  );
}
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
      // hover:opacity-80는 이 박스 테두리(border-active-gray)가 페이지 캔버스 배경(예전엔
      // 마찬가지로 active-gray, PageCanvas.tsx)과 색이 같아서 옅어져도 거의 안 보이고, 안쪽
      // 채움(box-gray)도 옅게 반투명해지는 정도라 박스 전체가 반응하는 느낌이 잘 안 났다
      // (사용자 지적, 2026-09-15). 그래서 채움 자체를 명확히 다른 색으로 바꿔서 점선 안 전체
      // 표면이 눈에 띄게 짙어지게 했다 — hover 색은 그레이 4단계 중 가장 짙은 canvas-gray를
      // 재사용(2026-09-16, 팔레트를 전체적으로 밝게 재조정하며 하드코딩된 #adadad를 정리).
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-active-gray px-6 py-10 text-center text-active-gray transition-colors ${
        dragOver ? "bg-demo-bg" : "bg-box-gray hover:bg-canvas-gray"
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
      <ArrowUpIcon className="h-8 w-8" />
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

// 업로드한 커버 이미지를 드래그해서 정사각형 크롭 노출 영역을 고르는 위젯(2026-09-16,
// 사용자 요청 — "노출영역을 조정할 수 있게끔"). 실제 크롭은 이 값을 들고 제출 시점에
// cropImageFileToSquare가 한 번만 수행하고, 여기서는 object-position만 실시간으로
// 바꿔서 가볍게 미리보기만 한다. 정확한 드래그 범위는 원본 이미지의 실제 여유 길이
// (naturalWidth/Height 중 더 긴 쪽 - 짧은 쪽)를 알아야 딱 맞지만, 그러려면 이미지 로드를
// 기다려야 해서 컨테이너 자체 크기를 기준으로 근사했다 — 사용자가 눈으로 보면서 직접
// 맞추는 UI라 약간의 오차보다 반응 속도가 더 중요하다고 판단.
function CoverPositionPicker({
  src,
  position,
  onChange,
  size = 160,
}: {
  src: string;
  position: { x: number; y: number };
  onChange: (next: { x: number; y: number }) => void;
  size?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);

  function clamp(v: number) {
    return Math.min(100, Math.max(0, v));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: position };
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    // 컨텐츠(이미지)를 오른쪽으로 끌면 보이는 창은 왼쪽으로 이동해야(=object-position
    // x%는 감소) 손가락을 따라 이미지가 움직이는 것처럼 느껴진다 — 그래서 부호를 반전.
    onChange({
      x: clamp(dragRef.current.startPos.x - (deltaX / rect.width) * 100),
      y: clamp(dragRef.current.startPos.y - (deltaY / rect.height) * 100),
    });
  }
  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ width: size, height: size }}
        className="relative shrink-0 cursor-move touch-none select-none overflow-hidden rounded-lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="커버 위치 조정"
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          style={{ objectPosition: `${position.x}% ${position.y}%` }}
        />
      </div>
      <p className="text-[11px] text-active-gray">드래그해서 노출 영역을 조정하세요</p>
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
  // coverFile은 원본(크롭 전) 파일을 그대로 들고 있는다 — 실제 정사각형 크롭은 제출 시점에
  // coverPosition을 반영해 한 번만 수행한다(2026-09-16, 사용자 요청 — 드래그로 노출 영역을
  // 조정할 수 있어야 해서, 선택 즉시 가운데로 확정 크롭해버리면 나중에 되돌릴 수 없었음).
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverFileError, setCoverFileError] = useState<string | null>(null);
  // 정사각형 크롭 시 어느 부분을 보여줄지 — 0~100%, 50/50이 가운데(기존 자동 크롭과 동일).
  // 새 파일을 고르거나 제거하면 다시 가운데로 리셋된다.
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  // 사진이 없는 유저를 위한 대안 — GIPHY에서 GIF를 골라 커버로 쓸 수 있다(GiphyPicker).
  // coverFile과 coverGifUrl은 동시에 하나만 유효(둘 중 하나를 고르면 다른 쪽은 비운다).
  // GIF는 파일이 아니라 외부 URL 참조라 픽셀을 직접 크롭할 수 없어서 위치 조정 대상에서는
  // 빠진다(사용자에게 안내, 추후 필요해지면 DB에 노출 위치를 저장하는 별도 작업 필요).
  const [coverGifUrl, setCoverGifUrl] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  // 영상 편집(VideoEditor, 2026-09-23) — DEMO/memo 단독 공용. trimRange=null이면 원본 전체.
  // 영상 커버는 coverFile을 그대로 재사용한다: 프레임에서 고르면 그 프레임 JPEG가,
  // "컴퓨터에서 선택"이면 고른 이미지가 coverFile이 되고 coverFromFrame으로 둘을 구분한다.
  // coverFrameTime=null은 "아직 직접 안 고름"(다듬기 시작점 프레임이 기본 커버로 따라감).
  const [trimRange, setTrimRange] = useState<TrimRange | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [coverFrameTime, setCoverFrameTime] = useState<number | null>(null);
  const [coverFromFrame, setCoverFromFrame] = useState(false);
  // 게시 중 단계 안내 — 다듬기(ffmpeg 로드+자르기)는 수 초~수십 초 걸릴 수 있어서 버튼에 표시.
  const [loadingLabel, setLoadingLabel] = useState("게시 중...");
  // 영상 소리 편집(2026-09-24) — 원본 소리 끄기, 음원 넣기(영상 길이에 맞춰 잘림).
  const [muteOriginal, setMuteOriginal] = useState(false);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicStart, setMusicStart] = useState(0);

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

  function resetVideoEdit() {
    setTrimRange(null);
    setMuteOriginal(false);
    setMusicFile(null);
    setMusicStart(0);
    setVideoDuration(0);
    setCoverFrameTime(null);
    setCoverFromFrame(false);
  }

  function handleFileChange(file: File | null) {
    setMediaFileError(null);
    setCoverFile(null);
    setCoverFileError(null);
    setCoverPosition({ x: 50, y: 50 });
    setCoverGifUrl(null);
    resetVideoEdit();
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      setMediaFile(null);
      setMediaKind(null);
      setMediaFileError(`파일 용량이 ${formatMB(file.size)}예요. ${formatMB(MAX_FILE_SIZE_BYTES)} 이하만 올릴 수 있어요.`);
      return;
    }
    setMediaFile(file);
    setMediaKind(file ? detectMediaKind(file) : null);
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    setCoverFileError(null);
    // 비율 상관없이 무조건 받는다(사용자 요청 — "이미지 비율이 안 맞다고 업로드 불가하면
    // 안 됨"). 원본을 그대로 들고 있다가 드래그로 위치를 고르게 하고, 실제 정사각형 크롭은
    // 제출 시점에(handleSubmit) coverPosition을 반영해서 한다.
    setCoverFile(file);
    setCoverFromFrame(false);
    setCoverPosition({ x: 50, y: 50 });
    if (file) setCoverGifUrl(null);
  }

  // VideoEditor에서 프레임 커버가 잡혔을 때 — 프레임은 영상 화면(가운데 정사각형으로 보임)과
  // 같은 기준이어야 해서 노출 위치는 항상 가운데로 둔다.
  function handleCoverFrame(time: number | null, file: File) {
    setCoverFrameTime(time);
    setCoverFile(file);
    setCoverFromFrame(true);
    setCoverFileError(null);
    setCoverPosition({ x: 50, y: 50 });
    setCoverGifUrl(null);
  }

  // 다듬기 구간이 원본과 실질적으로 다를 때만 실제 자르기를 한다(핸들을 살짝 건드렸다 되돌린
  // 정도로 ffmpeg를 받게 하지 않음).
  const hasMeaningfulTrim =
    trimRange !== null &&
    videoDuration > 0 &&
    (trimRange.start > 0.1 || trimRange.end < videoDuration - 0.1);

  // 편집(다듬기·소리)이 하나라도 있을 때만 ffmpeg로 파일을 새로 만든다.
  async function applyVideoEditIfNeeded(file: File, kind: DetectedMediaKind): Promise<File> {
    const hasSoundEdit = muteOriginal || musicFile !== null;
    if (kind !== "video" || (!hasMeaningfulTrim && !hasSoundEdit) || videoDuration <= 0) return file;
    const range = hasMeaningfulTrim && trimRange ? trimRange : { start: 0, end: videoDuration };
    setLoadingLabel("영상 편집 중...");
    try {
      return await editVideoFile(
        file,
        { start: range.start, end: range.end, muteOriginal, music: musicFile, musicStart },
        (ratio) => setLoadingLabel(`영상 편집 중... ${Math.round(ratio * 100)}%`),
      );
    } finally {
      setLoadingLabel("게시 중...");
    }
  }

  function handleSelectGif(gif: { url: string; width: number; height: number }) {
    setCoverGifUrl(gif.url);
    setCoverFile(null);
    setCoverFileError(null);
    setCoverPosition({ x: 50, y: 50 });
    setGifPickerOpen(false);
  }

  // 공동창작 체크 여부로 memo 업로드가 두 갈래로 갈린다(정책 변경, 사용자 요청):
  // 체크(collab) — 기존처럼 음원(mp3/wav)만, 채팅 협업방으로 게시. 미체크 — DEMO와 동일하게
  // 영상/음원 다 허용 + 커버 이미지 필수 + 좋아요/댓글/조회자 목록으로 게시.
  function handleComplexFileChange(file: File | null) {
    setComplexFileError(null);
    setCoverFile(null);
    setCoverFileError(null);
    setCoverPosition({ x: 50, y: 50 });
    setCoverGifUrl(null);
    resetVideoEdit();
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
  // DEMO와 memo 단독(공동창작 미체크)은 업로드 폼 자체가 구조적으로 동일(영상/음원+커버,
  // 위 "공동창작 미체크 = DEMO와 동일한 형태" 주석 참고) — 그런데 미리보기는 DEMO 전용
  // 조건으로만 걸려있어서, memo에서 영상을 올려도 미리보기가 아예 안 뜨는 문제가 있었다
  // (사용자 제보, 2026-09-15). 협업(collabAvailable)은 채팅 중심의 다른 화면이라 제외하고
  // 둘 다 같은 미리보기를 보여주게 통합.
  const showsFeedLikePreview = uploadType === "demo" || (uploadType === "complex" && !collabAvailable);
  const activeFile = uploadType === "demo" ? mediaFile : complexFile;
  const activeKind = uploadType === "demo" ? mediaKind : complexKind;
  const activeObjectUrl = uploadType === "demo" ? mediaObjectUrl : complexObjectUrl;
  // 미리보기도 다듬은 구간만 재생되게 media fragment(#t=시작,끝)를 붙인다.
  const previewVideoSrc =
    showsFeedLikePreview && activeKind === "video" && activeObjectUrl
      ? hasMeaningfulTrim && trimRange
        ? `${activeObjectUrl}#t=${trimRange.start.toFixed(2)},${trimRange.end.toFixed(2)}`
        : activeObjectUrl
      : null;
  // 인스타그램처럼 "게시하면 이렇게 보여요"를 실시간으로 보여주는 미리보기 — 커버 이미지가
  // 이제 DEMO의 메인 비주얼이라, 영상이 없어도(음원만 골랐거나 아직 아무것도 안 골랐어도)
  // 커버+캡션+해시태그만으로 미리보기를 띄운다.
  const showPostPreview = showsFeedLikePreview && (previewCoverSrc || activeFile);
  // memo 단독 게시물 미리보기는 실제 memo 피드처럼 다크 톤 + 우상단 남은시간 뱃지가 있어야
  // 한다(2026-09-15, 사용자 요청). 업로드 화면 자체는 dark 클래스가 안 걸려있어서(피드에서만
  // ThemeSync가 <html>에 .dark를 붙임) dark: variant 대신 조건부로 직접 색을 고른다.
  const previewIsMemo = uploadType === "complex";
  // 노출 시간(expireHours)로부터 지금 게시하면 언제 만료될지 미리 계산 — TimeLimitBadge가
  // 알아서 카운트다운하므로 값 자체는 expireHours가 바뀔 때만 다시 계산하면 된다(캡션 등
  // 다른 입력마다 재계산해 카운트다운이 매번 리셋되는 걸 막음).
  const previewExpiresAt = useMemo(
    () => (previewIsMemo ? new Date(Date.now() + expireHours * 60 * 60 * 1000).toISOString() : null),
    [previewIsMemo, expireHours],
  );

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
        complexMediaPath = await uploadFileToR2(await applyVideoEditIfNeeded(complexFile, complexKind));
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
            // 실제 정사각형 크롭은 여기서 한 번만 — coverPosition(드래그로 고른 노출 영역)을
            // 반영해 업로드 직전에 수행한다.
            complexThumbnailPath = await uploadFileToR2(await cropImageFileToSquare(coverFile, coverPosition));
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
      mediaPath = await uploadFileToR2(await applyVideoEditIfNeeded(mediaFile, mediaKind));
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
        thumbnailPath = await uploadFileToR2(await cropImageFileToSquare(coverFile, coverPosition));
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

  // 영상 편집 섹션 — DEMO와 memo 단독 업로드 박스 양쪽에서 같은 걸 쓴다.
  function renderVideoEditor(src: string) {
    return (
      <div className="border-t border-box-gray pt-3">
        <VideoEditor
          key={src}
          src={src}
          trim={trimRange}
          onTrimChange={setTrimRange}
          onDuration={setVideoDuration}
          coverTime={coverFrameTime}
          onCoverFrame={handleCoverFrame}
          onPickCustomCover={handleCoverChange}
          muteOriginal={muteOriginal}
          onMuteOriginalChange={setMuteOriginal}
          musicFile={musicFile}
          onMusicFileChange={(file) => {
            setMusicFile(file);
            setMusicStart(0);
          }}
          musicStart={musicStart}
          onMusicStartChange={setMusicStart}
          customCover={
            coverFile && !coverFromFrame && coverObjectUrl ? (
              <div className="flex items-start gap-3">
                <CoverPositionPicker src={coverObjectUrl} position={coverPosition} onChange={setCoverPosition} />
                <div className="flex flex-col items-start gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      // 프레임 커버로 되돌림 — coverFrameTime=null이라 VideoEditor가 시작점 프레임을 다시 잡는다.
                      setCoverFile(null);
                      setCoverFrameTime(null);
                      setCoverPosition({ x: 50, y: 50 });
                    }}
                    className="text-sm"
                  >
                    영상 장면으로 되돌리기
                  </Button>
                </div>
              </div>
            ) : null
          }
        />
      </div>
    );
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
                  <option.Icon className="h-4 w-4" />
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
              {mediaKind === "video" && mediaObjectUrl && renderVideoEditor(mediaObjectUrl)}
              {/* 커버 이미지는 음원일 때만 — 영상은 그 자체가 화면이라 버튼 자체를 안 보여준다
                  (사용자 요청: "없어도 되는 게 아니라 없어야 해"). 평소(파일 선택 전)에도 숨김. */}
              {mediaKind === "audio" && (
                <>
                  <div className="border-t border-box-gray pt-3">
                    <span className={blackLabel}>커버 이미지 (필수)</span>
                  </div>
                  {coverGifUrl ? (
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverGifUrl}
                        alt="선택한 GIF"
                        style={{ width: 160, height: 160 }}
                        className="shrink-0 rounded-xl object-cover"
                      />
                      <div className="flex flex-col items-start gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCoverGifUrl(null)}
                          className="text-sm"
                        >
                          GIF 제거
                        </Button>
                      </div>
                    </div>
                  ) : coverObjectUrl ? (
                    // 위 메인 업로드 박스와 같은 정사각형 점선 자리에 CoverPositionPicker가
                    // 들어간다(2026-09-16, 사용자 지적 — 가로로 긴 버튼+파일명 한 줄은 허접해
                    // 보임). "이미지 제거"는 그 옆 세로 버튼 자리로.
                    <div className="flex items-start gap-3">
                      <CoverPositionPicker
                        src={coverObjectUrl}
                        position={coverPosition}
                        onChange={setCoverPosition}
                      />
                      <div className="flex flex-col items-start gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setCoverFile(null);
                            setCoverFileError(null);
                            setCoverPosition({ x: 50, y: 50 });
                          }}
                          className="text-sm"
                        >
                          이미지 제거
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // 아직 아무것도 안 골랐을 때 — 이미지/GIF 둘 중 하나를 고르는 선택지를
                    // 같은 정사각형 점선 카드 두 개로 나란히(2026-09-16, 사용자 요청 — GIF
                    // 쪽도 "고르고 싶게" 디자인).
                    <div className="flex items-start gap-3">
                      <CoverFileButton onChange={handleCoverChange} />
                      <GifPickerButton onClick={() => setGifPickerOpen(true)} />
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
              {showPostPreview && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen((v) => !v)}
                  className="hidden self-start text-xs font-medium text-active-gray hover:underline md:inline"
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
              {!collabAvailable && complexKind === "video" && complexObjectUrl && renderVideoEditor(complexObjectUrl)}
              {/* 공동창작 미체크 = DEMO와 동일한 형태(사용자 요청)라 음원일 때만 커버 이미지
                  버튼을 보여준다 — 영상은 그 자체가 화면이라 버튼 자체를 숨긴다. */}
              {!collabAvailable && complexKind === "audio" && (
                <>
                  <div className="border-t border-box-gray pt-3">
                    <span className={blackLabel}>커버 이미지 (필수)</span>
                  </div>
                  {coverGifUrl ? (
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverGifUrl}
                        alt="선택한 GIF"
                        style={{ width: 160, height: 160 }}
                        className="shrink-0 rounded-xl object-cover"
                      />
                      <div className="flex flex-col items-start gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCoverGifUrl(null)}
                          className="text-sm"
                        >
                          GIF 제거
                        </Button>
                      </div>
                    </div>
                  ) : coverObjectUrl ? (
                    // 위 메인 업로드 박스와 같은 정사각형 점선 자리에 CoverPositionPicker가
                    // 들어간다(2026-09-16, 사용자 지적 — 가로로 긴 버튼+파일명 한 줄은 허접해
                    // 보임). "이미지 제거"는 그 옆 세로 버튼 자리로.
                    <div className="flex items-start gap-3">
                      <CoverPositionPicker
                        src={coverObjectUrl}
                        position={coverPosition}
                        onChange={setCoverPosition}
                      />
                      <div className="flex flex-col items-start gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setCoverFile(null);
                            setCoverFileError(null);
                            setCoverPosition({ x: 50, y: 50 });
                          }}
                          className="text-sm"
                        >
                          이미지 제거
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // 아직 아무것도 안 골랐을 때 — 이미지/GIF 둘 중 하나를 고르는 선택지를
                    // 같은 정사각형 점선 카드 두 개로 나란히(2026-09-16, 사용자 요청 — GIF
                    // 쪽도 "고르고 싶게" 디자인).
                    <div className="flex items-start gap-3">
                      <CoverFileButton onChange={handleCoverChange} />
                      <GifPickerButton onClick={() => setGifPickerOpen(true)} />
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
            {loading ? loadingLabel : <span suppressHydrationWarning>&quot;{submitPhrase}&quot;</span>}
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
            <div
              className={`overflow-hidden rounded-2xl border ${
                previewIsMemo ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 p-3">
                <Avatar userId={currentUserId ?? ""} name={authorName} className="h-8 w-8 text-xs" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate text-sm font-medium ${previewIsMemo ? "text-gray-200" : "text-gray-800"}`}>
                    {authorName}
                  </span>
                  <span className={`truncate text-xs ${previewIsMemo ? "text-gray-500" : "text-gray-400"}`}>
                    {authorMetaLine}
                  </span>
                </div>
                {/* memo는 노출 시간이 필수라 실제 피드처럼 헤더 우측에 남은시간 뱃지가 뜬다
                    (2026-09-15, 사용자 요청) — DEMO는 영구노출이라 안 뜬다. */}
                {previewExpiresAt && <TimeLimitBadge expiresAt={previewExpiresAt} />}
              </div>
              {title && (
                <p className={`px-3 pb-0.5 text-sm font-bold ${previewIsMemo ? "text-gray-100" : "text-gray-900"}`}>
                  {title}
                </p>
              )}
              <p className={`px-3 pb-2 text-sm ${previewIsMemo ? "text-gray-300" : "text-gray-700"}`}>
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
                    // GIF(coverGifUrl)는 외부 URL이라 위치 조정 대상이 아니라 가운데 고정,
                    // 직접 올린 이미지는 CoverPositionPicker에서 고른 위치를 그대로 반영.
                    style={coverGifUrl ? undefined : { objectPosition: `${coverPosition.x}% ${coverPosition.y}%` }}
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
                className={`flex items-center gap-6 border-t px-4 py-3.5 text-base font-semibold ${
                  previewIsMemo ? "border-gray-800 text-gray-300" : "border-gray-100 text-gray-600"
                }`}
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
