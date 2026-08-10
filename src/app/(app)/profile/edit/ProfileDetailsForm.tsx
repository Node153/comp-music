"use client";

// 학교/전공/지역/소개글/협업가능 — profiles 테이블(0001_init) 저장.
// 지금까지는 이 폼이 onSubmit 없는 정적 mock이었고, 실제로 profiles에 쓰는 화면이 하나도
// 없어서 가입 이후 아무도 이 행을 만든 적이 없다(그래서 프로필 화면에 학교/전공 배지가
// 아예 안 뜸). upsert로 처음 저장 시 행을 만들고, 이후엔 갱신한다(profiles_insert_self/
// profiles_update_self RLS가 본인 행만 허용).
// user_type(전공생/활동자)은 profiles의 NOT NULL 컬럼인데 verify/documents 제출 화면이
// verifications.type엔 저장해도 profiles엔 옮겨 적지 않는다 — 게다가 파일럿 테스터는 서류
// 제출 없이 SQL로 바로 승인되니 verifications 행조차 없을 수 있다. 그래서 여기서 직접
// 고르게 하고, 기존 값이 있으면(profiles → 없으면 verifications 순) 미리 채워준다.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, label, errorText } from "@/components/ui/styles";

type UserType = "student" | "activist";

const USER_TYPE_OPTIONS: { value: UserType; label: string }[] = [
  { value: "student", label: "🎓 전공생" },
  { value: "activist", label: "🎤 활동자" },
];

type ProfileDetails = {
  userType: UserType | null;
  school: string;
  major: string;
  region: string;
  bio: string;
  collab_available: boolean;
};

const EMPTY: ProfileDetails = {
  userType: null,
  school: "",
  major: "",
  region: "",
  bio: "",
  collab_available: false,
};

export function ProfileDetailsForm() {
  const supabase = createClient();
  const [details, setDetails] = useState<ProfileDetails>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("profiles")
        .select("user_type, school, major, region, bio, collab_available")
        .eq("user_id", data.user.id)
        .maybeSingle();

      let userType = (row?.user_type as UserType | undefined) ?? null;
      if (!userType) {
        const { data: verification } = await supabase
          .from("verifications")
          .select("type")
          .eq("user_id", data.user.id)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        userType = (verification?.type as UserType | undefined) ?? null;
      }

      if (row) {
        setDetails({
          userType,
          school: row.school ?? "",
          major: row.major ?? "",
          region: row.region ?? "",
          bio: row.bio ?? "",
          collab_available: row.collab_available,
        });
      } else {
        setDetails((d) => ({ ...d, userType }));
      }
      setLoaded(true);
    });
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !details.userType) return;
    setSaving(true);
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        user_type: details.userType,
        school: details.school.trim() || null,
        major: details.major.trim() || null,
        region: details.region.trim() || null,
        bio: details.bio.trim() || null,
        collab_available: details.collab_available,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    setMessage(
      error ? { type: "error", text: `저장 실패: ${error.message}` } : { type: "ok", text: "저장됐어요." },
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={label}>활동 유형</span>
        <div className="grid grid-cols-2 gap-2">
          {USER_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={!loaded}
              onClick={() => setDetails((d) => ({ ...d, userType: option.value }))}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                details.userType === option.value
                  ? "border-black bg-black text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>학교</span>
        <input
          type="text"
          placeholder="학교명"
          disabled={!loaded}
          value={details.school}
          onChange={(e) => setDetails((d) => ({ ...d, school: e.target.value }))}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>전공</span>
        <input
          type="text"
          placeholder="전공명"
          disabled={!loaded}
          value={details.major}
          onChange={(e) => setDetails((d) => ({ ...d, major: e.target.value }))}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>지역</span>
        <input
          type="text"
          placeholder="활동 지역"
          disabled={!loaded}
          value={details.region}
          onChange={(e) => setDetails((d) => ({ ...d, region: e.target.value }))}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>소개글</span>
        <textarea
          placeholder="나를 소개해주세요"
          rows={3}
          disabled={!loaded}
          value={details.bio}
          onChange={(e) => setDetails((d) => ({ ...d, bio: e.target.value }))}
          className={field}
        />
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-3 text-sm">
        <input
          type="checkbox"
          disabled={!loaded}
          checked={details.collab_available}
          onChange={(e) => setDetails((d) => ({ ...d, collab_available: e.target.checked }))}
          className="h-4 w-4 accent-black"
        />
        협업 가능
      </label>
      {message &&
        (message.type === "error" ? (
          <p className={errorText}>{message.text}</p>
        ) : (
          <p className="text-sm text-green-600">{message.text}</p>
        ))}
      <Button type="submit" disabled={saving || !loaded || !details.userType} className="mt-1 w-full">
        {saving ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
