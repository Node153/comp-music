"use client";

// 앨범 추천하기 — ① 검색: 아티스트를 고르면 그 아티스트의 앨범 목록, 또는 앨범 결과에서 바로 고르기
// (Apple 결과가 0건이면 MusicBrainz로 자동으로 한 번 더) ② 확인: 처음 올리는 앨범이면 세부 장르와
// 한 줄 이유(필수), 이미 차트에 있는 앨범이면 이유만(선택) 받고 추천. 원하는 세부 장르가 없으면
// 그 자리에서 직접 추가할 수 있다(0088 add_album_genre — 비슷한 이름이 있으면 그 장르로 연결).
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ALBUM_GENRE_LIMIT,
  ALBUM_REASON_MAX,
  itunesArtistAlbums,
  searchItunes,
  type AlbumCandidate,
  type AlbumGenre,
  type ChartAlbum,
  type ItunesArtist,
} from "@/lib/albumChart";
import { addAlbumGenre, recommendAlbum, searchMusicBrainz } from "./albumActions";
import { AlbumCover } from "./AlbumCover";
import { BackArrowIcon, PlusIcon, SearchIcon, UserIcon, XIcon } from "@/components/icons";

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-700 dark:bg-[#1c1c1e] dark:text-gray-100 md:text-sm";

function chipClass(active: boolean, disabled = false) {
  if (active) return "shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white";
  if (disabled) return "shrink-0 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-300 dark:bg-gray-900 dark:text-gray-600";
  return "shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
}

type ItunesResults = { artists: ItunesArtist[]; albums: AlbumCandidate[] };

export function AlbumRecommendModal({
  genres,
  albums,
  currentUserId,
  myCountByGenre,
  initialGenre,
  onClose,
  onDone,
}: {
  genres: AlbumGenre[];
  albums: ChartAlbum[];
  currentUserId: string;
  myCountByGenre: Map<string, number>;
  initialGenre: string | null;
  onClose: () => void;
  onDone: (genre: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ItunesResults | null>(null);
  const [mbResults, setMbResults] = useState<AlbumCandidate[] | null>(null);
  const [mbLoading, setMbLoading] = useState(false);
  const [artist, setArtist] = useState<ItunesArtist | null>(null);
  const [artistAlbums, setArtistAlbums] = useState<AlbumCandidate[] | null>(null);
  const [picked, setPicked] = useState<AlbumCandidate | null>(null);
  const [grp, setGrp] = useState<string | null>(
    initialGenre ? (genres.find((g) => g.slug === initialGenre)?.grp ?? null) : null,
  );
  const [genre, setGenre] = useState<string | null>(initialGenre);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mbQueryRef = useRef<string | null>(null);
  // 이 창에서 방금 추가한 장르 — 추천을 마치면 부모가 router.refresh()로 목록을 다시 받는다.
  const [addedGenres, setAddedGenres] = useState<AlbumGenre[]>([]);
  const [newGenreOpen, setNewGenreOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [genreNote, setGenreNote] = useState<string | null>(null);
  const [addingGenre, startAddGenre] = useTransition();

  const allGenres = useMemo(
    () => [...genres, ...addedGenres.filter((a) => !genres.some((g) => g.slug === a.slug))],
    [genres, addedGenres],
  );
  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of allGenres) if (!seen.has(g.grp)) seen.set(g.grp, g.grp_name);
    return [...seen].map(([key, name]) => ({ key, name }));
  }, [allGenres]);
  const genreBySlug = useMemo(() => new Map(allGenres.map((g) => [g.slug, g])), [allGenres]);

  function submitNewGenre() {
    if (!grp || !newGenreName.trim()) return;
    setGenreNote(null);
    startAddGenre(async () => {
      const res = await addAlbumGenre(grp, newGenreName);
      if (!res.ok) {
        setGenreNote(res.error);
        return;
      }
      setAddedGenres((prev) => [...prev, res.genre]);
      setGrp(res.genre.grp);
      setGenre(res.genre.slug);
      setNewGenreOpen(false);
      setNewGenreName("");
      setGenreNote(res.existed ? `이미 있는 장르 "${res.genre.name}"를 골랐어요.` : null);
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const runMusicBrainz = useCallback((q: string) => {
    if (mbQueryRef.current === q) return;
    mbQueryRef.current = q;
    setMbLoading(true);
    searchMusicBrainz(q)
      .then((list) => {
        if (mbQueryRef.current === q) setMbResults(list);
      })
      .finally(() => setMbLoading(false));
  }, []);

  function changeQuery(value: string) {
    setQuery(value);
    setArtist(null);
    setMbResults(null);
    mbQueryRef.current = null;
    const long = value.trim().length >= 2;
    setSearching(long);
    if (!long) setResults(null);
  }

  // 입력이 멈추고 0.4초 뒤에 검색 — Apple 호출 제한(분당 약 20회)을 넘지 않게.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchItunes(q, controller.signal)
        .then((r) => {
          setResults(r);
          setSearching(false);
          // "Daniel Caesar Freudian"처럼 아티스트+앨범명을 섞어 쓰면 Apple은 아티스트만 찾고 앨범은
          // 0건이다 — 이때는 이런 검색어를 잘 찾는 MusicBrainz로 한 번 더.
          if (r.albums.length === 0) runMusicBrainz(q);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setResults({ artists: [], albums: [] });
          setSearching(false);
          runMusicBrainz(q);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, runMusicBrainz]);

  function openArtist(a: ItunesArtist) {
    setArtistAlbums(null);
    setArtist(a);
  }

  useEffect(() => {
    if (!artist) return;
    const controller = new AbortController();
    itunesArtistAlbums(artist.id, controller.signal)
      .then(setArtistAlbums)
      .catch(() => {});
    return () => controller.abort();
  }, [artist]);

  const existingFor = (c: AlbumCandidate) => albums.find((a) => a.source === c.source && a.source_id === c.sourceId);
  const existing = picked ? existingFor(picked) : undefined;
  const alreadyMine = !!existing?.recs.some((r) => r.user_id === currentUserId);
  const targetGenre = existing ? existing.genre : genre;
  const usedInGenre = targetGenre ? (myCountByGenre.get(targetGenre) ?? 0) : 0;
  const atLimit = usedInGenre >= ALBUM_GENRE_LIMIT;
  const needsReason = !existing;
  const canSubmit =
    !!picked && !!targetGenre && !alreadyMine && !atLimit && (!needsReason || reason.trim().length > 0) && !pending;

  function pick(c: AlbumCandidate) {
    setPicked(c);
    setError(null);
    setReason("");
  }

  function submit() {
    if (!picked || !targetGenre || !canSubmit) return;
    setError(null);
    startTransition(async () => {
      const res = await recommendAlbum({
        source: picked.source,
        sourceId: picked.sourceId,
        genre: targetGenre,
        reason,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone(targetGenre);
    });
  }

  function candidateRow(c: AlbumCandidate) {
    const ex = existingFor(c);
    return (
      <li key={`${c.source}:${c.sourceId}`}>
        <button
          type="button"
          onClick={() => pick(c)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <AlbumCover url={c.artworkUrl} px={48} className="h-12 w-12 rounded-md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{c.title}</span>
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
              {c.artist}
              {c.year ? ` · ${c.year}` : ""}
            </span>
          </span>
          {ex && (
            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
              추천 {ex.rec_count}
            </span>
          )}
        </button>
      </li>
    );
  }

  const q = query.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="앨범 추천하기"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] dark:bg-[#2c2c2e] md:max-h-[80vh] md:max-w-lg md:rounded-2xl md:pb-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          {picked ? (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <BackArrowIcon className="h-4 w-4" />
              다시 고르기
            </button>
          ) : (
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">앨범 추천하기</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {picked ? (
          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <AlbumCover url={picked.artworkUrl} px={80} className="h-20 w-20 rounded-lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{picked.title}</p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {picked.artist}
                  {picked.year ? ` · ${picked.year}` : ""}
                </p>
              </div>
            </div>

            {existing ? (
              <p className="rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-800 dark:bg-violet-500/10 dark:text-violet-200">
                이미 <b>{genreBySlug.get(existing.genre)?.name ?? existing.genre}</b>에서 {existing.rec_count}명이 추천한
                앨범이에요.{alreadyMine ? " 나도 이미 추천했어요." : " 추천에 한 표 보태주세요."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">어떤 장르의 명반인가요?</p>
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
                  {groups.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => {
                        setGrp(g.key);
                        setGenre(null);
                        setNewGenreOpen(false);
                        setGenreNote(null);
                      }}
                      className={chipClass(grp === g.key)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
                {grp && (
                  <div className="flex flex-wrap gap-1.5">
                    {allGenres
                      .filter((g) => g.grp === grp)
                      .map((g) => {
                        const full = (myCountByGenre.get(g.slug) ?? 0) >= ALBUM_GENRE_LIMIT;
                        return (
                          <button
                            key={g.slug}
                            type="button"
                            disabled={full}
                            onClick={() => setGenre(g.slug)}
                            title={full ? `이 장르는 ${ALBUM_GENRE_LIMIT}장을 다 추천했어요` : undefined}
                            className={chipClass(genre === g.slug, full)}
                          >
                            {g.name}
                          </button>
                        );
                      })}
                    {!newGenreOpen && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewGenreOpen(true);
                          setGenreNote(null);
                        }}
                        className="flex shrink-0 items-center gap-0.5 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-gray-500 hover:text-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <PlusIcon className="h-3 w-3" />
                        장르 추가
                      </button>
                    )}
                  </div>
                )}
                {grp && newGenreOpen && (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newGenreName}
                      onChange={(e) => setNewGenreName(e.target.value.slice(0, 30))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitNewGenre();
                        }
                      }}
                      placeholder={`${groups.find((g) => g.key === grp)?.name ?? ""}에 추가할 세부 장르 (예: Baltimore Club)`}
                      className={`${inputClass} min-w-0 flex-1 !py-2`}
                    />
                    <button
                      type="button"
                      onClick={submitNewGenre}
                      disabled={addingGenre || newGenreName.trim().length < 2}
                      className="shrink-0 rounded-full bg-violet-600 px-3.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
                    >
                      {addingGenre ? "추가 중…" : "추가"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewGenreOpen(false)}
                      className="shrink-0 px-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                      취소
                    </button>
                  </div>
                )}
                {genreNote && <p className="text-xs text-gray-500 dark:text-gray-400">{genreNote}</p>}
              </div>
            )}

            {targetGenre && !alreadyMine && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {genreBySlug.get(targetGenre)?.name}에 내 추천 {usedInGenre}/{ALBUM_GENRE_LIMIT}
                {atLimit && " — 다 채웠어요. 차트에서 기존 추천을 취소하면 새로 추천할 수 있어요."}
              </p>
            )}

            {!alreadyMine && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {needsReason ? "왜 명반인가요? (한 줄, 필수)" : "한 줄 이유 (선택)"}
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, ALBUM_REASON_MAX))}
                  rows={2}
                  placeholder="예: 얼터너티브 R&B 보컬 레이어링의 교과서"
                  className={`${inputClass} resize-none`}
                />
                <span className="self-end text-[11px] tabular-nums text-gray-400">
                  {reason.length}/{ALBUM_REASON_MAX}
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-600"
            >
              {pending ? "추천하는 중…" : existing ? "나도 추천하기" : "추천하기"}
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-4 pt-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => changeQuery(e.target.value)}
                  placeholder="아티스트나 앨범 이름 (예: Daniel Caesar, 검정치마)"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>

            <div className="min-h-[200px] flex-1 overflow-y-auto px-2 py-2">
              {artist ? (
                <>
                  <button
                    type="button"
                    onClick={() => setArtist(null)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    <BackArrowIcon className="h-3.5 w-3.5" />
                    {artist.name}의 앨범
                  </button>
                  {artistAlbums === null ? (
                    <p className="px-2 py-6 text-center text-sm text-gray-400">앨범 목록을 불러오는 중…</p>
                  ) : artistAlbums.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-gray-400">앨범을 찾지 못했어요.</p>
                  ) : (
                    <ul>
                      {artistAlbums.map(candidateRow)}
                    </ul>
                  )}
                </>
              ) : q.length < 2 ? (
                <p className="px-2 py-8 text-center text-sm text-gray-400">
                  아티스트를 고르면 앨범 목록이 커버와 함께 나와요.
                </p>
              ) : (
                <>
                  {searching && !results && <p className="px-2 py-6 text-center text-sm text-gray-400">찾는 중…</p>}
                  {results && results.artists.length > 0 && (
                    <div className="mb-1">
                      <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">아티스트</p>
                      <ul>
                        {results.artists.map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => openArtist(a)}
                              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
                                <UserIcon className="h-5 w-5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{a.name}</span>
                                {a.genre && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{a.genre}</span>}
                              </span>
                              <span className="shrink-0 text-xs text-gray-400">앨범 보기</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {results && results.albums.length > 0 && (
                    <div>
                      <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">앨범</p>
                      <ul>
                        {results.albums.map(candidateRow)}
                      </ul>
                    </div>
                  )}
                  {mbResults && mbResults.length > 0 && (
                    <div>
                      <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        MusicBrainz 검색 결과
                      </p>
                      <ul>
                        {mbResults.map(candidateRow)}
                      </ul>
                    </div>
                  )}
                  {results && !searching && (
                    <div className="px-2 py-4 text-center">
                      {mbLoading ? (
                        <p className="text-sm text-gray-400">다른 음반 DB에서 찾는 중…</p>
                      ) : mbResults === null ? (
                        <button
                          type="button"
                          onClick={() => runMusicBrainz(q)}
                          className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-300"
                        >
                          찾는 앨범이 없나요? 다른 음반 DB에서 찾기
                        </button>
                      ) : (
                        results.albums.length === 0 &&
                        results.artists.length === 0 &&
                        mbResults.length === 0 && (
                          <p className="text-sm text-gray-400">
                            검색 결과가 없어요. 아티스트 이름만 넣거나 영문 표기로도 찾아보세요.
                          </p>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
