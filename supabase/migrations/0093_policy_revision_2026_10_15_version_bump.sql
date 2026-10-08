-- 약관 4종 개정(2026-10-08 공고, 2026-10-15 시행 — 사용자 요청 "문서와 실제 동작 맞추기").
-- 이용약관·개인정보처리방침·커뮤니티 운영정책·베타 안내의 동의 버전을 2026-10-15로 올린다.
--   terms_of_service / privacy_policy / community_guidelines: 2026-08-29 → 2026-10-15
--   beta_notice: 2026-08-20 → 2026-10-15
-- 소셜 가입 쪽 값은 src/lib/agreements.ts의 AGREEMENT_VERSIONS — 두 곳은 항상 같이 바꿀 것.
--
-- ⚠️ handle_new_user()는 통째로 다시 쓰다 사고 난 적이 있어서(0038 참고) 0092와 같은 방식으로,
-- 실제 DB에 있는 현재 정의에서 버전 문자열만 바꿔 끼운다. 예상한 줄이 하나라도 없으면 아무것도
-- 바꾸지 않고 실패한다. 함수 전체 모습은 0045 + 0092 + 이 네 줄.
do $$
declare
  def text := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  pair text[];
  pairs constant text[][] := array[
    [$q$(new.id, 'terms_of_service', '2026-08-29')$q$,     $q$(new.id, 'terms_of_service', '2026-10-15')$q$],
    [$q$(new.id, 'privacy_policy', '2026-08-29')$q$,       $q$(new.id, 'privacy_policy', '2026-10-15')$q$],
    [$q$(new.id, 'community_guidelines', '2026-08-29')$q$, $q$(new.id, 'community_guidelines', '2026-10-15')$q$],
    [$q$(new.id, 'beta_notice', '2026-08-20')$q$,          $q$(new.id, 'beta_notice', '2026-10-15')$q$]
  ];
begin
  foreach pair slice 1 in array pairs loop
    if position(pair[2] in def) > 0 then
      continue; -- 이미 적용됨
    end if;
    if position(pair[1] in def) = 0 then
      raise exception 'handle_new_user(): 예상한 행(%)을 찾지 못해 중단', pair[1];
    end if;
    def := replace(def, pair[1], pair[2]);
  end loop;
  execute def;
end;
$$;
