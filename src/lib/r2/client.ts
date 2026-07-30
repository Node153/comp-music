import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2는 S3 호환 API를 제공해서 AWS S3 SDK를 그대로 쓸 수 있다 — 엔드포인트만
// R2 계정 전용 URL로 바꾸면 됨. region은 R2에서 의미 없는 값이라 "auto" 고정.
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
