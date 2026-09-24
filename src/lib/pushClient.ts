"use client";

// 브라우저 쪽 웹 푸시(0074) 도우미 — 서비스 워커 등록, 구독/해지, 현재 상태 판정.
// 상태 판정 순서가 곧 화면 안내 문구 분기다(PushSettingsCard/PushPromptBanner):
//   unsupported      : 브라우저가 Push API 자체를 지원 안 함(또는 VAPID 키 미설정)
//   ios-needs-install: iPhone/iPad인데 홈 화면 앱이 아니라 사파리 탭 — 홈 화면에 추가해야 푸시 가능
//   denied           : 사용자가 브라우저 알림 권한을 차단함 — 브라우저 설정에서 풀어야 함
//   subscribed       : 이 기기에서 받는 중
//   available        : 켤 수 있음(권한 요청 전)
import { useCallback, useEffect, useState } from "react";

export type PushStatus = "loading" | "unsupported" | "ios-needs-install" | "denied" | "subscribed" | "available";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+는 데스크톱 사파리 UA를 쓰므로 터치 포인트로 구분한다.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushApiAvailable() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    VAPID_PUBLIC_KEY.length > 0
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

async function saveSubscription(sub: PushSubscription) {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

// 로그인한 화면이 뜰 때마다 부른다 — 이미 이 브라우저에 구독이 있으면 서버에 다시 알려서
// "지금 로그인한 계정"으로 소유자를 맞춘다(다른 계정으로 바꿔 로그인한 경우, 서버 행이 지워진 경우).
export async function syncExistingSubscription() {
  if (!pushApiAvailable()) return;
  const reg = await registerServiceWorker();
  if (!reg || Notification.permission !== "granted") return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await saveSubscription(sub).catch(() => {});
}

export async function currentPushStatus(): Promise<PushStatus> {
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (!pushApiAvailable()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registerServiceWorker();
  if (!reg) return "unsupported";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "subscribed" : "available";
}

// 반드시 버튼 클릭 같은 사용자 동작 안에서 불러야 한다(iOS/사파리는 그 외엔 권한 요청을 막음).
export async function subscribePush(): Promise<PushStatus> {
  if (!pushApiAvailable()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "available";
  await registerServiceWorker();
  // subscribe는 활성화(active)된 워커가 있어야 해서, 방금 등록한 경우를 위해 ready를 기다린다.
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  await saveSubscription(sub);
  return "subscribed";
}

export async function unsubscribePush(): Promise<PushStatus> {
  if (!pushApiAvailable()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "available";
}

// 로그아웃 직전에 부른다 — 브라우저 구독은 남겨두되 서버 행만 지워서, 로그아웃한 계정의 알림이
// 이 기기로 계속 오지 않게 한다(다음에 누가 로그인하면 syncExistingSubscription이 다시 연결).
export async function detachPushFromAccount() {
  if (!pushApiAvailable()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {
    // 로그아웃은 무조건 진행돼야 한다.
  }
}

export function usePushStatus() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    currentPushStatus()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await subscribePush());
    } catch {
      setStatus(await currentPushStatus().catch(() => "unsupported" as const));
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await unsubscribePush());
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, enable, disable };
}
