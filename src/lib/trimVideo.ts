// 업로드 화면 영상 편집(다듬기·원본 소리 끄기·음원 넣기) — 브라우저 안에서 ffmpeg.wasm으로
// 편집을 실제 파일에 적용해서, 결과 파일 자체를 R2에 올린다(2026-09-23, 소리 편집은 09-24).
// DB에 시작/끝 시각이나 배경음 정보만 저장하고 재생 쪽에서 맞추는 방식도 있지만, 그러면
// 피드 카드·전역 사운드바·재생목록·조회수 판정까지 재생 경로 전부가 그걸 알아야 해서
// 완성된 파일을 올리는 쪽을 택했다(다듬으면 저장 용량도 줄어든다).
//
// 영상 트랙은 먼저 재인코딩 없이 스트림 복사(-c:v copy)한다 — wasm 인코딩은 실시간보다 느려서
// 긴 영상이면 게시 버튼을 누르고 몇 분씩 기다려야 한다. 스트림 복사는 시작점이 직전 키프레임으로
// 당겨지는데, 그 오차가 크면(아래 COPY_TOLERANCE_SECONDS) 그때만 재인코딩으로 정확히 자른다.
// 소리를 바꾸는 경우(음소거 제외) 오디오 트랙만은 항상 AAC로 새로 만든다(가볍다).
//
// ffmpeg 코어(~30MB wasm)는 번들에 넣지 않고 실제로 편집을 적용해 게시할 때만 CDN에서
// 받아온다 — 편집을 안 쓰는 대부분의 업로드는 이 비용을 전혀 안 낸다.
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

// 코어 파일은 blob URL로 한 번만 받아 두고, ffmpeg 인스턴스는 실행할 때마다 새로 만든다 —
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

// 결과의 실제 길이 — 브라우저 <video> 메타데이터로 잰다(ffprobe 로그 파싱보다 단순).
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

type InputFile = { name: string; data: Uint8Array };

// 한 번의 ffmpeg 실행 — 새 인스턴스에서 돌리고 끝나면 버린다. exec 반환 코드는 위 Aborted()
// 문제 때문에 믿지 않고, 결과 파일이 실제로 재생 가능한지(길이를 읽을 수 있는지)로 판단한다.
async function runOnce(
  inputs: InputFile[],
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
    for (const input of inputs) await ffmpeg.writeFile(input.name, input.data.slice());
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

export type VideoEdit = {
  start: number;
  end: number;
  // 원본 영상 소리를 뺀다(음원을 넣었으면 음원만 남는다).
  muteOriginal: boolean;
  // 넣을 음원 — musicStart 지점부터 재생되고 영상(다듬은 구간) 길이에 맞춰 잘린다. 남은
  // 음원이 더 짧으면 그 뒤는 (원본 소리를 켰으면 원본만, 아니면) 무음.
  music: File | null;
  // 음원에서 쓸 구간의 시작(초) — 영상 첫 프레임에 이 지점이 맞춰진다.
  musicStart: number;
};

function extOf(name: string, fallback: string) {
  return (name.split(".").pop() || fallback).toLowerCase();
}

export async function editVideoFile(
  file: File,
  edit: VideoEdit,
  // 재인코딩으로 넘어갔을 때만 호출된다(0~1) — 스트림 복사는 금방 끝나서 진행률이 필요 없다.
  onReencodeProgress?: (ratio: number) => void,
): Promise<File> {
  const { start, end, muteOriginal, music, musicStart } = edit;
  const ext = extOf(file.name, "mp4");
  const length = end - start;
  const inputs: InputFile[] = [{ name: `input.${ext}`, data: new Uint8Array(await file.arrayBuffer()) }];
  const musicName = music ? `music.${extOf(music.name, "mp3")}` : null;
  if (music && musicName) inputs.push({ name: musicName, data: new Uint8Array(await music.arrayBuffer()) });

  // 입력 쪽 -ss/-t로 영상을 자르고, 음원도 입력 -ss로 고른 시작 지점부터 읽은 뒤 출력 -t로
  // 영상 길이에 맞춰 자른다.
  const inputArgs = ["-ss", start.toFixed(3), "-t", length.toFixed(3), "-i", inputs[0].name];
  if (musicName) inputArgs.push("-ss", Math.max(0, musicStart).toFixed(3), "-i", musicName);

  // 소리 구성별 매핑 — mixOriginal=false면 원본 오디오를 아예 안 쓴다(원본에 오디오 트랙이
  // 없어서 amix가 실패했을 때의 재시도에도 쓴다).
  const audioArgs = (mixOriginal: boolean): string[] => {
    if (!musicName) {
      return muteOriginal ? ["-map", "0:v:0", "-an"] : ["-map", "0:v:0", "-map", "0:a?", "-c:a", "copy"];
    }
    if (mixOriginal && !muteOriginal) {
      // normalize=0: amix 기본값은 입력 수만큼 음량을 나눠서 둘 다 작게 들린다.
      return [
        "-filter_complex",
        "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]",
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
      ];
    }
    return ["-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k"];
  };

  const copyVideoArgs = ["-c:v", "copy", "-avoid_negative_ts", "make_zero"];
  const reencodeVideoArgs = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p"];
  // 음원이 영상보다 길면 여기서 영상 길이로 잘린다.
  const outputTail = (name: string) => ["-t", length.toFixed(3), "-movflags", "+faststart", name];

  const attempt = async (videoArgs: string[], mixOriginal: boolean, reencode: boolean) => {
    // 소리를 새로 만들면(음원 넣기) mov 컨테이너에 AAC를 넣는 셈이라 문제는 없지만, 결과를
    // 일관되게 mp4로 맞춘다. 원본 오디오를 그대로 복사하는 경우만 원래 컨테이너를 유지.
    const keepContainer = !reencode && !musicName;
    const outExt = keepContainer ? ext : "mp4";
    const outName = `output.${outExt}`;
    return runOnce(
      inputs,
      [...inputArgs, ...audioArgs(mixOriginal), ...videoArgs, ...outputTail(outName)],
      outName,
      keepContainer
        ? { name: file.name, type: file.type }
        : { name: file.name.replace(/\.[^.]+$/, "") + ".mp4", type: "video/mp4" },
      reencode ? (seconds) => onReencodeProgress?.(Math.min(1, Math.max(0, seconds / length))) : undefined,
    );
  };

  // 원본 소리+음원 섞기는 원본에 오디오 트랙이 없으면 실패한다 — 그때는 음원만으로 다시 시도.
  const attemptWithAudioFallback = async (videoArgs: string[], reencode: boolean) => {
    const first = await attempt(videoArgs, true, reencode);
    if (first || !musicName || muteOriginal) return first;
    return attempt(videoArgs, false, reencode);
  };

  const copied = await attemptWithAudioFallback(copyVideoArgs, false);
  if (copied && copied.duration - length <= COPY_TOLERANCE_SECONDS) return copied.file;

  // 재인코딩 — ultrafast라 화질 대비 용량은 조금 커지지만 wasm(싱글 스레드)에서 그나마
  // 기다릴 만한 속도가 나온다.
  const reencoded = await attemptWithAudioFallback(reencodeVideoArgs, true);
  if (!reencoded) throw new Error("영상 편집에 실패했어요");
  return reencoded.file;
}
