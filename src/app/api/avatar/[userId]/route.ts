import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2SignedUrl } from "@/lib/r2/storage";

// 사진을 바꾼 직후에도 항상 최신본이 뜨도록 이 라우트 자체는 캐시하지 않는다 — 예전엔
// <img src="/api/avatar/{id}"> URL이 안 바뀌어서 브라우저가 이전 사진을 그대로 재사용했다.
export const dynamic = "force-dynamic";

// 모든 아바타(<Avatar>)가 이 라우트 하나를 통해서만 사진을 받아온다 — 서버/클라이언트
// 컴포넌트를 가리지 않고 <img src={`/api/avatar/${userId}`}>만 쓰면 되게 하기 위함(R2
// signed URL은 서버에서만 발급 가능해서, 곳곳에 흩어진 클라이언트 컴포넌트마다 직접
// 발급받게 하려면 매번 별도 배관이 필요했을 것). 사진이 없으면 404 — Avatar 컴포넌트가
// onError로 받아서 이니셜 원으로 대체한다. 사진 자체는 닉네임처럼 앱 안에서 넓게 보여도
// 되는 정보라 admin client로 RLS 없이 조회한다(다른 비공개 필드는 따로 노출 안 함).
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("profile_image_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.profile_image_url) {
    return NextResponse.json(
      { error: "no photo" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const signedUrl = await getR2SignedUrl(data.profile_image_url, 60 * 10);
  const res = NextResponse.redirect(signedUrl);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
