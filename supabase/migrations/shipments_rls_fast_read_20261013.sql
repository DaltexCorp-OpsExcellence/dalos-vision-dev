-- shipments read speed (NOT APPLIED — needs Tarek's go-ahead; shared prod DB)
-- Problem: policy USING has_product_access(product_id) runs per ROW (SECURITY DEFINER sql fn → 4× has_dashboard_access each),
-- ~0.35 ms/row → 6,192 citrus rows ≈ 2.2 s per 1,000-row page, every page re-filters the whole season.
-- Fix: same rule, evaluated ONCE per query: the list of products this user may read, then product_id = ANY(list).
-- Same visibility: has_product_access(p) for every product in public.products (all 4 shipment product_ids exist there).
create or replace function public.my_readable_shipment_products()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id), '{}') from public.products p where public.has_product_access(p.id);
$$;
revoke execute on function public.my_readable_shipment_products() from public, anon;
grant execute on function public.my_readable_shipment_products() to authenticated;

drop policy if exists shipments_per_product_read on public.shipments;
create policy shipments_per_product_read on public.shipments for select to authenticated
  using (product_id = any ((select public.my_readable_shipment_products())));

drop policy if exists shipments_client_qc_all_products_read on public.shipments;
create policy shipments_client_qc_all_products_read on public.shipments for select to authenticated
  using ((select public.has_role(array['client_qc'::text])));

notify pgrst, 'reload schema';
-- Verify after: per user, count(*) visible before == after (Tarek admin, a packhouse-locked user, a client_qc user, a no-access user);
-- EXPLAIN shows InitPlan (once) not per-row Filter; citrus page < 100 ms.
-- Rollback: recreate the two policies with USING has_product_access(product_id) / has_role(array['client_qc']); drop the function.
