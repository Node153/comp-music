-- memo 기능을 DEMO에 통합(2026-09-25, 사용자 요청) + 명반 차트 장르 추가.
--
-- 1) feed_candidates에 'all' 범위 추가 — DEMO 피드 하나에 전체공개 글과, 보는 사람이 볼 수 있는
--    Companion 공개(followers)·특정인 공개(invite_only) 글을 함께 싣는다. 비공개 글 범위는 옛 memo
--    피드와 같다(본인 글 + Companion의 글) + 초대받은 글(Companion이 아니어도 초대받았으면).
--    invite_only는 초대 안 받은 Companion에게도 행은 보이고 미디어는 노크 화면으로 잠긴다(feedRender.tsx
--    canViewMediaFor) — 옛 memo 피드와 동일.
--    기존 'demo'·'memo' 범위는 그대로 둔다: 이 마이그레이션이 코드 배포보다 먼저 운영에 들어가도
--    옛 화면(글마다가 아니라 탭 단위로 잠금을 판단)에 비공개 글이 섞여 들어가지 않게 하려는 것.
-- 2) 명반 차트 장르를 회원이 직접 추가(add_album_genre) — 비슷한 이름(대소문자·공백·기호 무시)이
--    이미 있으면 새로 만들지 않고 그 장르를 돌려준다. 한 사람당 하루 3개까지.

create or replace function public.feed_candidates(
  p_scope text,
  p_tag text default null,
  p_played boolean default false,
  p_before_ts timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20,
  p_ids uuid[] default null
)
returns setof posts
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from posts p
  where p.status = 'published'
    and p.published_at is not null
    and (p.expires_at is null or p.expires_at > now())
    and (
      (p_scope = 'demo' and p.visibility = 'public')
      or (
        p_scope = 'memo'
        and p.visibility <> 'public'
        and auth.uid() is not null
        and (p.user_id = auth.uid() or are_companions(p.user_id, auth.uid()))
      )
      or (
        p_scope = 'all'
        and (
          p.visibility = 'public'
          or (
            auth.uid() is not null
            and (
              p.user_id = auth.uid()
              or are_companions(p.user_id, auth.uid())
              or exists (
                select 1 from post_access pa
                where pa.post_id = p.id and pa.user_id = auth.uid() and pa.status in ('invited', 'accepted')
              )
            )
          )
        )
      )
    )
    and (p_tag is null or p.instrument_tags @> array[p_tag])
    and (
      p_ids is not null
      or (
        (
          auth.uid() is null and not p_played
          or auth.uid() is not null and exists (
            select 1 from post_plays pp where pp.post_id = p.id and pp.user_id = auth.uid()
          ) = p_played
        )
        and (p_before_ts is null or (p.published_at, p.id) < (p_before_ts, p_before_id))
      )
    )
    and (p_ids is null or p.id = any(p_ids))
  order by p.published_at desc, p.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

alter table album_genres add column created_by uuid references users(id) on delete set null;
alter table album_genres add column created_at timestamptz not null default now();

create or replace function public.add_album_genre(p_grp text, p_name text)
returns table (slug text, name text, grp text, grp_name text, sort_order integer, existed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_key text := lower(regexp_replace(coalesce(p_name, ''), '[^[:alnum:]]', '', 'g'));
  v_grp_name text;
  v_existing album_genres%rowtype;
  v_slug text;
  v_order integer;
begin
  if v_uid is null or not is_approved(v_uid) then
    raise exception 'not_allowed';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 30 or v_key = '' then
    raise exception 'bad_name';
  end if;

  select g.grp_name into v_grp_name from album_genres g where g.grp = p_grp limit 1;
  if v_grp_name is null then
    raise exception 'bad_group';
  end if;

  -- 같은 이름(대소문자·공백·기호 무시)이 어느 분류에든 이미 있으면 그걸 쓴다 — "UK Garage"와
  -- "uk-garage", "UKGarage"가 따로 생기지 않게.
  select * into v_existing from album_genres g
  where g.active and lower(regexp_replace(g.name, '[^[:alnum:]]', '', 'g')) = v_key
  limit 1;
  if found then
    return query select v_existing.slug, v_existing.name, v_existing.grp, v_existing.grp_name, v_existing.sort_order, true;
    return;
  end if;

  if (select count(*) from album_genres g where g.created_by = v_uid and g.created_at > now() - interval '1 day') >= 3 then
    raise exception 'daily_limit';
  end if;

  v_slug := 'u-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  select coalesce(max(g.sort_order), 0) + 1 into v_order from album_genres g where g.grp = p_grp;

  insert into album_genres (slug, name, grp, grp_name, sort_order, created_by)
  values (v_slug, v_name, p_grp, v_grp_name, v_order, v_uid);

  return query select v_slug, v_name, p_grp, v_grp_name, v_order, false;
end;
$$;

revoke all on function public.add_album_genre(text, text) from public;
revoke execute on function public.add_album_genre(text, text) from anon;
grant execute on function public.add_album_genre(text, text) to authenticated;
