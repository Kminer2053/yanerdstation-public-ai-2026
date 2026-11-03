-- Correct the pending information-zone rollout using the user-confirmed
-- F02WL072-S04 booth (F02WL054 shared shell), with S03/S05 upper panels.
-- IMG_6176.jpg: left boards, central booth, right TV, overhead supported TIDS.
-- This migration updates the five EXISTING app assets; image/version history
-- and replacement canvas sizes are intentionally preserved. The earlier S11/S10
-- western booth is unrelated and is not retired.

do $$
begin
  if (select count(*) from public.object_texture_slots
      where site_id = 'S202103' and source_kind = 'app_asset'
        and slot_key in ('44692b61d4446ce8637f431c0060df7d99997dd78d507f6495845476c242ef2f',
    'fc28178b5bc5646da81520d5a64731bd5e41f5693ca2b171d2016cb3fc7f36e4',
    '524dcbef517f512b1e9624e8999eed47d62a47c06889f7254ddd06ca9bac010e',
    'de2ba6d6b7acfe52548a90e389728a108d51b2636819b1fc15f17b455e477a8f',
    '905302e1d8bd62c38c2e8bac6dceefbc37c2b3106477570e66db910b104178d1')) <> 5 then
    raise exception 'Expected exactly five existing Seoul information assets';
  end if;
  if not exists (select 1 from public.object_texture_slots
      where slot_key = '7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc' and site_id = 'S202103'
        and source_kind = 'app_asset' and target_asset_id = 'SEOUL-2F-TRUEDAN') then
    raise exception 'Expected the existing TRUEDAN facade slot';
  end if;
  if (select count(*) from public.object_texture_slots
      where site_id = 'S202103' and source_kind = 'vworld_uv'
        and slot_key in ('656d96e60c67c90ce0e8f94036508054ba6a0ee0cd4438901c549e6aa2e01ae0',
    'd2ad0be71b735d6eda431336d165fec4e21427236c6ccd7422e0d5105998214c',
    '4c60ff5396e74667c17c7dbb7fe75856013dcbcaf3f63dbf32765b9e02223001')
        and slot_alias in ('F02WL072-S03','F02WL072-S04','F02WL072-S05')
        and placement_count = 1) <> 3 then
    raise exception 'S04 retirement requires exactly three single-placement original surfaces';
  end if;
end $$;

with corrected as (
  select * from jsonb_to_recordset($placements$
[
  {
    "slot_key": "44692b61d4446ce8637f431c0060df7d99997dd78d507f6495845476c242ef2f",
    "slot_alias": "INFO-BOOTH-01-S01",
    "target_asset_id": "SEOUL-2F-INFORMATION-BOOTH-01",
    "target_surface_id": "front-display",
    "pixel_width": 830,
    "pixel_height": 1000,
    "placement_id": "front-display",
    "is_primary": true,
    "render_kind": "app_asset_wall",
    "longitude": 126.97070977128412,
    "latitude": 37.553613973875024,
    "height_m": 37.51348952576518,
    "east_m": -9.740107111559627,
    "north_m": -1.7787130948718932,
    "up_m": 10.3134818485,
    "camera_heading_deg": 358.63429619853434,
    "surface_width_m": 2.05,
    "surface_height_m": 2.47,
    "texture_coordinates": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        0,
        1
      ]
    ],
    "surface_placements": [
      {
        "placement_id": "front-display",
        "target_surface_id": "front-display",
        "is_primary": true,
        "render_kind": "app_asset_wall",
        "longitude": 126.97070977128412,
        "latitude": 37.553613973875024,
        "height_m": 37.51348952576518,
        "east_m": -9.740107111559627,
        "north_m": -1.7787130948718932,
        "up_m": 10.3134818485,
        "camera_heading_deg": 358.63429619853434,
        "surface_width_m": 2.05,
        "surface_height_m": 2.47,
        "texture_coordinates": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      }
    ],
    "source_region_signature": "S04-IMG_6176-front-display-20260914"
  },
  {
    "slot_key": "fc28178b5bc5646da81520d5a64731bd5e41f5693ca2b171d2016cb3fc7f36e4",
    "slot_alias": "TIDS-01-S01",
    "target_asset_id": "SEOUL-2F-TRAIN-DEPARTURE-DISPLAY-01",
    "target_surface_id": "display-face",
    "pixel_width": 960,
    "pixel_height": 323,
    "placement_id": "display-face",
    "is_primary": true,
    "render_kind": "app_asset_wall",
    "longitude": 126.97071051312179,
    "latitude": 37.553589203637166,
    "height_m": 40.62149078864604,
    "east_m": -9.674564241560587,
    "north_m": -4.527931917045255,
    "up_m": 13.4214818485,
    "camera_heading_deg": 358.63429619853434,
    "surface_width_m": 3.64,
    "surface_height_m": 1.226,
    "texture_coordinates": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        0,
        1
      ]
    ],
    "surface_placements": [
      {
        "placement_id": "display-face",
        "target_surface_id": "display-face",
        "is_primary": true,
        "render_kind": "app_asset_wall",
        "longitude": 126.97071051312179,
        "latitude": 37.553589203637166,
        "height_m": 40.62149078864604,
        "east_m": -9.674564241560587,
        "north_m": -4.527931917045255,
        "up_m": 13.4214818485,
        "camera_heading_deg": 358.63429619853434,
        "surface_width_m": 3.64,
        "surface_height_m": 1.226,
        "texture_coordinates": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      }
    ],
    "source_region_signature": "S04-IMG_6176-display-face-20260914"
  },
  {
    "slot_key": "524dcbef517f512b1e9624e8999eed47d62a47c06889f7254ddd06ca9bac010e",
    "slot_alias": "INFO-GUIDE-01-S01",
    "target_asset_id": "SEOUL-2F-GUIDE-BOARD-01",
    "target_surface_id": "display-face",
    "pixel_width": 400,
    "pixel_height": 900,
    "placement_id": "display-face",
    "is_primary": true,
    "render_kind": "app_asset_wall",
    "longitude": 126.97075393547198,
    "latitude": 37.55361346029012,
    "height_m": 37.17848478257656,
    "east_m": -5.837639898113821,
    "north_m": -1.8357187786281646,
    "up_m": 9.9784818485,
    "camera_heading_deg": 358.63429619853434,
    "surface_width_m": 0.64,
    "surface_height_m": 1.44,
    "texture_coordinates": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        0,
        1
      ]
    ],
    "surface_placements": [
      {
        "placement_id": "display-face",
        "target_surface_id": "display-face",
        "is_primary": true,
        "render_kind": "app_asset_wall",
        "longitude": 126.97075393547198,
        "latitude": 37.55361346029012,
        "height_m": 37.17848478257656,
        "east_m": -5.837639898113821,
        "north_m": -1.8357187786281646,
        "up_m": 9.9784818485,
        "camera_heading_deg": 358.63429619853434,
        "surface_width_m": 0.64,
        "surface_height_m": 1.44,
        "texture_coordinates": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      }
    ],
    "source_region_signature": "S04-IMG_6176-display-face-20260914"
  },
  {
    "slot_key": "de2ba6d6b7acfe52548a90e389728a108d51b2636819b1fc15f17b455e477a8f",
    "slot_alias": "INFO-GUIDE-02-S01",
    "target_asset_id": "SEOUL-2F-GUIDE-BOARD-02",
    "target_surface_id": "display-face",
    "pixel_width": 400,
    "pixel_height": 900,
    "placement_id": "display-face",
    "is_primary": true,
    "render_kind": "app_asset_wall",
    "longitude": 126.97074488444983,
    "latitude": 37.553613288492286,
    "height_m": 37.178485568612814,
    "east_m": -6.637412646382436,
    "north_m": -1.854785795355158,
    "up_m": 9.9784818485,
    "camera_heading_deg": 358.63429619853434,
    "surface_width_m": 0.64,
    "surface_height_m": 1.44,
    "texture_coordinates": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        0,
        1
      ]
    ],
    "surface_placements": [
      {
        "placement_id": "display-face",
        "target_surface_id": "display-face",
        "is_primary": true,
        "render_kind": "app_asset_wall",
        "longitude": 126.97074488444983,
        "latitude": 37.553613288492286,
        "height_m": 37.178485568612814,
        "east_m": -6.637412646382436,
        "north_m": -1.854785795355158,
        "up_m": 9.9784818485,
        "camera_heading_deg": 358.63429619853434,
        "surface_width_m": 0.64,
        "surface_height_m": 1.44,
        "texture_coordinates": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      }
    ],
    "source_region_signature": "S04-IMG_6176-display-face-20260914"
  },
  {
    "slot_key": "905302e1d8bd62c38c2e8bac6dceefbc37c2b3106477570e66db910b104178d1",
    "slot_alias": "INFO-TV-01-S01",
    "target_asset_id": "SEOUL-2F-INFORMATION-TV-01",
    "target_surface_id": "display-face",
    "pixel_width": 1280,
    "pixel_height": 720,
    "placement_id": "display-face",
    "is_primary": true,
    "render_kind": "app_asset_wall",
    "longitude": 126.97068377657756,
    "latitude": 37.553612579208846,
    "height_m": 37.80849348753691,
    "east_m": -12.03707038574102,
    "north_m": -1.9335023614955764,
    "up_m": 10.608481848499999,
    "camera_heading_deg": 358.63429619853434,
    "surface_width_m": 1.28,
    "surface_height_m": 0.72,
    "texture_coordinates": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        0,
        1
      ]
    ],
    "surface_placements": [
      {
        "placement_id": "display-face",
        "target_surface_id": "display-face",
        "is_primary": true,
        "render_kind": "app_asset_wall",
        "longitude": 126.97068377657756,
        "latitude": 37.553612579208846,
        "height_m": 37.80849348753691,
        "east_m": -12.03707038574102,
        "north_m": -1.9335023614955764,
        "up_m": 10.608481848499999,
        "camera_heading_deg": 358.63429619853434,
        "surface_width_m": 1.28,
        "surface_height_m": 0.72,
        "texture_coordinates": [
          [
            0,
            0
          ],
          [
            1,
            0
          ],
          [
            1,
            1
          ],
          [
            0,
            1
          ]
        ]
      }
    ],
    "source_region_signature": "S04-IMG_6176-display-face-20260914"
  }
]
$placements$::jsonb) as c(
    slot_key text, slot_alias text, target_asset_id text, target_surface_id text,
    pixel_width integer, pixel_height integer,
    longitude double precision, latitude double precision, height_m double precision,
    east_m double precision, north_m double precision, up_m double precision,
    camera_heading_deg double precision, surface_width_m double precision,
    surface_height_m double precision, surface_placements jsonb, source_region_signature text
  )
)
update public.object_texture_slots as slot
set longitude = c.longitude, latitude = c.latitude, height_m = c.height_m,
    east_m = c.east_m, north_m = c.north_m, up_m = c.up_m,
    camera_heading_deg = c.camera_heading_deg,
    surface_placements = c.surface_placements,
    source_region_signature = c.source_region_signature,
    is_active = true
from corrected c
where slot.slot_key = c.slot_key and slot.site_id = 'S202103'
  and slot.source_kind = 'app_asset' and slot.target_asset_id = c.target_asset_id
  and slot.target_surface_id = c.target_surface_id
  and coalesce(slot.replacement_canvas_width_px,slot.crop_width_px) = c.pixel_width
  and coalesce(slot.replacement_canvas_height_px,slot.crop_height_px) = c.pixel_height;

-- Undo migration 008's mistaken TRUEDAN retirement without altering any version.
update public.object_texture_slots set is_active = true
where site_id = 'S202103' and slot_key = '7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc';

update public.object_slot_work_items w
set status = case
      when exists (select 1 from public.object_slot_replacement_versions v
        where v.slot_key=w.slot_key and v.review_status='approved' and v.is_active) then 'approved'
      when exists (select 1 from public.object_slot_replacement_versions v
        where v.slot_key=w.slot_key and v.review_status='submitted') then 'review'
      when w.assignee_id is null then 'pending' else 'in_progress' end,
    is_management_target = true,
    note = 'TRUEDAN은 S04 계단 앞 철거 대상이 아니므로 기존 관리와 승인 이력을 유지합니다.'
where w.slot_key = '7afba516acfae10344297172e7c5c80368d4d3d43b140a71a14ccedc208852bc' and w.status = 'hold';

-- The S04 front and its two upper panels are the ONLY retired catalog slots.
update public.object_texture_slots set is_active = false
where site_id = 'S202103' and slot_key in ('656d96e60c67c90ce0e8f94036508054ba6a0ee0cd4438901c549e6aa2e01ae0',
    'd2ad0be71b735d6eda431336d165fec4e21427236c6ccd7422e0d5105998214c',
    '4c60ff5396e74667c17c7dbb7fe75856013dcbcaf3f63dbf32765b9e02223001');
update public.object_slot_work_items set status = 'hold', is_management_target = false,
  note = '2026-09-14 현장 확인: F02WL072-S04 매장부스 철거 및 안내존 설치. 원본·교체 이력 보존.'
where slot_key in ('656d96e60c67c90ce0e8f94036508054ba6a0ee0cd4438901c549e6aa2e01ae0',
    'd2ad0be71b735d6eda431336d165fec4e21427236c6ccd7422e0d5105998214c',
    '4c60ff5396e74667c17c7dbb7fe75856013dcbcaf3f63dbf32765b9e02223001');

update public.object_slot_work_items
set note = '2026-09-14 사용자 확정 F02WL072-S04 부스 자리. IMG_6176.jpg 기준 안내존 시설; 기존 애셋 ID·이미지·승인 이력 유지.',
    is_management_target = true
where slot_key in ('44692b61d4446ce8637f431c0060df7d99997dd78d507f6495845476c242ef2f',
    'fc28178b5bc5646da81520d5a64731bd5e41f5693ca2b171d2016cb3fc7f36e4',
    '524dcbef517f512b1e9624e8999eed47d62a47c06889f7254ddd06ca9bac010e',
    'de2ba6d6b7acfe52548a90e389728a108d51b2636819b1fc15f17b455e477a8f',
    '905302e1d8bd62c38c2e8bac6dceefbc37c2b3106477570e66db910b104178d1');

do $$
begin
  if (select count(*) from public.object_texture_slots
      where slot_key in ('44692b61d4446ce8637f431c0060df7d99997dd78d507f6495845476c242ef2f',
    'fc28178b5bc5646da81520d5a64731bd5e41f5693ca2b171d2016cb3fc7f36e4',
    '524dcbef517f512b1e9624e8999eed47d62a47c06889f7254ddd06ca9bac010e',
    'de2ba6d6b7acfe52548a90e389728a108d51b2636819b1fc15f17b455e477a8f',
    '905302e1d8bd62c38c2e8bac6dceefbc37c2b3106477570e66db910b104178d1') and is_active
        and east_m between -13.0 and -5.0
        and camera_heading_deg between 358.63 and 358.64
        and jsonb_array_length(surface_placements) = 1
        and source_region_signature like 'S04-IMG_6176-%') <> 5 then
    raise exception 'All five information assets must match the verified S04 placement';
  end if;
  if exists (select 1 from public.object_texture_slots
      where slot_key in ('656d96e60c67c90ce0e8f94036508054ba6a0ee0cd4438901c549e6aa2e01ae0',
    'd2ad0be71b735d6eda431336d165fec4e21427236c6ccd7422e0d5105998214c',
    '4c60ff5396e74667c17c7dbb7fe75856013dcbcaf3f63dbf32765b9e02223001') and is_active) then
    raise exception 'S04 retired surfaces remain active';
  end if;
end $$;
