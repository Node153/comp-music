"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { detachPushFromAccount } from "@/lib/pushClient";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    // 로그아웃한 계정의 반응 알림이 이 기기로 계속 오지 않게 푸시 구독을 계정에서 떼어낸다(0074).
    await detachPushFromAccount();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}
