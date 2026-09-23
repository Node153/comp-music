// 업로드 화면 "다듬기" — 브라우저 안에서 ffmpeg.wasm으로 영상을 실제로 잘라서, 잘린 파일
// 자체를 R2에 올린다(2026-09-23). DB에 시작/끝 시각만 저장하고 재생 쪽에서 구간을 지키게
// 하는 방식도 있지만, 그러면 피드 카드·전역 사운드바·재생목록·조회수 판정까지 재생 경로
// 전부가 오프셋을 알아야 해서 잘린 파일을 올리는 쪽을 택했다(저장 용량도 줄어든다).
//
// 먼저 재인코딩 없이 스트림 복사(-c copy)로 자른다 — wasm 인코딩은 실시간보다 느려서 긴
// 영상이면 게시 버튼을 누르고 몇 분씩 기다려야 한다. 스트림 복사는 시작점이 직전 키프레임으로
// 당겨지는데, 그 오차가 크면(아래 COPY_TOLERANCE_SECONDS) 그때만 재인코딩으로 정확히 자른다.
//
// ffmpeg 코어(~30MB wasm)는 번들에 넣지 않고 실제로 다듬기를 적용해 게시할 때만 CDN에서
// 받아온다 — 다듬기를 안 쓰는 대부분의 업로드는 이 비용을 전혀 안 낸다.
import type { FFmpeg } from "@ffmpeg/ffmpeg";

const CORE_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
// 패키지 기본 워커를 그대로 쓰면 Turbopack이 워커 안의 import(coreURL)까지 번들링하려다
// "Cannot find module as expression is too dynamic"으로 깨진다 — 그래서 워커 파일
// (@ffmpeg/ffmpeg/dist/esm의 worker.js·const.js·errors.js)을 public/ffmpeg/에 그대로 복사해
// 번들 밖에서 서빙한다. @ffmpeg/ffmpeg 버전을 올리면 이 세 파일도 같이 다시 복사할 것.
const WORKER_PATH = "/ffmpeg/worker.js";

// 스트림 복사 결과가 원하는 길이보다 이만큼(초) 넘게 길면 시작점이 키프레임 때문에 크게
// 당겨진 것 — 화면 녹화나 MediaRecorder로 만든 영상은 키프레임이 처음에만 있는 경우도 있어서
// 2초 구간을 잘라도 0초부터 잘려버린다. 그럴 때만 재인코딩으로 정확히 다시 자른다.
const COPY_TOLERANCE_SECONDS = 1.5;

// 코어 파일은 blob URL로 한 번만 받아 두고, ffmpeg 인스턴스는 자를 때마다 새로 만든다 —
// ffmpeg.wasm 0.12는 exec가 끝나는 순간 "Aborted()"로 인스턴스가 죽는 경우가 있어서
// (결과 파일은 정상으로 다 써진 상태) 한 인스턴스를 재사용하면 다음 exec가 깨진다.
let coreUrlsPromise: Promise<{ coreURL: string; wasmURL: string }> | null = null;

function loadCoreUrls() {
  if (!coreUrlsPromise) {
    coreUrlsPromise = (async () => {
      const { toBlobURL } = await import("@ffmpeg/util");
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      return { coreURL, wasmURL };
    })().catch((err) => {
      // 네트워크 실패 등으로 로드가 깨졌으면 다음 시도 때 처음부터 다시 받게 캐시를 비운다.
      coreUrlsPromise = null;
      throw err;
    });
  }
  return coreUrlsPromise;
}

async function createFFmpeg(): Promise<FFmpeg> {
  const [{ FFmpeg }, urls] = await Promise.all([import("@ffmpeg/ffmpeg"), loadCoreUrls()]);
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({ classWorkerURL: new URL(WORKER_PATH, window.location.origin).href, ...urls });
  return ffmpeg;
}

// 잘린 결과의 실제 길이 — 브라우저 <video> 메타데이터로 잰다(ffprobe 로그 파싱보다 단순).
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : NaN);
    video.onerror = () => done(NaN);
    video.src = url;
  });
}

// 한 번의 ffmpeg 실행 — 새 인스턴스에서 돌리고 끝나면 버린다. exec 반환 코드는 위 Aborted()
// 문제 때문에 믿지 않고, 결과 파일이 실제로 재생 가능한지(길이를 읽을 수 있는지)로 판단한다.
async function runOnce(
  input: Uint8Array,
  inputName: string,
  args: string[],
  outputName: string,
  output: { name: string; type: string },
  onProgress?: (seconds: number) => void,
): Promise<{ file: File; duration: number } | null> {
  const ffmpeg = await createFFmpeg();
  const handleProgress = ({ time }: { time: number }) => onProgress?.(time / 1_000_000);
  ffmpeg.on("progress", handleProgress);
  try {
    // writeFile은 버퍼를 워커로 넘겨(transfer) 원본을 비워버리므로 매번 복사본을 넘긴다.
    await ffmpeg.writeFile(inputName, input.slice());
    await ffmpeg.exec(args).catch(() => -1);
    const data = await ffmpeg.readFile(outputName).catch(() => null);
    if (!data || typeof data === "string" || data.byteLength === 0) return null;
    const file = new File([new Uint8Array(data)], output.name, { type: output.type });
    const duration = await readDuration(file);
    return Number.isFinite(duration) && duration > 0 ? { file, duration } : null;
  } finally {
    ffmpeg.terminate();
  }
}

export async function trimVideoFile(
  file: File,
  start: number,
  end: number,
  // 재인코딩으로 넘어갔을 때만 호출된다(0~1) — 스트림 복사는 금방 끝나서 진행률이 필요 없다.
  onReencodeProgress?: (ratio: number) => void,
): Promise<File> {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const inputName = `input.${ext}`;
  const length = end - start;
  const seekArgs = ["-ss", start.toFixed(3), "-i", inputName, "-t", length.toFixed(3)];
  const input = new Uint8Array(await file.arrayBuffer());

  const copied = await runOnce(
    input,
    inputName,
    [...seekArgs, "-c", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", `copy.${ext}`],
    `copy.${ext}`,
    { name: file.name, type: file.type },
  );
  if (copied && copied.duration - length <= COPY_TOLERANCE_SECONDS) return copied.file;

  // 재인코딩 — ultrafast라 화질 대비 용량은 조금 커지지만 wasm(싱글 스레드)에서 그나마
  // 기다릴 만한 속도가 나온다. 결과는 항상 mp4(H.264/AAC)라 mov 원본도 확장자를 바꾼다.
  const reencoded = await runOnce(
    input,
    inputName,
    [
      ...seekArgs,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "reencode.mp4",
    ],
    "reencode.mp4",
    { name: file.name.replace(/\.[^.]+$/, "") + ".mp4", type: "video/mp4" },
    (seconds) => onReencodeProgress?.(Math.min(1, Math.max(0, seconds / length))),
  );
  if (!reencoded) throw new Error("영상 자르기에 실패했어요");
  return reencoded.file;
}
