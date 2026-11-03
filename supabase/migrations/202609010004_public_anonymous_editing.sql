-- Public-edit mode: visitors receive a browser-scoped anonymous Supabase user.
-- The UI has no login form, but writes remain attributable and originals stay immutable.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_member boolean;
  company_member boolean;
  anonymous_member boolean;
begin
  select not exists(select 1 from public.profiles) into first_member;
  company_member := lower(coalesce(new.email, '')) like '%@korailretail.com';
  anonymous_member := coalesce(new.is_anonymous, false) or coalesce(new.email, '') = '';
  insert into public.profiles(id, email, display_name, role, membership_state)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      case when anonymous_member then '공개 작업자 ' || upper(left(replace(new.id::text, '-', ''), 6))
           else split_part(coalesce(new.email, ''), '@', 1) end
    ), 80),
    case when anonymous_member then 'editor'
         when first_member then 'admin'
         when company_member then 'editor'
         else 'viewer' end,
    case when anonymous_member or first_member or company_member then 'active' else 'pending' end
  );
  return new;
end;
$$;

create or replace function public.claim_catalog_work(p_image_sha256 text)
returns public.catalog_work_items
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.catalog_work_items;
begin
  if not public.is_active_member() then raise exception '공개 편집 세션이 필요합니다.'; end if;
  update public.catalog_work_items
  set assignee_id = auth.uid(),
      status = case when assignee_id = auth.uid() and status in ('in_progress', 'review') then status else 'in_progress' end,
      updated_by = auth.uid()
  where image_sha256 = p_image_sha256
  returning * into result;
  if result.image_sha256 is null then raise exception '작업 항목을 찾지 못했습니다.'; end if;
  return result;
end;
$$;

create or replace function public.review_replacement(p_version_id uuid, p_decision text, p_note text default '')
returns public.replacement_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.replacement_versions;
begin
  if not public.is_active_member() then raise exception '공개 편집 세션이 필요합니다.'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception '승인 또는 반려만 가능합니다.'; end if;
  update public.replacement_versions
  set review_status = p_decision, reviewed_by = auth.uid(), review_note = left(coalesce(p_note, ''), 600), reviewed_at = now()
  where id = p_version_id
  returning * into result;
  if result.id is null then raise exception '교체 버전을 찾지 못했습니다.'; end if;
  update public.catalog_work_items
  set status = case when p_decision = 'approved' then 'approved' else 'in_progress' end, updated_by = auth.uid()
  where image_sha256 = result.image_sha256;
  return result;
end;
$$;
