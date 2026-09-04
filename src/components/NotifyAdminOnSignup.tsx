"use client";

// 미승인 사용자가 /status(심사 대기 화면)를 열면 관리자에게 "신규 가입 심사 요청"
// Discord 알림을 한 번 트리거한다(#8). 중복 방지·실제 발송 여부 판단은 전부 서버
// (/api/admin/notify-signup)가 하므로 여기서는 마운트 시 fire-and-forget으로 호출만
// 한다(MarkNotificationsSeen과 같은 패턴 — 서버 컴포넌트 렌더/prefetch 중이 아니라
// 실제 화면 진입 시점에만 실행되도록 useEffect).
import { useEffect } from "react";

export function NotifyAdminOnSignup() {
  useEffect(() => {
    void fetch("/api/admin/notify-signup", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
