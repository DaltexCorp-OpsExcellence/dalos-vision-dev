-- shipments_v2_returned_negative_cartons_20261117
-- Tarek 2026-11-17: a Returned shipment may have negative cartons (returns are booked as negative rows,
-- e.g. TRIU 8691236 -1,024 / -640, SZLU 9499275 -40, MNBU 3407164 -2,496). Today save/edit_shipment_v2_full
-- refuse any negative cartons, so those 4 live rows cannot be edited in Shipments > Manage.
--
-- Change (one line in each of the two functions, nothing else):
--   if v_cc < 0 then raise ...
-- becomes
--   if v_cc < 0 and coalesce(p_header->>'shipping_status','') <> 'Returned' then raise ...
-- Carton net/gross, packing, total cartons and Pascol stay non-negative for every status
-- (a return's Net t = negative cartons x positive carton net). Pallets were never checked.
-- Signatures, grants, owner and SECURITY DEFINER / search_path are unchanged (CREATE OR REPLACE of the same definition).
-- The patch asserts the old line appears exactly once in each function, so it fails loudly if the source drifted.

do $mig$
declare
  v_fn   regprocedure;
  v_def  text;
  v_new  text;
  v_old  constant text := $o$if v_cc < 0 then raise exception 'Cartons cannot be negative, got "%"', v_line->>'carton_count' using errcode = '22023'; end if;$o$;
  v_rep  constant text := $r$if v_cc < 0 and coalesce(p_header->>'shipping_status','') <> 'Returned' then raise exception 'Cartons cannot be negative unless the shipment status is Returned, got "%"', v_line->>'carton_count' using errcode = '22023'; end if;$r$;
begin
  foreach v_fn in array array['public.save_shipment_v2_full(jsonb,jsonb)'::regprocedure,
                              'public.edit_shipment_v2_full(jsonb,jsonb,uuid[])'::regprocedure] loop
    v_def := pg_get_functiondef(v_fn);
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'returned-negatives patch: expected exactly one negative-cartons check in %', v_fn;
    end if;
    v_new := replace(v_def, v_old, v_rep);
    execute v_new;
  end loop;
end
$mig$;

notify pgrst, 'reload schema';
