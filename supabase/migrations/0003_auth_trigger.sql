-- 회원가입(AUTH-01) 시 auth.users에 생성된 계정을 public.users에도 자동 생성.
-- signUp 호출 시 options.data.name으로 전달된 값을 사용.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
