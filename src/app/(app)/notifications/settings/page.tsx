"use client";

// 알림 설정 — 이메일(0033)과 웹 푸시(0074). 앱 출시 전이라 네이티브 푸시 대신 브라우저 웹
// 푸시(PWA)를 쓰고, 푸시를 못 받는 환경을 위해 이메일도 종류별로 켜고 끌 수 있게 한다.
// 토글마다 바로 저장(별도 "저장" 버튼 없음) — 설정 화면에서 흔한 패턴.
// 발송: Kick(0071)·좋아요·댓글(0074)은 받는 즉시(/api/kicks, /api/notify/reaction — 메일은
// 같은 게시물 기준으로 묶어서), 나머지는 api/cron/send-notification-emails의 하루 1회 다이제스트.
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { pageTitle, pageCard, mutedText } from "@/components/ui/styles";
import { PushSettingsCard } from "@/components/PushSettingsCard";

type PreferenceKey =
  | "push_notify_like"
  | "push_notify_comment"
  | "push_notify_kick"
  | "email_notify_knock"
  | "email_notify_companion_request"
  | "email_notify_message"
  | "email_notify_like"
  | "email_notify_kick"
  | "email_notify_comment"
  | "email_notify_peak";

type PreferenceRow = { key: PreferenceKey; label: string; description: string };

const PUSH_ROWS: PreferenceRow[] = [
  { key: "push_notify_like", label: "좋아요", description: "내 게시물에 좋아요가 눌리면" },
  { key: "push_notify_comment", label: "댓글·답글", description: "내 게시물에 댓글, 내 댓글에 답글이 달리면" },
  { key: "push_notify_kick", label: "Kick", description: "내 게시물이 Kick을 받으면" },
];

const PREFERENCE_ROWS: PreferenceRow[] = [
  { key: "email_notify_knock", label: "노크", description: "비공개 게시물에 노크가 오면 메일로 알려드려요" },
  {
    key: "email_notify_companion_request",
    label: "Companion 신청",
    description: "누군가 Companion을 신청하면 메일로 알려드려요",
  },
  { key: "email_notify_message", label: "메시지", description: "새 메시지가 오면 메일로 알려드려요" },
  { key: "email_notify_kick", label: "Kick", description: "내 게시물이 Kick을 받으면 바로 메일로 알려드려요" },
  {
    key: "email_notify_like",
    label: "좋아요",
    description: "좋아요가 눌리면 바로 메일로 알려드려요(같은 게시물은 1시간에 한 통으로 묶어서)",
  },
  {
    key: "email_notify_comment",
    label: "댓글·답글",
    description: "댓글·답글이 달리면 바로 메일로 알려드려요(같은 게시물은 10분에 한 통으로 묶어서)",
  },
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
          "push_notify_like, push_notify_comment, push_notify_kick, email_notify_knock, email_notify_companion_request, email_notify_message, email_notify_like, email_notify_kick, email_notify_comment, email_notify_peak",
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
      {/* /notifications 페이지는 알림 패널로 옮겨지며 삭제됨(2026-09-16) — 피드로 돌아간다. */}
      <Link href="/feed" className="text-sm text-black hover:underline">
        ← 피드
      </Link>
      <h1 className={`${pageTitle} !text-black mt-2`}>알림 설정</h1>
      <p className={`${mutedText} !text-active-gray mt-1`}>
        아직 앱이 없어서 브라우저 푸시와 이메일로 알려드려요.
      </p>

      <div className="mt-6">
        <PushSettingsCard />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-black">푸시로 받을 알림</h2>
      <div className="mt-1 flex flex-col divide-y divide-box-gray">
        {PUSH_ROWS.map((row) => (
          <ToggleRow key={row.key} row={row} channel="푸시" prefs={prefs} saving={saving} onToggle={toggle} />
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-black">이메일로 받을 알림</h2>
      <div className="mt-1 flex flex-col divide-y divide-box-gray">
        {PREFERENCE_ROWS.map((row) => (
          <ToggleRow key={row.key} row={row} channel="이메일" prefs={prefs} saving={saving} onToggle={toggle} />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <p className="mt-6 text-xs text-active-gray">
        Kick·좋아요·댓글은 받는 즉시, 나머지는 하루에 한 번 모아서 보내드려요.
      </p>
    </main>
  );
}

function ToggleRow({
  row,
  channel,
  prefs,
  saving,
  onToggle,
}: {
  row: PreferenceRow;
  channel: string;
  prefs: Preferences | null;
  saving: PreferenceKey | null;
  onToggle: (key: PreferenceKey, next: boolean) => void;
}) {
  const on = prefs?.[row.key] ?? false;
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-black">{row.label}</span>
        <span className="text-xs text-active-gray">{row.description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${row.label} ${channel} 알림 ${on ? "끄기" : "켜기"}`}
        disabled={!prefs || saving === row.key}
        onClick={() => prefs && onToggle(row.key, !on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
          on ? "bg-demo-bg" : "bg-box-gray"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-main-gray shadow transition ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
