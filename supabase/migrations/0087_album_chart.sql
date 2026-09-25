-- 명반 차트(2026-09-25, 사용자 요청) — Lab(옛 memo 탭) 실험 기능 1호. 회원들이 장르별로 명반을
-- 추천하고 추천 수로 순위를 매긴다. 전문 음악인이라도 잘 모르는 장르의 명반을 서로 알려주는 게 취지.
-- 규칙(사용자 확정):
--   - 장르는 세분화(Jersey Club, UK Garage 등) — 상위 분류(grp) 아래 세부 장르(slug)
--   - 한 사람당 세부 장르마다 최대 5장까지 추천(취소하면 그 자리가 다시 생김)
--   - 2명 이상 추천하면 차트 진입, 1명이면 "후보". 순위 계산은 화면에서 한다(albumChart.ts —
--     추천 수 내림차순, 동점이면 그 수에 먼저 도달한 앨범이 위)
--   - 10명이 추천하면 "명반 인증"(albums.certified_at) — PEAK처럼 영구, 나중에 추천이 줄어도 유지
--   - 앨범의 장르는 처음 추천한 사람이 정하고, 그 사람은 한 줄 이유 필수(뒤따르는 추천은 선택)
--   - 비로그인 방문자도 차트는 볼 수 있다. 추천한 사람은 닉네임만(DEMO와 같은 공개 범위)
-- 앨범 정보는 Apple(iTunes)·MusicBrainz에서 서버가 다시 조회해서 넣는다(feed/lab/albumActions.ts) —
-- 클라이언트가 보낸 제목·커버를 그대로 믿지 않으려고 albums에는 INSERT 정책을 안 두고 service role만 쓴다.
-- 숫자(5장·2명·10명)를 바꾸면 src/lib/albumChart.ts의 상수도 같이 바꿀 것.

create table album_genres (
  slug       text primary key,
  name       text not null,
  grp        text not null,
  grp_name   text not null,
  sort_order integer not null,
  active     boolean not null default true
);

create table albums (
  id           uuid primary key default gen_random_uuid(),
  source       text not null check (source in ('itunes', 'musicbrainz')),
  source_id    text not null,
  title        text not null,
  artist       text not null,
  artwork_url  text,
  release_year integer,
  source_url   text,
  genre        text not null references album_genres(slug),
  added_by     uuid references users(id) on delete set null,
  certified_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (source, source_id)
);

create table album_recs (
  album_id   uuid not null references albums(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  reason     text check (reason is null or char_length(reason) <= 100),
  created_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

create index idx_album_recs_user on album_recs (user_id);

alter table album_genres enable row level security;
alter table albums enable row level security;
alter table album_recs enable row level security;

-- 차트는 비로그인 방문자에게도 공개.
create policy "album_genres_select_all" on album_genres for select using (true);
create policy "albums_select_all" on albums for select using (true);
create policy "album_recs_select_all" on album_recs for select using (true);
-- 쓰기는 recommend_album(security definer)만. 취소는 본인 것만 직접 DELETE.
create policy "album_recs_delete_own" on album_recs for delete using (user_id = auth.uid());

-- 추천하기 — 유일한 INSERT 경로. 실패 사유는 예외 메시지(코드 문자열)로 돌려주고
-- albumActions.ts가 화면 문구로 바꾼다. 돌려주는 값은 추천 후 그 앨범의 추천 수.
create or replace function public.recommend_album(p_album_id uuid, p_genre text, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_genre text;
  v_count integer;
begin
  if v_uid is null or not is_approved(v_uid) then
    raise exception 'not_allowed';
  end if;
  if v_reason is not null and char_length(v_reason) > 100 then
    raise exception 'reason_too_long';
  end if;

  -- 두 사람이 동시에 "첫 추천"을 해서 장르가 엇갈리지 않도록 앨범 행을 잠근다.
  select genre into v_genre from albums where id = p_album_id for update;
  if v_genre is null then
    raise exception 'album_not_found';
  end if;
  if exists (select 1 from album_recs where album_id = p_album_id and user_id = v_uid) then
    raise exception 'already_recommended';
  end if;

  select count(*) into v_count from album_recs where album_id = p_album_id;
  -- 첫 추천(또는 모두 취소돼 0명이 된 앨범을 다시 올리는 경우) — 장르를 이 사람이 정하고 이유 필수.
  if v_count = 0 then
    if v_reason is null then
      raise exception 'reason_required';
    end if;
    if not exists (select 1 from album_genres where slug = p_genre and active) then
      raise exception 'bad_genre';
    end if;
    v_genre := p_genre;
    update albums set genre = v_genre where id = p_album_id;
  end if;

  if (
    select count(*) from album_recs r join albums a on a.id = r.album_id
    where r.user_id = v_uid and a.genre = v_genre
  ) >= 5 then
    raise exception 'genre_limit';
  end if;

  begin
    insert into album_recs (album_id, user_id, reason) values (p_album_id, v_uid, v_reason);
  exception when unique_violation then
    raise exception 'already_recommended';
  end;
  v_count := v_count + 1;

  if v_count >= 10 then
    update albums set certified_at = now() where id = p_album_id and certified_at is null;
  end if;

  return v_count;
end;
$$;

revoke all on function public.recommend_album(uuid, text, text) from public;
revoke execute on function public.recommend_album(uuid, text, text) from anon;
grant execute on function public.recommend_album(uuid, text, text) to authenticated;

-- 차트 화면용 — 추천이 1개 이상인 앨범 전부와 추천한 사람(닉네임만)·이유. 파일럿 규모라
-- 장르 필터는 화면에서 한다(칩을 눌러도 서버 왕복 없이 바로 바뀌게).
create or replace function public.album_chart()
returns table (
  id uuid,
  source text,
  source_id text,
  title text,
  artist text,
  artwork_url text,
  release_year integer,
  source_url text,
  genre text,
  certified_at timestamptz,
  rec_count integer,
  reached_at timestamptz,
  recs jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id, a.source, a.source_id, a.title, a.artist, a.artwork_url, a.release_year, a.source_url,
    a.genre, a.certified_at,
    count(*)::integer,
    max(r.created_at),
    jsonb_agg(
      jsonb_build_object(
        'user_id', r.user_id,
        'nickname', coalesce(u.nickname, '회원'),
        'reason', r.reason,
        'created_at', r.created_at
      ) order by r.created_at
    )
  from albums a
  join album_recs r on r.album_id = a.id
  join users u on u.id = r.user_id
  group by a.id;
$$;

grant execute on function public.album_chart() to anon, authenticated;

-- 장르 목록. 추가·수정은 여기 INSERT 한 줄(배포 없이 DB에만 넣어도 바로 보임). 표기는 음악인들이
-- 실제로 부르는 이름 그대로(영문 서브장르는 영문, 한국 쪽은 한글).
insert into album_genres (slug, name, grp, grp_name, sort_order) values
  ('contemporary-rnb',   'Contemporary R&B',     'rnb',        'R&B·소울',          101),
  ('alternative-rnb',    'Alternative R&B',      'rnb',        'R&B·소울',          102),
  ('neo-soul',           'Neo Soul',             'rnb',        'R&B·소울',          103),
  ('classic-soul',       'Classic Soul',         'rnb',        'R&B·소울',          104),
  ('funk',               'Funk',                 'rnb',        'R&B·소울',          105),
  ('gospel',             'Gospel',               'rnb',        'R&B·소울',          106),
  ('k-rnb',              '한국 R&B',             'rnb',        'R&B·소울',          107),

  ('boom-bap',           'Boom Bap',             'hiphop',     '힙합',              201),
  ('jazz-rap',           'Jazz Rap',             'hiphop',     '힙합',              202),
  ('alternative-hiphop', 'Alternative Hip-hop',  'hiphop',     '힙합',              203),
  ('trap',               'Trap',                 'hiphop',     '힙합',              204),
  ('drill',              'Drill',                'hiphop',     '힙합',              205),
  ('k-hiphop',           '한국 힙합',            'hiphop',     '힙합',              206),

  ('house',              'House',                'electronic', '일렉트로닉·클럽',   301),
  ('deep-house',         'Deep House',           'electronic', '일렉트로닉·클럽',   302),
  ('techno',             'Techno',               'electronic', '일렉트로닉·클럽',   303),
  ('uk-garage',          'UK Garage',            'electronic', '일렉트로닉·클럽',   304),
  ('jersey-club',        'Jersey Club',          'electronic', '일렉트로닉·클럽',   305),
  ('drum-and-bass',      'Drum & Bass',          'electronic', '일렉트로닉·클럽',   306),
  ('jungle',             'Jungle',               'electronic', '일렉트로닉·클럽',   307),
  ('dubstep',            'Dubstep',              'electronic', '일렉트로닉·클럽',   308),
  ('footwork',           'Footwork',             'electronic', '일렉트로닉·클럽',   309),
  ('breakbeat',          'Breakbeat',            'electronic', '일렉트로닉·클럽',   310),
  ('amapiano',           'Amapiano',             'electronic', '일렉트로닉·클럽',   311),
  ('disco',              'Disco·Nu-Disco',       'electronic', '일렉트로닉·클럽',   312),
  ('trance',             'Trance',               'electronic', '일렉트로닉·클럽',   313),
  ('ambient',            'Ambient',              'electronic', '일렉트로닉·클럽',   314),
  ('idm',                'IDM',                  'electronic', '일렉트로닉·클럽',   315),

  ('bebop',              'Bebop',                'jazz',       '재즈',              401),
  ('hard-bop',           'Hard Bop',             'jazz',       '재즈',              402),
  ('cool-jazz',          'Cool Jazz',            'jazz',       '재즈',              403),
  ('modal-jazz',         'Modal Jazz',           'jazz',       '재즈',              404),
  ('free-jazz',          'Free Jazz',            'jazz',       '재즈',              405),
  ('jazz-fusion',        'Jazz Fusion',          'jazz',       '재즈',              406),
  ('vocal-jazz',         'Vocal Jazz',           'jazz',       '재즈',              407),
  ('contemporary-jazz',  'Contemporary Jazz',    'jazz',       '재즈',              408),

  ('classic-rock',       'Classic Rock',         'rock',       '록·인디',           501),
  ('alternative-rock',   'Alternative Rock',     'rock',       '록·인디',           502),
  ('indie-rock',         'Indie Rock',           'rock',       '록·인디',           503),
  ('psychedelic-rock',   'Psychedelic Rock',     'rock',       '록·인디',           504),
  ('shoegaze',           'Shoegaze',             'rock',       '록·인디',           505),
  ('dream-pop',          'Dream Pop',            'rock',       '록·인디',           506),
  ('post-rock',          'Post-rock',            'rock',       '록·인디',           507),
  ('math-rock',          'Math Rock',            'rock',       '록·인디',           508),
  ('punk',               'Punk',                 'rock',       '록·인디',           509),
  ('metal',              'Metal',                'rock',       '록·인디',           510),

  ('pop',                'Pop',                  'pop',        '팝',                601),
  ('synth-pop',          'Synth-pop',            'pop',        '팝',                602),
  ('indie-pop',          'Indie Pop',            'pop',        '팝',                603),
  ('bedroom-pop',        'Bedroom Pop',          'pop',        '팝',                604),
  ('hyperpop',           'Hyperpop',             'pop',        '팝',                605),
  ('city-pop',           'City Pop',             'pop',        '팝',                606),
  ('j-pop',              'J-pop',                'pop',        '팝',                607),

  ('k-pop',              'K-pop',                'korean',     '가요',              701),
  ('ballad',             '발라드',               'korean',     '가요',              702),
  ('gayo-classic',       '8090 가요',            'korean',     '가요',              703),
  ('korean-indie',       '한국 인디',            'korean',     '가요',              704),
  ('trot',               '트로트',               'korean',     '가요',              705),
  ('gugak',              '국악·퓨전국악',        'korean',     '가요',              706),

  ('folk',               'Folk',                 'folk',       '포크·블루스·컨트리', 801),
  ('singer-songwriter',  'Singer-songwriter',    'folk',       '포크·블루스·컨트리', 802),
  ('blues',              'Blues',                'folk',       '포크·블루스·컨트리', 803),
  ('country',            'Country',              'folk',       '포크·블루스·컨트리', 804),

  ('bossa-nova',         'Bossa Nova·MPB',       'world',      '월드·라틴',         901),
  ('latin',              'Latin',                'world',      '월드·라틴',         902),
  ('reggae',             'Reggae',               'world',      '월드·라틴',         903),
  ('afrobeats',          'Afrobeats',            'world',      '월드·라틴',         904),

  ('baroque',            '바로크',               'classical',  '클래식·스코어',     1001),
  ('classical-romantic', '고전·낭만',            'classical',  '클래식·스코어',     1002),
  ('modern-classical',   '현대음악·미니멀리즘',  'classical',  '클래식·스코어',     1003),
  ('film-score',         '영화음악',             'classical',  '클래식·스코어',     1004),
  ('game-music',         '게임음악',             'classical',  '클래식·스코어',     1005),
  ('musical',            '뮤지컬',               'classical',  '클래식·스코어',     1006);
