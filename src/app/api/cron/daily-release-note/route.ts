import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 일일 릴리즈 노트 자동 초안(0070) — 매일 09:00 KST(vercel.json 크론 "0 0 * * *" UTC)에 전날 하루
// (KST 00:00~24:00) main 브랜치 커밋을 모아 Claude로 "회원에게 보이는 큰 변화" 위주 한 건으로
// 요약하고, 공지(업데이트)로 "초안" 저장한다. 관리자가 /admin/announcements에서 다듬어 게시해야
// 회원에게 보인다. 커밋이 없거나, 회원에게 보이는 변화가 없다고 판단되면 아무것도 만들지 않는다.
// 같은 날짜로 두 번 돌아도(재시도 등) announcements.release_date unique라 중복 생성되지 않는다.
//
// 필요한 환경변수: ANTHROPIC_API_KEY(Claude), CRON_SECRET(크론 인증). 저장소가 공개라 GitHub
// 토큰은 선택(GITHUB_TOKEN이 있으면 사용 — 비공개로 바뀌거나 호출 한도가 걸릴 때 대비).
export const maxDuration = 60;

const REPO = "Node153/comp-music";
const BRANCH = "main";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type GithubCommit = { sha: string; commit: { message: string }; parents: { sha: string }[] };

const NOTE_SCHEMA = {
  type: "object",
  properties: {
    has_member_facing_changes: { type: "boolean" },
    title: { type: "string" },
    content: { type: "string" },
    link_url: { type: ["string", "null"] },
  },
  required: ["has_member_facing_changes", "title", "content", "link_url"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `너는 음악 창작자 커뮤니티 앱 "Compmusic"의 릴리즈 노트를 쓰는 사람이야.
하루 동안의 git 커밋 메시지를 받아서, 회원에게 알릴 만한 "크게 바뀐 점"만 골라 업데이트 소식 한 건으로 요약해.

포함할 것: 회원이 화면에서 직접 느끼는 새 기능, 눈에 띄는 개선, 체감되는 버그 수정.
뺄 것: 관리자 화면(/admin, 회원 관리, 공지 관리 등)과 운영자 전용 기능, DB·보안·성능 같은 내부 작업, 리팩터링, 문구·여백 같은 사소한 조정, 테스트.
회원에게 보이는 변화가 하나도 없으면 has_member_facing_changes를 false로 하고 title/content는 빈 문자열로 둬.

작성 규칙:
- 한국어 해요체, 친근하고 담백하게. 과장이나 이모지는 쓰지 마.
- title: 가장 큰 변화를 한 줄로(25자 안팎). 예) "영상에 음원을 넣을 수 있어요"
- content: 1~3줄. 변화가 여러 개면 줄마다 "· "로 시작. 회원이 무엇을 할 수 있게 됐는지 위주로, 기술 용어(API, RLS, 컴포넌트 이름 등)는 쓰지 마.
- link_url: 바뀐 기능을 바로 써볼 수 있는 앱 내부 경로가 분명하면 그 경로(예: /upload, /help, /feed, /search), 아니면 null.
- 커밋에 없는 내용은 지어내지 마.`;

function kstDateString(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 전날 하루(KST) 구간.
  const until = new Date(`${kstDateString(new Date())}T00:00:00+09:00`);
  const since = new Date(until.getTime() - DAY_MS);
  const releaseDate = kstDateString(since);

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("announcements")
    .select("id")
    .eq("release_date", releaseDate)
    .maybeSingle();
  if (existing) return NextResponse.json({ skipped: "already_created", releaseDate });

  const commitsRes = await fetch(
    `https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&since=${since.toISOString()}&until=${until.toISOString()}&per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "compmusic-release-notes",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      cache: "no-store",
    },
  );
  if (!commitsRes.ok) {
    return NextResponse.json({ error: `github ${commitsRes.status}` }, { status: 502 });
  }
  const commits = ((await commitsRes.json()) as GithubCommit[]).filter((c) => c.parents.length <= 1);
  if (commits.length === 0) return NextResponse.json({ skipped: "no_commits", releaseDate });

  // Co-Authored-By 같은 꼬리 줄은 요약에 쓸모없어서 뺀다. 오래된 것부터 읽히게 뒤집는다.
  const commitLog = commits
    .reverse()
    .map((c) =>
      c.commit.message
        .split("\n")
        .filter((line) => !/^co-authored-by:/i.test(line.trim()))
        .join("\n")
        .trim(),
    )
    .join("\n\n---\n\n");

  // 키가 없으면 SDK가 APIError가 아닌 설정 오류를 던져서 원인이 안 보이는 500이 된다 — 먼저 확인.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 미설정", releaseDate, commits: commits.length }, { status: 500 });
  }
  const client = new Anthropic();
  let note: { has_member_facing_changes: boolean; title: string; content: string; link_url: string | null };
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: NOTE_SCHEMA } },
      // 안전 분류기 오판으로 거절되면 서버가 다른 모델로 이어서 처리.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `${releaseDate} 커밋 ${commits.length}개:\n\n${commitLog}` }],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "refusal", releaseDate }, { status: 502 });
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "no_text", releaseDate }, { status: 502 });
    }
    note = JSON.parse(text.text);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "anthropic_auth (ANTHROPIC_API_KEY 확인)" }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "anthropic_rate_limited" }, { status: 503 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `anthropic ${error.status}: ${error.message}` }, { status: 502 });
    }
    throw error;
  }

  if (!note.has_member_facing_changes || !note.title.trim() || !note.content.trim()) {
    return NextResponse.json({ skipped: "no_member_facing_changes", releaseDate, commits: commits.length });
  }

  // 작성자는 공식 "Compmusic" 운영 계정, 없으면 가장 먼저 만들어진 관리자.
  const { data: admins } = await supabase
    .from("users")
    .select("id, nickname")
    .eq("role", "admin")
    .order("created_at", { ascending: true });
  const author = (admins ?? []).find((u) => u.nickname === "Compmusic") ?? admins?.[0];
  if (!author) return NextResponse.json({ error: "no_admin_author" }, { status: 500 });

  const linkUrl = note.link_url && /^\/[^/]/.test(note.link_url) ? note.link_url : null;
  const { error: insertError } = await supabase.from("announcements").insert({
    author_id: author.id,
    kind: "update",
    status: "draft",
    release_date: releaseDate,
    title: note.title.trim().slice(0, 200),
    content: note.content.trim(),
    link_url: linkUrl,
  });
  if (insertError) {
    // 동시 실행으로 unique 충돌이면 이미 만들어진 것.
    if (insertError.code === "23505") return NextResponse.json({ skipped: "already_created", releaseDate });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ created: true, releaseDate, commits: commits.length, title: note.title });
}
