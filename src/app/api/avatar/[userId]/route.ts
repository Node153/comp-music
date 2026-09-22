import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2ObjectStream } from "@/lib/r2/storage";
import { ALLOWED_UPLOAD_CONTENT_TYPES } from "@/lib/r2/allowedContentTypes";

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

  // presigned URL로 리다이렉트하지 않고 바이트를 직접 응답에 실어보낸다 — Safari가 <img>의
  // 리다이렉트 응답을 no-store에도 캐시해버려서(2026-09-17) 새로고침해도 이전 사진이 보이는
  // 문제가 있었다. 리다이렉트가 아니라 우리 라우트가 직접 바이트를 실어보내므로 그 버그는
  // 재현되지 않는다 — 그래서 일반 Cache-Control을 걸어도 안전하다. 앱 전체 아바타가 이
  // 라우트 하나를 거치는데 no-store였던 탓에 같은 사진을 볼 때마다 R2→함수 구간 트래픽이
  // 매번 전부 다시 흘러(Vercel Fast Origin Transfer 무료 한도의 상당 부분을 여기서 소모,
  // 2026-09-23) max-age+SWR로 완화한다. 본인이 방금 사진을 바꾼 화면(ProfilePhotoForm)은
  // 로컬 photoVersion으로 매번 다른 URL(?v=)을 만들어 이 캐시와 무관하게 즉시 최신본을 본다.
  const { body, contentType } = await getR2ObjectStream(data.profile_image_url);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
  };
  // upload-url이 화이트리스트를 강제하기 전(과거)에 올라간 오브젝트가 남아있을 수 있어,
  // 예상 밖의 Content-Type이면 브라우저가 직접 렌더링하지 못하게 다운로드로 강제한다.
  if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType)) {
    headers["Content-Disposition"] = "attachment";
  }
  return new NextResponse(body, { headers });
}
