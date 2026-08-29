"use client";

// 닉네임 변경(0018) — 프로필 수정 화면에서 유일하게 실제 저장되는 필드.
// 기존 가입자는 0018 백필로 임시 닉네임(user_xxxxxx)을 받았으므로 여기서 바꾼다.
// users_update_self RLS로 본인 행만 수정 가능(닉네임 유니크 위반은 에러 메시지로 안내).
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, label, errorText } from "@/components/ui/styles";
import { randomNicknameExample, generateNicknameCandidate, hasWhitespace } from "@/lib/nicknameExamples";
import { DiceIcon } from "@/components/icons";

export function NicknameForm() {
  const supabase = createClient();
  const [nickname, setNickname] = useState("");
  // placeholder 예시는 mount마다 랜덤 — SSR과 달라질 수 있어 input에 suppressHydrationWarning.
  const [nicknameExample] = useState(randomNicknameExample);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("users")
        .select("nickname")
        .eq("id", data.user.id)
        .single();
      if (row) setNickname(row.nickname);
      setLoaded(true);
    });
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || saving) return;
    if (hasWhitespace(trimmed)) {
      setMessage({ type: "error", text: "닉네임에는 띄어쓰기를 쓸 수 없어요." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    // nickname은 이제 유니크 제약이 없다(0038) — 실제 유일함은 가입 시 서버가 배정하는
    // nickname_tag가 담당하고 여기서는 절대 안 건드리므로, 저장 실패는 그냥 그대로 보여준다.
    const { error } = await supabase.from("users").update({ nickname: trimmed }).eq("id", user.id);
    setSaving(false);
    setMessage(
      error
        ? { type: "error", text: `저장 실패: ${error.message}` }
        : { type: "ok", text: "닉네임이 저장됐어요." },
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-1.5">
      <span className={label}>닉네임</span>
      <p className="text-xs text-gray-400">
        Companion이 아닌 사람에게는 실명 대신 이 닉네임이 보여요. 다른 사람이 이 닉네임으로
        나를 검색해서 찾을 수 있으니, 활동명이 있다면 그걸로 적는 걸 추천해요.
      </p>
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder={`예: ${nicknameExample}`}
          suppressHydrationWarning
          required
          maxLength={30}
          disabled={!loaded}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className={field}
        />
        <button
          type="button"
          onClick={() => setNickname(generateNicknameCandidate())}
          title="다른 닉네임 뽑기"
          disabled={!loaded}
          className="flex shrink-0 items-center justify-center rounded-xl border border-gray-300 px-3.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <DiceIcon className="h-4 w-4" />
        </button>
        <Button type="submit" disabled={saving || !loaded} className="shrink-0 px-4">
          {saving ? "저장 중..." : "저장"}
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
