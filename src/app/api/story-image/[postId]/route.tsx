import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

// 인스타그램 스토리 공유용 1080×1920 이미지(ShareButton). 웹에서는 인스타 스토리 편집기를 직접
// 열 방법이 없어서(네이티브 앱의 instagram-stories:// + 전용 pasteboard는 웹이 못 씀), 이 이미지를
// 파일로 OS 공유 시트(navigator.share files)에 넘기면 Android는 "스토리" 대상이 바로 뜨고
// iOS는 Instagram → 스토리를 고르면 편집기가 열린다. DEMO(public) 게시물만 — 커버를 R2에서
// 서버가 직접 읽으니 브라우저 canvas CORS 문제도 없다.
const WIDTH = 1080;
const HEIGHT = 1920;
const COVER = 760;
const GOLD = "#c9a668";

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
  const giphy = value.match(/^https:\/\/media\d*\.giphy\.com\/media\/([^/]+)\//);
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

export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const supabase = createAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, user_id, title, caption, media_type, image_url, thumbnail_url, visibility, status")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.visibility !== "public" || (post.status !== "published" && post.status !== "expired")) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const { data: author } = await supabase.from("users").select("nickname").eq("id", post.user_id).maybeSingle();

  const title = (post.title || post.caption || "Drop").slice(0, 60);
  const authorName = author?.nickname ?? "";
  const cta = "링크 스티커로 들으러 오기";
  const footer = "compmusic.kr";

  const [cover, fontBold, fontMedium] = await Promise.all([
    loadCover(post.thumbnail_url ?? (post.media_type === "image" ? post.image_url : null)),
    loadFont(800, title),
    loadFont(500, `${authorName}@${cta}${footer}DEMO ON Compmusic♫▶`),
  ]);

  const fonts = [
    fontBold && { name: "NotoSansKR", data: fontBold, weight: 800 as const, style: "normal" as const },
    fontMedium && { name: "NotoSansKR", data: fontMedium, weight: 500 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #1b1a17 0%, #0b0b0c 55%, #000000 100%)",
          fontFamily: "NotoSansKR",
          color: "#ffffff",
          position: "relative",
        }}
      >
        {/* 인스타 스토리 상단(프로필/진행바)·하단(답장 입력창) UI가 덮는 약 250px씩은 비워둔다. */}
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: 6,
            color: GOLD,
            marginBottom: 56,
          }}
        >
          DEMO ON Compmusic
        </div>

        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={COVER}
            height={COVER}
            style={{ width: COVER, height: COVER, objectFit: "cover", borderRadius: 40, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}
          />
        ) : (
          <div
            style={{
              width: COVER,
              height: COVER,
              borderRadius: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${GOLD} 0%, #6b5630 100%)`,
              fontSize: 300,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            ♫
          </div>
        )}

        <div
          style={{
            display: "flex",
            marginTop: 72,
            maxWidth: 900,
            fontSize: title.length > 24 ? 60 : 76,
            fontWeight: 800,
            lineHeight: 1.25,
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          {title}
        </div>
        {authorName && (
          <div style={{ display: "flex", marginTop: 24, fontSize: 40, fontWeight: 500, color: "#b8b8bc" }}>
            @{authorName}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 88,
            padding: "22px 44px",
            borderRadius: 999,
            border: `3px solid ${GOLD}`,
            fontSize: 36,
            fontWeight: 500,
            color: GOLD,
          }}
        >
          ▶ {cta}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 32,
            fontWeight: 500,
            color: "#7a7a80",
            letterSpacing: 2,
          }}
        >
          {footer}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" },
    },
  );
}
