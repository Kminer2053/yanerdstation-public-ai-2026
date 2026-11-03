-- Shared per-photo work scope used by the public object texture workbench.
-- The flag lives on the existing one-row-per-slot collaboration record so it
-- follows the stable slot_key and participates in the current realtime stream.

alter table public.object_slot_work_items
  add column if not exists is_management_target boolean not null default false;

create index if not exists object_slot_work_items_management_target_idx
  on public.object_slot_work_items (is_management_target, updated_at desc)
  where is_management_target;

create or replace function public.set_object_slot_management_target(p_slot_key text, p_is_target boolean)
returns public.object_slot_work_items
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.object_slot_work_items;
begin
  if not public.is_active_member() then
    raise exception '공개 편집 세션이 필요합니다.';
  end if;

  update public.object_slot_work_items
  set is_management_target = coalesce(p_is_target, false),
      updated_by = auth.uid()
  where slot_key = p_slot_key
  returning * into result;

  if result.slot_key is null then
    raise exception '이미지 슬롯을 찾지 못했습니다.';
  end if;

  return result;
end;
$$;

grant execute on function public.set_object_slot_management_target(text, boolean) to authenticated;
