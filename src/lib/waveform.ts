// SoundbarPreview(업로드 미리보기)와 SoundbarPlayer(피드 카드) 둘 다 쓰는 파형 계산 로직.
// 업로드 쪽은 File.arrayBuffer(), 피드 쪽은 fetch(signedUrl).arrayBuffer()로 소스만 다르고
// 이후 디코딩·다운샘플링 과정은 동일해서 여기로 뺐다.
export const WAVEFORM_BAR_COUNT = 56;

export async function computeWaveformBars(
  arrayBuffer: ArrayBuffer,
  barCount: number = WAVEFORM_BAR_COUNT,
): Promise<number[]> {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(channelData[start + j] ?? 0);
      bars.push(sum / blockSize);
    }
    const max = Math.max(...bars, 0.0001);
    return bars.map((b) => Math.max(0.06, b / max));
  } finally {
    audioCtx.close();
  }
}

// 게시물 파형 미리 계산(0090, 2026-09-26) — 예전엔 재생할 때마다 waveform-proxy가 원본 파일 전체를
// Vercel 함수로 흘려보내서(곡당 7~8MB, 영상은 100MB 이상) Fast Origin Transfer 무료 한도(월 10GB)를
// 빠르게 소모했다. 이제 업로드 때 로컬 파일로 한 번 계산해 post_waveforms에 0~100 정수 200개로
// 저장하고, 화면마다 필요한 막대 수(전역 바 160, 카드 200)로 줄여 쓴다(usePostWaveform).
export const STORED_WAVEFORM_BARS = 200;
// 이보다 큰 파일(주로 긴 영상)은 업로드 기기에서 통째로 디코딩하다 메모리가 모자랄 수 있어 건너뛴다.
const STORED_WAVEFORM_MAX_FILE_BYTES = 100 * 1024 * 1024;

export function toStoredWaveform(bars: number[]): number[] {
  return bars.map((v) => Math.max(0, Math.min(100, Math.round(v * 100))));
}

export function fromStoredWaveform(stored: number[], barCount: number): number[] {
  const n = stored.length;
  const out: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const start = Math.floor((i * n) / barCount);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / barCount));
    let sum = 0;
    for (let j = start; j < end; j++) sum += stored[j] ?? 0;
    out.push(sum / (end - start));
  }
  const max = Math.max(...out, 1);
  return out.map((v) => Math.max(0.06, v / max));
}

// 업로드 화면 전용 — 올릴 파일(편집 적용 후 최종본)로 저장용 파형을 만든다. 실패해도 업로드는
// 계속돼야 하니 예외 대신 null(음원이면 처음 재생한 사람이 대신 채운다 — save_post_waveform).
export async function computeStoredWaveform(file: File): Promise<number[] | null> {
  if (file.size > STORED_WAVEFORM_MAX_FILE_BYTES) return null;
  try {
    return toStoredWaveform(await computeWaveformBars(await file.arrayBuffer(), STORED_WAVEFORM_BARS));
  } catch {
    return null;
  }
}

export function formatWaveformTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
