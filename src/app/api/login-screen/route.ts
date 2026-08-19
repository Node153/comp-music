import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/r2/storage";

const BGM_SETTING_KEY = "login_bgm_key";
const BACKGROUND_SETTING_KEY = "login_background_key";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;

// 로그인 화면 커스터마이징(배경음악 + 배경 이미지) 조회 — 로그인 페이지 자체가 비로그인
// 상태에서 호출하므로 인증 없이 공개. site_settings의 select 정책이 전체 공개라 서버
// 클라이언트로도 그대로 읽힌다. 값이 없으면(관리자가 한 번도 안 올렸으면) null을 내려주고,
// 로그인 화면은 각각 기본 트랙/기본 배경(없음)으로 대체한다.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [BGM_SETTING_KEY, BACKGROUND_SETTING_KEY]);

  const valueByKey = new Map((data ?? []).map((row) => [row.key, row.value]));
  const bgmValue = valueByKey.get(BGM_SETTING_KEY);
  const backgroundValue = valueByKey.get(BACKGROUND_SETTING_KEY);

  const [bgmUrl, backgroundUrl] = await Promise.all([
    bgmValue ? resolveMediaUrl(bgmValue, SIGNED_URL_EXPIRY_SECONDS) : Promise.resolve(null),
    backgroundValue ? resolveMediaUrl(backgroundValue, SIGNED_URL_EXPIRY_SECONDS) : Promise.resolve(null),
  ]);

  return NextResponse.json({ bgmUrl, backgroundUrl });
}
