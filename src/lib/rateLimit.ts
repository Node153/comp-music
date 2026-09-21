import "server-only";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// rate_limit_hits(0058)는 service_role만 접근 가능하지만, 그래도 원본 IP/식별자를 평문으로
// 쌓아두지 않게 해시로 저장한다.
function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

// windowSeconds 단위 고정 윈도(fixed window) 카운터. true면 허용, false면 한도 초과.
// 카운터 자체가 실패해도 기능이 통째로 막히면 안 되므로(방어선이지 핵심 기능이 아님) 에러 시
// fail-open으로 허용한다.
export async function checkRateLimit(
  bucket: string,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_key_hash: hashKey(key),
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) return true;
  return data ?? true;
}
