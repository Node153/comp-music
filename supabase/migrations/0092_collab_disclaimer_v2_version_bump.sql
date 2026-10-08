-- 공동창작 면책 동의(collab_disclaimer) 문구 개정(2026-10-08, 사용자 요청 — 가입 동의 현행화).
-- "memo(비공개 협업 공간)에서 다른 사람과 함께 만든 콘텐츠…"에서 memo 한정 표현을 뺐다 —
-- memo 작업물 기능은 DEMO로 합쳐졌고(0088) memo 탭은 명반 차트(0087)라 더는 맞지 않는 설명.
-- 문구가 바뀐 이 항목만 버전을 올린다(소셜 가입 쪽은 onboarding/page.tsx의
-- COLLAB_DISCLAIMER_VERSION — 두 값은 항상 같이 바꿀 것).
--
-- ⚠️ handle_new_user()는 통째로 다시 쓰다 사고 난 적이 있어서(0038 참고), 이번엔 실제 DB에 있는
-- 현재 정의에서 버전 문자열 한 곳만 바꿔 끼운다. 예상한 줄이 없으면 아무것도 바꾸지 않고 실패한다.
-- 함수 전체 모습은 0045 + 이 한 줄.
do $$
declare
  def text := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  old_row constant text := $q$(new.id, 'collab_disclaimer', '2026-08-10')$q$;
  new_row constant text := $q$(new.id, 'collab_disclaimer', '2026-10-08')$q$;
begin
  if position(new_row in def) > 0 then
    return; -- 이미 적용됨
  end if;
  if position(old_row in def) = 0 then
    raise exception 'handle_new_user(): collab_disclaimer 2026-08-10 행을 찾지 못해 중단';
  end if;
  execute replace(def, old_row, new_row);
end;
$$;
