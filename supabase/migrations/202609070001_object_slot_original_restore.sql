-- Keep approved replacement history while allowing one slot to return to its VWorld original.

alter table public.object_slot_replacement_versions
  add column if not exists is_active boolean not null default false,
  add column if not exists deactivated_by uuid references public.profiles(id) on delete set null,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_note text not null default '';

update public.object_slot_replacement_versions
set is_active = false
where is_active is distinct from false;

with latest_approved as (
  select distinct on (slot_key) id
  from public.object_slot_replacement_versions
  where review_status = 'approved'
  order by slot_key, created_at desc, id desc
)
update public.object_slot_replacement_versions as version
set is_active = true
from latest_approved
where version.id = latest_approved.id;

create unique index if not exists object_slot_replacements_one_active_idx
  on public.object_slot_replacement_versions (slot_key)
  where is_active;

create or replace function public.review_object_slot_replacement(p_version_id uuid, p_decision text, p_note text default '')
returns public.object_slot_replacement_versions language plpgsql security definer set search_path = public as $$
declare
  result public.object_slot_replacement_versions;
  active_approved_exists boolean;
begin
  if not public.is_active_member() then raise exception '공개 편집 세션이 필요합니다.'; end if;
  if p_decision not in ('approved','rejected') then raise exception '승인 또는 반려만 가능합니다.'; end if;

  select * into result
  from public.object_slot_replacement_versions
  where id = p_version_id
  for update;
  if result.id is null then raise exception '교체 버전을 찾지 못했습니다.'; end if;
  if result.review_status <> 'submitted' then raise exception '이미 검수가 끝난 교체 버전입니다.'; end if;

  if p_decision = 'approved' then
    update public.object_slot_replacement_versions
    set is_active = false,
        deactivated_by = auth.uid(),
        deactivated_at = now(),
        deactivation_note = '새 승인본으로 교체'
    where slot_key = result.slot_key and is_active and id <> p_version_id;
  end if;

  update public.object_slot_replacement_versions
  set review_status = p_decision,
      is_active = (p_decision = 'approved'),
      reviewed_by = auth.uid(),
      review_note = left(coalesce(p_note,''),600),
      reviewed_at = now(),
      deactivated_by = null,
      deactivated_at = null,
      deactivation_note = ''
  where id = p_version_id
  returning * into result;

  select exists (
    select 1 from public.object_slot_replacement_versions
    where slot_key = result.slot_key and is_active
  ) into active_approved_exists;

  update public.object_slot_work_items
  set status = case
        when p_decision = 'approved' or active_approved_exists then 'approved'
        else 'in_progress'
      end,
      updated_by = auth.uid()
  where slot_key = result.slot_key;
  return result;
end;
$$;

create or replace function public.restore_object_slot_original(p_slot_key text, p_note text default '')
returns public.object_slot_work_items language plpgsql security definer set search_path = public as $$
declare
  result public.object_slot_work_items;
  changed_count integer;
  submitted_exists boolean;
begin
  if not public.is_active_member() then raise exception '공개 편집 세션이 필요합니다.'; end if;

  perform 1 from public.object_texture_slots where slot_key = p_slot_key and is_active;
  if not found then raise exception '이미지 슬롯을 찾지 못했습니다.'; end if;

  update public.object_slot_replacement_versions
  set is_active = false,
      deactivated_by = auth.uid(),
      deactivated_at = now(),
      deactivation_note = left(coalesce(nullif(trim(p_note),''),'사용자 요청으로 원본 복원'),600)
  where slot_key = p_slot_key and is_active;
  get diagnostics changed_count = row_count;
  if changed_count = 0 then raise exception '현재 적용 중인 승인본이 없습니다.'; end if;

  select exists (
    select 1 from public.object_slot_replacement_versions
    where slot_key = p_slot_key and review_status = 'submitted'
  ) into submitted_exists;

  update public.object_slot_work_items
  set status = case when submitted_exists then 'review' else 'in_progress' end,
      assignee_id = coalesce(assignee_id, auth.uid()),
      note = left(coalesce(nullif(trim(p_note),''),'사용자 요청으로 원본 복원'),600),
      updated_by = auth.uid()
  where slot_key = p_slot_key
  returning * into result;
  if result.slot_key is null then raise exception '이미지 슬롯 작업 정보를 찾지 못했습니다.'; end if;
  return result;
end;
$$;

grant execute on function public.review_object_slot_replacement(uuid,text,text) to authenticated;
grant execute on function public.restore_object_slot_original(text,text) to authenticated;
