// DalOS Vision — Shipments v2 · live read. READ ONLY. Never writes public.shipments.
// Product: ?product=citrus|grapes|mango|pomegranate|potatoes (default citrus).
// Auth: verify_jwt=true + in-code getUser (anon key rejected). Group: (container_number, loading_date).
//
// SOURCE OF TRUTH: this file mirrors the DEPLOYED function (citrus-shipments v4,
// synced 2026-09-28 via get_edge_function). If you change it, deploy it — and
// re-sync here after any dashboard/MCP deploy — so a redeploy from the repo can
// never silently roll back live behaviour (multi-product + potato fields).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const PRODUCTS = ['citrus', 'grapes', 'mango', 'pomegranate', 'potatoes'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const J = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const COLS = [
  'container_number', 'carta', 'loading_date', 'invoice_no', 'booking_no',
  'vessel', 'shipping_line', 'client', 'subclient', 'receiving_country', 'receiving_port',
  'pack_house', 'agent', 'shipper', 'etd', 'eta', 'shipping_status',
  'matched_inspection_id', 'variety', 'daltex_class', 'carton_type', 'farm_source', 'size', 'brand',
  'pallet_count', 'carton_count', 'net_weight', 'gross_weight', 'raw_data',
].join(',');
function num(v: any): number { const n = Number(v); return isNaN(n) ? 0 : n; }
function toDMY(iso: any): string {
  const s = String(iso ?? '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
const g = (rd: any, k: string) => { const v = rd?.[k]; return v === undefined || v === '' ? null : v; };

async function fetchAll(product: string) {
  const out: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from('shipments_v2').select(COLS)
      .eq('product_id', product).range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data || [];
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}
function buildContainers(rows: any[]) {
  const groups = new Map<string, any>();
  for (const r of rows) {
    const rd = r.raw_data || {};
    const key = `${r.container_number ?? ''}||${r.loading_date ?? ''}`;
    let c = groups.get(key);
    if (!c) {
      c = {
        ref: r.container_number ?? '',
        hdr: {
          carta: r.carta ?? null, invoice: r.invoice_no ?? null, po: g(rd, 'PO Number'),
          vessel: r.vessel ?? null, line: r.shipping_line ?? null, booking: r.booking_no ?? null,
          loaded: r.loading_date ?? null, etd: toDMY(r.etd), eta: toDMY(r.eta),
          client: r.client ?? null, subclient: r.subclient ?? null, port: r.receiving_port ?? null,
          region: r.receiving_country ?? g(rd, 'Region'), pack: r.pack_house ?? null,
          agent: r.agent ?? null, shipper: r.shipper ?? null, source: g(rd, 'Source Type'),
          status: r.shipping_status ?? null,
          qc: (r.matched_inspection_id ?? '') !== '' ? 'Matched' : 'Unmatched',
          // potato header extras (null for orchards)
          station: r.pack_house ?? g(rd, 'Station'), sector: g(rd, 'Sector'), season: g(rd, 'Season'),
          permit: g(rd, 'Permit No'), workOrder: g(rd, 'Work Order'), country2: g(rd, 'Country 2'),
        },
        lines: [],
      };
      groups.set(key, c);
    }
    if ((r.matched_inspection_id ?? '') !== '') c.hdr.qc = 'Matched';
    c.lines.push({
      cat: g(rd, 'Category'), v: r.variety ?? null, lot: g(rd, 'Lot #'),
      dc: r.daltex_class ?? null, cc: g(rd, 'Client Class'), ct: r.carton_type ?? null,
      pk: g(rd, 'Packaging Type'), cal: g(rd, 'Caliber'), cnt: g(rd, 'Count/Size'),
      pal: num(r.pallet_count), ctn: num(r.carton_count), net: num(r.net_weight), grs: num(r.gross_weight),
      cnw: g(rd, 'Carton Net Weight'), cgw: g(rd, 'Carton Gross Weight'),
      pas: g(rd, 'Pascol Weight') ?? '—', paspct: g(rd, 'Pascol Weight Actual %'),
      packw: g(rd, 'Packing Weight'), pasnet: g(rd, 'Pascol Net Weight'), vr: g(rd, 'Weight Variance'),
      // potato line extras (null for orchards)
      pivot: g(rd, 'Pivot'), farm: r.farm_source ?? g(rd, 'Farm'), grade: g(rd, 'Grade'),
      size1: g(rd, 'Size 1'), size2: r.size ?? g(rd, 'Size 2'), crop: g(rd, 'Crop Type'),
      jumboN: g(rd, 'Jumbo Count'), sackN: g(rd, 'Sack Count'), op: g(rd, 'Operation Type'),
      cond: g(rd, 'Condition'), brand: r.brand ?? g(rd, 'Brand Name'),
    });
  }
  const containers = [...groups.values()];
  for (const c of containers) c.lines.sort((a: any, b: any) => num(b.ctn) - num(a.ctn));
  containers.sort((a, b) => String(b.hdr.loaded).localeCompare(String(a.hdr.loaded)));
  return containers;
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return J({ error: 'Method not allowed' }, 405);
  const authz = req.headers.get('Authorization') || '';
  const token = authz.replace(/^Bearer\s+/i, '').trim();
  if (!token) return J({ error: 'Sign in required' }, 401);
  const { data: userRes, error: authErr } = await db.auth.getUser(token);
  if (authErr || !userRes?.user) return J({ error: 'Sign in required' }, 401);
  let product = 'citrus';
  try {
    const p = (new URL(req.url).searchParams.get('product') || 'citrus').toLowerCase().trim();
    if (PRODUCTS.indexOf(p) >= 0) product = p;
    else if (p) return J({ error: 'Unknown product' }, 400);
  } catch (_e) { /* keep default */ }
  try {
    const rows = await fetchAll(product);
    const containers = buildContainers(rows);
    return J({ total: containers.length, generated_at: new Date().toISOString(), product, containers });
  } catch (err: any) {
    console.error('citrus-shipments error:', err?.message);
    return J({ error: err?.message || 'Internal error' }, 500);
  }
});
