// 프로필 사진·커버 사진을 R2에 올리기 전에 브라우저에서 줄인다(2026-09-26). 둘 다 /api/avatar,
// /api/cover가 R2 원본을 받아 그대로 흘려보내는 구조라 원본 크기가 곧 Vercel 트래픽(Fast Origin
// Transfer, Hobby 월 10GB)이 된다 — 폰 사진 원본(2~4MB)이 아바타 하나 뜰 때마다 통째로 오가던 걸 막는다.
// - square: 가운데 기준 정사각형으로 자른다(아바타는 어차피 원형 object-cover라 보이는 영역이 같다).
// - 투명 픽셀이 있으면 png, 아니면 jpeg. 결과가 원본보다 크면(이미 작은 사진) 원본 그대로.
// - GIF는 움직임이 사라지므로 손대지 않는다.
export function resizeImageFile(
  file: File,
  { maxSide, square = false, quality = 0.85 }: { maxSide: number; square?: boolean; quality?: number },
): Promise<File> {
  if (file.type === "image/gif") return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const cropW = square ? Math.min(srcW, srcH) : srcW;
      const cropH = square ? Math.min(srcW, srcH) : srcH;
      const scale = Math.min(1, maxSide / Math.max(cropW, cropH));
      const outW = Math.max(1, Math.round(cropW * scale));
      const outH = Math.max(1, Math.round(cropH * scale));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (srcW - cropW) / 2, (srcH - cropH) / 2, cropW, cropH, 0, 0, outW, outH);
      const pixels = ctx.getImageData(0, 0, outW, outH).data;
      let hasAlpha = false;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 255) {
          hasAlpha = true;
          break;
        }
      }
      const outputType = hasAlpha ? "image/png" : "image/jpeg";
      const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          resolve(new File([blob], `${baseName}.${hasAlpha ? "png" : "jpg"}`, { type: outputType }));
        },
        outputType,
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(file);
    };
    img.src = URL.createObjectURL(file);
  });
}

// 표시 크기 기준 — 아바타는 가장 크게 보이는 곳도 수십~백여 px라 레티나 2배를 넉넉히 잡은 값,
// 커버는 프로필 상단 배너 최대 폭 기준.
export const AVATAR_MAX_SIDE = 512;
export const PROFILE_COVER_MAX_SIDE = 1600;
