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

export function formatWaveformTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
