-- ============================================================================
-- shipments_v2_restore_mnbu3723239 — APPLIED 2026-10-12 (verified: 62/62 raw_data keys back; only synced_at differs)
-- Undo the damage from the 2026-09-20 QA status-flip on MNBU 3723239 (grapes,
-- id 8202f747-…). The old edit_shipment_v2_full REPLACED raw_data (31 sheet
-- keys lost, 'Entered' set to 'manual') and nulled color / punnet_count /
-- variety_type. The original values still live in public.shipments under the
-- SAME id.
--
-- public.shipments is only READ here. Only public.shipments_v2 is written.
-- The damaged row is backed up to audit_log first (old_value), so this is
-- itself reversible.
-- Run AFTER shipments_v2_hardening (relies on nothing from it, but keeps order).
-- ============================================================================
begin;

insert into public.audit_log(user_id, action, entity_type, entity_id, old_value, new_value)
select null, 'restore_from_shipments', 'shipments_v2', v.id::text, to_jsonb(v),
       jsonb_build_object('raw_data', s.raw_data, 'color', s.color,
                          'punnet_count', s.punnet_count, 'variety_type', s.variety_type)
from public.shipments_v2 v
join public.shipments s on s.id = v.id
where v.id = '8202f747-81c1-4b74-9554-43ffad050106';

update public.shipments_v2 v
set raw_data     = s.raw_data,
    color        = s.color,
    punnet_count = s.punnet_count,
    variety_type = s.variety_type
from public.shipments s
where s.id = v.id
  and v.id = '8202f747-81c1-4b74-9554-43ffad050106';

-- must have touched exactly one row
do $$ begin
  if (select count(*) from public.shipments_v2 v join public.shipments s on s.id = v.id
      where v.id = '8202f747-81c1-4b74-9554-43ffad050106'
        and v.raw_data = s.raw_data and v.color is not distinct from s.color
        and v.punnet_count is not distinct from s.punnet_count
        and v.variety_type is not distinct from s.variety_type) <> 1 then
    raise exception 'restore check failed — rolling back';
  end if;
end $$;

commit;
