// DalOS Vision — Shipments v2 · Phase 1 (live read)
// Serves aggregated citrus containers from public.shipments_v2 to the Vision
// citrus listing/detail UI. READ ONLY. Never writes public.shipments.
//
// Auth:   deployed with verify_jwt=true → the Supabase gateway rejects anon
//         before this code runs (Q3: Vision login required). Service-role key
//         stays in function env, never in the client bundle.
// Access: reads public.shipments_v2 ONLY (staging). No touch to shipments.
// Group:  container = (container_number, loading_date)  [Q4 — carta is not
//         unique per container; loading_date has no nulls and is 1 carta each].
//
// Endpoints (single function, selected by ?view=):
//   GET .../citrus-shipments                         → list (all citrus containers)
//   GET .../citrus-shipments?view=detail&container=..&loaded=YYYY-MM-DD → one container's lines
//
// Response shape matches §4.3 of the build spec so the frontend swap is minimal.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Slim column set for the listing (no raw_data → keeps the payload light).
const LIST_COLS = [
  'container_number', 'loading_date', 'carta', 'invoice_no', 'booking_no',
  'client', 'subclient', 'receiving_country', 'receiving_port', 'departure_port',
  'vessel', 'shipping_line', 'agent', 'pack_house',
  'etd', 'eta', 'arrival_date', 'shipping_status', 'matched_inspection_id',
  'pallet_count', 'carton_count', 'net_weight', 'gross_weight',
].join(',');

function num(v: any): number { const n = Number(v); return isNaN(n) ? 0 : n; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

// Fetch every citrus row (PostgREST caps unpaginated reads at 1000 → paginate).
async function fetchAllCitrus(cols: string, extraEq?: Record<string, any>) {
  const out: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from('shipments_v2').select(cols)
      .eq('product_id', 'citrus').range(from, from + 999);
    if (extraEq) for (const [k, v] of Object.entries(extraEq)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const page = data || [];
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

async function buildList() {
  const rows = await fetchAllCitrus(LIST_COLS);
  const groups = new Map<string, any>();
  for (const r of rows) {
    const key = `${r.container_number ?? ''}||${r.loading_date ?? ''}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        ref: r.container_number ?? '',
        carta: r.carta ?? null,
        hdr: {
          client: r.client ?? '', subclient: r.subclient ?? '',
          region: r.receiving_country ?? '', port: r.receiving_port ?? '',
          vessel: r.vessel ?? '', line: r.shipping_line ?? '',
          loaded: r.loading_date ?? '', etd: r.etd ?? '', eta: r.eta ?? '',
          arrival: r.arrival_date ?? '', status: r.shipping_status ?? '',
          invoice: r.invoice_no ?? '', booking: r.booking_no ?? '',
          agent: r.agent ?? '', pack: r.pack_house ?? '',
          departure: r.departure_port ?? '',
        },
        _qc: false, _statuses: new Set<string>(),
        agg: { lines: 0, pallets: 0, cartons: 0, net: 0, gross: 0 },
      };
      groups.set(key, g);
    }
    g.agg.lines += 1;
    g.agg.pallets += num(r.pallet_count);
    g.agg.cartons += num(r.carton_count);
    g.agg.net += num(r.net_weight);
    g.agg.gross += num(r.gross_weight);
    // QC matched fix: matched_inspection_id is NULL (not '') when unmatched.
    if ((r.matched_inspection_id ?? '') !== '') g._qc = true;
    if (r.shipping_status) g._statuses.add(r.shipping_status);
  }
  const containers = [...groups.values()].map((g) => {
    // Surface a mixed-status container honestly rather than hiding it.
    if (g._statuses.size > 1) g.hdr.status = [...g._statuses].join(' / ');
    return {
      ref: g.ref, carta: g.carta, hdr: g.hdr,
      qc: g._qc ? 'Matched' : 'Unmatched',
      agg: {
        lines: g.agg.lines, pallets: g.agg.pallets, cartons: g.agg.cartons,
        net: round2(g.agg.net), gross: round2(g.agg.gross),
      },
    };
  });
  // Newest loaded first (spec §4.2 order by loading_date desc).
  containers.sort((a, b) => String(b.hdr.loaded).localeCompare(String(a.hdr.loaded)));
  return { total: containers.length, containers };
}

const DETAIL_COLS = [
  'id', 'row_key', 'variety', 'daltex_class', 'carton_type',
  'carton_count', 'pallet_count', 'net_weight', 'gross_weight',
  'shipping_status', 'matched_inspection_id', 'raw_data',
].join(',');

async function buildDetail(container: string, loaded: string) {
  const rows = await fetchAllCitrus(DETAIL_COLS, {
    container_number: container, loading_date: loaded,
  });
  const lines = rows.map((r: any) => {
    const rd = r.raw_data || {};
    const g = (k: string) => { const v = rd[k]; return v === undefined || v === '' ? null : v; };
    return {
      id: r.id, row_key: r.row_key,
      variety: r.variety ?? null, class: r.daltex_class ?? null,
      carton_type: r.carton_type ?? null,
      client_class: g('Client Class'), category: g('Category'),
      caliber: g('Caliber'), count_size: g('Count/Size'), lot_no: g('Lot #'),
      cartons: r.carton_count, pallets: r.pallet_count,
      net: r.net_weight, gross: r.gross_weight,
      carton_net: g('Carton Net Weight'), carton_gross: g('Carton Gross Weight'),
      pascol_weight: g('Pascol Weight'), pascol_pct: g('Pascol Weight Actual %'),
      packing_weight: g('Packing Weight'), pascol_net: g('Pascol Net Weight'),
      weight_variance: g('Weight Variance'),
      status: r.shipping_status ?? null,
    };
  }).sort((a, b) => num(b.cartons) - num(a.cartons));
  return { ref: container, loaded, lines };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get('view') || 'list';
    let payload: any;
    if (view === 'detail') {
      const container = url.searchParams.get('container');
      const loaded = url.searchParams.get('loaded');
      if (!container || !loaded) {
        return new Response(JSON.stringify({ error: 'container and loaded are required' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      payload = await buildDetail(container, loaded);
    } else {
      payload = await buildList();
    }
    return new Response(JSON.stringify(payload),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('citrus-shipments error:', err?.message);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
