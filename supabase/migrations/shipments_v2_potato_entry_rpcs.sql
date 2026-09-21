-- Migration: shipments_v2_potato_entry_rpcs
-- Pivots (potato-station) shipments entry surface. Sibling to the Orchards
-- save_/edit_/get_shipment_v2_full set — SEPARATE functions so orchards is untouched.
-- Writes ONLY public.shipments_v2 (never public.shipments), product_id='potatoes'.
-- Modelled on the الادخال tab of "صادر محطات البطاطس 2026".
--
-- Voyage grain: (container_number, loading_date) header -> one or more variety/size/
-- packaging lines. Potato-specific fields live in raw_data (English keys, DalOS convention);
-- typed columns reused where they map so the row renders like a synced one.
-- Rollback: drop the 4 functions + deactivate the potatoes product.

-- 0) Seed the potatoes product (additive; needed for the product_id FK-style check + listing)
insert into public.products(id, name, active, inspection_prefix)
values('potatoes','Potatoes',true,'PT')
on conflict (id) do update set name=excluded.name, active=true;

-- 1) potato raw_data builder: header (station/sector/season/logistics) + per-line (variety/
--    pivot/farm/size/grade/packaging/colours/weights/op/condition). English keys.
create or replace function public._shipments_v2_potato_raw_data(p_header jsonb, p_line jsonb, p_container_pct numeric)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    -- header / logistics
    'Station',               p_header->>'station',            -- محطه التعبئه
    'Sector',                p_header->>'sector',             -- القطاع
    'Season',                p_header->>'season',             -- الموسم
    'Region',                p_header->>'receiving_country',   -- الدولة
    'Country 2',             p_header->>'country2',            -- الدوله 2
    'Receiving Port',        p_header->>'receiving_port',      -- ميناء الشحن
    'Vessel Name',           p_header->>'vessel',              -- اسم المركب
    'Client',                p_header->>'client',              -- العميل
    'Invoice No.',           p_header->>'invoice_no',          -- رقم الفاتوره
    'Permit No',             p_header->>'permit_no',           -- رقم الاذن
    'Work Order',            p_header->>'work_order',          -- امر الشغل
    'Container Count',       p_header->>'container_count',      -- عدد الحاويات
    -- per-line
    'Variety',               p_line->>'variety',               -- الصنف
    'Pivot',                 p_line->>'pivot',                 -- بيفوت
    'Farm',                  p_line->>'farm',                  -- المزرعه
    'Lot #',                 p_line->>'lot',                   -- رقم اللوط
    'Size 1',                p_line->>'size1',                 -- الحجم1
    'Size 2',                p_line->>'size2',                 -- الحجم2
    'Crop Type',             p_line->>'crop_type',             -- محصول (عادى/حيوي)
    'Grade',                 p_line->>'grade',                 -- تصنيف
    'Packaging',             p_line->>'packaging',             -- العبوة
    'Package Weight',        p_line->>'package_weight',        -- وزن العبوه
    'Pack Size',             p_line->>'pack_size',             -- عبوه1
    'Pallet Count',          p_line->>'pallets',               -- البالته
    'Brand Name',            p_line->>'brand',                 -- براند
    'Jumbo Colour',          p_line->>'jumbo_colour',          -- لون الجامب
    'Jumbo Count',           p_line->>'jumbo_count',           -- العدد جامب
    'Sack Colour',           p_line->>'sack_colour',           -- لون الشيكاره
    'Sack Count',            p_line->>'sack_count',            -- العدد شيكاره
    'Standard Weight',       p_line->>'standard_weight',       -- وزن معياري (net)
    'Pascol Weight',         p_line->>'pascol_weight',         -- وزن بسكول
    'Operation Type',        p_line->>'op_type',               -- نوع تشغيل
    'Condition',             p_line->>'condition',             -- الحاله (بدون/بالبتموس)
    -- derived
    'Loading Date',          to_char(nullif(p_header->>'loading_date','')::date,'DD/MM/YYYY'),
    'Shipping Month',        to_char(nullif(p_header->>'loading_date','')::date,'DD/MM/YYYY'),
    'Shipping Week No.',     to_char(nullif(p_header->>'loading_date','')::date,'IW')||''''||to_char(nullif(p_header->>'loading_date','')::date,'YY'),
    'Container %',           case when p_container_pct is not null then p_container_pct::text end,
    'Entered',               'manual'
  ))
$$;

-- 2) CREATE
create or replace function public.save_shipment_v2_potato_full(p_header jsonb, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total_net numeric := 0; v_line jsonb; v_id uuid; v_ids uuid[] := '{}'; v_pct numeric; v_pkgs int;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'save_shipment_v2_potato_full: at least one line required' using errcode = '22023';
  end if;
  select coalesce(sum(nullif(l->>'standard_weight','')::numeric), 0) into v_total_net from jsonb_array_elements(p_lines) l;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_id := gen_random_uuid();
    v_pct := case when v_total_net > 0 then round(coalesce(nullif(v_line->>'standard_weight','')::numeric,0) / v_total_net, 6) end;
    v_pkgs := coalesce(nullif(v_line->>'jumbo_count','')::int,0) + coalesce(nullif(v_line->>'sack_count','')::int,0);
    insert into shipments_v2(
      id,row_key,product_id,season_id,container_number,carta,pack_house,variety,carton_type,
      loading_date,client,vessel,receiving_country,receiving_port,shipping_status,
      carton_count,pallet_count,net_weight,farm_source,invoice_no,brand,size,raw_data,synced_at,created_at)
    values(
      v_id, md5(gen_random_uuid()::text || clock_timestamp()::text), 'potatoes', null,
      p_header->>'container_number', p_header->>'carta',
      p_header->>'station',                          -- station stored in pack_house
      v_line->>'variety', v_line->>'packaging',
      nullif(p_header->>'loading_date','')::date, p_header->>'client', p_header->>'vessel',
      p_header->>'receiving_country', p_header->>'receiving_port', null,
      nullif(v_pkgs,0), nullif(v_line->>'pallets','')::int, nullif(v_line->>'standard_weight','')::numeric,
      v_line->>'farm', p_header->>'invoice_no', v_line->>'brand', v_line->>'size2',
      _shipments_v2_potato_raw_data(p_header, v_line, v_pct), now(), now());
    v_ids := array_append(v_ids, v_id);
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids),
    'container_number', p_header->>'container_number', 'loading_date', p_header->>'loading_date', 'lines', jsonb_array_length(p_lines));
end $$;

-- 3) EDIT
create or replace function public.edit_shipment_v2_potato_full(p_header jsonb, p_lines jsonb, p_deleted_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total_net numeric := 0; v_line jsonb; v_id uuid; v_pct numeric; v_pkgs int;
  v_updated int := 0; v_inserted int := 0; v_deleted int := 0;
begin
  select coalesce(sum(nullif(l->>'standard_weight','')::numeric), 0) into v_total_net from jsonb_array_elements(p_lines) l;
  if p_deleted_ids is not null and array_length(p_deleted_ids,1) > 0 then
    delete from shipments_v2 where id = any(p_deleted_ids) and product_id = 'potatoes';
    get diagnostics v_deleted = row_count;
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pct := case when v_total_net > 0 then round(coalesce(nullif(v_line->>'standard_weight','')::numeric,0) / v_total_net, 6) end;
    v_pkgs := coalesce(nullif(v_line->>'jumbo_count','')::int,0) + coalesce(nullif(v_line->>'sack_count','')::int,0);
    v_id := nullif(v_line->>'id','')::uuid;
    if v_id is not null then
      update shipments_v2 set
        container_number = p_header->>'container_number', carta = p_header->>'carta',
        pack_house = p_header->>'station', variety = v_line->>'variety', carton_type = v_line->>'packaging',
        loading_date = nullif(p_header->>'loading_date','')::date, client = p_header->>'client', vessel = p_header->>'vessel',
        receiving_country = p_header->>'receiving_country', receiving_port = p_header->>'receiving_port',
        carton_count = nullif(v_pkgs,0), pallet_count = nullif(v_line->>'pallets','')::int,
        net_weight = nullif(v_line->>'standard_weight','')::numeric, farm_source = v_line->>'farm',
        invoice_no = p_header->>'invoice_no', brand = v_line->>'brand', size = v_line->>'size2',
        raw_data = _shipments_v2_potato_raw_data(p_header, v_line, v_pct), synced_at = now()
      where id = v_id and product_id = 'potatoes';
      if found then v_updated := v_updated + 1; end if;
    else
      insert into shipments_v2(
        id,row_key,product_id,season_id,container_number,carta,pack_house,variety,carton_type,
        loading_date,client,vessel,receiving_country,receiving_port,shipping_status,
        carton_count,pallet_count,net_weight,farm_source,invoice_no,brand,size,raw_data,synced_at,created_at)
      values(
        gen_random_uuid(), md5(gen_random_uuid()::text||clock_timestamp()::text), 'potatoes', null,
        p_header->>'container_number', p_header->>'carta', p_header->>'station', v_line->>'variety', v_line->>'packaging',
        nullif(p_header->>'loading_date','')::date, p_header->>'client', p_header->>'vessel',
        p_header->>'receiving_country', p_header->>'receiving_port', null,
        nullif(v_pkgs,0), nullif(v_line->>'pallets','')::int, nullif(v_line->>'standard_weight','')::numeric,
        v_line->>'farm', p_header->>'invoice_no', v_line->>'brand', v_line->>'size2',
        _shipments_v2_potato_raw_data(p_header, v_line, v_pct), now(), now());
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'updated',v_updated,'inserted',v_inserted,'deleted',v_deleted);
end $$;

-- 4) READ (edit-load): potato header + per-line shape
create or replace function public.get_shipment_v2_potato_container(p_container text, p_loaded date)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'header', (select to_jsonb(h) from (
        select container_number, carta, loading_date, product_id,
               pack_house as station,
               raw_data->>'Sector' as sector, raw_data->>'Season' as season,
               coalesce(receiving_country, nullif(raw_data->>'Region','')) as receiving_country,
               raw_data->>'Country 2' as country2, receiving_port, client, vessel, invoice_no,
               raw_data->>'Permit No' as permit_no, raw_data->>'Work Order' as work_order,
               raw_data->>'Container Count' as container_count
        from shipments_v2
        where product_id='potatoes' and container_number=p_container and loading_date=p_loaded
        limit 1) h),
    'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.standard_weight desc nulls last) from (
        select id, variety, raw_data->>'Pivot' as pivot, coalesce(farm_source, raw_data->>'Farm') as farm,
               raw_data->>'Lot #' as lot, raw_data->>'Size 1' as size1, coalesce(size, raw_data->>'Size 2') as size2,
               raw_data->>'Crop Type' as crop_type, raw_data->>'Grade' as grade,
               coalesce(carton_type, raw_data->>'Packaging') as packaging, raw_data->>'Package Weight' as package_weight,
               raw_data->>'Pack Size' as pack_size, pallet_count as pallets, brand,
               raw_data->>'Jumbo Colour' as jumbo_colour, raw_data->>'Jumbo Count' as jumbo_count,
               raw_data->>'Sack Colour' as sack_colour, raw_data->>'Sack Count' as sack_count,
               net_weight as standard_weight, raw_data->>'Pascol Weight' as pascol_weight,
               raw_data->>'Operation Type' as op_type, raw_data->>'Condition' as condition
        from shipments_v2
        where product_id='potatoes' and container_number=p_container and loading_date=p_loaded) l), '[]'::jsonb)
  );
$$;

-- grants: authenticated only (anon/PUBLIC revoked — new funcs default EXECUTE to PUBLIC)
revoke all on function public.save_shipment_v2_potato_full(jsonb, jsonb) from public, anon;
revoke all on function public.edit_shipment_v2_potato_full(jsonb, jsonb, uuid[]) from public, anon;
revoke all on function public.get_shipment_v2_potato_container(text, date) from public, anon;
grant execute on function public.save_shipment_v2_potato_full(jsonb, jsonb) to authenticated;
grant execute on function public.edit_shipment_v2_potato_full(jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.get_shipment_v2_potato_container(text, date) to authenticated;

notify pgrst, 'reload schema';
