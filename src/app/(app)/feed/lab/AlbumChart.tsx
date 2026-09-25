"use client";

// 명반 차트(0087) — Lab 탭 기본 화면. 장르 필터(상위 분류 → 세부 장르)는 서버 왕복 없이 여기서
// 거르고, 추천·취소 뒤에는 router.refresh()로 album_chart를 다시 받는다.
// 세부 장르가 70개가 넘어서 한 장르에 추천이 몇 개 없을 때가 많다 — 그래서 상위 분류 "전체"
// 차트(그 분류의 세부 장르를 합친 순위)와 전체 장르 차트를 같이 둔다.
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ALBUM_CERTIFY_AT,
  ALBUM_CHART_MIN,
  ALBUM_CHART_SIZE,
  ALBUM_GENRE_LIMIT,
  ALBUM_REASON_MAX,
  listenLinks,
  rankAlbums,
  type AlbumGenre,
  type ChartAlbum,
} from "@/lib/albumChart";
import { useGuestSignupPrompt } from "@/components/GuestSignupPrompt";
import { ChevronDownIcon, CrownIcon, PlusIcon } from "@/components/icons";
import { cancelAlbumRec, recommendAlbum } from "./albumActions";
import { AlbumCover } from "./AlbumCover";
import { AlbumRecommendModal } from "./AlbumRecommendModal";

function chipClass(active: boolean, empty = false) {
  if (active) return "shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white";
  return `shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 transition dark:bg-gray-800 ${
    empty
      ? "text-gray-400 ring-gray-100 hover:ring-gray-300 dark:text-gray-500 dark:ring-gray-800"
      : "text-gray-700 ring-gray-200 hover:ring-gray-400 dark:text-gray-200 dark:ring-gray-700"
  }`;
}

export function AlbumChart({
  genres,
  albums,
  currentUserId,
}: {
  genres: AlbumGenre[];
  albums: ChartAlbum[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const openGuestPrompt = useGuestSignupPrompt();
  const [grp, setGrp] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);
  // DEMO의 명반 추천 배너(AlbumPromoCard)에서 오면(recommend=1) 추천 창을 바로 연다 — 한 번 더
  // 누르는 단계가 없어야 실제 추천으로 이어진다. 새로고침 때 또 열리지 않게 주소에서는 지운다.
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(() => !!currentUserId && searchParams.get("recommend") === "1");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("recommend")) return;
    params.delete("recommend");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  }, []);

  const genreBySlug = useMemo(() => new Map(genres.map((g) => [g.slug, g])), [genres]);
  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of genres) if (!seen.has(g.grp)) seen.set(g.grp, g.grp_name);
    return [...seen].map(([key, name]) => ({ key, name }));
  }, [genres]);
  const countByGenre = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of albums) m.set(a.genre, (m.get(a.genre) ?? 0) + 1);
    return m;
  }, [albums]);
  const countByGrp = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of albums) {
      const key = genreBySlug.get(a.genre)?.grp;
      if (key) m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [albums, genreBySlug]);
  const myCountByGenre = useMemo(() => {
    const m = new Map<string, number>();
    if (!currentUserId) return m;
    for (const a of albums) {
      if (a.recs.some((r) => r.user_id === currentUserId)) m.set(a.genre, (m.get(a.genre) ?? 0) + 1);
    }
    return m;
  }, [albums, currentUserId]);

  const visible = albums.filter((a) =>
    genre ? a.genre === genre : grp ? genreBySlug.get(a.genre)?.grp === grp : true,
  );
  const { chart, rest, candidates } = rankAlbums(visible);
  const scopeName = genre
    ? (genreBySlug.get(genre)?.name ?? "")
    : grp
      ? `${groups.find((g) => g.key === grp)?.name ?? ""} 전체`
      : "전체 장르";

  function selectScope(nextGrp: string | null, nextGenre: string | null) {
    setGrp(nextGrp);
    setGenre(nextGenre);
    setExpandedId(null);
    setShowRest(false);
  }

  function openRecommend() {
    if (!currentUserId) {
      openGuestPrompt();
      return;
    }
    setModalOpen(true);
  }

  function renderRow(album: ChartAlbum, rank: number | null) {
    return (
      <AlbumRow
        key={album.id}
        album={album}
        rank={rank}
        genreName={genre ? null : (genreBySlug.get(album.genre)?.name ?? null)}
        expanded={expandedId === album.id}
        onToggle={() => setExpandedId((cur) => (cur === album.id ? null : album.id))}
        currentUserId={currentUserId}
        myCountInGenre={myCountByGenre.get(album.genre) ?? 0}
        onGuest={openGuestPrompt}
        onChanged={() => router.refresh()}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4 px-4 md:mx-auto md:w-full md:max-w-[659px] md:px-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">명반 차트</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            회원들이 장르별로 추천한 명반이에요. {ALBUM_CHART_MIN}명이 추천하면 차트에 오르고, {ALBUM_CERTIFY_AT}명이
            추천하면 명반으로 인증돼요.
          </p>
        </div>
        <button
          type="button"
          onClick={openRecommend}
          className="flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          <PlusIcon className="h-4 w-4" />
          추천하기
        </button>
      </div>

      {/* 장르 필터 — 추천 창(AlbumRecommendModal)과 같은 두 단계: 상위 장르는 앨범 수가 붙은 타일,
          세부 장르는 고른 상위 장르 아래 별도 패널의 작은 칩(2026-09-26 사용자 요청). */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {[{ key: null as string | null, name: "전체" }, ...groups].map((g) => {
            const active = g.key === null ? !grp && !genre : grp === g.key;
            const n = g.key === null ? albums.length : (countByGrp.get(g.key) ?? 0);
            return (
              <button
                key={g.key ?? "all"}
                type="button"
                onClick={() => selectScope(g.key, null)}
                aria-pressed={active}
                className={`flex items-center justify-between gap-1 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition sm:text-sm ${
                  active
                    ? "border-violet-500 bg-violet-50 text-violet-800 dark:border-violet-400 dark:bg-violet-500/15 dark:text-violet-100"
                    : n === 0
                      ? "border-gray-100 bg-white text-gray-400 hover:border-gray-300 dark:border-gray-800 dark:bg-transparent dark:text-gray-500 dark:hover:border-gray-600"
                      : "border-gray-200 bg-white text-gray-800 hover:border-gray-400 dark:border-gray-700 dark:bg-transparent dark:text-gray-200 dark:hover:border-gray-500"
                }`}
              >
                <span className="min-w-0 break-keep leading-tight">{g.name}</span>
                {n > 0 && (
                  <span className={`shrink-0 text-[11px] font-medium ${active ? "text-violet-500 dark:text-violet-300" : "text-gray-400"}`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {grp && (
          <div className="flex flex-col gap-1.5 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-900">
            <p className="px-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              세부 장르 · {groups.find((g) => g.key === grp)?.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => selectScope(grp, null)} className={chipClass(!genre)}>
                전체
              </button>
              {genres
                .filter((g) => g.grp === grp)
                .map((g) => {
                  const n = countByGenre.get(g.slug) ?? 0;
                  return (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => selectScope(grp, g.slug)}
                      className={chipClass(genre === g.slug, n === 0)}
                    >
                      {g.name}
                      {n > 0 && <span className="ml-1 opacity-60">{n}</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{scopeName} Top {ALBUM_CHART_SIZE}</h2>
        {chart.length === 0 ? (
          <p className="mt-3 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            {candidates.length > 0
              ? `아직 차트에 오른 앨범이 없어요. 아래 후보에 한 명만 더 추천하면 올라가요.`
              : `아직 추천된 앨범이 없어요. 첫 명반을 추천해보세요.`}
          </p>
        ) : (
          <ol className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
            {chart.map((a, i) => renderRow(a, i + 1))}
            {showRest && rest.map((a, i) => renderRow(a, chart.length + i + 1))}
          </ol>
        )}
        {rest.length > 0 && !showRest && (
          <button
            type="button"
            onClick={() => setShowRest(true)}
            className="mt-1 flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {chart.length + 1}위부터 더 보기 ({rest.length})
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {candidates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            후보 <span className="font-normal text-gray-500 dark:text-gray-400">· 1명만 더 추천하면 차트에 올라가요</span>
          </h2>
          <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
            {candidates.map((a) => renderRow(a, null))}
          </ul>
        </div>
      )}

      {currentUserId && (
        <p className="pb-2 text-center text-xs text-gray-400 dark:text-gray-500">
          원하는 장르가 없나요? 추천할 때 장르 목록 끝의 &ldquo;장르 추가&rdquo;로 직접 만들 수 있어요.
        </p>
      )}

      {modalOpen && currentUserId && (
        <AlbumRecommendModal
          genres={genres}
          albums={albums}
          currentUserId={currentUserId}
          myCountByGenre={myCountByGenre}
          initialGenre={genre}
          onClose={() => setModalOpen(false)}
          onDone={(g) => {
            setModalOpen(false);
            selectScope(genreBySlug.get(g)?.grp ?? null, g);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function AlbumRow({
  album,
  rank,
  genreName,
  expanded,
  onToggle,
  currentUserId,
  myCountInGenre,
  onGuest,
  onChanged,
}: {
  album: ChartAlbum;
  rank: number | null;
  genreName: string | null;
  expanded: boolean;
  onToggle: () => void;
  currentUserId: string | null;
  myCountInGenre: number;
  onGuest: () => void;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();
  const mine = !!currentUserId && album.recs.some((r) => r.user_id === currentUserId);
  const toChart = ALBUM_CHART_MIN - album.rec_count;
  const toCertify = ALBUM_CERTIFY_AT - album.rec_count;

  function recommend() {
    setError(null);
    startTransition(async () => {
      const res = await recommendAlbum({
        source: album.source,
        sourceId: album.source_id,
        genre: album.genre,
        reason,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReason("");
      onChanged();
    });
  }

  function cancel() {
    startTransition(async () => {
      const res = await cancelAlbumRec(album.id);
      if (!res.ok) {
        setError("취소하지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      setConfirmCancel(false);
      onChanged();
    });
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        <span
          className={`w-6 shrink-0 text-center tabular-nums ${
            rank === null
              ? ""
              : rank <= 3
                ? "text-lg font-bold text-violet-600 dark:text-violet-300"
                : "text-base font-bold text-gray-700 dark:text-gray-300"
          }`}
        >
          {rank ?? ""}
        </span>
        <AlbumCover url={album.artwork_url} px={56} className="h-14 w-14 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{album.title}</span>
            {album.certified_at && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                <CrownIcon className="h-2.5 w-2.5" />
                명반
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {album.artist}
            {album.release_year ? ` · ${album.release_year}` : ""}
          </span>
          {genreName && <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">{genreName}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className={`text-sm font-bold tabular-nums ${mine ? "text-violet-600 dark:text-violet-300" : "text-gray-900 dark:text-gray-100"}`}>
            {album.rec_count}
          </span>
          <span className="text-[10px] text-gray-400">{mine ? "내 추천" : "추천"}</span>
        </span>
      </button>

      {expanded && (
        <div className="mb-3 ml-9 flex flex-col gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
          <ul className="flex flex-col gap-2">
            {album.recs.map((r, i) => (
              <li key={r.user_id} className="text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">{r.nickname}</span>
                {i === 0 && <span className="ml-1.5 text-[11px] text-violet-600 dark:text-violet-300">처음 추천</span>}
                {r.reason && <p className="mt-0.5 text-gray-600 dark:text-gray-300">{r.reason}</p>}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-1.5">
            {listenLinks(album).map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-gray-400 dark:border-gray-700 dark:bg-[#1c1c1e] dark:text-gray-200 dark:hover:border-gray-500"
              >
                {l.label}
              </a>
            ))}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {toChart > 0
              ? `${toChart}명만 더 추천하면 차트에 올라가요.`
              : album.certified_at
                ? "명반으로 인증된 앨범이에요."
                : `명반 인증까지 ${toCertify}명 남았어요.`}
          </p>

          {!currentUserId ? (
            <button
              type="button"
              onClick={onGuest}
              className="self-start rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
            >
              나도 추천하기
            </button>
          ) : mine ? (
            confirmCancel ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600 dark:text-gray-300">추천을 취소할까요?</span>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={pending}
                  className="rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  취소하기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="px-2 py-1.5 font-medium text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  그대로 두기
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="self-start text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                내 추천 취소
              </button>
            )
          ) : myCountInGenre >= ALBUM_GENRE_LIMIT ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              이 장르는 {ALBUM_GENRE_LIMIT}장을 다 추천했어요. 기존 추천을 취소하면 새로 추천할 수 있어요.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, ALBUM_REASON_MAX))}
                placeholder="한 줄 이유 (선택)"
                className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-3.5 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none dark:border-gray-700 dark:bg-[#1c1c1e] dark:text-gray-100 md:text-sm"
              />
              <button
                type="button"
                onClick={recommend}
                disabled={pending}
                className="shrink-0 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {pending ? "추천 중…" : "나도 추천"}
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </li>
  );
}
