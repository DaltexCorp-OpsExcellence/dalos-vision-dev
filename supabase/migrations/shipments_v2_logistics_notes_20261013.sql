-- Shipments Manage: Logistics Notes (line, free text) — NOT APPLIED, awaiting Tarek's OK.
-- No new column: the copied sheet rows already keep it in raw_data->'Logistics Notes' (2,329 of 8,259 rows).
-- Two functions change, one line each; both start from the LIVE definitions (2026-10-13). Same signatures → OR REPLACE is safe.
--  1) _shipments_v2_raw_data: write p_line->>'logistics_notes' to raw_data 'Logistics Notes'.
--     jsonb_strip_nulls means an older client that doesn't send the key leaves the stored note untouched on edit
--     (edit merges raw_data || new).
--  2) get_shipment_v2_container: return it as lines[].logistics_notes so the form can show/edit it.
-- Never touches public.shipments.

CREATE OR REPLACE FUNCTION public._shipments_v2_raw_data(p_header jsonb, p_line jsonb, p_container_pct numeric)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
    'Pack House (Packing)',  p_line->>'pack_house',
    'Pack House (Departure)',coalesce(p_header->>'pack_house_departure', p_line->>'pack_house'),
    'Source Type',           p_line->>'source_type',
    'Raw Source',            p_line->>'raw_source',
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
    'Logistics Notes',       p_line->>'logistics_notes',                       -- NEW
    'Container %',           case when p_container_pct is not null then p_container_pct::text end,
    'Entered',               'manual'
  ))
$function$;

CREATE OR REPLACE FUNCTION public.get_shipment_v2_container(p_container text, p_loaded date, p_product text DEFAULT 'citrus'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
               coalesce(farm_source, raw_data->>'Raw Source') as raw_source,
               raw_data->>'Logistics Notes' as logistics_notes                -- NEW
        from shipments_v2
        where product_id = p_product and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = p_loaded) l), '[]'::jsonb)
  );
end $function$;

NOTIFY pgrst, 'reload schema';
