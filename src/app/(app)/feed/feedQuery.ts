import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { FeedPostRow } from "./feedRender";

// 맞춤형 피드 페이지 구성(2026-09-24, 사용자 요청) — 10개씩 무한 스크롤.
//   1) 아직 재생 안 한(post_plays 없는) 게시물 먼저, 최신순
//   2) 다 보면 "모두 확인했어요" 구분선 뒤에 이미 재생한 게시물, 최신순
//   3) 두 구간 모두 게시자 섞기 — 같은 게시자가 연달아 나오지 않고, 한 페이지(10개)에 같은
//      게시자는 최대 2개. 규칙 때문에 빠진 글은 버리지 않고 carry로 다음 페이지 앞에 넘긴다.
//      다른 게시자가 더 없으면(그 구간 DB를 다 읽음) 규칙을 풀어 그대로 보여준다.
// 게스트는 재생 기록이 없어 1)만 있다(= 최신순 + 게시자 섞기).
// 2026-09-25(사용자 요청) memo 탭을 없애고 DEMO 피드 하나에 전체공개 + 내가 볼 수 있는 Companion·
// 특정인 공개 글을 함께 싣는다 — feed_candidates의 'all' 범위(0088). 콜라보 고정(Pin) 글은 첫 페이지
// 맨 위에 따로 두고(태그로 거를 때는 제외) 이후 페이지에서는 exclude로 뺀다.
// 공유·알림 링크의 post=(focusId)도 같은 방식 — 그 글을 첫 페이지 맨 위에 두고 목록에서는 뺀다.

export const FEED_PAGE_SIZE = 10;
// 한 페이지를 고를 때 보는 후보 수(carry 포함) — 섞을 다른 게시자를 찾을 여유분.
const POOL_SIZE = 20;
const MAX_PER_AUTHOR = 2;
// 1차(엄격한) 규칙으로 이보다 적게 뽑히면 페이지당 상한만 풀고 인접 금지는 유지한다.
const MIN_PICKS = 4;

export type FeedState = {
  // 예전엔 "demo" | "memo" 두 피드였다 — 이제 DEMO 하나(값은 호환용으로만 남김).
  scope: "demo";
  tag: string | null;
  phase: "unplayed" | "played";
  cursor: { ts: string; id: string } | null;
  // 게시자 섞기로 미뤄진 글(다음 페이지 후보 맨 앞) — id만 들고 다니고 서버에서 다시 조회.
  carry: string[];
  // 첫 페이지에 이미 맨 위로 보여준 memo 고정 글.
  exclude: string[];
  lastAuthor: string | null;
  // 현재 phase의 DB 행을 끝까지 읽었는지.
  dbDone: boolean;
  // 안 들은 글 구간이 끝나 다음 글 앞에 "모두 확인했어요" 구분선을 넣어야 함.
  pendingDivider: boolean;
};

export type FeedItem = { kind: "post"; post: FeedPostRow } | { kind: "divider" };

type Supabase = Awaited<ReturnType<typeof createClient>>;

// feed_candidates 범위 — 전체공개 + 볼 수 있는 비공개 글(0088). 옛 'demo'(전체공개만)는 이 코드가
// 배포되기 전 화면을 위해 DB에 남아 있다.
const RPC_SCOPE = "all";

export function initialFeedState(tag: string | null): FeedState {
  return { scope: "demo", tag, phase: "unplayed", cursor: null, carry: [], exclude: [], lastAuthor: null, dbDone: false, pendingDivider: false };
}

function byRecency(a: FeedPostRow, b: FeedPostRow) {
  const t = (b.published_at ?? "").localeCompare(a.published_at ?? "");
  return t !== 0 ? t : b.id.localeCompare(a.id);
}

// 후보 풀에서 게시자가 섞이도록 최대 max개를 고른다. picks/counts/prev는 호출자와 공유(같은
// 페이지 안에서 구간이 바뀌어도 규칙이 이어지게).
function diversify(
  pool: FeedPostRow[],
  max: number,
  state: { prev: string | null; counts: Map<string, number> },
  relaxAll: boolean,
): { picked: FeedPostRow[]; rest: FeedPostRow[] } {
  const picked: FeedPostRow[] = [];
  let rest = pool;
  const take = (p: FeedPostRow) => {
    picked.push(p);
    state.prev = p.user_id;
    state.counts.set(p.user_id, (state.counts.get(p.user_id) ?? 0) + 1);
  };
  // 한 바퀴에 게시자당 하나씩 빠지는 식이라(A B C A B C …) 더 고를 게 없을 때까지 반복한다.
  const pass = (ok: (p: FeedPostRow) => boolean) => {
    for (let progressed = true; progressed && picked.length < max; ) {
      progressed = false;
      const next: FeedPostRow[] = [];
      for (const p of rest) {
        if (picked.length < max && ok(p)) {
          take(p);
          progressed = true;
        } else next.push(p);
      }
      rest = next;
    }
  };

  pass((p) => p.user_id !== state.prev && (state.counts.get(p.user_id) ?? 0) < MAX_PER_AUTHOR);
  if (picked.length < MIN_PICKS || relaxAll) pass((p) => p.user_id !== state.prev);
  if (relaxAll) pass(() => true);
  return { picked, rest };
}

async function fetchByIds(supabase: Supabase, s: FeedState, ids: string[]): Promise<FeedPostRow[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.rpc("feed_candidates", {
    p_scope: RPC_SCOPE,
    p_tag: s.tag,
    p_ids: ids,
    p_limit: 50,
  });
  return (data ?? []) as FeedPostRow[];
}

// 첫 페이지 맨 위 고정 글 — feed/feedRender.tsx의 isPinned와 같은 규칙(post_pins 오버라이드
// 우선, 없으면 "내 콜라보 글 또는 초대받은 invite_only 콜라보 글" 자동 고정).
async function fetchPinned(supabase: Supabase, s: FeedState, userId: string): Promise<FeedPostRow[]> {
  const [{ data: pinRows }, { data: accessRows }, { data: ownCollab }] = await Promise.all([
    supabase.from("post_pins").select("post_id, pinned").eq("user_id", userId),
    supabase.from("post_access").select("post_id").eq("user_id", userId).in("status", ["invited", "accepted"]),
    supabase
      .from("posts")
      .select("id")
      .eq("user_id", userId)
      .eq("collab_available", true)
      .eq("status", "published"),
  ]);
  const unpinned = new Set((pinRows ?? []).filter((r) => !r.pinned).map((r) => r.post_id));
  const forced = new Set((pinRows ?? []).filter((r) => r.pinned).map((r) => r.post_id));
  const invited = new Set((accessRows ?? []).map((r) => r.post_id));
  const ids = [...new Set([...forced, ...invited, ...(ownCollab ?? []).map((r) => r.id)])].filter(
    (id) => !unpinned.has(id),
  );
  const rows = await fetchByIds(supabase, s, ids);
  return rows
    .filter((p) => forced.has(p.id) || (p.collab_available && (p.user_id === userId || p.visibility === "invite_only")))
    .sort(byRecency);
}

// 다음 페이지 구성. 반환 state가 null이면 더 볼 게시물이 없다.
export async function buildFeedPage(
  supabase: Supabase,
  input: FeedState,
  userId: string | null,
  isFirstPage: boolean,
  focusId: string | null = null,
): Promise<{ items: FeedItem[]; next: FeedState | null; focused: boolean }> {
  const s: FeedState = { ...input, carry: [...input.carry], exclude: [...input.exclude] };
  const items: FeedItem[] = [];
  let postCount = 0;
  let focused = false;

  // 링크로 콕 집어 들어온 글 — feed_candidates가 열람 범위(본인·Companion·초대)를 그대로 걸러서,
  // 볼 수 없는 글이면 그냥 무시된다.
  if (isFirstPage && focusId) {
    const [post] = await fetchByIds(supabase, s, [focusId]);
    if (post) {
      items.push({ kind: "post", post });
      s.exclude.push(post.id);
      focused = true;
    }
  }

  if (isFirstPage && !s.tag && userId) {
    const pinned = (await fetchPinned(supabase, s, userId)).filter((p) => !s.exclude.includes(p.id));
    for (const post of pinned) items.push({ kind: "post", post });
    s.exclude.push(...pinned.map((p) => p.id));
  }

  const exclude = new Set(s.exclude);
  const div = { prev: s.lastAuthor, counts: new Map<string, number>() };

  // 구간 전환(안 들은 글 → 들은 글)이 한 페이지 안에서 일어날 수 있어 몇 바퀴 돈다.
  for (let round = 0; round < 4 && postCount < FEED_PAGE_SIZE; round++) {
    const carried = await fetchByIds(supabase, s, s.carry);
    const carriedById = new Map(carried.map((p) => [p.id, p]));
    const pool = s.carry.map((id) => carriedById.get(id)).filter((p): p is FeedPostRow => !!p);

    const need = POOL_SIZE - pool.length;
    if (!s.dbDone && need > 0) {
      const { data } = await supabase.rpc("feed_candidates", {
        p_scope: RPC_SCOPE,
        p_tag: s.tag,
        p_played: s.phase === "played",
        p_before_ts: s.cursor?.ts ?? null,
        p_before_id: s.cursor?.id ?? null,
        p_limit: need,
      });
      const fresh = (data ?? []) as FeedPostRow[];
      if (fresh.length < need) s.dbDone = true;
      const last = fresh.at(-1);
      if (last) s.cursor = { ts: last.published_at!, id: last.id };
      for (const p of fresh) if (!exclude.has(p.id)) pool.push(p);
    }
    pool.sort(byRecency);

    // 풀 전체가 방금 나온 게시자 한 명뿐이라 하나도 못 고르면(한 사람이 수십 개 연속 게시)
    // 빈 페이지를 반복하지 않도록 규칙을 푼다.
    let { picked, rest } = diversify(pool, FEED_PAGE_SIZE - postCount, div, s.dbDone);
    if (picked.length === 0 && pool.length > 0) ({ picked, rest } = diversify(pool, FEED_PAGE_SIZE - postCount, div, true));
    if (picked.length > 0 && s.pendingDivider) {
      items.push({ kind: "divider" });
      s.pendingDivider = false;
    }
    for (const post of picked) items.push({ kind: "post", post });
    postCount += picked.length;
    s.carry = rest.map((p) => p.id);
    s.lastAuthor = div.prev;

    const phaseExhausted = s.dbDone && s.carry.length === 0;
    if (!phaseExhausted) continue;
    if (s.phase === "unplayed" && userId) {
      s.phase = "played";
      s.cursor = null;
      s.dbDone = false;
      // 구분선은 들은 글이 실제로 하나라도 나올 때 그 앞에 넣는다(위 pendingDivider).
      s.pendingDivider = true;
      continue;
    }
    return { items, next: null, focused };
  }

  return { items, next: s, focused };
}
