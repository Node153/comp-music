-- 로그인 전 미리보기(Instagram 참고) — DEMO(전체공개) 게시물은 비로그인 방문자에게도
-- 보여주고, memo(Companion 전용)는 완전히 잠근다.
--
-- 기존 posts_select_approved_users 정책은 건드리지 않는다(다른 화면 전부가 거기 의존).
-- Postgres RLS는 같은 커맨드의 permissive 정책을 OR로 합치므로, "public + published/expired"
-- 로 딱 한정한 정책을 추가로 얹기만 해도 기존 로그인 사용자 경험엔 아무 영향이 없다.
create policy "posts_select_public_anyone"
  on posts for select
  using (visibility = 'public' and status in ('published', 'expired'));

-- 공개 게시물의 좋아요/댓글 수를 비로그인 방문자에게도 보여주기 위한 동일 원리의 추가 정책.
create policy "likes_select_public_posts"
  on likes for select
  using (
    exists (
      select 1 from posts p
      where p.id = post_id and p.visibility = 'public' and p.status in ('published', 'expired')
    )
  );

create policy "comments_select_public_posts"
  on comments for select
  using (
    exists (
      select 1 from posts p
      where p.id = post_id and p.visibility = 'public' and p.status in ('published', 'expired')
    )
  );

-- 작성자 이름 — user_display(0018)는 "승인된 뷰어" 전제로 실명/닉네임을 가르는 핵심 뷰라
-- 그대로 두고 건드리지 않는다. 비로그인 전용으로 훨씬 좁은 뷰를 따로 만든다:
-- 비로그인 방문자는 누구의 Companion도 될 수 없으므로 무조건 닉네임만 내려주고,
-- "지금 공개 게시물이 있는 사용자"로 범위를 제한해 전체 유저 닉네임 디렉터리가
-- 통째로 새는 걸 막는다(email/실명 등 다른 컬럼은 애초에 select 목록에 없음).
create view public_post_authors as
select u.id, u.nickname as display_name
from users u
where u.status = 'approved'
  and exists (
    select 1 from posts p
    where p.user_id = u.id and p.visibility = 'public' and p.status in ('published', 'expired')
  );
