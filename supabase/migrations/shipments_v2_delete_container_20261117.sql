-- shipments_v2_delete_container_20261117
-- Adds delete_shipment_v2_container: deletes ONE whole shipment (all lines of one product + container + loading date)
-- from the Manage screen. The edit RPCs refuse zero lines, so this is the only UI path to remove a container.
--
-- Safety:
--   * same gate as edit: active user + _shipments_v2_can_edit() (admin or active shipments_v2_editors row, never client_qc)
--   * scoped to ONE product + normalised container + loading date (another product on the same key is never touched)
--   * the caller sends the line ids it has open; if the stored set differs (someone added/removed a line) -> 40001, nothing deleted
--   * same advisory lock key as save_shipment_v2_full, plus FOR UPDATE on the rows
--   * every deleted row is copied to audit_log (action 'delete', old_value = full row), like edit_shipment_v2_full;
--     trg_sv2_audit also writes old_row to shipments_v2_audit
--   * EXECUTE: authenticated only (revoked from PUBLIC and anon)
-- No table, column, policy or grant on shipments_v2 changes.

create function public.delete_shipment_v2_container(p_product text, p_container text, p_loaded date, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cn  text := _shipments_v2_norm_cn(p_container);
  v_cur uuid[];
  v_del uuid[];
  v_n   int;
begin
  if not _shipments_v2_active_user() or not _shipments_v2_can_edit() then
    raise exception 'You do not have permission to delete shipments' using errcode = '42501';
  end if;
  if p_product is null or not exists (select 1 from products where id = p_product) then
    raise exception 'delete_shipment_v2_container: unknown product_id %', p_product using errcode = '22023';
  end if;
  if v_cn is null or p_loaded is null then
    raise exception 'Container No. and Loading Date are required' using errcode = '22023';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'delete_shipment_v2_container: no line ids sent' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('shipments_v2|'||p_product||'|'||v_cn||'|'||p_loaded));

  select coalesce(array_agg(id order by id), '{}') into v_cur
    from (select id from shipments_v2
           where product_id = p_product and _shipments_v2_norm_cn(container_number) = v_cn and loading_date = p_loaded
           for update) s;

  if cardinality(v_cur) = 0 then
    raise exception 'Shipment % loaded % was not found', v_cn, p_loaded using errcode = 'P0002';
  end if;
  if not (v_cur @> p_ids and p_ids @> v_cur) then
    raise exception 'This shipment was changed since you opened it % reload and try again', chr(8212) using errcode = '40001';
  end if;

  insert into audit_log(user_id, action, entity_type, entity_id, old_value)
    select auth.uid(), 'delete', 'shipments_v2', s.id::text, to_jsonb(s)
      from shipments_v2 s where s.id = any(v_cur);

  with d as (
    delete from shipments_v2 where id = any(v_cur) and product_id = p_product returning id
  ) select coalesce(array_agg(id order by id), '{}'), count(*) into v_del, v_n from d;

  if v_n <> cardinality(v_cur) then
    raise exception 'Delete affected % of % lines % aborted', v_n, cardinality(v_cur), chr(8212) using errcode = '40001';
  end if;

  return jsonb_build_object('ok', true, 'product_id', p_product, 'container_number', v_cn,
                            'loading_date', p_loaded, 'deleted', v_n, 'deleted_ids', to_jsonb(v_del));
end
$function$;

revoke all on function public.delete_shipment_v2_container(text, text, date, uuid[]) from public, anon;
grant execute on function public.delete_shipment_v2_container(text, text, date, uuid[]) to authenticated;

notify pgrst, 'reload schema';
