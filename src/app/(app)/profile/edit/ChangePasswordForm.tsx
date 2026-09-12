"use client";

// 비밀번호 변경 — Supabase 세션 기반 auth.updateUser({ password }).
// 현재 비밀번호는 묻지 않는다(Supabase 기본 동작). 소셜 로그인만 쓰던 계정이 여기서
// 비밀번호를 설정하면 이후 이메일+비밀번호 로그인도 가능해진다.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { errorText } from "@/components/ui/styles";

const MIN_LENGTH = 8;
// 그레이 3단계(옅은/중간/짙은)만 쓰는 화면이라, 여러 색을 한번에 묶은 공유 토큰(field/label)
// 대신 여기서 직접 정의한다 — 공유 토큰은 이 화면 밖(로그인 등)에서도 쓰여서 그대로 둔다.
const grayField =
  "w-full rounded-xl border border-transparent bg-box-gray px-3.5 py-2.5 text-sm text-black placeholder:text-black focus:border-active-gray focus:outline-none focus:ring-1 focus:ring-active-gray";
const blackLabel = "text-sm font-medium text-black";

export function ChangePasswordForm() {
  const supabase = createClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (pw.length < MIN_LENGTH) {
      setMessage({ type: "error", text: `비밀번호는 ${MIN_LENGTH}자 이상이어야 해요.` });
      return;
    }
    if (pw !== pw2) {
      setMessage({ type: "error", text: "두 비밀번호가 일치하지 않아요." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: `변경 실패: ${error.message}` });
      return;
    }
    setPw("");
    setPw2("");
    setMessage({ type: "ok", text: "비밀번호가 변경됐어요." });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-1.5">
      <span className={blackLabel}>비밀번호 변경</span>
      <p className="text-xs text-black">{MIN_LENGTH}자 이상. 변경 즉시 적용돼요.</p>
      <input
        type="password"
        placeholder="새 비밀번호"
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className={grayField}
      />
      <div className="flex gap-1.5">
        <input
          type="password"
          placeholder="새 비밀번호 확인"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className={grayField}
        />
        <Button type="submit" disabled={saving || !pw || !pw2} className="shrink-0 px-4 !bg-demo-bg !text-black">
          {saving ? "변경 중..." : "변경"}
        </Button>
      </div>
      {message &&
        (message.type === "error" ? (
          <p className={errorText}>{message.text}</p>
        ) : (
          <p className="text-sm text-green-600">{message.text}</p>
        ))}
    </form>
  );
}
