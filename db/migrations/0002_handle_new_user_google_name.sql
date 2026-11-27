-- 0002: Google OAuth 가입 시 profiles.display_name 채우기
-- 현재 원격(Nuvori) 트리거 handle_new_user()는 raw_user_meta_data->>'display_name'만 읽는다.
-- Google 로그인은 'full_name' / 'name'으로 이름을 넘기므로 display_name이 NULL로 남는다.
-- 상태: 미적용 (대시보드 SQL Editor 또는 supabase db push로 적용 필요)
-- 적용 전까지는 web이 로그인 직후 본인 프로필의 빈 display_name을 채운다 (profiles_update_own 정책 범위).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  );
  return new;
end;
$function$;
