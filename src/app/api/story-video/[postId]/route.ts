import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { loadStoryPost, renderStoryCard, STORY_GOLD, STORY_TRACK, STORY_TRACK_BG, STORY_WIDTH } from "@/lib/storyCard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// 인스타 스토리 공유용 "소리 나는" 카드 — 스토리 카드 이미지(lib/storyCard) 위에 금색 진행바가
// 차오르고 곡의 처음 CLIP_SECONDS초가 깔린 720×1280 MP4. 스포티파이처럼 인스타가 곡을 붙여주는 건
// 메타 제휴 전용이라, 대신 영상 자체에 소리를 넣어 스토리에서 바로 들리게 한다(ShareButton이
// navigator.share files로 넘김). 원본(R2)은 ffmpeg가 서명 URL로 필요한 앞부분만 읽는다.
// 같은 게시물은 결과가 같으니 CDN(s-maxage)에 캐시 — 인코딩은 게시물당 대략 한 번.
const CLIP_SECONDS = 15;
const OUT_W = 720;
const OUT_H = 1280;
const FPS = 24;

function runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args);
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

// ffprobe가 ffmpeg-static에 없어서 `ffmpeg -i`가 출력 없이 끝나며 찍는 Duration 줄을 읽는다.
async function probeDuration(url: string): Promise<number | null> {
  const { stderr } = await runFfmpeg(["-hide_banner", "-i", url]);
  const m = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const post = await loadStoryPost(postId);
  if (!post || !post.soundKey) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const soundUrl = await getR2SignedUrl(post.soundKey, 60 * 10);
  const [duration, card] = await Promise.all([
    probeDuration(soundUrl),
    renderStoryCard(post, { withTrack: true }).then((r) => r.arrayBuffer()),
  ]);
  const clip = Math.max(1, Math.min(CLIP_SECONDS, duration ?? CLIP_SECONDS));

  const scale = OUT_W / STORY_WIDTH;
  const track = {
    x: Math.round(STORY_TRACK.left * scale),
    y: Math.round(STORY_TRACK.top * scale),
    w: Math.round(STORY_TRACK.width * scale),
    h: Math.round(STORY_TRACK.height * scale),
  };
  const hex = (c: string) => `0x${c.slice(1)}`;
  // 트랙 크기의 금색 바를 트랙 캔버스 위에서 왼쪽 밖(-w)부터 오른쪽으로 밀어 넣는다 — overlay는
  // 아래 캔버스 밖으로 나간 부분을 자르니 "차오르는" 모양이 된다.
  // 카드 PNG는 한 번만 디코드·축소하고 그 프레임을 반복(loop 필터) — 입력에 -loop 1을 주면 매 프레임
  // PNG를 다시 디코드·축소해서 인코딩이 3배 느렸다(15초 영상 6.3초 → 2.1초, 로컬 측정).
  const filter = [
    `[0:v]scale=${OUT_W}:${OUT_H},loop=loop=-1:size=1:start=0,fps=${FPS},setpts=N/${FPS}/TB[bg]`,
    `color=c=${hex(STORY_TRACK_BG)}:s=${track.w}x${track.h}:r=${FPS}[track]`,
    `color=c=${hex(STORY_GOLD)}:s=${track.w}x${track.h}:r=${FPS}[bar]`,
    `[track][bar]overlay=x='-${track.w}+${track.w}*t/${clip}':y=0[prog]`,
    `[bg][prog]overlay=${track.x}:${track.y}:shortest=1,format=yuv420p[v]`,
    `[1:a]afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, clip - 1)}:d=1[a]`,
  ].join(";");

  const dir = await mkdtemp(path.join(tmpdir(), "story-"));
  try {
    const cardPath = path.join(dir, "card.png");
    const outPath = path.join(dir, "story.mp4");
    await writeFile(cardPath, Buffer.from(card));
    const { code, stderr } = await runFfmpeg([
      "-hide_banner",
      "-loglevel", "error",
      "-i", cardPath,
      "-t", String(clip),
      "-i", soundUrl,
      "-filter_complex", filter,
      "-map", "[v]",
      "-map", "[a]",
      "-t", String(clip),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "stillimage",
      "-crf", "23",
      "-r", String(FPS),
      "-c:a", "aac",
      "-b:a", "160k",
      "-ar", "44100",
      "-movflags", "+faststart",
      "-y", outPath,
    ]);
    if (code !== 0) {
      console.error("story-video ffmpeg failed", postId, stderr.slice(-2000));
      return NextResponse.json({ error: "영상을 만들지 못했습니다." }, { status: 500 });
    }
    const video = await readFile(outPath);
    return new NextResponse(new Uint8Array(video), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.length),
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
