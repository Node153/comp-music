"use client";

// 이메일 알림 설정(0029) — 모바일 앱이 없어서 실시간 푸시가 불가능해 이메일이 사실상
// 유일한 알림 채널이다. 다만 이메일은 스팸처럼 느껴지기 쉬워서 종류별로 켜고 끌 수
// 있게 한다. 토글마다 바로 저장(별도 "저장" 버튼 없음) — 설정 화면에서 흔한 패턴.
// 실제 발송(이메일 서비스 연동)은 별도 작업이라 여기 토글은 지금 저장만 되고, 발송은
// 아직 연결 전이다 — 그래서 안내 문구를 하나 붙여둔다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { pageTitle, pageCard, mutedText } from "@/components/ui/styles";

type PreferenceKey =
  | "email_notify_knock"
  | "email_notify_companion_request"
  | "email_notify_message"
  | "email_notify_like"
  | "email_notify_comment"
  | "email_notify_peak";

const PREFERENCE_ROWS: { key: PreferenceKey; label: string; description: string }[] = [
  { key: "email_notify_knock", label: "노크", description: "비공개 게시물에 노크가 오면 메일로 알려드려요" },
  {
    key: "email_notify_companion_request",
    label: "Companion 신청",
    description: "누군가 Companion을 신청하면 메일로 알려드려요",
  },
  { key: "email_notify_message", label: "메시지", description: "새 메시지가 오면 메일로 알려드려요" },
  { key: "email_notify_like", label: "좋아요", description: "내 게시물에 좋아요가 눌리면 메일로 알려드려요" },
  { key: "email_notify_comment", label: "댓글", description: "내 게시물에 댓글이 달리면 메일로 알려드려요" },
  { key: "email_notify_peak", label: "PEAK", description: "내 게시물이 PEAK에 도달하면 메일로 알려드려요" },
];

type Preferences = Record<PreferenceKey, boolean>;

export default function NotificationSettingsPage() {
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState<PreferenceKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("users")
        .select(
          "email_notify_knock, email_notify_companion_request, email_notify_message, email_notify_like, email_notify_comment, email_notify_peak",
        )
        .eq("id", data.user.id)
        .single();
      if (row) setPrefs(row);
    });
  }, [supabase]);

  async function toggle(key: PreferenceKey, next: boolean) {
    if (!prefs) return;
    setError(null);
    setPrefs({ ...prefs, [key]: next });
    setSaving(key);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(null);
      return;
    }
    const update: Partial<Record<PreferenceKey, boolean>> = { [key]: next };
    const { error: updateError } = await supabase.from("users").update(update).eq("id", user.id);
    setSaving(null);
    if (updateError) {
      setPrefs({ ...prefs, [key]: !next });
      setError("저장에 실패했어요. 다시 시도해주세요.");
    }
  }

  return (
    <main className={pageCard}>
      <Link href="/notifications" className="text-sm text-gray-400 hover:text-gray-600">
        ← 알림
      </Link>
      <h1 className={`${pageTitle} mt-2`}>알림 설정</h1>
      <p className={`${mutedText} mt-1`}>
        아직 모바일 앱이 없어서, 켜둔 알림은 가입하신 이메일로 보내드려요.
      </p>

      <div className="mt-6 flex flex-col divide-y divide-gray-100">
        {PREFERENCE_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{row.label}</span>
              <span className="text-xs text-gray-400">{row.description}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs?.[row.key] ?? false}
              aria-label={`${row.label} 이메일 알림 ${prefs?.[row.key] ? "끄기" : "켜기"}`}
              disabled={!prefs || saving === row.key}
              onClick={() => prefs && toggle(row.key, !prefs[row.key])}
              className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                prefs?.[row.key] ? "bg-black" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  prefs?.[row.key] ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <p className="mt-6 text-xs text-gray-400">
        메일 발송 기능은 아직 준비 중이에요 — 지금은 설정만 저장돼요.
      </p>
    </main>
  );
}
