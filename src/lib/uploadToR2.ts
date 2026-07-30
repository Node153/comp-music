// 브라우저에서 직접 쓰는 헬퍼(서버 전용 아님) — /api/storage/upload-url로 presigned PUT URL을
// 받아온 뒤 그 URL로 파일을 곧장 R2에 올린다. 반환값은 posts.video_url/image_url/audio_url/
// thumbnail_url에 저장할 R2 object key.
export async function uploadFileToR2(file: File): Promise<string> {
  const presignRes = await fetch("/api/storage/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });

  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => null);
    throw new Error(body?.error ?? "업로드 URL 발급에 실패했습니다.");
  }

  const { key, url } = (await presignRes.json()) as { key: string; url: string };

  const putRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error("파일 업로드에 실패했습니다.");
  }

  return key;
}
