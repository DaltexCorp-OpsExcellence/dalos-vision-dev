-- Migration: shipments_v2_entry_rpcs
-- Manual shipment entry (create + edit) for the Orchards entry forms.
-- Writes ONLY public.shipments_v2 (staging). NEVER public.shipments (Phase 1-3 hard rule).
-- No RLS change: shipments_v2 stays policy-less; access is via these SECURITY DEFINER
-- RPCs (authenticated only, anon/PUBLIC revoked). Rows are built to mirror the
-- sync-shipments raw_data shape so a manual container renders in the listing like a
-- synced one. row_key is generated (unique); shipments_v2 has no sync to delete orphans.
-- Rollback: drop the three functions.

-- ── Shared row-builder: one shipments_v2 row from header + one line ──────────────
-- Returns the full column set as a record via an INSERT helper used by both RPCs.

create or replace function public._shipments_v2_raw_data(p_header jsonb, p_line jsonb, p_container_pct numeric)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'Region',                p_header->>'receiving_country',
    'Receiving Port',        p_header->>'receiving_port',
    'Client',                p_header->>'client',
    'Subclient',             p_header->>'subclient',
    'Vessel Name',           p_header->>'vessel',
    'Shipping Line',         p_header->>'shipping_line',
    'Agent',                 p_header->>'agent',
    'Shipper',               p_header->>'shipper',
    'Booking No.',           p_header->>'booking_no',
    'Invoice No.',           p_header->>'invoice_no',
    'PO Number',             p_header->>'po_number',
    'Departure Port',        p_header->>'departure_port',
    'Pack House (Packing)',  p_header->>'pack_house',
    'Pack House (Departure)',coalesce(p_header->>'pack_house_departure', p_header->>'pack_house'),
    'Source Type',           p_header->>'source_type',
    'Raw Source',            p_header->>'raw_source',
    'Shipping Status',       p_header->>'shipping_status',
    'Loading Date',          to_char(nullif(p_header->>'loading_date','')::date,'DD/MM/YYYY'),
    'ETD',                   to_char(nullif(p_header->>'etd','')::date,'DD/MM/YYYY'),
    'ETA',                   to_char(nullif(p_header->>'eta','')::date,'DD/MM/YYYY'),
    'Shipping Month',        to_char(nullif(p_header->>'loading_date','')::date,'DD/MM/YYYY'),
    'Shipping Week No.',     to_char(nullif(p_header->>'loading_date','')::date,'IW')||''''||to_char(nullif(p_header->>'loading_date','')::date,'YY'),
    'Category',              p_line->>'category',
    'Variety',               p_line->>'variety',
    'Daltex Class',          p_line->>'daltex_class',
    'Client Class',          p_line->>'client_class',
    'Carton Type',           p_line->>'carton_type',
    'Brand Name',            p_line->>'brand',
    'Packaging Type',        p_line->>'packaging_type',
    'Caliber',               p_line->>'caliber',
    'Count/Size',            p_line->>'count_size',
    'Lot #',                 p_line->>'lot',
    'Carton Count',          p_line->>'carton_count',
    'Pallet Count',          p_line->>'pallet_count',
    'Net Weight',            p_line->>'net_weight',
    'Gross Weight',          p_line->>'gross_weight',
    'Carton Net Weight',     p_line->>'carton_net_weight',
    'Carton Gross Weight',   p_line->>'carton_gross_weight',
    'Pascol Weight',         p_line->>'pascol_weight',
    'Pascol Weight Actual %',p_line->>'pascol_pct',
    'Packing Weight',        p_line->>'packing_weight',
    'Pascol Net Weight',     p_line->>'pascol_net',
    'Weight Variance',       p_line->>'weight_variance',
    'Traceability code',     p_line->>'traceability_code',
    'Container %',           case when p_container_pct is not null then p_container_pct::text end,
    'Entered',               'manual'
  ))
$$;

-- ── CREATE: one container, N variety lines, atomic ──────────────────────────────
create or replace function public.save_shipment_v2_full(p_header jsonb, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod text := p_header->>'product_id';
  v_total_net numeric := 0;
  v_line jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_pct numeric;
begin
  if v_prod is null or not exists (select 1 from products where id = v_prod) then
    raise exception 'save_shipment_v2_full: unknown product_id %', v_prod using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'save_shipment_v2_full: at least one line required' using errcode = '22023';
  end if;

  select coalesce(sum(nullif(l->>'net_weight','')::numeric), 0)
    into v_total_net from jsonb_array_elements(p_lines) l;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_id  := gen_random_uuid();
    v_pct := case when v_total_net > 0
                  then round(coalesce(nullif(v_line->>'net_weight','')::numeric,0) / v_total_net, 6) end;
    insert into shipments_v2(
      id, row_key, product_id, season_id, container_number, carta, pack_house,
      variety, color, daltex_class, carton_type, loading_date, client, subclient,
      vessel, etd, eta, arrival_date, receiving_country, receiving_port, shipping_status,
      carton_count, pallet_count, punnet_count, net_weight, gross_weight, variety_type,
      traceability_code, farm_source, shipper, agent, shipping_line, booking_no, invoice_no,
      departure_port, brand, size, carton_net_weight, raw_data, synced_at, created_at)
    values(
      v_id,
      md5(gen_random_uuid()::text || clock_timestamp()::text),
      v_prod,
      nullif(p_header->>'season_id','')::uuid,
      p_header->>'container_number',
      p_header->>'carta',
      p_header->>'pack_house',
      v_line->>'variety',
      v_line->>'color',
      v_line->>'daltex_class',
      v_line->>'carton_type',
      nullif(p_header->>'loading_date','')::date,
      p_header->>'client',
      p_header->>'subclient',
      p_header->>'vessel',
      nullif(p_header->>'etd','')::date,
      nullif(p_header->>'eta','')::date,
      nullif(p_header->>'arrival_date','')::date,
      p_header->>'receiving_country',
      p_header->>'receiving_port',
      p_header->>'shipping_status',
      nullif(v_line->>'carton_count','')::int,
      nullif(v_line->>'pallet_count','')::int,
      nullif(v_line->>'punnet_count','')::int,
      nullif(v_line->>'net_weight','')::numeric,
      nullif(v_line->>'gross_weight','')::numeric,
      p_header->>'variety_type',
      v_line->>'traceability_code',
      coalesce(p_header->>'raw_source', p_header->>'source_type'),
      p_header->>'shipper',
      p_header->>'agent',
      p_header->>'shipping_line',
      p_header->>'booking_no',
      p_header->>'invoice_no',
      p_header->>'departure_port',
      v_line->>'brand',
      v_line->>'count_size',
      nullif(v_line->>'carton_net_weight','')::numeric,
      _shipments_v2_raw_data(p_header, v_line, v_pct),
      now(), now());
    v_ids := array_append(v_ids, v_id);
  end loop;

  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids),
    'container_number', p_header->>'container_number',
    'loading_date', p_header->>'loading_date',
    'lines', jsonb_array_length(p_lines));
end $$;

-- ── EDIT: update kept lines (by id), insert new lines, delete removed (explicit ids) ──
create or replace function public.edit_shipment_v2_full(p_header jsonb, p_lines jsonb, p_deleted_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod text := p_header->>'product_id';
  v_total_net numeric := 0;
  v_line jsonb;
  v_id uuid;
  v_pct numeric;
  v_updated int := 0;
  v_inserted int := 0;
  v_deleted int := 0;
begin
  if v_prod is null or not exists (select 1 from products where id = v_prod) then
    raise exception 'edit_shipment_v2_full: unknown product_id %', v_prod using errcode = '22023';
  end if;

  select coalesce(sum(nullif(l->>'net_weight','')::numeric), 0)
    into v_total_net from jsonb_array_elements(p_lines) l;

  -- delete removed lines FIRST, by explicit id only (never by absence)
  if p_deleted_ids is not null and array_length(p_deleted_ids,1) > 0 then
    delete from shipments_v2 where id = any(p_deleted_ids) and product_id = v_prod;
    get diagnostics v_deleted = row_count;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pct := case when v_total_net > 0
                  then round(coalesce(nullif(v_line->>'net_weight','')::numeric,0) / v_total_net, 6) end;
    v_id := nullif(v_line->>'id','')::uuid;
    if v_id is not null then
      update shipments_v2 set
        container_number = p_header->>'container_number',
        carta            = p_header->>'carta',
        pack_house       = p_header->>'pack_house',
        variety          = v_line->>'variety',
        color            = v_line->>'color',
        daltex_class     = v_line->>'daltex_class',
        carton_type      = v_line->>'carton_type',
        loading_date     = nullif(p_header->>'loading_date','')::date,
        client           = p_header->>'client',
        subclient        = p_header->>'subclient',
        vessel           = p_header->>'vessel',
        etd              = nullif(p_header->>'etd','')::date,
        eta              = nullif(p_header->>'eta','')::date,
        arrival_date     = nullif(p_header->>'arrival_date','')::date,
        receiving_country= p_header->>'receiving_country',
        receiving_port   = p_header->>'receiving_port',
        shipping_status  = p_header->>'shipping_status',
        carton_count     = nullif(v_line->>'carton_count','')::int,
        pallet_count     = nullif(v_line->>'pallet_count','')::int,
        punnet_count     = nullif(v_line->>'punnet_count','')::int,
        net_weight       = nullif(v_line->>'net_weight','')::numeric,
        gross_weight     = nullif(v_line->>'gross_weight','')::numeric,
        variety_type     = p_header->>'variety_type',
        traceability_code= v_line->>'traceability_code',
        farm_source      = coalesce(p_header->>'raw_source', p_header->>'source_type'),
        shipper          = p_header->>'shipper',
        agent            = p_header->>'agent',
        shipping_line    = p_header->>'shipping_line',
        booking_no       = p_header->>'booking_no',
        invoice_no       = p_header->>'invoice_no',
        departure_port   = p_header->>'departure_port',
        brand            = v_line->>'brand',
        size             = v_line->>'count_size',
        carton_net_weight= nullif(v_line->>'carton_net_weight','')::numeric,
        raw_data         = _shipments_v2_raw_data(p_header, v_line, v_pct),
        synced_at        = now()
      where id = v_id and product_id = v_prod;
      if found then v_updated := v_updated + 1; end if;
    else
      insert into shipments_v2(
        id,row_key,product_id,season_id,container_number,carta,pack_house,variety,color,
        daltex_class,carton_type,loading_date,client,subclient,vessel,etd,eta,arrival_date,
        receiving_country,receiving_port,shipping_status,carton_count,pallet_count,punnet_count,
        net_weight,gross_weight,variety_type,traceability_code,farm_source,shipper,agent,
        shipping_line,booking_no,invoice_no,departure_port,brand,size,carton_net_weight,
        raw_data,synced_at,created_at)
      values(
        gen_random_uuid(), md5(gen_random_uuid()::text||clock_timestamp()::text), v_prod,
        nullif(p_header->>'season_id','')::uuid, p_header->>'container_number', p_header->>'carta',
        p_header->>'pack_house', v_line->>'variety', v_line->>'color', v_line->>'daltex_class',
        v_line->>'carton_type', nullif(p_header->>'loading_date','')::date, p_header->>'client',
        p_header->>'subclient', p_header->>'vessel', nullif(p_header->>'etd','')::date,
        nullif(p_header->>'eta','')::date, nullif(p_header->>'arrival_date','')::date,
        p_header->>'receiving_country', p_header->>'receiving_port', p_header->>'shipping_status',
        nullif(v_line->>'carton_count','')::int, nullif(v_line->>'pallet_count','')::int,
        nullif(v_line->>'punnet_count','')::int, nullif(v_line->>'net_weight','')::numeric,
        nullif(v_line->>'gross_weight','')::numeric, p_header->>'variety_type',
        v_line->>'traceability_code', coalesce(p_header->>'raw_source', p_header->>'source_type'),
        p_header->>'shipper', p_header->>'agent', p_header->>'shipping_line', p_header->>'booking_no',
        p_header->>'invoice_no', p_header->>'departure_port', v_line->>'brand', v_line->>'count_size',
        nullif(v_line->>'carton_net_weight','')::numeric,
        _shipments_v2_raw_data(p_header, v_line, v_pct), now(), now());
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'updated',v_updated,'inserted',v_inserted,'deleted',v_deleted);
end $$;

-- ── READ one container for the edit form ────────────────────────────────────────
create or replace function public.get_shipment_v2_container(p_container text, p_loaded date, p_product text default 'citrus')
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'header', (select to_jsonb(h) from (
        select container_number, carta, loading_date, shipping_status, vessel, shipping_line,
               booking_no, invoice_no, raw_data->>'PO Number' as po_number, etd, eta, arrival_date,
               departure_port, receiving_country, receiving_port, client, subclient, agent, shipper,
               pack_house, raw_data->>'Pack House (Departure)' as pack_house_departure,
               raw_data->>'Source Type' as source_type, farm_source as raw_source, product_id
        from shipments_v2
        where product_id = p_product and container_number = p_container and loading_date = p_loaded
        limit 1) h),
    'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.carton_count desc nulls last) from (
        select id, variety, raw_data->>'Category' as category, raw_data->>'Lot #' as lot,
               daltex_class, raw_data->>'Client Class' as client_class, carton_type, brand,
               raw_data->>'Packaging Type' as packaging_type, raw_data->>'Caliber' as caliber,
               size as count_size, pallet_count, carton_count, net_weight, gross_weight,
               carton_net_weight, raw_data->>'Carton Gross Weight' as carton_gross_weight,
               raw_data->>'Pascol Weight' as pascol_weight, raw_data->>'Pascol Weight Actual %' as pascol_pct,
               raw_data->>'Packing Weight' as packing_weight, raw_data->>'Pascol Net Weight' as pascol_net,
               raw_data->>'Weight Variance' as weight_variance, traceability_code
        from shipments_v2
        where product_id = p_product and container_number = p_container and loading_date = p_loaded) l), '[]'::jsonb)
  );
$$;

-- ── Grants: authenticated only; anon/PUBLIC revoked (new funcs default to PUBLIC) ──
revoke all on function public.save_shipment_v2_full(jsonb, jsonb)         from public, anon;
revoke all on function public.edit_shipment_v2_full(jsonb, jsonb, uuid[]) from public, anon;
revoke all on function public.get_shipment_v2_container(text, date, text) from public, anon;
revoke all on function public._shipments_v2_raw_data(jsonb, jsonb, numeric) from public, anon;
grant execute on function public.save_shipment_v2_full(jsonb, jsonb)         to authenticated;
grant execute on function public.edit_shipment_v2_full(jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.get_shipment_v2_container(text, date, text) to authenticated;

notify pgrst, 'reload schema';
