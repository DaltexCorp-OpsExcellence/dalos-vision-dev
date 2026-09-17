// DalOS Vision — Shipments v2 · Phase 1 (live read)
// Serves citrus containers from public.shipments_v2 to the Vision citrus
// listing/entry form. READ ONLY. Never writes public.shipments.
//
// Auth  (Q3 — Vision login): deployed with verify_jwt=true (gateway blocks
//        tokenless calls) AND an in-code getUser() check so the public anon
//        key alone is rejected — a real signed-in DalOS user is required.
//        Service-role key stays in function env, never in the client bundle.
// Access: reads public.shipments_v2 ONLY (staging). No touch to shipments.
// Group : container = (container_number, loading_date)  [Q4].
//
// Endpoint (one call, matches the frontend's in-memory DATA shape):
//   GET .../citrus-shipments  → { total, generated_at, containers: [ {ref,hdr,lines[]} ] }
// The form opens from already-loaded lines, so no separate detail endpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const J = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Columns needed to build the container + line shape (raw_data carries citrus detail).
const COLS = [
  'container_number', 'carta', 'loading_date', 'invoice_no', 'booking_no',
  'vessel', 'shipping_line', 'client', 'subclient', 'receiving_port',
  'pack_house', 'agent', 'shipper', 'etd', 'eta', 'shipping_status',
  'matched_inspection_id', 'variety', 'daltex_class', 'carton_type',
  'pallet_count', 'carton_count', 'net_weight', 'gross_weight', 'raw_data',
].join(',');

function numOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v); return isNaN(n) ? null : n;
}
function num(v: any): number { const n = Number(v); return isNaN(n) ? 0 : n; }
// DB date (YYYY-MM-DD) → dd/mm/yyyy for the frontend's fmtEta(); loaded stays ISO.
function toDMY(iso: any): string {
  const s = String(iso ?? '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
// raw_data getter: undefined/'' → null so the UI's blank/pending logic works.
const g = (rd: any, k: string) => { const v = rd?.[k]; return v === undefined || v === '' ? null : v; };

async function fetchAllCitrus() {
  const out: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from('shipments_v2').select(COLS)
      .eq('product_id', 'citrus').range(from, from + 999);
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
          carta: r.carta ?? null,
          invoice: r.invoice_no ?? null,
          po: g(rd, 'PO Number'),
          vessel: r.vessel ?? null,
          line: r.shipping_line ?? null,
          booking: r.booking_no ?? null,
          loaded: r.loading_date ?? null,          // YYYY-MM-DD (frontend adds T00:00)
          etd: toDMY(r.etd),
          eta: toDMY(r.eta),
          client: r.client ?? null,
          subclient: r.subclient ?? null,
          port: r.receiving_port ?? null,
          region: g(rd, 'Region'),                 // top-level receiving_country is null for citrus
          pack: r.pack_house ?? null,
          agent: r.agent ?? null,
          shipper: r.shipper ?? null,
          source: g(rd, 'Source Type'),
          status: r.shipping_status ?? null,
          qc: (r.matched_inspection_id ?? '') !== '' ? 'Matched' : 'Unmatched',
        },
        lines: [],
      };
      groups.set(key, c);
    }
    // A container matched to QC on any line is matched.
    if ((r.matched_inspection_id ?? '') !== '') c.hdr.qc = 'Matched';
    c.lines.push({
      cat: g(rd, 'Category'),
      v: r.variety ?? null,
      lot: g(rd, 'Lot #'),
      dc: r.daltex_class ?? null,
      cc: g(rd, 'Client Class'),
      ct: r.carton_type ?? null,
      pk: g(rd, 'Packaging Type'),
      cal: g(rd, 'Caliber'),
      cnt: g(rd, 'Count/Size'),
      pal: num(r.pallet_count),
      ctn: num(r.carton_count),
      net: num(r.net_weight),
      grs: num(r.gross_weight),
      cnw: g(rd, 'Carton Net Weight'),
      cgw: g(rd, 'Carton Gross Weight'),
      pas: g(rd, 'Pascol Weight') ?? '—',          // '—' keeps the "pending weighbridge" logic
      paspct: g(rd, 'Pascol Weight Actual %'),
      packw: g(rd, 'Packing Weight'),
      pasnet: g(rd, 'Pascol Net Weight'),
      vr: g(rd, 'Weight Variance'),
    });
  }
  const containers = [...groups.values()];
  // Biggest line first within a container (matches the snapshot's ordering).
  for (const c of containers) c.lines.sort((a: any, b: any) => num(b.ctn) - num(a.ctn));
  // Newest loaded first.
  containers.sort((a, b) => String(b.hdr.loaded).localeCompare(String(a.hdr.loaded)));
  return containers;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return J({ error: 'Method not allowed' }, 405);

  // Require a real signed-in DalOS user (rejects the public anon key).
  const authz = req.headers.get('Authorization') || '';
  const token = authz.replace(/^Bearer\s+/i, '').trim();
  if (!token) return J({ error: 'Sign in required' }, 401);
  const { data: userRes, error: authErr } = await db.auth.getUser(token);
  if (authErr || !userRes?.user) return J({ error: 'Sign in required' }, 401);

  try {
    const rows = await fetchAllCitrus();
    const containers = buildContainers(rows);
    return J({ total: containers.length, generated_at: new Date().toISOString(), containers });
  } catch (err: any) {
    console.error('citrus-shipments error:', err?.message);
    return J({ error: err?.message || 'Internal error' }, 500);
  }
});
