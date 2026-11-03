create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('admin', 'reviewer', 'editor', 'viewer')),
  membership_state text not null default 'pending' check (membership_state in ('active', 'pending', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_manifests (
  site_id text primary key,
  site_name text not null,
  generated_at timestamptz,
  source_tileset text,
  tile_count integer not null default 0,
  image_occurrence_count integer not null default 0,
  unique_image_count integer not null default 0,
  feature_count integer not null default 0,
  source_observed_at date,
  metadata jsonb not null default '{}'::jsonb
);

create table public.image_occurrences (
  image_id text primary key,
  tile text not null,
  tile_uri text,
  tile_url text,
  tile_depth integer,
  detail_tile boolean not null default false,
  parent_tile text,
  geometric_error double precision,
  image_index integer,
  mime_type text not null,
  width_px integer not null check (width_px > 0),
  height_px integer not null check (height_px > 0),
  byte_length bigint not null default 0,
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  placeholder boolean not null default false,
  replacement_priority text not null default 'REVIEW' check (replacement_priority in ('HIGH', 'MEDIUM', 'REVIEW', 'REFERENCE', 'EXCLUDE')),
  floors text not null default '',
  feature_ids text not null default '',
  model_names text not null default '',
  class_codes text not null default '',
  td_ids text not null default '',
  oids text not null default '',
  coordinate_accuracy text,
  longitude double precision,
  latitude double precision,
  height_m double precision,
  east_m double precision,
  north_m double precision,
  up_m double precision,
  rtc_center_x double precision,
  rtc_center_y double precision,
  rtc_center_z double precision,
  asset_storage_path text not null,
  preview_storage_path text not null,
  preview_error text,
  source_observed_at date,
  current_store_name text not null default '',
  field_verified boolean not null default false,
  duplicate_count integer not null default 0,
  unique_image boolean not null default false,
  ocr_text text not null default '',
  ocr_confidence text not null default '',
  ocr_label_candidate text not null default ''
);

create index image_occurrences_sha_idx on public.image_occurrences(image_sha256);
create index image_occurrences_floor_idx on public.image_occurrences(floors);
create index image_occurrences_priority_idx on public.image_occurrences(replacement_priority);

create table public.feature_placements (
  feature_key text primary key,
  tile text not null,
  feature_id integer,
  floor text not null default '',
  site text not null default '서울역KTX',
  type text,
  td_id text not null default '',
  model_name text not null default '',
  class_code text not null default '',
  oid integer,
  image_ids text not null default '',
  mapping_method text,
  coordinate_accuracy text,
  longitude double precision,
  latitude double precision,
  height_m double precision,
  east_m double precision,
  north_m double precision,
  up_m double precision,
  vertex_count integer
);

create index feature_placements_floor_idx on public.feature_placements(floor);
create index feature_placements_td_idx on public.feature_placements(td_id);

create table public.catalog_work_items (
  image_sha256 text primary key,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'review', 'approved', 'hold')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  current_store_name text not null default '',
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalog_work_items_status_idx on public.catalog_work_items(status);
create index catalog_work_items_assignee_idx on public.catalog_work_items(assignee_id);

create table public.replacement_versions (
  id uuid primary key default gen_random_uuid(),
  image_sha256 text not null,
  image_id text not null,
  storage_path text not null unique,
  file_name text not null,
  original_width_px integer not null,
  original_height_px integer not null,
  replacement_width_px integer not null,
  replacement_height_px integer not null,
  replacement_mime_type text not null check (replacement_mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  replacement_byte_length bigint not null default 0,
  replacement_sha256 text,
  current_store_name text not null default '',
  note text not null default '',
  usage_floor text not null default '',
  usage_model text not null default '',
  usage_td_id text not null default '',
  review_status text not null default 'submitted' check (review_status in ('draft', 'submitted', 'approved', 'rejected')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index replacement_versions_image_idx on public.replacement_versions(image_sha256, created_at desc);
create index replacement_versions_status_idx on public.replacement_versions(review_status);

create table public.catalog_comments (
  id uuid primary key default gen_random_uuid(),
  image_sha256 text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index catalog_comments_image_idx on public.catalog_comments(image_sha256, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger work_items_touch_updated_at before update on public.catalog_work_items
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_member boolean;
  company_member boolean;
begin
  select not exists(select 1 from public.profiles) into first_member;
  company_member := lower(coalesce(new.email, '')) like '%@korailretail.com';
  insert into public.profiles(id, email, display_name, role, membership_state)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)), 80),
    case when first_member then 'admin' when company_member then 'editor' else 'viewer' end,
    case when first_member or company_member then 'active' else 'pending' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and membership_state = 'active'
  );
$$;

create or replace function public.has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and membership_state = 'active' and role = any(p_roles)
  );
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
  if not public.is_active_member() then raise exception '활성 협업자만 작업을 맡을 수 있습니다.'; end if;
  update public.catalog_work_items
  set assignee_id = auth.uid(), status = case when status in ('pending', 'hold') then 'in_progress' else status end, updated_by = auth.uid()
  where image_sha256 = p_image_sha256 and (assignee_id is null or assignee_id = auth.uid())
  returning * into result;
  if result.image_sha256 is null then raise exception '이미 다른 담당자가 맡은 작업입니다.'; end if;
  return result;
end;
$$;

create or replace function public.set_catalog_work_status(p_image_sha256 text, p_status text)
returns public.catalog_work_items
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.catalog_work_items;
begin
  if p_status not in ('pending', 'in_progress', 'review', 'approved', 'hold') then raise exception '지원하지 않는 작업 상태입니다.'; end if;
  if not public.is_active_member() then raise exception '활성 협업자만 상태를 변경할 수 있습니다.'; end if;
  update public.catalog_work_items
  set status = p_status,
      assignee_id = case when p_status = 'pending' then null else coalesce(assignee_id, auth.uid()) end,
      updated_by = auth.uid()
  where image_sha256 = p_image_sha256
    and (assignee_id = auth.uid() or public.has_role(array['admin','reviewer']))
  returning * into result;
  if result.image_sha256 is null then raise exception '담당자 또는 검수자만 상태를 변경할 수 있습니다.'; end if;
  return result;
end;
$$;

create or replace function public.validate_replacement_dimensions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_width integer;
  expected_height integer;
begin
  select width_px, height_px into expected_width, expected_height
  from public.image_occurrences
  where image_sha256 = new.image_sha256 and not placeholder
  order by detail_tile desc, byte_length desc
  limit 1;
  if expected_width is null then raise exception '카탈로그 원본 이미지를 찾지 못했습니다.'; end if;
  if new.original_width_px <> expected_width or new.original_height_px <> expected_height
     or new.replacement_width_px <> expected_width or new.replacement_height_px <> expected_height then
    raise exception '교체 이미지 규격은 원본 %×%px와 같아야 합니다.', expected_width, expected_height;
  end if;
  return new;
end;
$$;

create trigger replacement_dimensions_check before insert or update on public.replacement_versions
for each row execute function public.validate_replacement_dimensions();

create or replace function public.review_replacement(p_version_id uuid, p_decision text, p_note text default '')
returns public.replacement_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.replacement_versions;
begin
  if not public.has_role(array['admin','reviewer']) then raise exception '검수 권한이 없습니다.'; end if;
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

alter table public.profiles enable row level security;
alter table public.catalog_manifests enable row level security;
alter table public.image_occurrences enable row level security;
alter table public.feature_placements enable row level security;
alter table public.catalog_work_items enable row level security;
alter table public.replacement_versions enable row level security;
alter table public.catalog_comments enable row level security;

create policy profiles_read_active on public.profiles for select to authenticated using (public.is_active_member());
create policy manifests_read_active on public.catalog_manifests for select to authenticated using (public.is_active_member());
create policy occurrences_read_active on public.image_occurrences for select to authenticated using (public.is_active_member());
create policy placements_read_active on public.feature_placements for select to authenticated using (public.is_active_member());
create policy work_items_read_active on public.catalog_work_items for select to authenticated using (public.is_active_member());
create policy replacements_read_active on public.replacement_versions for select to authenticated using (public.is_active_member());
create policy replacements_insert_active on public.replacement_versions for insert to authenticated with check (
  public.has_role(array['admin','reviewer','editor']) and created_by = auth.uid()
);
create policy comments_read_active on public.catalog_comments for select to authenticated using (public.is_active_member());
create policy comments_insert_active on public.catalog_comments for insert to authenticated with check (
  public.is_active_member() and created_by = auth.uid()
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('vworld-catalog-originals', 'vworld-catalog-originals', false, 52428800, array['image/jpeg','image/ktx2','application/octet-stream']),
  ('vworld-catalog-previews', 'vworld-catalog-previews', false, 52428800, array['image/png','image/jpeg','image/webp']),
  ('vworld-catalog-replacements', 'vworld-catalog-replacements', false, 18874368, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy storage_originals_read_active on storage.objects for select to authenticated
using (bucket_id = 'vworld-catalog-originals' and public.is_active_member());
create policy storage_previews_read_active on storage.objects for select to authenticated
using (bucket_id = 'vworld-catalog-previews' and public.is_active_member());
create policy storage_replacements_read_active on storage.objects for select to authenticated
using (bucket_id = 'vworld-catalog-replacements' and public.is_active_member());
create policy storage_replacements_insert_active on storage.objects for insert to authenticated
with check (bucket_id = 'vworld-catalog-replacements' and public.has_role(array['admin','reviewer','editor']));
create policy storage_replacements_delete_owner on storage.objects for delete to authenticated
using (bucket_id = 'vworld-catalog-replacements' and (owner_id = auth.uid()::text or public.has_role(array['admin'])));

grant usage on schema public to authenticated;
grant select on public.profiles, public.catalog_manifests, public.image_occurrences, public.feature_placements,
  public.catalog_work_items, public.replacement_versions, public.catalog_comments to authenticated;
grant insert on public.replacement_versions, public.catalog_comments to authenticated;
grant execute on function public.claim_catalog_work(text), public.set_catalog_work_status(text, text),
  public.review_replacement(uuid, text, text), public.is_active_member(), public.has_role(text[]) to authenticated;

alter publication supabase_realtime add table public.catalog_work_items;
alter publication supabase_realtime add table public.replacement_versions;
alter publication supabase_realtime add table public.catalog_comments;
