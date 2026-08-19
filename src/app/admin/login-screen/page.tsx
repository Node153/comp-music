import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/r2/storage";
import { pageTitle, sectionTitle, mutedText } from "@/components/ui/styles";
import { BgmUploadForm } from "./BgmUploadForm";
import { BackgroundImageUploadForm } from "./BackgroundImageUploadForm";

// 관리자 - 로그인 화면 커스터마이징(배경음악 + 배경 이미지). role=admin만 접근(proxy.ts에서 가드).
const BGM_SETTING_KEY = "login_bgm_key";
const BACKGROUND_SETTING_KEY = "login_background_key";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;

export default async function AdminLoginScreenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("key, value, updated_at")
    .in("key", [BGM_SETTING_KEY, BACKGROUND_SETTING_KEY]);

  const bgmSetting = (settings ?? []).find((s) => s.key === BGM_SETTING_KEY);
  const backgroundSetting = (settings ?? []).find((s) => s.key === BACKGROUND_SETTING_KEY);

  const [bgmPreviewUrl, backgroundPreviewUrl] = await Promise.all([
    bgmSetting?.value ? resolveMediaUrl(bgmSetting.value, SIGNED_URL_EXPIRY_SECONDS) : Promise.resolve(null),
    backgroundSetting?.value
      ? resolveMediaUrl(backgroundSetting.value, SIGNED_URL_EXPIRY_SECONDS)
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className={pageTitle}>로그인 화면 설정</h1>
        <Link href="/admin/members" className="text-sm font-medium text-blue-600 hover:underline">
          회원 관리 →
        </Link>
      </div>

      {user && (
        <>
          <div className="flex flex-col gap-2">
            <h2 className={sectionTitle}>배경음악</h2>
            <p className={mutedText}>
              로그인 화면 우측 하단 음악 버튼을 누르면 재생되는 곡이에요. mp3 또는 wav 파일을 올리면 바로
              교체됩니다(별도 배포 필요 없음).
            </p>
            <BgmUploadForm
              adminUserId={user.id}
              currentPreviewUrl={bgmPreviewUrl}
              currentUpdatedAt={bgmSetting?.updated_at ?? null}
            />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className={sectionTitle}>배경 이미지</h2>
            <p className={mutedText}>
              로그인 화면 전체 배경으로 깔리는 이미지예요. jpg/png/webp 파일을 올리면 바로 교체됩니다.
            </p>
            <BackgroundImageUploadForm
              adminUserId={user.id}
              currentPreviewUrl={backgroundPreviewUrl}
              currentUpdatedAt={backgroundSetting?.updated_at ?? null}
            />
          </div>
        </>
      )}
    </main>
  );
}
