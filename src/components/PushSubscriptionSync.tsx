"use client";

// 로그인한 화면 공통(app/(app)/layout.tsx) — 서비스 워커를 등록하고, 이 브라우저에 이미 웹 푸시
// 구독이 있으면 현재 계정으로 서버에 다시 연결한다(0074). 화면에는 아무것도 안 그린다.
import { useEffect } from "react";
import { syncExistingSubscription } from "@/lib/pushClient";

export function PushSubscriptionSync() {
  useEffect(() => {
    syncExistingSubscription().catch(() => {});
  }, []);
  return null;
}
