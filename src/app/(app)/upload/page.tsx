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
import {
  LockIcon,
  EyeIcon,
  HeartIcon,
  CommentIcon,
  SearchIcon,
  ArrowUpIcon,
  FlameIcon,
  GlobeIcon,
  ChevronDownIcon,
  ImageIcon,
} from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { label as labelClass, errorText, pageCard } from "@/components/ui/styles";
import { ALL_GENRES } from "@/lib/genres";
import { tagColorClass } from "@/lib/feedConstants";
import type { ExpireHours } from "@/types/database";
import { editVideoFile } from "@/lib/trimVideo";
import { VideoEditor, type TrimRange } from "./VideoEditor";
import { notifyReaction } from "@/lib/notifyReaction";
import { HAPTIC, haptic } from "@/lib/haptics";
import { acquireWakeLock } from "@/lib/wakeLock";
import { takeSharedUploadFile } from "@/lib/shareTarget";
import { track } from "@/lib/analytics";
import { FEEDBACK_FOCUS_OPTIONS, FEEDBACK_NOTE_MAX, feedbackFocusText } from "@/lib/feedbackFocus";

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

// 2026-09-25(사용자 요청) memo 작업물 기능을 DEMO에 통합 — "게시 유형(DEMO/memo)" 선택 없이
// 한 폼에서 공개 범위·노출 기간·콜라보를 옵션으로 고른다. 저장 형태는 예전과 같다:
//   공개 범위 → posts.visibility(public / followers=Companion 공개 / invite_only=특정인 공개, 초대는
//   post_access), 노출 기간 → expires_at(영구면 null), 콜라보 → collab_available(채팅·재창작 스택).
type Audience = "public" | "companion" | "specific";
const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "public", label: "전체" },
  { value: "companion", label: "Companion" },
  { value: "specific", label: "특정인" },
];
// 2026-09-26(사용자 요청) 계속·24시간·7일 세 개로 줄임(6시간·3일 제거 — 실제로 기간을 고른 글이 0건).
const EXPIRE_OPTIONS: { hours: ExpireHours | null; label: string }[] = [
  { hours: null, label: "계속" },
  { hours: 24, label: "24시간" },
  { hours: 168, label: "7일" },
];

// 미리보기 남은시간 뱃지용 — 노출 기간 버튼을 누를 때만 부른다(렌더 중 Date.now() 금지 규칙).
function expiresAtFromNow(hours: ExpireHours | null) {
  return hours === null ? null : new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// 게시 설정은 평소 한 줄 요약만 보이고 눌러야 펼쳐진다(2026-09-26 — 거의 모두 기본값으로 올림).
function settingsSummary(audience: Audience, expireHours: ExpireHours | null) {
  const who = audience === "public" ? "전체 공개" : audience === "companion" ? "Companion 공개" : "특정인 공개";
  const label = EXPIRE_OPTIONS.find((o) => o.hours === expireHours)?.label ?? "";
  return `${who} · ${expireHours === null ? "계속 유지" : `${label} 뒤 숨김`}`;
}

// posts.expire_hours는 not null 컬럼이라 demo(영구노출)에도 값이 필요하지만,
// 영구노출 여부는 expires_at(null)로만 판단하므로(feed/page.tsx 쿼리 참고) 이 값 자체는 화면에 노출되지 않는다.
const PERMANENT_POST_EXPIRE_HOURS_PLACEHOLDER: ExpireHours = 48;

// 영상/음원 둘 다 올릴 수 있다. 콜라보(음원 전용)는 2026-09-26 업로드 화면에서 숨김(사용자 결정 —
// 실사용 0건). DB 컬럼(collab_available)과 피드 쪽 콜라보 화면은 기존 글을 위해 그대로 둔다.
type DetectedMediaKind = "video" | "audio";
const VIDEO_OR_AUDIO_ACCEPT = "video/mp4,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/x-wav";

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
// 건드리지 않고, 여기서만 색만 이 4가지+검정 글씨로 덮어써(입력칸 스타일은 아래 innerField/bareField로 새로 정의) 확장한다.
// w-full: pageCard는 max-w만 있어서 카드 폭이 내용물 고유 너비를 따라간다 — 해시태그 검색으로
// 칩 목록이 줄면 폼 전체가 좁아지는 문제가 있어 이 페이지에서는 폭을 항상 max-w까지 고정.
const wideCard = `${pageCard} w-full`;
const blackLabel = `${labelClass} !text-black`;
// 네이티브 <input type="file">를 그대로 쓰면 브라우저 기본 버튼("Choose File" 등)이 file:
// 유사요소로만 살짝 꾸며져서 다른 화면 요소들과 톤이 안 맞고 허접해 보였다(사용자 지적,
// 2026-09-16) — UploadDropbox와 같은 패턴(숨긴 input + 직접 만든 버튼)으로 바꿈.
// 위 CoverFileButton(가로로 긴 작은 버튼+파일명 텍스트 한 줄) 시도가 오히려 더 허접해
// 보인다는 피드백(2026-09-16) — 위 메인 업로드 박스(UploadDropbox)와 같은 점선 정사각형
// 언어로 통일해서, 파일 고르기 전/후 모두 CoverPositionPicker와 같은 자리·같은 크기(160px
// 정사각형)의 요소가 서로 바뀌어 끼워지는 느낌으로 만든다 — 더 정돈되고 일관돼 보인다.
function CoverFileButton({
  onChange,
  size = 160,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  size?: number;
}) {
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
        style={{ width: size, height: size }}
        className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-active-gray bg-box-gray text-center text-active-gray transition-colors hover:bg-canvas-gray"
      >
        <ImageIcon className="h-6 w-6" />
        <span className="text-sm font-bold">커버 이미지</span>
        <span className="text-[11px]">PNG · JPG · WEBP</span>
      </button>
    </>
  );
}

// 공유 <Button variant="primary">는 기본이 검정 배경(다른 화면들과 공유하는 토큰이라 그대로 둠) —
// 이 화면(그레이 3단계 규칙)에서만 !important로 활성화 박스 색(demo-bg)으로 덮어쓴다.
// !important가 배경색을 고정해버려서 Button 기본 hover:bg-gray-800이 안 먹으니, 다른 버튼들과
// 같은 hover:opacity로 눌렀을 때 짙어지는 느낌을 따로 챙겨준다.
const primaryButtonClass = "!bg-demo-bg !text-black hover:opacity-80";

// 게시 설정 세그먼트(공개·기간) — main-gray 홈 안에서 고른 칸만 밝은 활성화 박스로 떠오른다.
function segmentClass(active: boolean) {
  const colors = active ? "bg-demo-bg font-semibold text-black ring-1 ring-canvas-gray" : "text-active-gray hover:text-black";
  return `flex items-center justify-center gap-1 rounded-md px-1 py-1.5 text-xs transition ${colors}`;
}

// 섹션(box-gray) 안의 입력칸 — 한 단계 밝은 활성화 박스 색 위에 적는다.
const innerField =
  "w-full rounded-lg border border-transparent bg-demo-bg px-3 py-2 text-sm text-black placeholder:text-active-gray/70 focus:border-active-gray focus:outline-none";
// 작업물 카드의 제목·캡션 — 칸 테두리 없이 카드에 바로 적는 느낌(포커스 때만 밑줄 없이 그대로).
const bareField =
  "w-full border-none bg-transparent p-0 text-black placeholder:text-active-gray/70 focus:outline-none focus:ring-0";
const COVER_SLOT = 128;

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-active-gray" : "bg-canvas-gray"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-demo-bg shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

// 해시태그 목록 박스는 채색 없이 테두리만(사용자 지시 — "이전처럼") 그려서 안의 바탕은
// 카드 자체 색(main-gray)이 그대로 비친다 — 칩은 그 위에서 옅은 톤(box-gray)으로 도드라지고,
// 선택되면 활성화 박스 색(demo-bg)으로 바뀐다.
function chipButtonClass(active: boolean) {
  // 섹션(box-gray) 위라 안 고른 칩은 한 단계 짙은 main-gray, 고른 칩은 밝은 활성화 박스+테두리.
  const colors = active
    ? "bg-demo-bg text-black font-semibold ring-1 ring-active-gray"
    : "bg-main-gray text-black hover:bg-canvas-gray";
  return `rounded-full px-3 py-1.5 text-sm transition ${colors}`;
}

// 파일 input을 감춘 큰 dropzone — 클릭·드래그앤드롭 둘 다 지원. 업로드 가능한 확장자를
// 박스 안에 나열해서 별도 라벨 없이 이 박스 하나로 파일 선택 UI를 대체한다.
const UPLOADABLE_FORMATS = "mp3 · wav · mp4 · mov";

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
      // 파일을 고른 뒤엔 큰 점선 박스 대신 파일 정보 한 줄로 줄어든다(2026-09-26 — 여전히 클릭·드롭으로 교체).
      className={
        file
          ? `flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-active-gray transition-colors ${
              dragOver ? "bg-demo-bg" : "bg-main-gray hover:bg-canvas-gray"
            }`
          : `relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-active-gray px-6 py-10 text-center text-active-gray transition-colors ${
              dragOver ? "bg-demo-bg" : "bg-box-gray hover:bg-canvas-gray"
            }`
      }
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
      {file ? (
        <>
          <ArrowUpIcon className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-black">{file.name}</p>
          <span className="shrink-0 text-xs">{file.size < 1024 * 1024 ? "1MB 미만" : formatMB(file.size)} · 교체</span>
          <button
            type="button"
            aria-label="파일 제거"
            title="파일 제거"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black transition hover:bg-demo-bg"
          >
            ×
          </button>
        </>
      ) : (
        <>
          <ArrowUpIcon className="h-6 w-6" />
          <p className="text-base font-bold text-active-gray">Upload</p>
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
  hint = true,
}: {
  src: string;
  position: { x: number; y: number };
  onChange: (next: { x: number; y: number }) => void;
  size?: number;
  hint?: boolean;
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
      {hint && <p className="text-[11px] text-active-gray">드래그해서 노출 영역을 조정하세요</p>}
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const supabase = createClient();

  // 영상 또는 음원 파일 하나만 필수로 업로드, 종류는 자동 판별
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

  // 작품 제목 — caption(부가 설명, 선택)과 분리된 필수 입력(0052, 2026-09-15 사용자 요청).
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [popularUserTags, setPopularUserTags] = useState<string[]>([]);
  // 게시 설정(2026-09-25 memo 통합) — 기본은 전체 공개·영구·콜라보 끔(옛 DEMO와 같음).
  const [audience, setAudience] = useState<Audience>("public");
  const [expireHours, setExpireHours] = useState<ExpireHours | null>(null);
  // 미리보기 카드의 남은시간 뱃지용 — 렌더 중 Date.now()를 부르지 않도록 노출 기간을 고를 때 계산.
  const [previewExpiresAt, setPreviewExpiresAt] = useState<string | null>(null);
  const [inviteUsers, setInviteUsers] = useState<PickedUser[]>([]);
  // 피드백 받기(0089) — 켜면 feedback_focus에 고른 분야(없으면 빈 배열=전체적으로)를 저장.
  const [feedbackOn, setFeedbackOn] = useState(false);
  const [feedbackFocus, setFeedbackFocus] = useState<string[]>([]);
  const [feedbackNote, setFeedbackNote] = useState("");
  // 게시 설정(공개·기간)은 한 줄 요약으로 접혀 있다가 눌러야 펼쳐진다.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 해시태그 추천 칩은 처음엔 두어 줄만 — "더 보기"로 전체(예전 스크롤 박스는 칩이 반쯤 잘려 보였다).
  const [showAllTags, setShowAllTags] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 이용 통계(0079) — 올리려다 어디서 막혔는지(검증 메시지·업로드 실패). 성공은 posts 테이블로 안다.
  useEffect(() => {
    if (error) track("upload_error", { props: { message: error.slice(0, 120) } });
  }, [error]);
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

  // 음원 파일의 사운드바 재생용 object URL — 값 계산(useMemo)과 정리(effect)를 분리.
  const mediaObjectUrl = useMemo(() => (mediaFile ? URL.createObjectURL(mediaFile) : null), [mediaFile]);
  useEffect(() => {
    return () => {
      if (mediaObjectUrl) URL.revokeObjectURL(mediaObjectUrl);
    };
  }, [mediaObjectUrl]);

  // 커버 이미지 미리보기용 object URL — 같은 패턴. GIF를 골랐으면 coverGifUrl(이미 완성된
  // URL)을 그대로 쓰고, 직접 올린 사진이면 이 object URL을 쓴다(previewCoverSrc가 둘을 합침).
  const coverObjectUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  useEffect(() => {
    return () => {
      if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
    };
  }, [coverObjectUrl]);
  const previewCoverSrc = coverGifUrl ?? coverObjectUrl;

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
    const kind = file ? detectMediaKind(file) : null;
    setMediaFile(file);
    setMediaKind(kind);
  }

  // Android 공유 시트에서 Compmusic으로 보낸 음원·영상(Share Target, shareTarget.ts) — sw.js가
  // 캐시에 넣어두고 ?shared=1로 보낸 파일을 한 번 꺼내 DEMO 업로드 파일로 채운다. 서비스 워커가
  // 아직 없어 서버로 바로 온 경우(?shared=missing)엔 다시 골라달라고 안내한다.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("shared");
    if (!shared) return;
    let cancelled = false;
    void takeSharedUploadFile().then((file) => {
      if (cancelled) return;
      if (file) {
        handleFileChange(file);
      } else {
        setMediaFileError("공유한 파일을 받지 못했어요. 아래에서 파일을 다시 선택해주세요.");
      }
    });
    return () => {
      cancelled = true;
    };
    // 마운트 때 한 번만 — handleFileChange는 매 렌더 새로 만들어지지만 여기선 첫 렌더 것이면 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleExpireChange(hours: ExpireHours | null) {
    setExpireHours(hours);
    setPreviewExpiresAt(expiresAtFromNow(hours));
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

  // 추천 칩 — 이미 고른 태그는 위 "선택됨" 줄에 있으니 뺀다. 검색 중이거나 "더 보기"를 눌렀으면
  // 전부, 아니면 인기 6개 + 기본 12개만(두어 줄).
  const collapsedTags = !showAllTags && !tagSearch.trim();
  const popularCandidates = filteredPopularUserTags.filter((t) => !selectedTags.includes(t));
  const genreCandidates = filteredGenres.filter((t) => !selectedTags.includes(t) && !popularCandidates.includes(t));
  const visiblePopularTags = collapsedTags ? popularCandidates.slice(0, 6) : popularCandidates;
  const visibleGenreTags = collapsedTags ? genreCandidates.slice(0, 12) : genreCandidates;
  const hiddenTagCount =
    popularCandidates.length + genreCandidates.length - visiblePopularTags.length - visibleGenreTags.length;
  const suggestedTags = [...popularCandidates, ...genreCandidates];

  // 게시 버튼에 보여줄 남은 필수 항목(submitPost 검증과 같은 순서·조건).
  const missingItems: string[] = [];
  if (!mediaFile || !mediaKind) missingItems.push("파일");
  if (mediaKind === "audio" && !coverFile && !coverGifUrl) missingItems.push("커버");
  if (!title.trim()) missingItems.push("제목");
  if (audience === "public" && selectedTags.length < MIN_TAGS) missingItems.push(`해시태그 ${MIN_TAGS - selectedTags.length}개`);
  if (audience === "specific" && inviteUsers.length === 0) missingItems.push("초대할 사람");

  // 인스타그램처럼 "게시하면 이렇게 보여요"를 실시간으로 보여주는 미리보기 — 콜라보는 채팅 중심의
  // 다른 화면이라 제외. 커버 이미지가 메인 비주얼이라 영상이 없어도(음원만 골랐거나 아직 아무것도
  // 안 골랐어도) 커버+캡션+해시태그만으로 띄운다.
  const showsFeedLikePreview = true;
  // 미리보기도 다듬은 구간만 재생되게 media fragment(#t=시작,끝)를 붙인다.
  const previewVideoSrc =
    showsFeedLikePreview && mediaKind === "video" && mediaObjectUrl
      ? hasMeaningfulTrim && trimRange
        ? `${mediaObjectUrl}#t=${trimRange.start.toFixed(2)},${trimRange.end.toFixed(2)}`
        : mediaObjectUrl
      : null;
  const showPostPreview = showsFeedLikePreview && (previewCoverSrc || mediaFile);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 영상 다듬기(ffmpeg)·업로드 도중 폰 화면이 꺼지면 브라우저가 작업을 멈출 수 있어서, 끝날
    // 때까지 화면을 켜둔다(wakeLock.ts — 미지원 브라우저면 아무것도 안 함).
    const releaseWakeLock = await acquireWakeLock();
    try {
      await submitPost();
    } finally {
      releaseWakeLock();
    }
  }

  async function submitPost() {
    setError(null);
    track("upload_submit", { props: { tab: audience } });

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
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
    // 해시태그는 전체 공개 글만 필수 — 태그로 탐색하는 공개 피드용이라(옛 memo엔 태그가 없었다).
    if (audience === "public" && selectedTags.length < MIN_TAGS) {
      setError(`전체 공개 게시물은 해시태그를 최소 ${MIN_TAGS}개 선택해주세요.`);
      return;
    }
    if (audience === "specific" && inviteUsers.length === 0) {
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

    // R2로 이전(2026-07-29) — presigned PUT URL을 발급받아 브라우저가 R2에 직접 업로드.
    let mediaPath: string;
    try {
      mediaPath = await uploadFileToR2(await applyVideoEditIfNeeded(mediaFile, mediaKind));
    } catch (err) {
      setError(`업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      setLoading(false);
      return;
    }

    // 커버는 thumbnail_url(원래 있던 미사용 컬럼)에 저장한다. GIF를 골랐으면 GIPHY 자체 URL을
    // 그대로 쓰고(resolveMediaUrl이 읽을 때 구분), 직접 올린 사진이면 coverPosition(드래그로 고른
    // 노출 영역)을 반영해 여기서 한 번만 정사각형으로 크롭해 R2에 올린다.
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
    // 영구 노출은 expires_at=null(피드 쿼리가 만료 취급을 안 함).
    const expiresAt = expireHours === null ? null : new Date(publishedAt.getTime() + expireHours * 60 * 60 * 1000);

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
        visibility: audience === "public" ? "public" : audience === "companion" ? "followers" : "invite_only",
        collab_available: false,
        feedback_focus: feedbackOn ? feedbackFocus : null,
        feedback_note: feedbackOn && feedbackNote.trim() ? feedbackNote.trim().slice(0, FEEDBACK_NOTE_MAX) : null,
        collab_role_needed: null,
        status: "published",
        published_at: publishedAt.toISOString(),
        expire_hours: expireHours ?? PERMANENT_POST_EXPIRE_HOURS_PLACEHOLDER,
        expires_at: expiresAt?.toISOString() ?? null,
      })
      .select("id")
      .single();

    if (insertError || !post) {
      setError(`게시 실패: ${insertError?.message ?? "알 수 없는 오류"}`);
      setLoading(false);
      return;
    }

    // 특정인 초대 — post_access에 invited 상태로 일괄 등록(0012). 초대 인원별로 DB row 하나씩,
    // (post_id,user_id) unique라 중복 선택은 InviteUserPicker에서 이미 걸러짐.
    if (audience === "specific" && inviteUsers.length > 0) {
      const { error: accessError } = await supabase.from("post_access").insert(
        inviteUsers.map((invitee) => ({
          post_id: post.id,
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

    // Companion(특정인 공개면 초대받은 사람) 새 글 푸시 + 운영자 Discord(첫 반응 보장) — 0076.
    // 초대 등록 뒤에 불러야 대상이 잡힌다.
    notifyReaction({ kind: "published", postId: post.id });
    haptic(HAPTIC.success);
    setLoading(false);
    router.push("/feed");
  }

  // 영상 편집 섹션(다듬기·소리·커버 프레임).
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
        {/* 2026-09-26(사용자 요청) 업로드 화면 개편 — 섹션 네 개(파일 / 작업물 카드 / 피드백 받기 /
            해시태그) + 게시 설정 한 줄 + 남은 필수 항목을 알려주는 게시 버튼. 콜라보는 숨김. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            {mediaFile && mediaKind === "audio" && mediaObjectUrl && (
              <SoundbarPreview
                key={`${mediaFile.name}-${mediaFile.size}-${mediaFile.lastModified}`}
                file={mediaFile}
                src={mediaObjectUrl}
                tone="demo"
              />
            )}
            {mediaKind === "video" && mediaObjectUrl && renderVideoEditor(mediaObjectUrl)}
            {showPostPreview && (
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                className="hidden self-start text-xs font-medium text-active-gray hover:underline md:inline"
              >
                {previewOpen ? "미리보기 접기" : "미리보기 펼치기"}
              </button>
            )}
          </div>

          {/* 작업물 카드 — 음원이면 왼쪽에 커버(필수), 오른쪽에 제목·캡션(앨범 재킷처럼). 영상은 그
              자체가 화면이라 커버 자리가 없다(사용자 요청: "없어야 해"). */}
          <div className="flex gap-3 rounded-xl bg-box-gray p-3">
            {mediaKind === "audio" && (
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                {coverGifUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverGifUrl}
                    alt="선택한 GIF"
                    style={{ width: COVER_SLOT, height: COVER_SLOT }}
                    className="rounded-lg object-cover"
                  />
                ) : coverObjectUrl ? (
                  <CoverPositionPicker
                    src={coverObjectUrl}
                    position={coverPosition}
                    onChange={setCoverPosition}
                    size={COVER_SLOT}
                    hint={false}
                  />
                ) : (
                  <CoverFileButton onChange={handleCoverChange} size={COVER_SLOT} />
                )}
                {coverGifUrl || coverObjectUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverGifUrl(null);
                      setCoverFile(null);
                      setCoverFileError(null);
                      setCoverPosition({ x: 50, y: 50 });
                    }}
                    className="text-[11px] text-active-gray hover:underline"
                  >
                    {coverGifUrl ? "GIF 제거" : "드래그로 위치 조정 · 제거"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGifPickerOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-active-gray hover:underline"
                  >
                    <SearchIcon className="h-3 w-3" />
                    GIF로 대신하기
                  </button>
                )}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                type="text"
                aria-label="제목"
                placeholder="제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                // Safari가 이 필드를 이름/연락처로 오인해 자동완성 아이콘을 얹는 걸 방지
                // (사용자 제보 — 제목 칸에 사람 아이콘이 떴음).
                autoComplete="off"
                className={`${bareField} text-lg font-bold`}
              />
              <textarea
                aria-label="캡션"
                placeholder="어떤 작업물인가요? (선택)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={mediaKind === "audio" ? 4 : 2}
                className={`${bareField} flex-1 resize-none text-sm`}
              />
            </div>
          </div>
          {coverFileError && <p className={errorText}>{coverFileError}</p>}

          {/* 피드백 받기(0089) — 켜면 분야 칩(복수)과 한 줄 요청. 피드 카드에 칩으로 표시된다. */}
          <div className="flex flex-col gap-3 rounded-xl bg-box-gray p-3">
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-black">
                  <CommentIcon className="h-4 w-4" />
                  피드백 받기
                </span>
                <span className="text-xs text-active-gray">카드에 표시돼서 어떤 의견을 원하는지 알 수 있어요</span>
              </div>
              <Switch checked={feedbackOn} onChange={setFeedbackOn} label="피드백 받기" />
            </div>
            {feedbackOn && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-active-gray">어떤 부분을 봐줬으면 하나요? (여러 개, 안 고르면 전체적으로)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {FEEDBACK_FOCUS_OPTIONS.map((focus) => (
                      <button
                        key={focus}
                        type="button"
                        onClick={() =>
                          setFeedbackFocus((prev) =>
                            prev.includes(focus) ? prev.filter((f) => f !== focus) : [...prev, focus],
                          )
                        }
                        className={chipButtonClass(feedbackFocus.includes(focus))}
                      >
                        {focus}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  aria-label="피드백 요청 한 줄"
                  placeholder="한 줄로 구체적으로 (선택) — 후렴에서 킥이 묻히는지 봐주세요"
                  value={feedbackNote}
                  maxLength={FEEDBACK_NOTE_MAX}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  autoComplete="off"
                  className={innerField}
                />
              </>
            )}
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl bg-box-gray p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-black"># 해시태그</span>
              <span className="text-xs text-active-gray">
                {audience === "public" ? `${selectedTags.length} / ${MIN_TAGS}개 이상` : "선택"}
              </span>
            </div>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`${chipButtonClass(true)} flex items-center gap-1`}
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
                placeholder="검색하거나 직접 입력 후 Enter"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                className={innerField}
              />
              {tagSearch.trim() && (
                <Button type="button" onClick={addCustomTag} className="shrink-0 px-4 !bg-demo-bg !text-black hover:opacity-80">
                  추가
                </Button>
              )}
            </div>

            {suggestedTags.length === 0 ? (
              <p className="text-xs text-active-gray">일치하는 해시태그가 없어요. Enter로 그대로 추가할 수 있어요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {visiblePopularTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 pr-1 text-xs font-medium text-active-gray">
                      <FlameIcon className="h-3.5 w-3.5" />
                      인기
                    </span>
                    {visiblePopularTags.map((tag) => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)} className={chipButtonClass(false)}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {visibleGenreTags.map((tag) => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)} className={chipButtonClass(false)}>
                      #{tag}
                    </button>
                  ))}
                  {hiddenTagCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllTags(true)}
                      className="rounded-full border border-dashed border-active-gray px-3 py-1.5 text-sm text-active-gray transition hover:bg-demo-bg"
                    >
                      더 보기 +{hiddenTagCount}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 게시 설정 — 한 줄 요약, 누르면 공개 범위·기간이 펼쳐진다. */}
          <div className="rounded-xl bg-box-gray">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              className="flex w-full items-center gap-2 px-3 py-3 text-left"
            >
              {audience === "public" ? (
                <GlobeIcon className="h-4 w-4 text-active-gray" />
              ) : audience === "companion" ? (
                <EyeIcon className="h-4 w-4 text-active-gray" />
              ) : (
                <LockIcon className="h-4 w-4 text-active-gray" />
              )}
              <span className="flex-1 text-sm font-medium text-black">{settingsSummary(audience, expireHours)}</span>
              <span className="text-xs text-active-gray">변경</span>
              <ChevronDownIcon
                className={`h-4 w-4 text-active-gray transition-transform ${settingsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {settingsOpen && (
              <div className="flex flex-col gap-2.5 px-3 pb-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-xs text-active-gray">공개</span>
                  <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-main-gray p-1">
                    {AUDIENCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAudience(option.value)}
                        className={segmentClass(audience === option.value)}
                      >
                        {option.value === "companion" && <EyeIcon className="h-3.5 w-3.5" />}
                        {option.value === "specific" && <LockIcon className="h-3.5 w-3.5" />}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {audience === "specific" && (
                  <div className="pl-11">
                    <InviteUserPicker
                      currentUserId={currentUserId ?? ""}
                      value={inviteUsers}
                      onChange={setInviteUsers}
                      inputClassName={innerField}
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-xs text-active-gray">기간</span>
                  <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-main-gray p-1">
                    {EXPIRE_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => handleExpireChange(option.hours)}
                        className={segmentClass(expireHours === option.hours)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className={errorText}>{error}</p>}
          {/* 필수 항목이 남았으면 버튼이 뭐가 남았는지 알려주고(눌러도 아래 검증 메시지가 뜸), 다
              채우면 사투리 문구로 바뀌며 진하게 활성화된다. */}
          <Button
            type="submit"
            disabled={loading}
            className={`h-12 w-full rounded-xl ${
              missingItems.length === 0 ? `${primaryButtonClass} font-bold ring-1 ring-active-gray` : "!bg-box-gray !font-normal !text-active-gray hover:opacity-80"
            }`}
          >
            {loading ? (
              loadingLabel
            ) : missingItems.length > 0 ? (
              `${missingItems.join(" · ")} 남았어요`
            ) : (
              <span suppressHydrationWarning>&quot;{submitPhrase}&quot;</span>
            )}
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
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
            >
              <div className="flex items-center gap-2 p-3">
                <Avatar userId={currentUserId ?? ""} name={authorName} className="h-8 w-8 text-xs" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-gray-800">
                    {authorName}
                  </span>
                  <span className="truncate text-xs text-gray-400">
                    {authorMetaLine}
                  </span>
                </div>
                {/* 노출 기간을 정했으면 실제 피드처럼 헤더 우측에 남은시간 뱃지가 뜬다(영구면 없음). */}
                {previewExpiresAt && <TimeLimitBadge expiresAt={previewExpiresAt} />}
              </div>
              {title && (
                <p className="px-3 pb-0.5 text-sm font-bold text-gray-900">
                  {title}
                </p>
              )}
              <p className="px-3 pb-2 text-sm text-gray-700">
                {caption || <span className="text-gray-400">캡션이 여기 보여요</span>}
              </p>
              {/* 비공개 글은 피드 카드처럼 공개 범위 표시(feedRender.tsx와 같은 모양). */}
              {feedbackOn && (
                <div className="px-3 pb-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                    <CommentIcon className="h-3 w-3" />
                    피드백 환영 · {feedbackFocusText(feedbackFocus)}
                  </span>
                  {feedbackNote.trim() && (
                    <p className="truncate pt-1 text-xs text-gray-500">&ldquo;{feedbackNote.trim()}&rdquo;</p>
                  )}
                </div>
              )}
              {audience !== "public" && (
                <div className="px-3 pb-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    {audience === "specific" ? <LockIcon className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
                    {audience === "specific" ? "특정인 공개" : "Companion 공개"}
                  </span>
                </div>
              )}
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
