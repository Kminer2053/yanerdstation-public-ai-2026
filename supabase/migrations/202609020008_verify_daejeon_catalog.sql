-- Fail the deployment if the Daejeon Station catalog is incomplete.
do $$
declare
  occurrence_count bigint;
  feature_count bigint;
  active_slot_count bigint;
  manifest_record public.catalog_manifests%rowtype;
begin
  select count(*) into occurrence_count
  from public.image_occurrences where site_id = 'S201801';
  select count(*) into feature_count
  from public.feature_placements where site_id = 'S201801';
  select count(*) into active_slot_count
  from public.object_texture_slots where site_id = 'S201801' and is_active;
  select * into manifest_record
  from public.catalog_manifests where site_id = 'S201801';

  if occurrence_count <> 2101 then
    raise exception 'Daejeon image occurrence count mismatch: %', occurrence_count;
  end if;
  if feature_count <> 488 then
    raise exception 'Daejeon feature count mismatch: %', feature_count;
  end if;
  if active_slot_count <> 1379 then
    raise exception 'Daejeon active slot count mismatch: %', active_slot_count;
  end if;
  if manifest_record.site_name <> '대전역KTX'
    or manifest_record.tile_count <> 246
    or manifest_record.unique_image_count <> 893 then
    raise exception 'Daejeon manifest mismatch: %', row_to_json(manifest_record);
  end if;
end $$;
