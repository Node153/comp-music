import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "./client";

// 업로드 전용 presigned PUT URL — 브라우저가 이 URL로 파일을 직접 R2에 올린다(우리 서버를
// 거치지 않음 — Vercel 서버리스 함수의 요청 본문 크기 제한을 영상 파일이 넘길 수 있어서 필수).
export function getR2UploadUrl(key: string, contentType: string, expirySeconds = 60 * 5) {
  const command = new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, ContentType: contentType });
  return getSignedUrl(r2Client, command, { expiresIn: expirySeconds });
}

// 조회 전용 presigned GET URL — Supabase Storage의 createSignedUrl과 동일한 역할.
export function getR2SignedUrl(key: string, expirySeconds: number) {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2Client, command, { expiresIn: expirySeconds });
}

export async function deleteR2Object(key: string) {
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

// prefix(보통 `${user.id}/`) 아래 오브젝트들의 합산 용량(바이트) — 업로드 키가 전부
// `${user.id}/...`로 시작하므로(upload-url/route.ts) 회원별 스토리지 사용량을 이걸로 계산한다.
export async function getR2UsageBytes(prefix: string): Promise<number> {
  let totalBytes = 0;
  let continuationToken: string | undefined;

  do {
    const result = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    totalBytes += (result.Contents ?? []).reduce((sum, obj) => sum + (obj.Size ?? 0), 0);
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return totalBytes;
}
