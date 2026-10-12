-- ============================================================================
-- shipments_v2_hardening  — APPLIED to shared project 2026-10-12 (apply_migration name: shipments_v2_hardening)
-- Follow-up applied same day: shipments_v2_int_thousands_fix.sql (_shipments_v2_int strips ',' — "1,664" = 1664).
-- Pre-merge hardening of the Shipments v2 RPCs after the 4-agent review.
--
-- SCOPE: touches ONLY public.shipments_v2 + its RPCs/helpers.
--        public.shipments is NEVER written (Phase 1–3 hard rule). It is not
--        even read here. RPC signatures and return shapes are UNCHANGED, so the
--        staging pages keep working without a client deploy.
--
-- Fixes:
--   P1  authz: every RPC now checks the caller (was: any signed-in user).
--         read  = active user AND (editor OR has_product_access(product) OR client_qc)
--               (mirrors the read policies on public.shipments)
--         write = active user with an editor role  -> _shipments_v2_can_edit()
--   P1  edit scoped to ONE voyage: every line id / deleted id must belong to
--       (product, container_number, loading_date) from the header, else raise.
--       => no cross-voyage delete/re-parent, no re-keying, no product switch.
--   P1  stale-form guard: every existing voyage row must be in p_lines or
--       p_deleted_ids, else raise 40001 (someone else changed it — reload).
--   P1  raw_data is MERGED (raw_data || new), never replaced; original
--       'Entered' marker preserved. Sheet-only keys (JDE Code, Seg_*, …) survive.
--   P1  typed fields the form doesn't send (color, punnet_count, variety_type)
--       are only overwritten when the key is present in the payload.
--   P2  create refuses an existing voyage (23505) instead of silently merging.
--   P2  container_number normalised (trim, collapse spaces, upper) on write
--       and on lookup.
--   P2  season follows Vision's season tag: create REQUIRES the client-sent
--       season_id (the viewed season, like every other Vision save) and
--       validates it — no silent fallback to the active season. Edit keeps the
--       voyage's existing season unless a valid season_id is sent.
--   P2  numbers normalised server-side: Arabic-Indic digits, Arabic decimal
--       separator, comma decimals, thousands separators -> clear error text
--       instead of a raw 22P02.
--   P2  audit: created_by / updated_by / updated_at columns; full old row
--       written to audit_log before every update and delete (recoverable).
--   P3  get_* header picks a deterministic row; potato edit validates p_lines.
--   P3  revoke leftover anon/authenticated table grants on shipments_v2 and
--       anon/PUBLIC EXECUTE on the raw_data builders; pin search_path.
--
-- Editor roles: admin, power_user, commercial (Tarek 2026-10-12: include Emad's role = commercial).
--   Change it in ONE place: _shipments_v2_can_edit().
-- ============================================================================

begin;

-- ---------------------------------------------------------------- audit cols
alter table public.shipments_v2
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz;

-- ------------------------------------------------------------------ helpers
create or replace function public._shipments_v2_norm_cn(p text)
returns text language sql immutable set search_path = public as $$
  select nullif(upper(regexp_replace(btrim(coalesce(p,'')), '\s+', ' ', 'g')), '')
$$;

-- numeric: Arabic-Indic digits -> ASCII, Arabic decimal sep (U+066B) -> '.',
-- Arabic thousands sep (U+066C) and spaces stripped; a single ',' with no '.'
-- is a decimal comma, otherwise ',' is a thousands separator.
create or replace function public._shipments_v2_num(p text, p_field text default 'value')
returns numeric language plpgsql immutable set search_path = public as $$
declare s text;
begin
  s := btrim(coalesce(p,''));
  if s = '' then return null; end if;
  s := translate(s, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫', '01234567890123456789.');
  s := replace(replace(s, '٬', ''), ' ', '');
  if position('.' in s) = 0 and length(s) - length(replace(s, ',', '')) = 1 then
    s := replace(s, ',', '.');
  else
    s := replace(s, ',', '');
  end if;
  if s !~ '^-?[0-9]+(\.[0-9]+)?$' then
    raise exception 'Invalid number for %: "%"', p_field, p using errcode = '22P02';
  end if;
  return s::numeric;
end $$;

create or replace function public._shipments_v2_int(p text, p_field text default 'value')
returns int language plpgsql immutable set search_path = public as $$
declare n numeric := public._shipments_v2_num(p, p_field);
begin
  if n is null then return null; end if;
  if n <> trunc(n) then
    raise exception '% must be a whole number: "%"', p_field, p using errcode = '22P02';
  end if;
  return n::int;
end $$;

create or replace function public._shipments_v2_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and active = true)
$$;

-- >>> editor roles live here (single source of truth) <<<
create or replace function public._shipments_v2_can_edit()
returns boolean language sql stable security definer set search_path = public as $$
  select has_role(array['admin','power_user','commercial'])
$$;

create or replace function public._shipments_v2_can_read(p_product text)
returns boolean language sql stable security definer set search_path = public as $$
  select _shipments_v2_active_user()
     and (_shipments_v2_can_edit()
          or has_product_access(p_product)
          or has_role(array['client_qc']))
$$;

-- season: validate a client-sent season_id; null when absent.
create or replace function public._shipments_v2_season(p_header jsonb)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid := nullif(p_header->>'season_id','')::uuid;
begin
  if v is not null and not exists (select 1 from seasons where id = v) then
    raise exception 'Unknown season_id %', v using errcode = '22023';
  end if;
  return v;
end $$;


-- pin search_path on the pure raw_data builders (bodies unchanged)
alter function public._shipments_v2_raw_data(jsonb, jsonb, numeric)        set search_path = public;
alter function public._shipments_v2_potato_raw_data(jsonb, jsonb, numeric) set search_path = public;

-- ========================================================= ORCHARDS: create
create or replace function public.save_shipment_v2_full(p_header jsonb, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  v_prod text := p_header->>'product_id';
  v_cn   text := _shipments_v2_norm_cn(p_header->>'container_number');
  v_ld   date := nullif(p_header->>'loading_date','')::date;
  v_season uuid;
  v_total_net numeric := 0; v_line jsonb; v_id uuid; v_ids uuid[] := '{}'; v_pct numeric;
begin
  if not _shipments_v2_active_user() or not _shipments_v2_can_edit() then
    raise exception 'You do not have permission to create shipments' using errcode = '42501';
  end if;
  if v_prod is null or v_prod = 'potatoes' or not exists (select 1 from products where id = v_prod) then
    raise exception 'save_shipment_v2_full: unknown product_id %', v_prod using errcode = '22023';
  end if;
  if v_cn is null or v_ld is null then
    raise exception 'Container No. and Loading Date are required' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'save_shipment_v2_full: at least one line required' using errcode = '22023';
  end if;
  -- serialise concurrent creates of the same voyage, then refuse duplicates
  perform pg_advisory_xact_lock(hashtext('shipments_v2|'||v_prod||'|'||v_cn||'|'||v_ld));
  if exists (select 1 from shipments_v2
             where product_id = v_prod and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = v_ld) then
    raise exception 'Shipment % loaded % already exists — open it from the list to edit', v_cn, v_ld
      using errcode = '23505';
  end if;
  v_season := _shipments_v2_season(p_header);
  if v_season is null then
    raise exception 'Select a season before saving (season_id missing)' using errcode = '22023';
  end if;

  select coalesce(sum(_shipments_v2_num(l->>'net_weight','Net Weight')), 0) into v_total_net
    from jsonb_array_elements(p_lines) l;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_id := gen_random_uuid();
    v_pct := case when v_total_net > 0
                  then round(coalesce(_shipments_v2_num(v_line->>'net_weight','Net Weight'),0) / v_total_net, 6) end;
    insert into shipments_v2(
      id,row_key,product_id,season_id,container_number,carta,pack_house,variety,color,daltex_class,carton_type,
      loading_date,client,subclient,vessel,etd,eta,arrival_date,receiving_country,receiving_port,shipping_status,
      carton_count,pallet_count,punnet_count,net_weight,gross_weight,variety_type,traceability_code,farm_source,
      shipper,agent,shipping_line,booking_no,invoice_no,departure_port,brand,size,carton_net_weight,raw_data,
      synced_at,created_at,created_by)
    values(
      v_id, md5(gen_random_uuid()::text || clock_timestamp()::text), v_prod, v_season,
      v_cn, p_header->>'carta', v_line->>'pack_house',
      v_line->>'variety', v_line->>'color', v_line->>'daltex_class', v_line->>'carton_type',
      v_ld, p_header->>'client', p_header->>'subclient', p_header->>'vessel',
      nullif(p_header->>'etd','')::date, nullif(p_header->>'eta','')::date, nullif(p_header->>'arrival_date','')::date,
      p_header->>'receiving_country', p_header->>'receiving_port', p_header->>'shipping_status',
      _shipments_v2_int(v_line->>'carton_count','Cartons'), _shipments_v2_int(v_line->>'pallet_count','Pallets'),
      _shipments_v2_int(v_line->>'punnet_count','Punnets'),
      _shipments_v2_num(v_line->>'net_weight','Net Weight'), _shipments_v2_num(v_line->>'gross_weight','Gross Weight'),
      p_header->>'variety_type', v_line->>'traceability_code',
      coalesce(v_line->>'raw_source', v_line->>'source_type'),
      p_header->>'shipper', p_header->>'agent', p_header->>'shipping_line', p_header->>'booking_no', p_header->>'invoice_no',
      p_header->>'departure_port', v_line->>'brand', v_line->>'count_size',
      _shipments_v2_num(v_line->>'carton_net_weight','Carton Net Weight'),
      _shipments_v2_raw_data(p_header, v_line, v_pct), now(), now(), auth.uid());
    v_ids := array_append(v_ids, v_id);
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids),
    'container_number', v_cn, 'loading_date', v_ld, 'lines', jsonb_array_length(p_lines));
end $function$;

-- =========================================================== ORCHARDS: edit
create or replace function public.edit_shipment_v2_full(p_header jsonb, p_lines jsonb, p_deleted_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  v_prod text := p_header->>'product_id';
  v_cn   text := _shipments_v2_norm_cn(p_header->>'container_number');
  v_ld   date := nullif(p_header->>'loading_date','')::date;
  v_del  uuid[] := coalesce(p_deleted_ids, '{}');
  v_season uuid; v_voyage_season uuid;
  v_voyage uuid[]; v_sent uuid[];
  v_total_net numeric := 0; v_line jsonb; v_id uuid; v_pct numeric;
  v_updated int := 0; v_inserted int := 0; v_deleted int := 0;
begin
  if not _shipments_v2_active_user() or not _shipments_v2_can_edit() then
    raise exception 'You do not have permission to edit shipments' using errcode = '42501';
  end if;
  if v_prod is null or v_prod = 'potatoes' or not exists (select 1 from products where id = v_prod) then
    raise exception 'edit_shipment_v2_full: unknown product_id %', v_prod using errcode = '22023';
  end if;
  if v_cn is null or v_ld is null then
    raise exception 'Container No. and Loading Date are required' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'edit_shipment_v2_full: at least one line required' using errcode = '22023';
  end if;

  -- lock + collect the voyage's current rows
  perform 1 from shipments_v2
    where product_id = v_prod and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = v_ld
    for update;
  select coalesce(array_agg(id), '{}'), (array_agg(season_id order by created_at, id))[1]
    into v_voyage, v_voyage_season
    from shipments_v2
    where product_id = v_prod and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = v_ld;
  if cardinality(v_voyage) = 0 then
    raise exception 'Shipment % loaded % not found (Container No., Loading Date and product cannot be changed in edit)',
      v_cn, v_ld using errcode = 'P0002';
  end if;

  select coalesce(array_agg(nullif(l->>'id','')::uuid) filter (where nullif(l->>'id','') is not null), '{}')
    into v_sent from jsonb_array_elements(p_lines) l;

  if cardinality(v_sent) <> (select count(distinct x) from unnest(v_sent) x) then
    raise exception 'Duplicate line id in payload' using errcode = '22023';
  end if;
  if v_sent && v_del then
    raise exception 'A line cannot be both kept and deleted' using errcode = '22023';
  end if;
  -- every id sent must belong to THIS voyage
  if exists (select unnest(v_sent) except select unnest(v_voyage))
     or exists (select unnest(v_del) except select unnest(v_voyage)) then
    raise exception 'Line does not belong to shipment % loaded % (Container No., Loading Date and product cannot be changed in edit)',
      v_cn, v_ld using errcode = '42501';
  end if;
  -- every current voyage row must be accounted for (stale-form guard)
  if exists (select unnest(v_voyage) except (select unnest(v_sent) union select unnest(v_del))) then
    raise exception 'This shipment was changed since you opened it — reload and re-apply your edit'
      using errcode = '40001';
  end if;

  v_season := coalesce(_shipments_v2_season(p_header), v_voyage_season);

  -- audit: full old rows before they change or disappear
  insert into audit_log(user_id, action, entity_type, entity_id, old_value)
    select auth.uid(), case when s.id = any(v_del) then 'delete' else 'update' end,
           'shipments_v2', s.id::text, to_jsonb(s)
      from shipments_v2 s where s.id = any(v_voyage);

  if cardinality(v_del) > 0 then
    delete from shipments_v2 where id = any(v_del) and product_id = v_prod;
    get diagnostics v_deleted = row_count;
  end if;

  select coalesce(sum(_shipments_v2_num(l->>'net_weight','Net Weight')), 0) into v_total_net
    from jsonb_array_elements(p_lines) l;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pct := case when v_total_net > 0
                  then round(coalesce(_shipments_v2_num(v_line->>'net_weight','Net Weight'),0) / v_total_net, 6) end;
    v_id := nullif(v_line->>'id','')::uuid;
    if v_id is not null then
      update shipments_v2 set
        container_number = v_cn, carta = p_header->>'carta',
        pack_house       = v_line->>'pack_house',
        variety = v_line->>'variety',
        color        = case when v_line ? 'color' then v_line->>'color' else color end,
        daltex_class = v_line->>'daltex_class', carton_type = v_line->>'carton_type',
        season_id = v_season,
        client = p_header->>'client', subclient = p_header->>'subclient', vessel = p_header->>'vessel',
        etd = nullif(p_header->>'etd','')::date, eta = nullif(p_header->>'eta','')::date,
        arrival_date = nullif(p_header->>'arrival_date','')::date,
        receiving_country = p_header->>'receiving_country', receiving_port = p_header->>'receiving_port',
        shipping_status = p_header->>'shipping_status',
        carton_count = _shipments_v2_int(v_line->>'carton_count','Cartons'),
        pallet_count = _shipments_v2_int(v_line->>'pallet_count','Pallets'),
        punnet_count = case when v_line ? 'punnet_count'
                            then _shipments_v2_int(v_line->>'punnet_count','Punnets') else punnet_count end,
        net_weight   = _shipments_v2_num(v_line->>'net_weight','Net Weight'),
        gross_weight = _shipments_v2_num(v_line->>'gross_weight','Gross Weight'),
        variety_type = case when p_header ? 'variety_type' then p_header->>'variety_type' else variety_type end,
        traceability_code = v_line->>'traceability_code',
        farm_source      = coalesce(v_line->>'raw_source', v_line->>'source_type'),
        shipper = p_header->>'shipper', agent = p_header->>'agent', shipping_line = p_header->>'shipping_line',
        booking_no = p_header->>'booking_no', invoice_no = p_header->>'invoice_no', departure_port = p_header->>'departure_port',
        brand = v_line->>'brand', size = v_line->>'count_size',
        carton_net_weight = _shipments_v2_num(v_line->>'carton_net_weight','Carton Net Weight'),
        -- MERGE: keep sheet-only keys + the original 'Entered' marker
        raw_data   = coalesce(raw_data, '{}'::jsonb) || (_shipments_v2_raw_data(p_header, v_line, v_pct) - 'Entered'),
        updated_by = auth.uid(), updated_at = now()
      where id = v_id and product_id = v_prod;
      if found then v_updated := v_updated + 1; end if;
    else
      insert into shipments_v2(
        id,row_key,product_id,season_id,container_number,carta,pack_house,variety,color,daltex_class,carton_type,
        loading_date,client,subclient,vessel,etd,eta,arrival_date,receiving_country,receiving_port,shipping_status,
        carton_count,pallet_count,punnet_count,net_weight,gross_weight,variety_type,traceability_code,farm_source,
        shipper,agent,shipping_line,booking_no,invoice_no,departure_port,brand,size,carton_net_weight,raw_data,
        synced_at,created_at,created_by)
      values(
        gen_random_uuid(), md5(gen_random_uuid()::text||clock_timestamp()::text), v_prod, v_season,
        v_cn, p_header->>'carta', v_line->>'pack_house', v_line->>'variety', v_line->>'color',
        v_line->>'daltex_class', v_line->>'carton_type', v_ld, p_header->>'client',
        p_header->>'subclient', p_header->>'vessel', nullif(p_header->>'etd','')::date, nullif(p_header->>'eta','')::date,
        nullif(p_header->>'arrival_date','')::date, p_header->>'receiving_country', p_header->>'receiving_port', p_header->>'shipping_status',
        _shipments_v2_int(v_line->>'carton_count','Cartons'), _shipments_v2_int(v_line->>'pallet_count','Pallets'),
        _shipments_v2_int(v_line->>'punnet_count','Punnets'),
        _shipments_v2_num(v_line->>'net_weight','Net Weight'), _shipments_v2_num(v_line->>'gross_weight','Gross Weight'),
        p_header->>'variety_type',
        v_line->>'traceability_code', coalesce(v_line->>'raw_source', v_line->>'source_type'), p_header->>'shipper', p_header->>'agent',
        p_header->>'shipping_line', p_header->>'booking_no', p_header->>'invoice_no', p_header->>'departure_port',
        v_line->>'brand', v_line->>'count_size', _shipments_v2_num(v_line->>'carton_net_weight','Carton Net Weight'),
        _shipments_v2_raw_data(p_header, v_line, v_pct), now(), now(), auth.uid());
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  if v_updated <> cardinality(v_sent) then   -- belt-and-braces; guards above should make this unreachable
    raise exception 'Edit affected % of % existing lines — aborted', v_updated, cardinality(v_sent) using errcode = '40001';
  end if;
  return jsonb_build_object('ok',true,'updated',v_updated,'inserted',v_inserted,'deleted',v_deleted);
end $function$;

-- ============================================================ ORCHARDS: get
create or replace function public.get_shipment_v2_container(p_container text, p_loaded date, p_product text default 'citrus')
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v_cn text := _shipments_v2_norm_cn(p_container);
begin
  if not _shipments_v2_can_read(p_product) then
    raise exception 'You do not have access to % shipments', p_product using errcode = '42501';
  end if;
  return jsonb_build_object(
    'header', (select to_jsonb(h) from (
        select container_number, carta, loading_date, shipping_status, vessel, shipping_line,
               booking_no, invoice_no, raw_data->>'PO Number' as po_number, etd, eta, arrival_date,
               departure_port,
               coalesce(receiving_country, nullif(raw_data->>'Region','')) as receiving_country,
               receiving_port, client, subclient, agent, shipper,
               raw_data->>'Pack House (Departure)' as pack_house_departure, product_id, season_id
        from shipments_v2
        where product_id = p_product and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = p_loaded
        order by created_at, id
        limit 1) h),
    'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.carton_count desc nulls last) from (
        select id, variety, raw_data->>'Category' as category, raw_data->>'Lot #' as lot,
               daltex_class, raw_data->>'Client Class' as client_class, carton_type, brand,
               raw_data->>'Packaging Type' as packaging_type, raw_data->>'Caliber' as caliber,
               size as count_size, pallet_count, carton_count, net_weight, gross_weight,
               carton_net_weight, raw_data->>'Carton Gross Weight' as carton_gross_weight,
               raw_data->>'Pascol Weight' as pascol_weight, raw_data->>'Pascol Weight Actual %' as pascol_pct,
               raw_data->>'Packing Weight' as packing_weight, raw_data->>'Pascol Net Weight' as pascol_net,
               raw_data->>'Weight Variance' as weight_variance, traceability_code,
               pack_house,
               raw_data->>'Source Type' as source_type,
               coalesce(farm_source, raw_data->>'Raw Source') as raw_source
        from shipments_v2
        where product_id = p_product and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = p_loaded) l), '[]'::jsonb)
  );
end $function$;

-- ================================================================ ref lists
-- Non-editors get the same shape with empty arrays (never raises: a failure
-- here would blank the mobile list — reviewer P3 #11).
create or replace function public.get_shipment_v2_ref_options()
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v jsonb;
begin
  if not (_shipments_v2_active_user() and _shipments_v2_can_edit()) then
    return jsonb_build_object('lines','[]'::jsonb,'agents','[]'::jsonb,'dep_ports','[]'::jsonb,'rec_ports','[]'::jsonb,
      'countries','[]'::jsonb,'shippers','[]'::jsonb,'source_types','[]'::jsonb,'raw_sources','[]'::jsonb);
  end if;
  with d as (
    select
      nullif(btrim(shipping_line),'')   as line,
      nullif(btrim(agent),'')           as agent,
      nullif(btrim(departure_port),'')  as depport,
      nullif(btrim(receiving_port),'')  as recport,
      coalesce(nullif(btrim(receiving_country),''), nullif(btrim(raw_data->>'Region'),'')) as country,
      nullif(btrim(shipper),'')                   as shipper,
      nullif(btrim(raw_data->>'Source Type'),'')  as source_type,
      nullif(btrim(farm_source),'')               as raw_source
    from public.shipments_v2
  )
  select jsonb_build_object(
    'lines',        (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct line        as x from d where line        is not null) s),
    'agents',       (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct agent       as x from d where agent       is not null) s),
    'dep_ports',    (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct depport     as x from d where depport     is not null) s),
    'rec_ports',    (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct recport     as x from d where recport     is not null) s),
    'countries',    (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct country     as x from d where country     is not null) s),
    'shippers',     (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct shipper     as x from d where shipper     is not null) s),
    'source_types', (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct source_type as x from d where source_type is not null) s),
    'raw_sources',  (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (select distinct raw_source  as x from d where raw_source  is not null) s)
  ) into v;
  return v;
end $function$;

-- ========================================================== POTATOES: create
create or replace function public.save_shipment_v2_potato_full(p_header jsonb, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  v_cn text := _shipments_v2_norm_cn(p_header->>'container_number');
  v_ld date := nullif(p_header->>'loading_date','')::date;
  v_season uuid;
  v_total_net numeric := 0; v_line jsonb; v_id uuid; v_ids uuid[] := '{}'; v_pct numeric; v_pkgs int;
begin
  if not _shipments_v2_active_user() or not _shipments_v2_can_edit() then
    raise exception 'You do not have permission to create shipments' using errcode = '42501';
  end if;
  if v_cn is null or v_ld is null then
    raise exception 'Container No. and Loading Date are required' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'save_shipment_v2_potato_full: at least one line required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('shipments_v2|potatoes|'||v_cn||'|'||v_ld));
  if exists (select 1 from shipments_v2
             where product_id = 'potatoes' and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = v_ld) then
    raise exception 'Shipment % loaded % already exists — open it from the list to edit', v_cn, v_ld
      using errcode = '23505';
  end if;
  v_season := _shipments_v2_season(p_header);
  if v_season is null then
    raise exception 'Select a season before saving (season_id missing)' using errcode = '22023';
  end if;
  select coalesce(sum(_shipments_v2_num(l->>'standard_weight','Standard Weight')), 0) into v_total_net
    from jsonb_array_elements(p_lines) l;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_id := gen_random_uuid();
    v_pct := case when v_total_net > 0
                  then round(coalesce(_shipments_v2_num(v_line->>'standard_weight','Standard Weight'),0) / v_total_net, 6) end;
    v_pkgs := coalesce(_shipments_v2_int(v_line->>'jumbo_count','Jumbo Count'),0)
            + coalesce(_shipments_v2_int(v_line->>'sack_count','Sack Count'),0);
    insert into shipments_v2(
      id,row_key,product_id,season_id,container_number,carta,pack_house,variety,carton_type,
      loading_date,client,vessel,receiving_country,receiving_port,shipping_status,
      carton_count,pallet_count,net_weight,farm_source,invoice_no,brand,size,raw_data,synced_at,created_at,created_by)
    values(
      v_id, md5(gen_random_uuid()::text || clock_timestamp()::text), 'potatoes', v_season,
      v_cn, p_header->>'carta', p_header->>'station',
      v_line->>'variety', v_line->>'packaging',
      v_ld, p_header->>'client', p_header->>'vessel',
      p_header->>'receiving_country', p_header->>'receiving_port', null,
      nullif(v_pkgs,0), _shipments_v2_int(v_line->>'pallets','Pallets'),
      _shipments_v2_num(v_line->>'standard_weight','Standard Weight'),
      v_line->>'farm', p_header->>'invoice_no', v_line->>'brand', v_line->>'size2',
      _shipments_v2_potato_raw_data(p_header, v_line, v_pct), now(), now(), auth.uid());
    v_ids := array_append(v_ids, v_id);
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids),
    'container_number', v_cn, 'loading_date', v_ld, 'lines', jsonb_array_length(p_lines));
end $function$;

-- ============================================================ POTATOES: edit
create or replace function public.edit_shipment_v2_potato_full(p_header jsonb, p_lines jsonb, p_deleted_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  v_cn  text := _shipments_v2_norm_cn(p_header->>'container_number');
  v_ld  date := nullif(p_header->>'loading_date','')::date;
  v_del uuid[] := coalesce(p_deleted_ids, '{}');
  v_voyage uuid[]; v_sent uuid[]; v_season uuid; v_voyage_season uuid;
  v_total_net numeric := 0; v_line jsonb; v_id uuid; v_pct numeric; v_pkgs int;
  v_updated int := 0; v_inserted int := 0; v_deleted int := 0;
begin
  if not _shipments_v2_active_user() or not _shipments_v2_can_edit() then
    raise exception 'You do not have permission to edit shipments' using errcode = '42501';
  end if;
  if v_cn is null or v_ld is null then
    raise exception 'Container No. and Loading Date are required' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'edit_shipment_v2_potato_full: at least one line required' using errcode = '22023';
  end if;

  perform 1 from shipments_v2
    where product_id = 'potatoes' and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = v_ld
    for update;
  select coalesce(array_agg(id), '{}'), (array_agg(season_id order by created_at, id))[1]
    into v_voyage, v_voyage_season from shipments_v2
    where product_id = 'potatoes' and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = v_ld;
  if cardinality(v_voyage) = 0 then
    raise exception 'Shipment % loaded % not found (Container No. and Loading Date cannot be changed in edit)',
      v_cn, v_ld using errcode = 'P0002';
  end if;
  select coalesce(array_agg(nullif(l->>'id','')::uuid) filter (where nullif(l->>'id','') is not null), '{}')
    into v_sent from jsonb_array_elements(p_lines) l;
  if cardinality(v_sent) <> (select count(distinct x) from unnest(v_sent) x) then
    raise exception 'Duplicate line id in payload' using errcode = '22023';
  end if;
  if v_sent && v_del then
    raise exception 'A line cannot be both kept and deleted' using errcode = '22023';
  end if;
  if exists (select unnest(v_sent) except select unnest(v_voyage))
     or exists (select unnest(v_del) except select unnest(v_voyage)) then
    raise exception 'Line does not belong to shipment % loaded %', v_cn, v_ld using errcode = '42501';
  end if;
  if exists (select unnest(v_voyage) except (select unnest(v_sent) union select unnest(v_del))) then
    raise exception 'This shipment was changed since you opened it — reload and re-apply your edit'
      using errcode = '40001';
  end if;

  v_season := coalesce(_shipments_v2_season(p_header), v_voyage_season);

  insert into audit_log(user_id, action, entity_type, entity_id, old_value)
    select auth.uid(), case when s.id = any(v_del) then 'delete' else 'update' end,
           'shipments_v2', s.id::text, to_jsonb(s)
      from shipments_v2 s where s.id = any(v_voyage);

  if cardinality(v_del) > 0 then
    delete from shipments_v2 where id = any(v_del) and product_id = 'potatoes';
    get diagnostics v_deleted = row_count;
  end if;

  select coalesce(sum(_shipments_v2_num(l->>'standard_weight','Standard Weight')), 0) into v_total_net
    from jsonb_array_elements(p_lines) l;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pct := case when v_total_net > 0
                  then round(coalesce(_shipments_v2_num(v_line->>'standard_weight','Standard Weight'),0) / v_total_net, 6) end;
    v_pkgs := coalesce(_shipments_v2_int(v_line->>'jumbo_count','Jumbo Count'),0)
            + coalesce(_shipments_v2_int(v_line->>'sack_count','Sack Count'),0);
    v_id := nullif(v_line->>'id','')::uuid;
    if v_id is not null then
      update shipments_v2 set
        container_number = v_cn, carta = p_header->>'carta',
        pack_house = p_header->>'station', variety = v_line->>'variety', carton_type = v_line->>'packaging',
        client = p_header->>'client', vessel = p_header->>'vessel',
        receiving_country = p_header->>'receiving_country', receiving_port = p_header->>'receiving_port',
        carton_count = nullif(v_pkgs,0), pallet_count = _shipments_v2_int(v_line->>'pallets','Pallets'),
        net_weight = _shipments_v2_num(v_line->>'standard_weight','Standard Weight'), farm_source = v_line->>'farm',
        invoice_no = p_header->>'invoice_no', brand = v_line->>'brand', size = v_line->>'size2',
        season_id  = v_season,
        raw_data   = coalesce(raw_data, '{}'::jsonb) || (_shipments_v2_potato_raw_data(p_header, v_line, v_pct) - 'Entered'),
        updated_by = auth.uid(), updated_at = now()
      where id = v_id and product_id = 'potatoes';
      if found then v_updated := v_updated + 1; end if;
    else
      insert into shipments_v2(
        id,row_key,product_id,season_id,container_number,carta,pack_house,variety,carton_type,
        loading_date,client,vessel,receiving_country,receiving_port,shipping_status,
        carton_count,pallet_count,net_weight,farm_source,invoice_no,brand,size,raw_data,synced_at,created_at,created_by)
      values(
        gen_random_uuid(), md5(gen_random_uuid()::text||clock_timestamp()::text), 'potatoes', v_season,
        v_cn, p_header->>'carta', p_header->>'station', v_line->>'variety', v_line->>'packaging',
        v_ld, p_header->>'client', p_header->>'vessel',
        p_header->>'receiving_country', p_header->>'receiving_port', null,
        nullif(v_pkgs,0), _shipments_v2_int(v_line->>'pallets','Pallets'),
        _shipments_v2_num(v_line->>'standard_weight','Standard Weight'),
        v_line->>'farm', p_header->>'invoice_no', v_line->>'brand', v_line->>'size2',
        _shipments_v2_potato_raw_data(p_header, v_line, v_pct), now(), now(), auth.uid());
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  if v_updated <> cardinality(v_sent) then
    raise exception 'Edit affected % of % existing lines — aborted', v_updated, cardinality(v_sent) using errcode = '40001';
  end if;
  return jsonb_build_object('ok',true,'updated',v_updated,'inserted',v_inserted,'deleted',v_deleted);
end $function$;

-- ============================================================= POTATOES: get
create or replace function public.get_shipment_v2_potato_container(p_container text, p_loaded date)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v_cn text := _shipments_v2_norm_cn(p_container);
begin
  if not _shipments_v2_can_read('potatoes') then
    raise exception 'You do not have access to potato shipments' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'header', (select to_jsonb(h) from (
        select container_number, carta, loading_date, product_id, pack_house as station,
               raw_data->>'Sector' as sector, raw_data->>'Season' as season,
               coalesce(receiving_country, nullif(raw_data->>'Region','')) as receiving_country,
               raw_data->>'Country 2' as country2, receiving_port, client, vessel, invoice_no,
               raw_data->>'Permit No' as permit_no, raw_data->>'Work Order' as work_order,
               raw_data->>'Container Count' as container_count
        from shipments_v2
        where product_id='potatoes' and _shipments_v2_norm_cn(container_number) = v_cn and loading_date=p_loaded
        order by created_at, id
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
        where product_id='potatoes' and _shipments_v2_norm_cn(container_number) = v_cn and loading_date=p_loaded) l), '[]'::jsonb)
  );
end $function$;

-- =================================================================== grants
-- Table: access is via SECURITY DEFINER RPCs + the service-role edge fn only.
revoke all on table public.shipments_v2 from anon, authenticated;

-- Internal helpers: owner-only (called from inside SECURITY DEFINER bodies).
revoke all on function public._shipments_v2_norm_cn(text)                         from public, anon, authenticated;
revoke all on function public._shipments_v2_num(text, text)                       from public, anon, authenticated;
revoke all on function public._shipments_v2_int(text, text)                       from public, anon, authenticated;
revoke all on function public._shipments_v2_active_user()                         from public, anon, authenticated;
revoke all on function public._shipments_v2_season(jsonb)                         from public, anon, authenticated;
revoke all on function public._shipments_v2_raw_data(jsonb, jsonb, numeric)       from public, anon, authenticated;
revoke all on function public._shipments_v2_potato_raw_data(jsonb, jsonb, numeric) from public, anon, authenticated;

-- Permission probes: callable by signed-in users (edge fn + future UI gating).
revoke all on function public._shipments_v2_can_edit()      from public, anon;
revoke all on function public._shipments_v2_can_read(text)  from public, anon;
grant execute on function public._shipments_v2_can_edit()     to authenticated;
grant execute on function public._shipments_v2_can_read(text) to authenticated;

-- Public RPCs: authenticated only (body enforces the real check).
revoke all on function public.save_shipment_v2_full(jsonb, jsonb)                       from public, anon;
revoke all on function public.edit_shipment_v2_full(jsonb, jsonb, uuid[])               from public, anon;
revoke all on function public.get_shipment_v2_container(text, date, text)               from public, anon;
revoke all on function public.get_shipment_v2_ref_options()                             from public, anon;
revoke all on function public.save_shipment_v2_potato_full(jsonb, jsonb)                from public, anon;
revoke all on function public.edit_shipment_v2_potato_full(jsonb, jsonb, uuid[])        from public, anon;
revoke all on function public.get_shipment_v2_potato_container(text, date)              from public, anon;
grant execute on function public.save_shipment_v2_full(jsonb, jsonb)                to authenticated;
grant execute on function public.edit_shipment_v2_full(jsonb, jsonb, uuid[])        to authenticated;
grant execute on function public.get_shipment_v2_container(text, date, text)        to authenticated;
grant execute on function public.get_shipment_v2_ref_options()                      to authenticated;
grant execute on function public.save_shipment_v2_potato_full(jsonb, jsonb)         to authenticated;
grant execute on function public.edit_shipment_v2_potato_full(jsonb, jsonb, uuid[]) to authenticated;
grant execute on function public.get_shipment_v2_potato_container(text, date)       to authenticated;

commit;

notify pgrst, 'reload schema';
