import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2/client";

// 인스타그램 스토리 공유 카드(1080×1920) — /api/story-image(이미지)와 /api/story-video(곡 15초를
// 입힌 영상)가 같이 쓴다. 영상은 ffmpeg가 이 이미지 위 고정 좌표(STORY_TRACK)에 금색 진행바를
// 덮어 그리기 때문에, 레이아웃은 flex 가운데 정렬이 아니라 전부 절대 좌표로 고정한다.
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
const COVER = { top: 360, left: 162, size: 756 };
// 영상 진행바 트랙 — 좌표는 720×1280 출력(×2/3)에서도 정수가 되도록 3의 배수로 맞췄다.
export const STORY_TRACK = { top: 1158, left: 162, width: 756, height: 12 };
export const STORY_GOLD = "#c9a668";
export const STORY_TRACK_BG = "#3a3833";

export type StoryPost = {
  id: string;
  title: string;
  coverKey: string | null;
  // 영상에 입힐 소리가 있는 원본(R2 key) — 음원 게시물은 audio_url, 영상 게시물은 video_url.
  soundKey: string | null;
};

// 공개 DEMO(published/expired)만 — 그 외엔 null.
export async function loadStoryPost(postId: string): Promise<StoryPost | null> {
  const supabase = createAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, title, caption, media_type, image_url, audio_url, video_url, thumbnail_url, visibility, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.visibility !== "public" || (post.status !== "published" && post.status !== "expired")) {
    return null;
  }
  const rawTitle = post.title || post.caption || "Drop";
  return {
    id: post.id,
    title: rawTitle.length > 40 ? `${rawTitle.slice(0, 39)}…` : rawTitle,
    coverKey: post.thumbnail_url ?? (post.media_type === "image" ? post.image_url : null),
    soundKey: post.media_type === "audio" ? post.audio_url : post.media_type === "video" ? post.video_url : null,
  };
}

// Satori(next/og)는 한글 글리프가 없는 기본 폰트만 내장 — 실제로 쓰는 글자만 Google Fonts에서
// text= 서브셋으로 받아온다(수 KB). TTF가 내려오는 css2 API 기본 응답을 파싱.
async function loadFont(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`,
      { cache: "force-cache" },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { cache: "force-cache" }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

// 커버를 data URI로 — Satori가 제대로 그리는 png/jpeg만(gif는 빈 칸으로 그려짐). GIPHY 커버는
// 같은 GIF의 정지 JPG 렌더(480w_s.jpg)로 바꿔 받고, 그 밖의 형식은 기본 그래픽으로 대신한다.
async function loadCover(value: string | null): Promise<string | null> {
  if (!value) return null;
  // media.giphy.com/media/<id>/giphy.gif 와 media1.giphy.com/media/v1.<토큰>/<id>/200w.gif 둘 다 있음.
  const giphy = value.match(/^https:\/\/media\d*\.giphy\.com\/media\/(?:v1\.[^/]+\/)?([^/]+)\/[^/]+$/);
  if (giphy) value = `https://media.giphy.com/media/${giphy[1]}/480w_s.jpg`;
  try {
    let bytes: Uint8Array;
    let type: string;
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const res = await fetch(value);
      if (!res.ok) return null;
      type = res.headers.get("content-type") ?? "";
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      const res = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: value }));
      type = res.ContentType ?? "";
      bytes = await res.Body!.transformToByteArray();
    }
    if (type !== "image/jpeg" && type !== "image/png") return null;
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

// 공식 아이콘(앱 아이콘과 같은 고양이) — public/ 파일은 서버 함수 번들에 기본 포함이 안 돼서
// next.config의 outputFileTracingIncludes로 두 스토리 라우트에 넣어준다.
let brandIcon: Promise<string | null> | null = null;
function loadBrandIcon() {
  brandIcon ??= readFile(path.join(process.cwd(), "public", "pwa-icon-512.png"))
    .then((buf) => `data:image/png;base64,${buf.toString("base64")}`)
    .catch(() => null);
  return brandIcon;
}

// withTrack: 영상용 — 커버 아래에 빈 진행바 트랙을 그려두고(채워지는 금색 바는 ffmpeg가 덮음),
// 그만큼 글자 블록을 아래로 내린다. 인스타 스토리 상단(프로필/진행바)·하단(답장 입력창) UI가
// 덮는 약 250px씩은 비워둔다.
export async function renderStoryCard(post: StoryPost, { withTrack = false } = {}) {
  const cta = withTrack ? "링크 스티커로 전곡 듣기" : "링크 스티커로 들으러 오기";
  const footer = "compmusic.kr";

  const [cover, icon, fontBold, fontMedium] = await Promise.all([
    loadCover(post.coverKey),
    loadBrandIcon(),
    loadFont(800, `${post.title}Compmusic`),
    loadFont(500, `${cta}${footer}♫▶`),
  ]);

  const fonts = [
    fontBold && { name: "NotoSansKR", data: fontBold, weight: 800 as const, style: "normal" as const },
    fontMedium && { name: "NotoSansKR", data: fontMedium, weight: 500 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          width: STORY_WIDTH,
          height: STORY_HEIGHT,
          display: "flex",
          position: "relative",
          background: "linear-gradient(180deg, #1b1a17 0%, #0b0b0c 55%, #000000 100%)",
          fontFamily: "NotoSansKR",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 240,
            left: 0,
            width: STORY_WIDTH,
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" width={72} height={72} style={{ width: 72, height: 72, borderRadius: 36 }} />
          )}
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: 0.5 }}>Compmusic</div>
        </div>

        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={COVER.size}
            height={COVER.size}
            style={{
              position: "absolute",
              top: COVER.top,
              left: COVER.left,
              width: COVER.size,
              height: COVER.size,
              objectFit: "cover",
              borderRadius: 40,
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: COVER.top,
              left: COVER.left,
              width: COVER.size,
              height: COVER.size,
              borderRadius: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${STORY_GOLD} 0%, #6b5630 100%)`,
              fontSize: 300,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            ♫
          </div>
        )}

        {withTrack && (
          <div
            style={{
              position: "absolute",
              top: STORY_TRACK.top,
              left: STORY_TRACK.left,
              width: STORY_TRACK.width,
              height: STORY_TRACK.height,
              background: STORY_TRACK_BG,
              display: "flex",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            top: withTrack ? 1232 : 1176,
            left: 90,
            width: 900,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              fontSize: post.title.length > 20 ? 58 : 72,
              fontWeight: 800,
              lineHeight: 1.25,
            }}
          >
            {post.title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 60,
              padding: "20px 44px",
              borderRadius: 999,
              border: `3px solid ${STORY_GOLD}`,
              fontSize: 36,
              fontWeight: 500,
              color: STORY_GOLD,
            }}
          >
            ▶ {cta}
          </div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 32, fontWeight: 500, color: "#7a7a80", letterSpacing: 2 }}>
            {footer}
          </div>
        </div>
      </div>
    ),
    { width: STORY_WIDTH, height: STORY_HEIGHT, fonts },
  );
}
