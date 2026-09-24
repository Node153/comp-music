import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMediaUrl } from "@/lib/r2/storage";

// 웹 푸시(0074) 발송 — 앱 출시 전이라 네이티브 푸시 대신 브라우저 Push API를 쓴다.
// Android/데스크톱 크롬·엣지·파이어폭스·맥 사파리는 브라우저에서 바로, iPhone은 iOS 16.4+에서
// "홈 화면에 추가"한 경우에만 받는다(PushSettings의 설치 안내 참고).
// VAPID 키가 없으면(로컬 등) 조용히 건너뛴다 — 푸시 실패가 좋아요/댓글 자체를 막으면 안 된다.

// 알림 아래 버튼(Android만 표시, iOS는 무시하고 본문 탭만 된다) — 누르면 url을 연다(sw.js).
export type PushAction = { action: string; title: string; url: string };

export type PushPayload = {
  title: string;
  body: string;
  // 알림을 눌렀을 때 열 경로(같은 오리진 상대경로).
  url: string;
  // 같은 tag의 알림은 기기에서 새 것으로 교체된다(같은 게시물 좋아요가 줄줄이 쌓이지 않게).
  tag?: string;
  // 알림을 펼쳤을 때 보이는 큰 이미지(Android만) — 게시물 커버.
  image?: string;
  actions?: PushAction[];
};

// 내 게시물 소식(반응·청취자·PEAK) 알림 버튼 — "반응 → 다음 업로드" 루프(0077)를 알림 자체에서도.
export function ownPostActions(href: string): PushAction[] {
  return [
    { action: "open", title: "보러 가기", url: href },
    { action: "upload", title: "새 Drop 올리기", url: "/upload" },
  ];
}

// 알림 큰 이미지용 커버 URL — R2 서명 URL은 알림이 늦게 열려도 보이게 넉넉히(3일, R2 최대 7일).
export async function pushImageFor(thumbnailUrl: string | null | undefined): Promise<string | undefined> {
  if (!thumbnailUrl) return undefined;
  try {
    return await resolveMediaUrl(thumbnailUrl, 60 * 60 * 24 * 3);
  } catch {
    return undefined;
  }
}

let configured: boolean | null = null;
function ensureConfigured() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:no-reply@compmusic.kr", publicKey, privateKey);
  configured = true;
  return true;
}

// 한 사용자의 모든 구독(기기)에 보낸다. 하나라도 성공하면 true. 만료/해지된 구독(404·410)은
// 브라우저가 다시 쓰지 않으므로 바로 지운다.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  if (!ensureConfigured()) return false;
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return false;

  const body = JSON.stringify(payload);
  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24, urgency: "normal" },
        );
        return { id: sub.id, ok: true as const };
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push] 발송 실패", status, err);
        }
        return { id: sub.id, ok: false as const };
      }
    }),
  );

  const okIds = results.filter((r) => r.ok).map((r) => r.id);
  if (okIds.length > 0) {
    await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("id", okIds);
  }
  return okIds.length > 0;
}
