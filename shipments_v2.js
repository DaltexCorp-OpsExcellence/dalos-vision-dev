/* DalOS Vision — Shipments "Manage" (entry sandbox on public.shipments_v2)
 * ----------------------------------------------------------------------------
 * Ported from the standalone orchards_shipment_desktop/_mobile pages (2026-10-12).
 * Mounted by ShipmentsMgmt (index.html) → window.ShipV2.mount(host, opts).
 *
 *  - Self-contained: the only global is window.ShipV2. All DOM ids are prefixed
 *    "sv2-", all CSS is scoped under .sv2, every listener is on the host (or
 *    removed again on unmount). No inline onclick= — one delegated handler.
 *  - Uses Vision's own supabase client (opts.sb): one login, one token refresh,
 *    and typing here bubbles to Vision's activity listeners (idle heartbeat).
 *    Never calls signOut()/refreshSession().
 *  - Product is fixed by Vision (opts.product) and locked; season follows the
 *    sidebar season (opts.seasonId) like every other Vision save; saving a NEW
 *    shipment into a non-active season asks first (same rule as inspections).
 *  - Reads via edge fn citrus-shipments (?product=&season=); writes ONLY through
 *    save_/edit_shipment_v2_full (server-side authz + voyage-scoped edits).
 *    Never touches public.shipments.
 *  - One responsive UI: table + inline line rows on desktop; cards on phones.
 */
(function(){
'use strict';

var STATUS_OPTS=['Loading','Shipped','On Water','Delivered','Returned'];   /* the container's journey in order, then Returned */
var SNAPSHOT_NOTE='Copied from the live shipment records on 17 Sep 2026.';
var SNAPSHOT_PRODUCTS={citrus:1,grapes:1,mango:1,pomegranate:1};   /* products whose rows were copied in — Potatoes start empty */
var SV2_SEND_DEPARTURE_DATE=false; // enable only after the DB column + RPC mapping are applied (pending Anna/Ash/Tarek)
var SV2_INTAKE_FIELDS_ENABLED=window.SV2_INTAKE_ENABLED===true||!!window.VISION_IS_DEV;   /* prod turns it on with index.html SV2_INTAKE_ENABLED=true */
/* 2026-11-26 (Tarek): Citrus sales Region (sheet column U, the 1st 'Region'; e.g. Daltex LLC, RU & LA, Western Europe, UK) on the
   header. Staging only: index.html SV2_SALES_REGION_ENABLED=VISION_IS_DEV, checked again here. The field stays hidden until the
   managed list 'sales_region' has citrus values (DB step B01 in ~/dalos-script-backups/variety-region-config), so nothing is
   typed that the server would drop. Sent as header key sales_region. */
function salesRegionFlag(){return window.SV2_SALES_REGION_ENABLED===true&&window.VISION_IS_DEV===true;} // intake DB v0.5 is applied: ON on staging (/dalos-vision-dev/ + localhost) only, OFF anywhere else
/* testers: localStorage.setItem('SV2_INTAKE_FIELDS_ENABLED','true') then reload (read once at mount) */
/* Other crops (Vera 2026-11-23): product 'other_crops' = the Potatoes (Pivots) intake + Crop, Cartons # and Benz #.
   ON on the staging host only (index.html SV2_OTHER_CROPS_ENABLED=VISION_IS_DEV, and checked again here). Same check in vision.js.
   The prod address always resolves OFF (otherCropsEnabled). Staging and prod share the one live database. */
/* Saving is ON on staging (OC_WRITES=true, Tarek 2026-11-23 21:30) because the OC DB package is applied. If OC_WRITES is set
   back to false, Save, Save & new, Delete and the list editor only show OC_PENDING. Not a runtime switch. */
var OC_WRITES=true;
var OC_PENDING='Preview: saving turns on after the database step';   /* v0.2 P3 (Pixel): neutral wording, not an error */
function otherCropsEnabled(){
  /* v0.2 (Ash): ON only when index.html's config says so AND this is the staging host (VISION_IS_DEV, set in index.html from
     the address: path /dalos-vision-dev/ or localhost). The prod address always resolves OFF, whatever its config says. */
  return window.SV2_OTHER_CROPS_ENABLED===true;   /* 2026-11-26 (Tarek): index.html decides (staging VISION_IS_DEV, prod explicit) */
}
function intakeFieldsEnabled(){
  if(SV2_INTAKE_FIELDS_ENABLED)return true;
  try{
    var v=window.localStorage&&localStorage.getItem('SV2_INTAKE_FIELDS_ENABLED');
    return v==='true'||v==='1';
  }catch(e){return false;}
}

/* ---------------------------------------------------------------- styles */
var CSS=[
'.sv2{--sv2-glass:color-mix(in srgb,var(--card) 82%,transparent);display:grid;grid-template-columns:minmax(0,1fr);gap:12px;font-size:13px;color:var(--text)}',
'.sv2 *,.sv2 *::before,.sv2 *::after{box-sizing:border-box}',
'.sv2-view{display:none;gap:12px}.sv2-view.on{display:grid;grid-template-columns:minmax(0,1fr)}',
'.sv2 .mono{font-family:var(--font-mono)}',
'.sv2-banner{display:flex;gap:10px;align-items:flex-start;border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.5;background:var(--amber-bg);border:1px solid var(--amber-border);color:#7a4a10}',
'.sv2-banner.info{background:var(--bg2,#f1efe9);border-color:var(--border,#d0cbbe);color:var(--text2,#4a4a44)}.sv2-banner.info b{color:var(--text,#222)}',
'.sv2-banner b{color:#5c360a}.sv2-banner.err{background:var(--red-bg);border-color:var(--red-border);color:var(--red)}.sv2-banner.err b{color:var(--red)}',
'.sv2-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
'.sv2-sp{flex:1}',
'.sv2-search{position:relative;flex:1 1 220px;max-width:340px}',
'.sv2-search input{width:100%;background:var(--card);border:1px solid var(--border2);border-radius:8px;padding:7px 30px 7px 10px;font:13px var(--font-body);color:var(--text);outline:none}',
'.sv2-search input:focus{border-color:var(--accent)}',
'.sv2-search input::-webkit-search-cancel-button{-webkit-appearance:none;display:none}',   /* only the custom ✕ shows */
'.sv2-clr{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;color:var(--text3);cursor:pointer;font-size:13px;display:none;padding:2px 4px}',
'.sv2-search.has .sv2-clr{display:block}',
'.sv2-btn{font:500 13px var(--font-body);border-radius:var(--r);padding:7px 14px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;white-space:nowrap}',
'.sv2-btn:hover{background:var(--accent2);border-color:var(--accent2)}',
'.sv2-btn.sec{background:var(--card);border-color:var(--border2);color:var(--text2)}.sv2-btn.sec:hover{background:var(--bg2)}',
'.sv2-btn.sm{padding:4px 10px;font-size:12px}',
'.sv2-btn:disabled{opacity:.55;cursor:not-allowed}',
'.sv2-btn:focus-visible,.sv2 [data-act]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
'.sv2-vsw{display:inline-flex;background:var(--bg2,#eee);border-radius:8px;padding:2px;gap:2px}',
'.sv2-vsw button{font:500 12px var(--font-body);border:none;background:transparent;color:var(--text3);border-radius:6px;padding:5px 11px;cursor:pointer;min-height:30px}',
'.sv2-vsw button[aria-pressed="true"]{background:var(--card,#fff);color:var(--text);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
'.sv2-reset{font:500 12px var(--font-body);border:1px solid var(--border2);background:var(--card);color:var(--text2);border-radius:20px;padding:4px 11px;cursor:pointer;display:none}.sv2-reset.show{display:inline-block}',
'.sv2-fsels{display:flex;flex-wrap:wrap;gap:8px}',
'.sv2 .sv2-fsel{width:172px;padding:7px 8px 7px 10px;border-radius:8px;text-overflow:ellipsis}',
'.sv2 .sv2-fsel.on{border-color:var(--accent);color:var(--accent);background-color:var(--green-bg)}',
'.sv2-tw{overflow-x:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--r2)}',
'.sv2-tbl{border-collapse:collapse;width:100%;min-width:900px;font-size:12.5px}',
'.sv2-tbl th{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);text-align:left;padding:8px 10px;border-bottom:2px solid var(--border2);font-weight:600;white-space:nowrap;user-select:none}',
'.sv2-tbl th.srt{cursor:pointer}.sv2-tbl th.act{color:var(--accent)}.sv2-tbl th .ar{margin-left:4px;opacity:.6}',
'.sv2-tbl td{padding:8px 10px;border-bottom:1px solid var(--bg2);color:var(--text2);vertical-align:top}',
'.sv2-tbl tbody tr:last-child td{border-bottom:none}',
'.sv2-tbl tbody tr[data-act]{cursor:pointer}.sv2-tbl tbody tr[data-act]:hover td{background:var(--bg)}',
'.sv2-tbl .num{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums}',
'.sv2-ref{font-family:var(--font-mono);color:var(--text);font-size:12px}',
'.sv2-sub{display:block;font-size:10.5px;color:var(--text3)}',
'.sv2-hl{background:#fbe9a8;border-radius:2px}',
'.sv2-tags{display:flex;flex-wrap:wrap;gap:3px}.sv2-tg{font-size:10.5px;padding:0 6px;border-radius:4px;background:var(--bg2);color:var(--text2)}',
'.sv2-pill{font-size:11px;font-weight:500;padding:1px 8px;border-radius:20px;border:1px solid;white-space:nowrap;display:inline-block}',
'.sv2-pill.green{color:var(--green);background:var(--green-bg);border-color:var(--green-border)}',
'.sv2-pill.blue{color:#2a50c0;background:#e8eeff;border-color:#a0b4e8}',
'.sv2-pill.amber{color:#7a4a10;background:var(--amber-bg);border-color:var(--amber-border)}',
'.sv2-pill.neutral{color:var(--text2);background:var(--bg2);border-color:var(--border)}',
'.sv2-w{font-family:var(--font-mono);font-size:10.5px;padding:1px 6px;border-radius:4px}.sv2-w.pend{background:var(--bg2);color:var(--text3)}.sv2-w.ok{background:var(--green-bg);color:var(--green)}.sv2-w.off{background:var(--amber-bg);color:#7a4a10}',
'.sv2-empty{padding:28px 12px;text-align:center;color:var(--text3)}',
'.sv2-note{font-size:11.5px;color:var(--text3)}',
'.sv2-sk{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--bg2),var(--bg3),var(--bg2));background-size:200% 100%;animation:sv2sh 1.2s infinite}',
'@keyframes sv2sh{to{background-position:-200% 0}}',
'@media (prefers-reduced-motion:reduce){.sv2-sk{animation:none}}',
/* cards (phone list + phone lines) */
'.sv2-cards{display:none;gap:8px}',
'.sv2-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:10px 12px;display:grid;gap:3px;font-size:12.5px}',
'.sv2-card[data-act]{cursor:pointer}',
'.sv2-card .t{display:flex;justify-content:space-between;align-items:center;gap:8px}',
/* form */
'.sv2-fbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
'.sv2-back{font:500 12.5px var(--font-body);border:1px solid var(--border);background:var(--card);border-radius:20px;padding:4px 11px;cursor:pointer;color:var(--text2)}',
'.sv2-ftitle{font-family:var(--font-display);font-size:18px}',
'.sv2-dirty{font-size:12px;color:#7a4a10;display:none}.sv2-dirty.on{display:inline}',
'.sv2-ctx{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
'.sv2-chip{font-size:11.5px;padding:2px 9px;border-radius:20px;background:var(--card);border:1px solid var(--border);color:var(--text2)}',
'.sv2-chip.season{border-color:var(--accent2);color:var(--accent)}',
'.sv2-chip .pd{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:0}',
'.sv2-box{background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:12px 14px;display:grid;gap:10px;min-width:0;position:relative}',
'.sv2-st{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--text3)}',
'.sv2-st::before{content:"";width:20px;height:2px;background:var(--accent)}',
'.sv2-st small{font-size:12px;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text2)}',
'.sv2-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 10px}',
'.sv2-f label{display:block;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);margin-bottom:3px}',
'.sv2-f .req,.sv2 .req{color:var(--red)}',
'.sv2-in{width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:6px 9px;font:13px var(--font-body);color:var(--text);outline:none;min-width:0}',
'.sv2-in:focus,.sv2 .cin:focus,.sv2 .csel:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(74,140,98,.18);outline:none}\n.sv2-in.num{font-family:var(--font-mono);text-align:right}',
'.sv2-in.mono{font-family:var(--font-mono);font-size:12.5px}',
'.sv2-in[readonly]{background:var(--bg2);color:var(--text2);cursor:not-allowed}',
'.sv2-in.invalid,.sv2 .cin.invalid,.sv2 .csel.invalid{border-color:var(--red);background:var(--red-bg)}',
'.sv2-derived{display:flex;gap:6px;align-items:center;font-size:11.5px;color:var(--text3)}',
'.sv2-dep{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}',
'.sv2-dep .chk{display:inline-flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;font-size:12.5px;color:var(--text)}',
'.sv2-dep .chk input{width:18px;height:18px;margin:0;accent-color:var(--accent);cursor:pointer}',
'.sv2-dep .hint{font-size:11.5px;color:var(--text3)}.sv2-dep .dd{min-width:180px}',
'.sv2-derived b{font-family:var(--font-mono);color:var(--text2)}',
'.sv2-ar{font-weight:500;font-size:12px;text-transform:none;letter-spacing:0;color:var(--text2);font-family:var(--font-body);unicode-bidi:isolate}',
'.sv2-lab2{display:inline-flex;justify-content:space-between;align-items:baseline;gap:8px;width:calc(100% - 12px)}',
'.sv2-f label .sv2-lab2{width:calc(100% - 14px)}',
'.sv2-lines{border-collapse:collapse;width:100%;min-width:1040px;font-size:12px}.sv2-lines.or{min-width:880px}.sv2-lines.or>tbody>tr>td{vertical-align:top}',
'.sv2-lines th{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--text2);text-align:left;padding:6px 5px;border-bottom:2px solid var(--border2);font-weight:600;white-space:nowrap}',
'.sv2-lines td{padding:4px 5px;border-bottom:1px solid var(--bg2);vertical-align:middle}',
'.sv2 .cin,.sv2 .csel{width:100%;min-width:62px;background:var(--card);border:1px solid var(--border2);border-radius:5px;padding:4px 6px;font:12px var(--font-body);color:var(--text)}',
'.sv2 .sv2-lines .csel[data-k="carton_type"],.sv2 .sv2-lines .csel[data-k="pack_house"]{min-width:150px}',   /* 2026-11-26: carton type / packed at no longer cut in the line table */
'.sv2 .cin.mono,.sv2 .cin.num{font-family:var(--font-mono)}.sv2 .cin.num{text-align:right;min-width:58px}',
'.sv2 .cin.calc{background:transparent;color:var(--text);font-weight:500;border-color:transparent;border-bottom:1px dotted var(--border2);border-radius:0;cursor:default;box-shadow:none}',
'.sv2 .cin.warn,.sv2-in.warn{border-color:var(--amber);background:var(--amber-bg)}',
'.sv2-wgroup{grid-column:1/-1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px 10px;padding:6px 8px;border:1px dashed var(--border2);border-radius:8px;background:var(--bg)}',
'.sv2-wgh{grid-column:1/-1;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text2)}',
'.sv2-wgh small{font-size:12px;text-transform:none;letter-spacing:0;font-weight:400}',
'.sv2-ctnwarn,.sv2-kgwarn{display:none;font-size:12px;color:#7a4a10;background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;padding:6px 10px;flex-basis:100%}',
'.sv2-ctnwarn.on,.sv2-kgwarn.on{display:block}',
'.sv2-ctnwarn.ok,.sv2-pend.ok{color:var(--green);background:var(--green-bg);border-color:var(--green-border)}',   /* 2026-11-26: carton match = green ok state, no layout jump */
'@media (max-width:700px){.sv2-submit .sv2-ctnwarn.ok{display:none!important}}',   /* phones: the ok line would grow the Save bar */
/* r2 P1: plain inline message under a flagged carton weight (warn-only, never blocks save) */
'.sv2-wmsg{font-size:12px;line-height:1.35;color:#7a4a10;margin-top:3px}.sv2-wmsg[hidden]{display:none}',
'.sv2-lines .idx{font-family:var(--font-mono);color:var(--text3)}',
'.sv2-lines tr.sub td,.sv2-lines tr.det td{background:var(--bg);font-size:11.5px}',
'.sv2-lines tr.det{display:none}.sv2-lines tr.det.open{display:table-row}',
'.sv2-lines th.num{text-align:right;padding-right:12px}\n.sv2-lines tfoot td{font-family:var(--font-mono);font-weight:600;text-align:right;background:var(--bg2);padding:7px 12px 7px 5px}',
'.sv2-dgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px 10px;padding:4px 0}',
'.sv2-dlab{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);margin-bottom:3px}',
/* 2026-11-17 layout (mock-up): line panel = Classification / Weight inputs / Results */
'.sv2-u{text-transform:none;letter-spacing:0;font-family:var(--font-mono);font-weight:400;color:var(--text2)}.sv2-echo{font:11px var(--font-mono);color:var(--text2);margin-top:2px;text-align:right;min-height:14px}.sv2-echo.warn{color:#7a4a10}.sv2-echo.hint{font-family:var(--font-body);color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sv2-echo.ok{color:var(--green)}.sv2-auto{font:500 9px var(--font-mono);color:var(--green);background:var(--green-bg);border-radius:3px;padding:1px 4px;margin-left:5px;text-transform:none;letter-spacing:0;vertical-align:1px}.sv2-panel{display:grid;grid-template-columns:2.1fr 1fr 1.5fr;gap:10px;padding:6px 0 10px}.sv2-blk{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:grid;gap:8px;align-content:start;min-width:0}.sv2-bt{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}.sv2-bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px 10px}.sv2-bgrid .s2{grid-column:span 2}.sv2-rgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px}.sv2-pend{grid-column:1/-1;font-size:12px;color:#6e4a0e;background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:6px;padding:6px 9px}.sv2-pend[hidden]{display:none}.sv2-rgrid.pending .cin.calc{color:var(--text3)}.sv2-cat{font-size:11px!important;min-height:0!important;padding:1px 4px!important;margin-bottom:3px;color:var(--text2);border-color:var(--border)!important}.sv2 .rm{opacity:.75}.sv2-goprob{font:500 13px var(--font-body);color:var(--red);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0}.sv2-goprob[hidden]{display:none}.sv2-tot .v small{font-size:13px;color:var(--text2)}.sv2-tot.warn .v,.sv2-tot.warn .v small{color:#7a4a10}.sv2-undo{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#1a1a17;color:#f0ede6;font:13px var(--font-body,sans-serif);padding:8px 10px 8px 16px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25);z-index:91;display:flex;gap:12px;align-items:center}.sv2-undo button{font:600 13px var(--font-body,sans-serif);background:none;border:1px solid #6a8068;color:#c8e6cf;border-radius:6px;padding:4px 10px;cursor:pointer}@media (max-width:1100px){.sv2-panel{grid-template-columns:1fr 1fr}.sv2-panel .sv2-blk:first-child{grid-column:1/-1}}',
'.sv2-cgwraw{font-size:10.5px;color:var(--text3);margin-top:2px}',
'.sv2-ib{border:1px solid var(--border);background:var(--card);border-radius:5px;cursor:pointer;color:var(--text3);font-size:13px;line-height:1;padding:3px 7px}',
'.sv2-ib.open{transform:rotate(180deg)}.sv2-ib.rm:hover{color:var(--red);border-color:var(--red-border)}',
'.sv2-lcards{display:none;gap:8px}',
'.sv2-lcard{border:1px solid var(--border);border-radius:var(--r2);background:var(--bg);display:grid}',
'.sv2-lcard .lh{display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer}',
'.sv2-lcard .lb{display:none;padding:2px 11px 11px;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr))}',
'.sv2-lcard.open .lb{display:grid}',
'.sv2-lcard .lb .full{grid-column:1/-1}',
'.sv2-oc .sv2-lcard .lb>div:not(.full){display:flex;flex-direction:column;justify-content:flex-end}',   /* v0.2 P3 (Pixel): line-card inputs line up when a label wraps to 2 lines */
'.sv2.sv2-ro [data-act="openCreate"],.sv2.sv2-ro [data-act="save"],.sv2.sv2-ro [data-act="saveNew"],.sv2.sv2-ro [data-act="delShip"],.sv2.sv2-ro [data-act="addLine"],.sv2.sv2-ro [data-act="dupLast"],.sv2.sv2-ro [data-act="rmLine"],.sv2.sv2-ro [data-act="ocConfig"],.sv2.sv2-ro .sv2-submit,.sv2.sv2-ro .sv2-dirty{display:none!important}',
'.sv2-qc{display:inline-flex;gap:4px;flex-wrap:wrap}.sv2-qc span{font:600 10.5px var(--font-body);border-radius:10px;padding:2px 7px;white-space:nowrap}',
'.sv2-qc .q-c{background:#e6eef6;color:#2f5f8a}.sv2-qc .q-i{background:#e6f1e8;color:#2e7d46}.sv2-qc .q-n{background:var(--bg2,#f2f2f2);color:var(--text3,#888)}',
'.sv2-submit{position:sticky;bottom:var(--sv2-bottom,8px);z-index:6;box-shadow:0 -2px 18px rgba(26,26,23,.10);display:flex;flex-wrap:wrap;gap:8px 22px;align-items:center;background:#fff;border:1px solid var(--border2);border-radius:var(--r2);padding:10px 14px}',   /* solid: form text never shows through */
'@media (min-width:701px){.sv2-submit .sv2-jdewarn{order:20;flex-basis:100%}}',   /* desktop: JDE warning on its own row, Save shipment no longer wraps */
'.sv2-tot{display:grid}.sv2-tot .k{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text2)}.sv2-tot .v{font:500 18px var(--font-mono);font-variant-numeric:tabular-nums}',
'.sv2-ferr .sv2-banner{align-items:center}',
'.sv2-lstat{display:grid;gap:6px;margin:0 0 8px}.sv2-lstat:empty{display:none}.sv2-lstat .sv2-banner{align-items:center}',
'.sv2-overlay{position:absolute;inset:0;background:color-mix(in srgb,var(--card) 80%,transparent);display:none;align-items:center;justify-content:center;gap:10px;z-index:3;border-radius:var(--r2);font-size:13px;color:var(--text2)}',
'.sv2-overlay.on{display:flex}',
'.sv2-spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--border2);border-top-color:var(--accent);animation:sv2spin .8s linear infinite}',
'@keyframes sv2spin{to{transform:rotate(360deg)}}',
'.sv2-modal{position:fixed;inset:0;z-index:80;background:rgba(26,26,23,.42);display:flex;align-items:center;justify-content:center;padding:16px}',
'.sv2-modal .box{background:var(--card,#fff);border:1px solid var(--border,#d0cbbe);border-radius:var(--r2,12px);width:100%;max-width:420px;padding:20px 22px;box-shadow:0 12px 40px rgba(26,26,23,.28);font:13px var(--font-body,sans-serif);color:var(--text2,#4a4840)}',
'.sv2-modal h3{font-family:var(--font-display,serif);font-weight:400;font-size:19px;color:var(--text,#1a1a17);margin:0 0 10px}',
'.sv2-modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}',
/* Delete shipment (edit mode only) */
'.sv2-btn.sv2-del{color:var(--red);border-color:var(--red-border)}.sv2-btn.sv2-del:hover{background:var(--red-bg)}.sv2-btn.sv2-del[hidden]{display:none}',
'.sv2-btn.sv2-delgo{background:var(--red);border-color:var(--red);color:#fff}.sv2-btn.sv2-delgo:disabled{opacity:.45;cursor:not-allowed}',
'.sv2-modal .sv2-delin{width:100%;margin-top:10px;padding:8px 10px;font:14px var(--font-mono,monospace);border:1px solid var(--border2,#c9c3b4);border-radius:8px;background:var(--card,#fff);color:var(--text,#1a1a17)}',
'.sv2-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#1a1a17;color:#f0ede6;font:13px var(--font-body,sans-serif);padding:9px 16px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25);z-index:90;opacity:0;transition:opacity .2s;pointer-events:none}',
'.sv2-toast.on{opacity:1}',
/* responsive: phones get cards */
'@media (max-width:1100px){.sv2-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'@media (max-width:700px){',
'  .sv2-desk{display:none!important}.sv2-cards,.sv2-lcards{display:grid}',
'  .sv2-grid{grid-template-columns:repeat(2,minmax(0,1fr))}',
'  .sv2-fsels{width:100%}.sv2 .sv2-fsel{flex:1 1 140px;width:0;min-width:0;max-width:100%}',   /* 2026-11-25 P2: a long client/region option no longer widens the list past the screen */
'  .sv2-cards{grid-template-columns:minmax(0,1fr)}.sv2-card{min-width:0;overflow-wrap:anywhere}',
'  .sv2-search{flex-basis:100%;max-width:none}',
'  .sv2-in,.sv2-search input{font-size:16px}',  /* no iOS zoom-on-focus */
'  .sv2-btn,.sv2-back{min-height:40px}',
'  .sv2-submit .sv2-btn{flex-basis:100%}',
/* 2026-11-25 P2 (Pixel, ~389px): the Manage toolbar wraps and '+ New shipment' comes first, full width, every product */
'  #sv2-vlist>.sv2-toolbar>[data-act="openCreate"]{order:-1;flex:1 1 100%}',
'  #sv2-vlist>.sv2-toolbar>.sv2-sp{display:none}',
/* 2026-11-25 P3b (Pixel): compact Save bar on phones (was 170-212px): totals on small inline rows, the two buttons side by side,
   empty warnings take no space, a warning is one line (full text on tap/hover via title). --sv2-footh follows the new height. */
'  .sv2:not(.sv2-oc) .sv2-submit{gap:4px 10px;padding:7px 10px;background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}',   /* solid: fields never show through */
'  .sv2:not(.sv2-oc) .sv2-submit .sv2-tot{display:flex;align-items:baseline;gap:4px;flex:0 0 auto;white-space:nowrap}',
/* 2026-11-25 P3 (Pixel, live 375px with the real fonts: Citrus 172.5px, Grapes/Mango 129.5px): totals on ONE line that scrolls sideways, so the bar
   is the same height at every phone width (totals line + buttons) */
'  .sv2:not(.sv2-oc) .sv2-totrow{display:flex;flex:1 1 100%;min-width:0;flex-wrap:nowrap;gap:0 12px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}',
'  .sv2:not(.sv2-oc) .sv2-totrow::-webkit-scrollbar{display:none}',
/* 2026-11-25 P2 (Pixel, QC): Citrus totals are never behind a swipe on phones: they sit in a 3 x 2 grid (label over value) at every phone width,
   smaller type, 'Variance' for 'Container variance'. Other products keep the one swipe line, with a right-edge fade while more is hidden. */
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap{display:grid;grid-template-columns:repeat(3,minmax(0,auto));justify-content:space-between;gap:2px 10px;overflow:visible}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap .sv2-tot{display:grid;gap:0;white-space:normal;min-width:0}',
'  .sv2:not(.sv2-oc) .sv2-submit:has(.sv2-totrow.wrap){padding-top:5px;padding-bottom:5px;row-gap:3px}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap .sv2-tot .k{font-size:10px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap .sv2-tot .v{font-size:12.5px;line-height:1.15}',
'  .sv2-totrow.wrap .sv2-kl{display:none}.sv2-totrow.wrap .sv2-ks{display:inline}',
/* 2026-11-25 P3a (Pixel, 320px): clearer right-edge fade + a small › while totals are out of view (pinned to the visible edge, takes no extra width) */
'  .sv2 .sv2-totrow.more::after{content:"›";position:sticky;right:0;flex:0 0 auto;align-self:stretch;display:flex;align-items:center;justify-content:flex-end;width:44px;margin-left:-56px;padding-right:1px;background:linear-gradient(to right,rgba(255,255,255,0),#fff 55%);color:var(--text2,#4a4840);font:700 17px/1 var(--font-body,system-ui,sans-serif);pointer-events:none}',
'  .sv2:not(.sv2-oc) .sv2-submit .sv2-tot .k{font-size:11px;letter-spacing:0;text-transform:none;font-weight:500}',
'  .sv2:not(.sv2-oc) .sv2-submit .sv2-tot .v{font-size:13.5px;font-weight:600}',
'  .sv2:not(.sv2-oc) .sv2-submit .sv2-sp{display:none}',
'  .sv2:not(.sv2-oc) .sv2-submit .sv2-btn{flex:1 1 40%;flex-basis:40%;min-height:44px;white-space:nowrap}',
'  .sv2-submit .sv2-ctnwarn,.sv2-submit .sv2-kgwarn,.sv2-submit .sv2-jdewarn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding-top:4px;padding-bottom:4px}',
'  .sv2-submit .sv2-ctnwarn:empty,.sv2-submit .sv2-kgwarn:empty{display:none!important}',
'  .sv2-submit .sv2-ctnwarn.open,.sv2-submit .sv2-kgwarn.open{white-space:normal}.sv2-submit .sv2-ctnwarn,.sv2-submit .sv2-kgwarn{cursor:pointer}',
'  .sv2-submit .sv2-jdewarn{flex-basis:100%;order:-1}',
'}',
'.sv2-toolbar>*{min-width:0;max-width:100%}',
/* r2 P2 (Pixel): <=768px the form lines are cards (no sideways scroll), weights wrap to 2 columns, and the
   form keeps room for the sticky Save bar (--sv2-footh = its measured height, set by placeFoot) */
/* v0.2 P2 (Pixel), Other crops only: the form keeps room under the sticky Save bar (its measured height + 16px) at every width,
   and at <=700px the bar is one compact row (~60px): totals on the left, Save on the right */
'.sv2-oc #sv2-vform.on{padding-bottom:calc(var(--sv2-footh,0px) + var(--sv2-bottom,8px) + 16px)!important}',   /* 2026-11-25 P3: + the bar’s offset above the phone nav */
'.sv2-ocvhint{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:500;color:var(--text2,#4a4840);margin:-4px 0 8px}',   /* 2026-11-25 P3c: AA contrast + info icon */
'.sv2-ocvhint .ic{flex:0 0 auto;display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;border:1.5px solid currentColor;font:700 10px/1 var(--font-body);font-style:normal}',
'.sv2-oc #sv2-vform input,.sv2-oc #sv2-vform select,.sv2-oc #sv2-vform .sv2-btn{scroll-margin-bottom:calc(var(--sv2-footh,0px) + var(--sv2-bottom,8px) + 16px)}',
'.sv2-totrow{display:contents}.sv2-ks{display:none}.sv2-kn{display:none}',
'html.sv2-bar-on .vas-bar{bottom:var(--sv2-pill,14px)}',
'.sv2 .sv2-submit{margin-top:var(--sv2-pillpad,0px)}',   /* 2026-11-25 follow-up: room for the raised pill between the last field and the Save bar (only while the pill exists and the form is open; 0 otherwise) */   /* 2026-11-25 P2b (Pixel): the admin "View Vision as" pill sits above the Save bar while the bar is on screen (offset set by placePill; viewas.js unchanged) */
'.sv2-oc #sv2-lhead th.oc-var,.sv2-oc #sv2-lbody td.oc-var{min-width:190px}',   /* v0.2 P3 (Pixel): wider Variety column on desktop */
'.sv2 .sv2-f.sv2-sregion:not(.on){display:none}',   /* 2026-11-26: Region (sales) shows once its list has values */
'@media (max-width:700px){',
'  .sv2-oc .sv2-submit{flex-wrap:nowrap;gap:10px;padding:7px 10px;min-height:0;background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}',   /* v0.2 P3: solid, labels never show through */
'  .sv2-oc .sv2-ocg>.sv2-f{display:flex;flex-direction:column;justify-content:flex-end}',   /* v0.2 P3: inputs line up when a label wraps to 2 lines */
'  .sv2-oc .sv2-totrow{display:flex;flex-wrap:nowrap;align-items:baseline;gap:0 12px;flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}',   /* 2026-11-25 P3c (Pixel, 375px): one line, swipe + fade like Grapes */
'  .sv2-oc .sv2-totrow::-webkit-scrollbar{display:none}',
'  .sv2-oc .sv2-tot{display:flex;align-items:baseline;gap:4px;flex:0 0 auto;white-space:nowrap}',
'  .sv2-oc .sv2-tot .k{font-size:11px;letter-spacing:0;text-transform:none;font-weight:500}',
'  .sv2-oc .sv2-tot .v{font-size:13.5px;font-weight:600}',
'  .sv2-oc .sv2-submit .sv2-sp{display:none}',
'  .sv2-oc .sv2-submit .sv2-btn{flex:0 0 auto;flex-basis:auto;white-space:nowrap;min-height:44px}',
'  .sv2-oc .sv2-submit .sv2-ctnwarn:empty,.sv2-oc .sv2-submit .sv2-kgwarn:empty{display:none}',
'}',
'@media (max-width:768px){',
'  #sv2-vform .sv2-desk{display:none!important}#sv2-vform .sv2-lcards{display:grid}',
'  .sv2-lcard .sv2-wgroup{grid-template-columns:repeat(2,minmax(0,1fr))}',
'  .sv2-wgroup .sv2-dlab{white-space:normal;overflow-wrap:anywhere}',
'}',
/* 2026-11-25 P3 (Pixel): room for the whole Save bar, incl. its offset above the phone nav. 2026-11-26: every width (was <=768px), so the sticky bar never covers the last heading/fields on desktop */
'#sv2-vform.on{padding-bottom:calc(var(--sv2-footh,0px) + var(--sv2-bottom,8px) + 8px)}',
'#sv2-vform input,#sv2-vform select{scroll-margin-bottom:calc(var(--sv2-footh,0px) + var(--sv2-bottom,8px) + 8px)}',
/* r2 P2: touch layouts — tap targets >= 44px, inputs >= 16px (no iOS zoom-on-focus); this form only */
'@media (max-width:768px),(pointer:coarse){',
'  #sv2-vform .sv2-in,#sv2-vform .cin,#sv2-vform .csel{font-size:16px!important;min-height:44px}',   /* !important: index.html sets 14px!important at >=768px */
'  #sv2-vform .sv2-btn,#sv2-vform .sv2-back,#sv2-vform .lh{min-height:44px}',
'  #sv2-vform .sv2-ib{min-height:44px;min-width:44px}',
'}',
/* r2 P3: <=420px the two loading dates take a full row each (no wrapped labels, no clipped mm/dd/yyyy) */
'.sv2-jrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.sv2-jcopy{display:inline-flex;align-items:center;gap:4px;font:600 11.5px var(--font-body,inherit);color:var(--text2);background:var(--card,#fff);border:1px solid var(--border2,#ccd);border-radius:7px;padding:4px 8px;min-height:28px;cursor:pointer}.sv2-jcopy:hover{color:var(--text);border-color:var(--text3,#999)}.sv2-jcopy:focus-visible{outline:2px solid var(--accent,#1c5c3c);outline-offset:1px}.sv2-jcopy.ok{color:#1c7c3c;border-color:#9fd2ae;background:#eef8f1}'+
'.sv2-jcode{font:600 16px var(--font-mono);letter-spacing:.03em;color:var(--text);padding:4px 0}.sv2-jnote{font-size:11px;color:var(--text2)}.sv2-jwarn{font-size:12.5px;color:#7a4a10;background:#fdf5e6;border:1px solid #ecd3a3;border-radius:8px;padding:6px 9px;margin:2px 0 4px;line-height:1.4}',
'.sv2-jsegs{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.sv2-jseg{display:inline-flex;flex-direction:column;align-items:center;min-width:40px;padding:3px 6px;border:1px solid var(--border,#e2ddd2);border-radius:6px;font-size:10px;color:var(--text2);background:var(--bg,#fbfaf6)}.sv2-jseg b{font:600 12.5px var(--font-mono);color:var(--text)}.sv2-jseg.miss{border-color:#c98a1c;background:#fdf5e6}.sv2-jseg.miss b{color:#7a4a10}',
'.sv2-jdewarn{font-size:13px;color:#7a4a10;font-weight:500}',
'@media (max-width:420px){#sv2-vform .sv2-fdate{grid-column:1/-1}#sv2-vform .sv2-fdate label{white-space:nowrap}}'
,/* Other crops: phone field order + full-width fields as in form-v3-390 (follow-ups P3: the amber "new" tags are gone) */
'@media (max-width:700px){.sv2-ocg .oc-full{grid-column:1/-1}.sv2-ocg .oc-o1{order:1}.sv2-ocg .oc-o2{order:2}.sv2-ocg .oc-o3{order:3}.sv2-ocg .oc-o4{order:4}.sv2-ocg .oc-o5{order:5}.sv2-ocg .oc-o6{order:6}.sv2-ocg .oc-o7{order:7}.sv2-ocg .oc-o8{order:8}.sv2-ocg .oc-o9{order:9}}',
/* follow-ups P3 (Pixel): <=420px (390px phones) Other crops is one column: header fields and line-card fields each take a full row */
/* 2026-11-25 P2a (Pixel, 320px: 'Pascol · Packing t' cut, Net · Gross value on 2 lines, bar 127px): at <=360px Citrus totals are
   row 1 = Lines, Pallets, Cartons (label and value on one line), row 2 = Net · Gross, Pascol, Variance (label over value, second figure under the first) */
'@media (max-width:700px){',   /* 2026-11-25 follow-up (Tarek): every phone width, so real container numbers stay on ~114px at 375/430 too */
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:0 8px}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap::after{content:"";flex:0 0 100%;order:1;height:0}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap .sv2-tot:nth-child(-n+3){display:flex;align-items:baseline;gap:4px;white-space:nowrap}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap .sv2-tot:nth-child(n+4){order:2;margin-top:3px}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap .sv2-tot:nth-child(n+4) .v{white-space:nowrap}',
'  .sv2:not(.sv2-oc) .sv2-totrow.wrap .sv2-tot:nth-child(n+4) .v small{display:block;font-size:11px;line-height:1.1}',
'}',
'@media (max-width:360px){.sv2-totrow.wrap .sv2-kp{display:none}.sv2-totrow.wrap .sv2-kn{display:inline}}',
'@media (max-width:420px){.sv2-oc .sv2-ocg{grid-template-columns:minmax(0,1fr)}.sv2-oc .sv2-ocg>.sv2-f{grid-column:1/-1}.sv2-oc .sv2-lcard .lb{grid-template-columns:minmax(0,1fr)}}'
].join('\n');
function injectCss(){
  if(document.getElementById('sv2-css'))return;
  var s=document.createElement('style');s.id='sv2-css';s.textContent=CSS;document.head.appendChild(s);
}

/* ---------------------------------------------------------------- helpers */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function uniq(a){return a.filter(function(v,i){return v!=null&&v!==''&&a.indexOf(v)===i;});}
function sum(a,k){return a.reduce(function(t,x){return t+(+x[k]||0);},0);}
function statusClass(s){s=String(s||'').toLowerCase();if(s.indexOf('deliver')>=0)return 'green';if(s.indexOf('ship')>=0||s.indexOf('water')>=0)return 'blue';if(s.indexOf('return')>=0)return 'amber';return 'neutral';}
function fmtDate(iso){if(!iso)return '—';var d=new Date(iso+'T00:00');if(isNaN(d))return esc(iso);var m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear();}
function fmtT(n){return (Math.round((+n||0)*100)/100).toFixed(2);}
function fmtEta(s){s=String(s||'');var m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return esc(s||'—');return fmtDate(m[3]+'-'+m[2]+'-'+m[1]);}
function packShort(p){return String(p||'').replace(/\s*\d+\s*kg.*$/i,'').replace(/Crt|Carton/i,'').trim()||p;}
/* client-side number read for the running totals only (server re-validates):
   Arabic-Indic digits, Arabic decimal sep, comma decimal (single comma, no dot). */
function numOf(v,whole){
  var s=String(v==null?'':v).trim();if(!s)return 0;
  s=s.replace(/[٠-٩]/g,function(c){return String(c.charCodeAt(0)-0x660);}).replace(/[۰-۹]/g,function(c){return String(c.charCodeAt(0)-0x6F0);});
  s=s.replace(/٫/g,'.').replace(/[٬\s]/g,'');
  /* counts: a comma can only be a thousands separator ("1,664" = 1664), same rule as the server */
  if(whole)s=s.replace(/,/g,'');
  else if(s.indexOf('.')<0&&(s.match(/,/g)||[]).length===1)s=s.replace(',','.');else s=s.replace(/,/g,'');
  var n=Number(s);return isNaN(n)?0:n;
}
/* Arabic-Indic / Persian digits and the Arabic decimal sign → ASCII, so the stored text copy
   (raw_data) matches the typed number columns. Separators are left for the server to read. */
function asciiDigits(v){return String(v==null?'':v).replace(/[\u0660-\u0669]/g,function(c){return String(c.charCodeAt(0)-0x660);}).replace(/[\u06F0-\u06F9]/g,function(c){return String(c.charCodeAt(0)-0x6F0);}).replace(/\u066B/g,'.');}
function newLine(){return {id:null,net_flag:'--',category:'',variety:'',lot:'',daltex_class:'',client_class:'',carton_type:'',brand:'',packaging_type:'',caliber:'',count_size:'',pack_house:'',source_type:'',raw_source:'',pallet_count:'',carton_count:'',net_weight:'',gross_weight:'',carton_net_weight:'',carton_gross_weight:'',pascol_weight:'',pascol_pct:'',packing_weight:'',packing_factor:'',pascol_net:'',weight_variance:'',traceability_code:''};}
/* Potatoes (Pivots): lists from the الادخال entry sheet (no registry for these yet).
   Varieties are NOT here — they come from the shared varieties table (same list as potato inspections). */
var PT_LISTS={
  stations:['سلمى','مريم','كفر الزيات','الخير','حليمه','الصالحية','الادهم'],
  sectors:['بحري','فرافره','جنوب'],
  cropSeasons:['شتوى','صيفى'],
  size2:['ميديم','لارج','بيبي','45UP','40UP'],
  cropTypes:['عادى','حيوي'],
  grades:['مائده','فرايز تصنيع','كرسبي تصنيع'],
  conditions:['بدون','بالبتموس'],
  brands:['دالتكس','داليا','بدون -دالتكس','داليا-دالتكس','ميرديان جولد','ملينديز','بدون -داليا','بدون'],
  ops:['يدوي','تعديل اوزان','ماكينه +تعديل','ماكينه','يدوى+تعديل','شحن مباشر','عينات'],
  packs:['جامب','بروبلين','شبك+جامب شنطه','بروبلين+جامب شنطه','شبكه + بروبلين','شبك','كيس + بروبلين'],
  colours:['اسود×ازرق×احمر','اسود×اصفر×اسود','احمر','ازرق','اسود'],
  clients:['Burgess Farms','DANKERS'],countries:['UK','Germany','Italy','Russia','Kuwait','Qatar'],
  ports:['شرق التفريعة','دمياط'],pivots:['التيسير','31','4','70','58','65','57'],farms:['التيسير','الاوقاف']
};
function newLinePT(){return {id:null,variety:'',pivot:'',farm:'',lot:'',size1:'',size2:'',crop_type:'',grade:'',packaging:'',package_weight:'',pack_size:'',pallets:'',brand:'',jumbo_colour:'',jumbo_count:'',sack_colour:'',sack_count:'',standard_weight:'',pascol_weight:'',op_type:'',condition:''};}
/* Potatoes managed lists (Vera 2026-11-25, branch vera/potato-dropdowns). ON on the staging host only (index.html
   SV2_PT_LISTS_ENABLED=VISION_IS_DEV, checked again here); the prod address always resolves OFF and keeps PT_LISTS exactly.
   One source per field:
   - the 10 lists with no master: public.ref_options, product 'potatoes', on the shared keys of potato-lists A (OC_PT_KEYS,
     the same map Other crops uses for its own *_OC_* options).
   - the 6 lists mc v0.4 links to masters for Potatoes: config_list_values('potatoes', key) (PT_MASTER_KEYS).
   Each list on its own keeps its PT_LISTS values when it is missing, has no active option, or its read fails.
   Saved value = the option's text, as before (no codes, no data change). */
var PT_MASTER_KEYS={stations:'packing_station',clients:'client',countries:'country',ports:'port',farms:'farm',packs:'packing_type'};
var PT_MASTER_EN={clients:1,countries:1};   /* English in the sheet: master name first, then name_ar */
function ptListsEnabled(){return window.SV2_PT_LISTS_ENABLED===true&&window.VISION_IS_DEV===true;}
/* refRows = ref_options rows (null = read failed); refKeys = {PT_LISTS name: list_key}; masters = {PT_LISTS name: config_list_values
   result, or null}. Returns {lists:{name:[active labels by sort_order]}, src:{name:'ref'|'master'}}; a list left out falls back. */
function ptBuildLists(refRows,refKeys,masters){
  var acc={},src={},byKey={},out={lists:{},src:{}};
  Object.keys(refKeys||{}).forEach(function(n){byKey[refKeys[n]]=n;});
  (Array.isArray(refRows)?refRows:[]).forEach(function(o){var n=o&&byKey[o.list_key];if(!n||!o.label_ar)return;
    (acc[n]=acc[n]||[]).push({label:String(o.label_ar),active:o.active!==false,sort:+o.sort_order||0});src[n]='ref';});
  Object.keys(PT_MASTER_KEYS).forEach(function(n){var arr=masters&&masters[n];if(!Array.isArray(arr))return;var l=[];
    arr.forEach(function(x){if(!x)return;var lab=PT_MASTER_EN[n]?(x.name||x.name_ar):(x.name_ar||x.name);if(!lab)return;
      l.push({label:String(lab),active:x.tag_active!==false&&x.master_active!==false&&!x.merged_into,sort:+x.sort_order||0});});
    if(l.length){acc[n]=l;src[n]='master';}});
  Object.keys(acc).forEach(function(n){var l=acc[n].slice().sort(function(a,b){return a.sort-b.sort;}).filter(function(o){return o.active;}).map(function(o){return o.label;});
    if(l.length){out.lists[n]=l;out.src[n]=src[n];}});
  return out;}
/* PT_LISTS with the managed lists laid over it (same shape as ocLists()); no model = PT_LISTS itself (prod, switch off) */
function ptListsFrom(m){if(!m)return PT_LISTS;var out={},k;for(k in PT_LISTS)out[k]=(m.lists&&m.lists[k])||PT_LISTS[k];return out;}
/* Other crops line = the potato line + Cartons # and Benz # (codes in farm / packaging) */
function newLineOC(){var d=newLinePT();d.cartons_count='';d.benz_count='';return d;}
/* whole-number fields (server: _shipments_v2_int) — everything else in NUMKEYS is a decimal. Other crops pallets are decimal (20.5). */
var INTKEYS={pallet_count:1,carton_count:1,punnet_count:1,pallets:1,jumbo_count:1,sack_count:1,cartons_count:1,benz_count:1};
/* same rule as the server (_shipments_v2_num/_int): null = OK or empty, else a short reason */
function numProblem(v,whole){
  var s=asciiDigits(v).trim();if(!s)return null;
  s=s.replace(/\u066C|\s/g,'');
  if(whole)s=s.replace(/,/g,'');
  else if(s.indexOf('.')<0&&(s.match(/,/g)||[]).length===1)s=s.replace(',','.');else s=s.replace(/,/g,'');
  if(!/^-?[0-9]+(\.[0-9]+)?$/.test(s))return 'not a number';
  if(whole&&Number(s)!==Math.trunc(Number(s)))return 'must be a whole number';
  return null;
}
/* stored numbers come back as e.g. "13.216000000" or "13.216000000000001" — show 13.216 (trailing zeros + float noise only) */
function tidyNum(v){var s=String(v);if(!/^-?\d+(\.\d+)?$/.test(s))return s;
  var n=Number(s),r=Number(n.toFixed(6));   /* float noise from sheet maths (13.216000000000001) → 13.216; real decimals kept */
  return String(Math.abs(n-r)<1e-9?r:n);}
var NUMKEYS={pallets:'numeric',jumbo_count:'numeric',sack_count:'numeric',cartons_count:'numeric',benz_count:'numeric',standard_weight:'decimal',package_weight:'decimal',pack_size:'decimal',pallet_count:'numeric',carton_count:'numeric',net_weight:'decimal',gross_weight:'decimal',carton_net_weight:'decimal',carton_gross_weight:'decimal',pascol_weight:'decimal',pascol_pct:'decimal',packing_weight:'decimal',packing_factor:'decimal',pascol_net:'decimal',weight_variance:'decimal'};

/* ---------------------------------------------------------------- intake maths (all weights in tonnes, never ÷1000)
   Strings in, strings out ('' = blank), same 6-decimal tidy as calcPascol. Invalid numbers count as blank here
   (numProblem flags them as invalid separately). Exported on window.ShipV2 for tests. */
var INTAKE_WARN={cartonNetMin:0.001,cartonNetMax:0.05,grossHeadroom:0.01,packingFactorMin:0,packingFactorMax:0.01};
function intakeBlank(v){return String(v==null?'':v).trim()==='';}
function intakeR6(x){return String(Number(x.toFixed(6)));}
/* gap 3 (2026-11-17): the save RPCs refuse negatives on these (via _sv2_intake_nonneg / the Cartons check), so refuse them inline
   before Save too. Pallets are NOT here: returned containers carry negative pallets and the RPC allows them. Not used for potatoes. */
var NONNEG_LINE={carton_count:1,carton_net_weight:1,carton_gross_weight:1,packing_factor:1};
/* 2026-11-17: "changed since you opened it" conflicts. The DB now raises SQLSTATE PT409 (HTTP 409); 40001 is still
   accepted for the old functions, but 40001 makes PostgREST retry forever, so the server no longer sends it. */
function isStaleErr(e){return !!e&&(e.code==='PT409'||e.code==='40001');}
function isNegNum(v){var s=asciiDigits(v==null?'':v).trim();return /^-/.test(s)&&!numProblem(v,0);}
/* 2026-11-17: a negative carton net/gross gets ONE message, blocks Save (NONNEG_LINE) and blanks that line's auto totals,
   so negative cartons (Returned) x negative weight never shows a positive Net/Gross t */
var NEG_WT_MSG='Carton weight can\u2019t be negative';
function lineNegWeight(d){return !!d&&(isNegNum(d.carton_net_weight)||isNegNum(d.carton_gross_weight));}
/* gap 4 (2026-11-17, Tarek: bin-aware block): a carton weight above 0.1 t is refused (kg typed: 15 for 0.015), except on
   Carton Bins lines where one bin is 0.55-0.6 t, so the limit there is 1 t. A bin line with no carton type picked is
   treated as a carton (pick 'Carton Bins' first). 0.1 itself is allowed. Not used for potatoes. */
var CARTON_MAX={carton:0.1,bin:1};
/* Other crops: packing types are codes; a code's is_bulk (ref_options) decides, like the server. Other values: the old name rule. */
var PACK_BULK={};
function isBinType(ct){if(ct!=null&&Object.prototype.hasOwnProperty.call(PACK_BULK,ct))return PACK_BULK[ct];return /\bbins?\b/i.test(String(ct||''));}
function cartonMax(ct){return isBinType(ct)?CARTON_MAX.bin:CARTON_MAX.carton;}
function cartonOverMax(v,ct){var n=intakeNum(v);return n!==null&&n>cartonMax(ct)+1e-12;}
var BIN_MAX_MSG='Over 1 t per bin. Bin weights are in tonnes, e.g. 0.6';
/* 2026-11-17 (UX review): kg typed into the two remaining tonne fields is refused too. Packaging per carton above 0.01 t
   (0.1 t for bins) and a container Pascol weight above 40 t are the kg habit (1.1 for 0.0011, 27000 for 27). Client-side only. */
var PASCOL_MAX=40;
function packMax(ct){return isBinType(ct)?0.1:0.01;}
function packOverMax(v,ct){var n=intakeNum(v);return n!==null&&n>packMax(ct)+1e-12;}
var PACK_KG_MSG='Looks like kg. Packaging per carton is in tonnes, e.g. 0.0011 (= 1.1 kg)';
function cartonMaxMsg(ct){return isBinType(ct)?BIN_MAX_MSG:INTAKE_KG_MSG+' (max 0.1 t per carton)';}
function intakeOk(v,whole){return !intakeBlank(v)&&!numProblem(v,whole);}
function intakeNum(v,whole){return intakeOk(v,whole)?numOf(v,whole):null;}
/* aWhole: read a as a count ("1,664" = 1664, same rule as the server) */
function intakeMul(a,b,aWhole){if(!intakeOk(a,aWhole)||!intakeOk(b))return '';return intakeR6(numOf(a,aWhole)*numOf(b));}
function intakeLineNetT(cartonCount,cartonNet){return intakeMul(cartonCount,cartonNet,1);}
function intakeLineGrossT(cartonCount,cartonGross){return intakeMul(cartonCount,cartonGross,1);}
/* unrounded share (number) or null; never divides by zero */
function intakeShareRaw(lineCartons,totalCartons){
  var l=intakeNum(lineCartons,1),t=intakeNum(totalCartons,1);
  if(l===null||t===null||!(t>0))return null;
  return l/t;
}
/* Container % as a fraction 0–1 (string, e.g. '0.5'), '' if line/total blank or total is 0 */
function intakeContainerShare(lineCartons,totalCartons){var s=intakeShareRaw(lineCartons,totalCartons);return s===null?'':intakeR6(s);}
function intakePascolActual(pascolWeight,share){var p=intakeNum(pascolWeight),s=intakeNum(share);if(p===null||s===null)return '';return intakeR6(p*s);}
function intakePackingWeight(cartonCount,factor){return intakeMul(cartonCount,factor,1);}
/* warn-only range checks: blank / not a number → false */
function intakeCartonNetWarn(v){var n=intakeNum(v);return n!==null&&(n<INTAKE_WARN.cartonNetMin||n>INTAKE_WARN.cartonNetMax);}
function intakeCartonGrossWarn(net,gross){var n=intakeNum(net),g=intakeNum(gross);if(n===null||g===null)return false;
  return g<n-1e-9||g>n+INTAKE_WARN.grossHeadroom+1e-9;}   /* 1e-9: float noise at the exact edges (0.015+0.01) */
/* r2 P1 / DB v0.4 (Anna): more than 0.1 t per carton is the kg habit (15 / 16.5 / 0.5 typed for 0.015 / 0.0165 t); 0.1 itself does not warn */
var INTAKE_KG_MSG='Looks like kg. Carton weights are in tonnes, e.g. 0.015';
function intakeLooksKg(v){var n=intakeNum(v);return n!==null&&n>0.1;}
function intakePackingFactorWarn(v){var n=intakeNum(v);return n!==null&&(n<INTAKE_WARN.packingFactorMin||n>INTAKE_WARN.packingFactorMax);}
function intakeCartonFooter(sumLineCartons,totalCartons){
  var t=numOf(totalCartons,1),s=numOf(sumLineCartons,1);
  if(intakeBlank(totalCartons)||t===0)return {kind:'missing',message:'Total cartons missing (Container weights)'};
  if(t>0&&s!==t)return {kind:'mismatch',message:'Line cartons ('+s.toLocaleString()+') don’t match Total cartons ('+t.toLocaleString()+'). Check before saving.'};
  return {kind:'ok',message:''};
}

/* ============================================================== instance */
var CUR=null;   /* the one mounted instance */

function mount(host,opts){
  if(CUR)CUR.unmount();
  injectCss();
  var I=createInstance(host,opts||{});
  CUR=I;return I.api;
}

function createInstance(host,O){
  var sb=O.sb;
  var PRODUCT=O.product;                       /* fixed by Vision */
  var PRODUCT_NAME=O.productName||PRODUCT;
  var PRODUCT_COLOR=O.productColor||'var(--accent)';
  var SEASON=O.seasonId||null;                 /* the sidebar (viewed) season */
  var SEASON_NAME=O.seasonName||'';
  var dead=false;
  /* 2026-11-26 step 2 (Tarek): people without edit rights get Manage read-only (list + open a shipment to view; no New/Save/Delete) */
  var RO=!!O.readOnly;
  function isCitrus(){return PRODUCT==='citrus';}
  function regionOn(){return isCitrus()&&salesRegionFlag();}
  function regionLive(){return regionOn()&&REF.sregions.length>0;}   /* the DB step is applied: the list has values */
  function hasLot(){return PRODUCT!=='grapes';}   /* Tarek 2026-10-13: Lot # everywhere except Grapes */
  var OC=(PRODUCT==='other_crops');        /* Other crops: the Pivots form + Crop, Cartons #, Benz #; lists are ref_options codes */
  var PT=(PRODUCT==='potatoes')||OC;       /* Pivots line: own fields, totals and RPCs; everything else shared */
  var PTM=PT&&!OC&&ptListsEnabled();      /* Potatoes managed lists (staging only); off = PT_LISTS as before */
  if(OC&&!otherCropsEnabled()){   /* flag off: never mount the form */
    host.innerHTML='<div class="sv2"><div class="sv2-banner err"><span aria-hidden="true">!</span><span>Other crops isn\u2019t switched on yet.</span></div></div>';
    var offApi={isDirty:function(){return false;},confirmLeave:function(){return true;},unmount:function(){host.innerHTML='';if(CUR&&CUR.api===offApi)CUR=null;}};
    return {api:offApi,unmount:offApi.unmount};
  }
  /* new-column intake fields (planned date, total cartons, header pascol, packing factor). Read once at mount. Never potatoes. */
  var INTAKE=!PT&&intakeFieldsEnabled();
  function blankLine(){return OC?newLineOC():PT?newLinePT():newLine();}
  function snapNote(){return SNAPSHOT_PRODUCTS[PRODUCT]?SNAPSHOT_NOTE:'';}
  function bannerInner(){
    if(OC&&!OC_WRITES)return '<span aria-hidden="true">✎</span><span>'+OC_PENDING+'.</span>';
    /* 2026-11-26: Manage is the main page now (no longer a test sandbox) */
    if(RO)return '<span aria-hidden="true">👁</span><span><b>View only.</b> You can open and read shipments here. Ask an admin for edit rights to add or change them.</span>';
    return '<span aria-hidden="true">✎</span><span><b>Shipments are entered here.</b> Reports and Analytics still read the old shipment records until they are switched over.</span>';}
  function q(sel){return host.querySelector(sel);}
  function qa(sel){return Array.prototype.slice.call(host.querySelectorAll(sel));}
  function el(id){return host.querySelector('#sv2-'+id);}
  function val(id){var e=el(id);return e?String(e.value||'').trim():'';}

  var REF={clients:[],clientIdByName:{},subByClientId:{},cats:[],vars:[],packs:[],cartonTypes:[],ref:{},oc:{byList:{},byCode:{}},pt:null,sregions:[],ocCats:{}};
  var LINES=[],openRows={},MODE='list',EDIT={container:null,loaded:null,deletedIds:[]};
  var LOADED_IDS=[];   /* ids of the lines as last loaded from the server; Delete shipment sends exactly these */
  var ROW_VERSION='';  /* fixpkg: get_* row_version as last loaded; sent back on edit + delete so the server refuses (PT409) if anyone changed the lines since */
  /* old sheet carton gross text by line id (get: carton_gross_weight_raw, only when the tonnes column is empty).
     Display hint only: never copied into LINES, never sent. */
  var RAWCGW={};
  /* Citrus weighbridge maths (same as the sheet, matches 100% of stored net/variance rows):
     Pascol %  = line gross ÷ voyage gross × pascol weight;  Pascol net = Pascol % − packing;  Variance = Pascol net − net.
     PAS_LIVE: off when an existing voyage loads (keeps the sheet's stored values), on once a weight changes or for a new shipment. */
  var PAS_CALC={pascol_pct:1,pascol_net:1,weight_variance:1},PAS_IN={pascol_weight:1,packing_weight:1,gross_weight:1,net_weight:1},PAS_LIVE=true;
  /* intake flag on: Container % = line cartons ÷ Total cartons; Pascol share (t) = header pascol × Container %;
     Packing weight = cartons × packing factor. These inputs also switch PAS_LIVE on. */
  var INTAKE_IN={carton_count:1,packing_factor:1};
  /* new lines: Net t / Gross t are cartons × carton net/gross t, so these feed gross (and the pascol maths) */
  var CARTON_SRC={carton_count:1,carton_net_weight:1,carton_gross_weight:1};
  var WARN_KEYS={carton_net_weight:1,carton_gross_weight:1,packing_factor:1};
  var DATA=[],DIRTY=false,SAVING=false,SEASON_OK=false,listSeq=0,formSeq=0;
  var LISTS=null;
  var ST={q:'',sortKey:'loaded',dir:'desc',limit:200,f:{cls:[],region:[],client:[],status:[],qc:[]}};
  /* 2026-11-26 (Tarek): Manage list has two views, By container (default) and All rows (one row per line); remembered per browser */
  ST.view='container';try{if(window.localStorage&&localStorage.getItem('dalos_sv2_view')==='rows')ST.view='rows';}catch(_e){}

  var RENDER_STEP=200;
  var phoneMQ=window.matchMedia?window.matchMedia('(max-width:700px)'):null;
  function isPhone(){return !!(phoneMQ&&phoneMQ.matches);}
  /* r2: the form's lines switch to cards at <=768px (the list keeps its 700px switch) */
  var formMQ=window.matchMedia?window.matchMedia('(max-width:768px)'):null;
  function isNarrow(){return !!(formMQ&&formMQ.matches);}
  function isTouch(){try{return !!(window.matchMedia&&window.matchMedia('(hover:none) and (pointer:coarse)').matches)||(navigator.maxTouchPoints>0&&!window.matchMedia('(hover:hover)').matches);}catch(e){return false;}}

  /* ---------------------------------------------------------- markup */
  host.innerHTML=
  '<div class="sv2'+(OC?' sv2-oc':'')+(RO?' sv2-ro':'')+'">'+
   '<div class="sv2-view on" id="sv2-vlist">'+
    '<div class="sv2-banner" id="sv2-banner">'+bannerInner()+'</div>'+
    '<div class="sv2-toolbar">'+
     '<div class="sv2-search" id="sv2-searchwrap"><input id="sv2-q" type="search" placeholder="'+(OC?'Search container, crop, client, station, variety, farm, grade…':PT?'Search container, client, station, variety, pivot, farm, lot, grade…':'Search container, client, vessel…')+'" title="'+(OC?'Search container, crop, client, station, variety, farm, grade':PT?'Search container, client, station, variety, pivot, farm, lot, grade':'Search container, client, vessel, booking, invoice, lot, port')+'" autocomplete="off" aria-label="Search shipments"><button type="button" class="sv2-clr" data-act="clearQ" aria-label="Clear search">✕</button></div>'+
     '<span class="sv2-fsels" id="sv2-facets"></span>'+
     '<button type="button" class="sv2-reset" id="sv2-resetbtn" data-act="resetAll">Reset filters</button>'+
     '<span class="sv2-sp"></span>'+
     (OC?'<button type="button" class="sv2-btn sec" data-act="ocCsv" title="Download the shown shipments as a CSV file (UTF-8, opens in Excel)">Export CSV</button>':'')+
     (OC&&O.canConfigure&&window.SV2Ref?'<button type="button" class="sv2-btn sec" data-act="ocConfig">Configurations</button>':'')+
     '<span class="sv2-vsw" role="group" aria-label="List view"><button type="button" data-act="view" data-v="container" id="sv2-vcont">By container</button>'+
     '<button type="button" data-act="view" data-v="rows" id="sv2-vrows">All rows</button></span>'+
     '<button type="button" class="sv2-btn" data-act="openCreate">+ New shipment</button>'+
    '</div>'+
    '<div class="sv2-tw sv2-desk"><table class="sv2-tbl"><thead><tr id="sv2-thead"></tr></thead><tbody id="sv2-listbody"></tbody></table></div>'+
    '<div class="sv2-cards" id="sv2-cards"></div>'+
    '<div class="sv2-note" id="sv2-countnote"></div><div id="sv2-showmore"></div>'+
   '</div>'+
   '<div class="sv2-view" id="sv2-vform">'+
    '<div class="sv2-fbar">'+
     '<button type="button" class="sv2-back" data-act="leave">← Back to Manage</button>'+
     '<span class="sv2-ftitle" id="sv2-ftitle">New shipment</span><span class="sv2-sp"></span>'+
     '<span class="sv2-dirty" id="sv2-dirty">● Unsaved changes</span>'+
     '<button type="button" class="sv2-btn sec sm sv2-del" data-act="delShip" id="sv2-delship" hidden>Delete shipment</button>'+
     '<button type="button" class="sv2-btn sec sm" data-act="leave">Cancel</button>'+
     '<button type="button" class="sv2-btn sm" data-act="save">Save shipment</button>'+
    '</div>'+
    '<div class="sv2-ctx">'+
     '<span class="sv2-chip" title="One shipment is one product. The product can’t be changed here."><span class="pd" style="background:'+esc(PRODUCT_COLOR)+'"></span>'+esc(PRODUCT_NAME)+' · product locked</span>'+
     '<span class="sv2-chip mono" id="sv2-ctxref">New</span>'+
     '<span class="sv2-chip season" id="sv2-ctxseason"></span>'+
     (PT?'':'<span class="sv2-pill green" id="sv2-ctxstatus">Delivered</span>')+
    '</div>'+
    '<div id="sv2-ferr" class="sv2-ferr"></div>'+
    '<div id="sv2-lstat" class="sv2-lstat" aria-live="polite"></div>'+   /* 2026-11-25: list loading / "Couldn’t load list" + Retry (never cleared by form errors) */
    '<div class="sv2-box">'+
     '<div class="sv2-overlay" id="sv2-overlay"><span class="sv2-spin"></span>Loading container…</div>'+
     (OC?ocHeaderHTML():PT?ptHeaderHTML():orHeaderHTML())+
    '</div>'+
    '<div class="sv2-box">'+
     '<div class="sv2-st" id="sv2-lhint">'+esc(PRODUCT_NAME)+' lines <small>· at least one line'+(PT?'':' · <span class="req">*</span> required')+'</small></div>'+
     '<div class="sv2-tw sv2-desk" style="border:none"><table class="sv2-lines'+(PT?'':' or')+'"><thead id="sv2-lhead"></thead><tbody id="sv2-lbody"></tbody><tfoot id="sv2-lfoot"></tfoot></table></div>'+
     '<div class="sv2-lcards" id="sv2-lcards"></div>'+
     '<div class="sv2-toolbar"><button type="button" class="sv2-btn sec sm" data-act="addLine">+ Add line</button><button type="button" class="sv2-btn sec sm" data-act="dupLast">'+(PT?'Duplicate last line':'Duplicate line (same pack)')+'</button></div>'+
    '</div>'+
    '<div class="sv2-submit">'+
     '<div class="sv2-totrow'+(isCitrus()?' wrap':'')+'">'+tot('Lines','slines')+tot('Pallets','spal')+   /* 2026-11-25 P3: every product (phones: one scrollable line) */
     (OC?tot('Packs','spacks')+tot('Std weight','snet'):PT?tot('Jumbo bags','sjumbo')+tot('Sacks','ssack')+tot('Standard wt','snet')+tot('Pascol wt','spas')
        :tot('Cartons','sctn')+tot('Net · Gross'+u('t'),'snet')+(INTAKE&&isCitrus()?tot('<span class="sv2-kp">Pascol · Packing</span><span class="sv2-kn">Pascol</span>'+u('t'),'spas')+tot('<span class="sv2-kl">Container variance</span><span class="sv2-ks">Variance</span>'+u('t'),'svar'):''))+'</div>'+
     '<span class="sv2-sp"></span><span class="sv2-jdewarn" id="sv2-jdewarn" role="status" hidden></span><button type="button" class="sv2-goprob" data-act="goProblem" id="sv2-goprob" hidden></button>'+
     (PT?'':'<button type="button" class="sv2-btn sec" data-act="saveNew">Save &amp; new</button>')+
     '<button type="button" class="sv2-btn" data-act="save">Save shipment</button>'+
     (INTAKE?'<div class="sv2-ctnwarn" id="sv2-ctnwarn" role="status" aria-live="polite"></div>':'')+
     (PT?'':'<div class="sv2-kgwarn" id="sv2-kgwarn" role="status" aria-live="polite"></div>')+
    '</div>'+
   '</div>'+
  '</div>';

  function orHeaderHTML(){return ''+
     '<div class="sv2-st">Logistics <small id="sv2-lockhint" hidden>· container + date locked while editing</small></div>'+
     '<div class="sv2-grid">'+
      fld(INTAKE?'Actual loading date':'Loading Date','ldate','date',{req:1,chg:'ldate',cls:'sv2-fdate'})+
      (INTAKE?fld('Planned loading date','plandate','date',{cls:'sv2-fdate'}):'')+
      '<div class="sv2-dep"><label class="chk"><input type="checkbox" id="sv2-depdiff" data-chg="depdiff">Departure date differs from loading date</label>'+
       '<span class="hint" id="sv2-dephint"></span><div class="dd" id="sv2-depwrap" hidden>'+fld('Departure Date','depdate','date',{req:1})+(SV2_SEND_DEPARTURE_DATE?'':'<div class="hint" style="color:var(--red);font-weight:600">Preview only: departure date will not be saved yet</div>')+'</div></div>'+
      '<div class="sv2-f"><label for="sv2-status">Shipping Status <span class="req">*</span></label><select class="sv2-in" id="sv2-status" data-chg="status" data-req="1"></select></div>'+
      fld('Carta','carta','text',{mono:1})+
      fld('Container No.','container','text',{req:1,mono:1,ph:'e.g. MNBU 3751992'})+
      fld('Vessel','vessel')+fld('Shipping Line','line','text',{list:'sv2-dl-line'})+
      fld('Booking No.','booking','text',{mono:1})+fld('Invoice No.','invoice','text',{mono:1})+
      fld('PO Number','po','text',{mono:1})+fld('ETD','etd','date')+fld('ETA','eta','date')+fld('Actual Arrival','arrival','date')+
      fld('Departure Port','depport','text',{list:'sv2-dl-depport'})+
     '</div>'+
     '<div class="sv2-derived">Auto · Month <b id="sv2-dmonth">—</b> · Week <b id="sv2-dweek">—</b></div>'+
     (INTAKE?'<div class="sv2-st">Container <small>· once per container, not per line</small></div>'+
      '<div class="sv2-grid">'+
       '<div class="sv2-f"><label for="sv2-packdep">Loaded at (pack house)</label><select class="sv2-in" id="sv2-packdep"></select></div>'+
       fld('Total cartons','tcartons','text',{mono:1,num:1,inputmode:'numeric',after:'<div class="sv2-echo" id="sv2-tcecho"></div>'})+
       (isCitrus()?fld('Pascol weight'+u('t'),'hpascol','text',{mono:1,num:1,inputmode:'decimal',after:'<div class="sv2-echo" id="sv2-hpecho"></div>'}):'')+
      '</div>':'')+
     '<div class="sv2-st">Destination &amp; commercial</div>'+
     '<div class="sv2-grid">'+
      fld('Receiving Country','country','text',{list:'sv2-dl-country'})+fld('Receiving Port','port','text',{list:'sv2-dl-port'})+
      '<div class="sv2-f"><label for="sv2-client">Client</label><select class="sv2-in" id="sv2-client" data-chg="client"></select></div>'+
      '<div class="sv2-f"><label for="sv2-subclient">Subclient</label><select class="sv2-in" id="sv2-subclient"></select></div>'+
      fld('Agent','agent','text',{list:'sv2-dl-agent'})+fld('Shipper','shipper','text',{list:'sv2-dl-shipper'})+
      (regionOn()?fld('Region (sales)','sregion','text',{cls:'sv2-sregion'}):'')+
     '</div>'+
     (INTAKE?'':'<div class="sv2-st">Handling</div>'+
     '<div class="sv2-grid"><div class="sv2-f"><label for="sv2-packdep">Pack House (Departure)</label><select class="sv2-in" id="sv2-packdep"></select></div></div>')+
     '<datalist id="sv2-dl-line"></datalist><datalist id="sv2-dl-depport"></datalist><datalist id="sv2-dl-country"></datalist>'+
     '<datalist id="sv2-dl-port"></datalist><datalist id="sv2-dl-agent"></datalist><datalist id="sv2-dl-shipper"></datalist>'+
     '<datalist id="sv2-dl-source"></datalist><datalist id="sv2-dl-rawsource"></datalist>';
  }
  function ar(en,arb){return '<span class="sv2-lab2"><span>'+en+'</span><bdi class="sv2-ar" dir="rtl" lang="ar">'+arb+'</bdi></span>';}
  function sel(label,id){return '<div class="sv2-f"><label for="sv2-'+id+'">'+label+'</label><select class="sv2-in" id="sv2-'+id+'" dir="auto"></select></div>';}
  function ptHeaderHTML(){return ''+
     '<div class="sv2-st">Voyage <small id="sv2-lockhint" hidden>· container + date locked while editing</small></div>'+
     '<div class="sv2-grid">'+
      fld(ar('Loading Date','التاريخ'),'ldate','date',{req:1,chg:'ldate'})+sel(ar('Packing Station','محطه التعبئه'),'station')+
      sel(ar('Sector','القطاع'),'sector')+sel(ar('Crop season','الموسم'),'pseason')+
      fld(ar('Container No.','رقم الحاويه'),'container','text',{req:1,mono:1,ph:'e.g. MNBU 9188741'})+fld(ar('Carta','كارته شحن'),'carta','text',{mono:1})+
      fld(ar('Vessel','اسم المركب'),'vessel')+fld(ar('Container Count','عدد الحاويات'),'ccount','text',{mono:1,inputmode:'numeric'})+
     '</div>'+
     '<div class="sv2-derived">Auto · Month <b id="sv2-dmonth">—</b> · Week <b id="sv2-dweek">—</b></div>'+
     '<div class="sv2-st">Destination &amp; documents</div>'+
     '<div class="sv2-grid">'+
      fld(ar('Client','العميل'),'client','text',{list:'sv2-dl-client'})+fld(ar('Country','الدولة'),'country','text',{list:'sv2-dl-country'})+
      fld(ar('Country 2','الدوله 2'),'country2','text',{list:'sv2-dl-country'})+fld(ar('Shipping Port','ميناء الشحن'),'port','text',{list:'sv2-dl-port'})+
      fld(ar('Invoice No.','رقم الفاتوره'),'invoice','text',{mono:1})+fld(ar('Permit No.','رقم الاذن'),'permit','text',{mono:1})+
      fld(ar('Work Order','امر الشغل'),'workorder','text',{mono:1})+
     '</div>'+
     '<datalist id="sv2-dl-client"></datalist><datalist id="sv2-dl-country"></datalist><datalist id="sv2-dl-port"></datalist>'+
     '<datalist id="sv2-dl-pivot"></datalist><datalist id="sv2-dl-farm"></datalist>';
  }
  /* Other crops header: the Pivots header with Crop first; Crop, Packing Station, Vessel, Client and Shipping Port pick ref_options codes */
  function selO(label,id,o){o=o||{};return '<div class="sv2-f'+(o.cls?' '+o.cls:'')+'"><label for="sv2-'+id+'">'+label+(o.req?' <span class="req">*</span>':'')+'</label>'+
    '<select class="sv2-in" id="sv2-'+id+'" dir="auto"'+(o.req?' data-req="1"':'')+'></select></div>';}
  function ocHeaderHTML(){return ''+
     '<div class="sv2-st">Voyage <small id="sv2-lockhint" hidden>· container + date locked while editing</small></div>'+
     '<div class="sv2-grid sv2-ocg">'+
      selO(ar('Crop','المحصول'),'crop',{req:1,cls:'oc-full oc-o1'})+
      fld(ar('Loading Date','التاريخ'),'ldate','date',{req:1,chg:'ldate',cls:'oc-o2'})+selO(ar('Packing Station','محطه التعبئه'),'station',{cls:'oc-full oc-o4'})+
      selO(ar('Sector','القطاع'),'sector',{cls:'oc-o5'})+selO(ar('Crop season','الموسم'),'pseason',{cls:'oc-o3'})+
      fld(ar('Container No.','رقم الحاويه'),'container','text',{req:1,mono:1,ph:'e.g. MNBU 9188741',cls:'oc-full oc-o7'})+fld(ar('Carta','كارته شحن'),'carta','text',{mono:1,cls:'oc-o8'})+
      selO(ar('Vessel','اسم المركب'),'vessel',{cls:'oc-o9'})+fld(ar('Container Count','عدد الحاويات'),'ccount','text',{mono:1,inputmode:'numeric',cls:'oc-o6'})+
     '</div>'+
     '<div class="sv2-derived">Auto · Month <b id="sv2-dmonth">—</b> · Week <b id="sv2-dweek">—</b></div>'+
     '<div class="sv2-st">Destination &amp; documents</div>'+
     '<div class="sv2-grid sv2-ocg">'+
      selO(ar('Client','العميل'),'client',{cls:'oc-full'})+fld(ar('Country','الدولة'),'country','text',{list:'sv2-dl-country'})+
      fld(ar('Country 2','الدوله 2'),'country2','text',{list:'sv2-dl-country'})+selO(ar('Shipping Port','ميناء الشحن'),'port',{cls:'oc-full'})+
      fld(ar('Invoice No.','رقم الفاتوره'),'invoice','text',{mono:1})+fld(ar('Permit No.','رقم الاذن'),'permit','text',{mono:1})+
      fld(ar('Work Order','امر الشغل'),'workorder','text',{mono:1,cls:'oc-full'})+
     '</div>'+
     '<datalist id="sv2-dl-country"></datalist><datalist id="sv2-dl-pivot"></datalist><datalist id="sv2-dl-variety"></datalist>';
  }
  function tot(k,id){return '<div class="sv2-tot" id="sv2-'+id+'-w"><span class="k">'+k+'</span><span class="v" id="sv2-'+id+'">0</span></div>';}
  function u(x){return ' <span class="sv2-u">'+x+'</span>';}
  function autoTag(){return '<span class="sv2-auto">auto</span>';}
  /* JDE item code (citrus): Category, Variety, Client class, Caliber, Packing, Brand, Net/-- looked up in public.jde_codes,
     the same tables as the sheet's 'JD.E. Code Mapping' tab (brand / Net left empty count as '--'). The server builds and
     stores the code on save (trigger _sv2_jde); this is the live preview. Incomplete = amber note only, Save is not blocked. */
  var JDE_PARTS=[['category','Category','category'],['variety','Variety','variety'],['client_class','Client class','client_class'],['caliber','Caliber','caliber'],
                 ['packaging_type','Packing','packaging_type'],['brand','Brand','brand'],['net_flag','Net / --','net']];
  function jdeFold(v){return String(v==null?'':v).toLowerCase().replace(/\s/g,'');}
  function jdeVal(d,k){var v=String(d[k]==null?'':d[k]).trim();return (k==='brand'||k==='net_flag')&&!v?'--':v;}
  function jdeKey(d){return JDE_PARTS.map(function(p){return jdeFold(jdeVal(d,p[0]));}).join('|');}
  function jdeFor(d){
    if(!REF.jde)return null;
    var parts=JDE_PARTS.map(function(p){var v=jdeVal(d,p[0]),t=REF.jde[p[2]]||{};return {label:p[1],value:v,code:v?(t[jdeFold(v)]||null):null};});
    var miss=parts.filter(function(x){return !x.code;});
    if(d._jdeSaved&&d._jdeKey===jdeKey(d))return {code:d._jdeSaved,parts:parts,miss:[],saved:true};   /* unchanged stored line: the server keeps its code */
    return {code:miss.length?null:parts.map(function(x){return x.code;}).join(''),parts:parts,miss:miss,saved:false};
  }
  function netSel(d){var v=d.net_flag==='Net'?'Net':'--';
    return '<select class="csel" dir="auto" data-k="net_flag" aria-label="Net or --"><option value="--"'+(v==='--'?' selected':'')+'>--</option><option value="Net"'+(v==='Net'?' selected':'')+'>Net</option></select>';}
  var JCOPY_SVG='<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  /* copy the line's JDE code for pasting into JDE (clipboard API; textarea fallback for older/insecure contexts) */
  function jdeCopy(btn){
    var code=btn.getAttribute('data-jcopy')||'',lab=btn.querySelector('span');
    function done(ok){btn.classList.toggle('ok',ok);if(lab)lab.textContent=ok?'Copied':'Copy failed';clearTimeout(btn._t);btn._t=setTimeout(function(){btn.classList.remove('ok');if(lab)lab.textContent='Copy';},1600);}
    function fallback(){try{var t=document.createElement('textarea');t.value=code;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();var ok=document.execCommand('copy');t.remove();done(!!ok);}catch(_e){done(false);}}
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(code).then(function(){done(true);},fallback);else fallback();
  }
  function paintJde(){
    if(host&&!host._jcopyOn){host._jcopyOn=true;host.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('.sv2-jcopy');if(b){e.preventDefault();jdeCopy(b);}});}
    if(PT||!isCitrus())return;
    var bad=0;
    LINES.forEach(function(d,i){
      var box=host.querySelector('[data-jde="'+i+'"]'),r=jdeFor(d);
      if(!r){if(box)box.innerHTML='';return;}
      if(!r.code&&!isUntouched(d))bad++;
      if(!box)return;
      var chips='<div class="sv2-jsegs">'+r.parts.map(function(p){return '<span class="sv2-jseg'+(p.code?'':' miss')+'" title="'+esc(p.label+': '+(p.value||'(empty)'))+'"><b>'+esc(p.code||'??')+'</b>'+esc(p.label)+'</span>';}).join('')+'</div>';
      box.innerHTML=r.code
        ?'<div class="sv2-jrow"><div class="sv2-jcode">'+esc(r.code)+'</div><button type="button" class="sv2-jcopy" data-jcopy="'+esc(r.code)+'" title="Copy JDE code" aria-label="Copy JDE code '+esc(r.code)+'">'+JCOPY_SVG+'<span>Copy</span></button></div>'+(r.saved?'<div class="sv2-jnote">Code stored on this line</div>':chips)
        :'<div class="sv2-jwarn">JDE code incomplete: no code for '+esc(r.miss.map(function(m){return m.label+(m.value?' \u201c'+m.value+'\u201d':' (empty)');}).join(', '))+'. You can still save. Admins add codes in Lists \u2192 JDE codes.</div>'+chips;
    });
    var w=el('jdewarn');if(w){w.hidden=!bad;w.textContent=bad?bad+' JDE code'+(bad===1?'':'s')+' incomplete':'';}
  }
  function loadJde(){
    if(PT||!isCitrus())return Promise.resolve();
    return Promise.resolve(sb.from('jde_codes').select('part,value,code').eq('product_id',PRODUCT).eq('active',true)).then(function(r){
      if(!r||r.error||!(r.data||[]).length){REF.jde=null;return;}
      var m={};(r.data||[]).forEach(function(x){(m[x.part]=m[x.part]||{})[jdeFold(x.value)]=x.code;});REF.jde=m;
    },function(){REF.jde=null;});
  }
  function fld(label,id,type,o){o=o||{};
    var im=(type==='text'&&o.inputmode)?' inputmode="'+o.inputmode+'"':'';
    return '<div class="sv2-f'+(o.cls?' '+o.cls:'')+'"><label for="sv2-'+id+'">'+label+(o.req?' <span class="req">*</span>':'')+'</label>'+
      '<input class="sv2-in'+(o.mono?' mono':'')+(o.num?' num':'')+'" id="sv2-'+id+'" type="'+(type||'text')+'"'+(type==='text'||!type?' dir="auto"':'')+(o.list?' list="'+o.list+'"':'')+
      (o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.req?' data-req="1"':'')+(o.chg?' data-chg="'+o.chg+'"':'')+im+' autocomplete="off">'+(o.after||'')+'</div>';}

  /* ---------------------------------------------------------- reference data */
  function opts(list,cur){
    var arr=uniq((list||[]).slice());if(cur&&arr.indexOf(cur)<0)arr.unshift(cur);
    return '<option value=""></option>'+arr.map(function(o){return '<option'+(o===cur?' selected':'')+'>'+esc(o)+'</option>';}).join('');
  }
  function fillSelect(id,list,cur){var e=el(id);if(e)e.innerHTML=opts(list,cur);}
  function fillDatalist(id,list){var e=host.querySelector('#'+id);if(e)e.innerHTML=uniq(list||[]).map(function(o){return '<option value="'+esc(o)+'">';}).join('');}
  /* managed dropdown lists (shipments_lists.js): flag-gated, fails closed — never blocks the form */
  function attachLists(){
    if(PT||dead||LISTS||!window.SV2Lists||typeof window.SV2Lists.attach!=='function')return;
    try{LISTS=window.SV2Lists.attach(host,{sb:sb,product:PRODUCT,productName:PRODUCT_NAME,container:function(){return val('container');},
      onStatus:function(st){listsState=st;paintStat();}});}catch(_e){LISTS=null;}
  }
  /* "Not in list?" for the Potatoes + Other crops lists (shipments_pt_suggest.js, Vera 2026-11-25): staging only (its own switch +
     VISION_IS_DEV), Potatoes only with the managed lists on (PTM); fails closed, never blocks the form */
  var PTS=null;
  function attachPtSuggest(){
    if(!PT||dead||PTS||(!OC&&!PTM)||!window.SV2PtSuggest||typeof window.SV2PtSuggest.attach!=='function')return;
    try{PTS=window.SV2PtSuggest.attach(host,{sb:sb,product:PRODUCT,productName:PRODUCT_NAME,container:function(){return val('container');}});}catch(_e){PTS=null;}
  }
  /* Other crops: option rows by list and by code; labels come from the code, never stored */
  function ocSetRefs(rows){var bl={},bc={};PACK_BULK={};
    (rows||[]).forEach(function(o){(bl[o.list_key]=bl[o.list_key]||[]).push(o);bc[o.code]=o;if(o.list_key==='packing_type')PACK_BULK[o.code]=!!o.is_bulk;});
    REF.oc={byList:bl,byCode:bc};}
  /* sv2dd (Claudia 2026-11-25, Tarek "goo all"): Other crops' own lists for the 11 fields that borrowed the potato lists.
     ref_options keys = the 10 shared keys of Vera's potato-lists A (sector, crop_season, pivot, grade, size, crop_type, brand,
     bag_colour (jumbo + sack), operation, condition); Other crops has its own *_OC_* options on them. Country / Country 2 has no
     ref_options key (masters, as on Potatoes) and keeps the potato list.
     Saved value = the option's Arabic label (free text on the server, as before). A key with no active option (DB step not
     applied yet) keeps the potato list, so nothing changes until then. */
  var OC_PT_KEYS={sectors:'sector',cropSeasons:'crop_season',pivots:'pivot',grades:'grade',size2:'size',cropTypes:'crop_type',brands:'brand',colours:'bag_colour',ops:'operation',conditions:'condition'};
  function ocLists(){var out={},k;for(k in PT_LISTS)out[k]=PT_LISTS[k];
    var bl=(REF.oc&&REF.oc.byList)||{};
    Object.keys(OC_PT_KEYS).forEach(function(pk){var arr=(bl[OC_PT_KEYS[pk]]||[]).filter(function(o){return o.active&&o.label_ar;}).map(function(o){return o.label_ar;});if(arr.length)out[pk]=arr;});
    return out;}
  /* v0.2 P3 (Pixel): one pattern for every list, as on the Potatoes screen: the option's own (sheet) label, no mixed 'English · Arabic' */
  function ocText(o,list){if(!o)return '';return o.label_ar||o.code;}
  /* follow-ups P3 (Pixel): in the form, Crop / Packing Station / Shipping Port options read 'English · Arabic' (one label when
     label_en is empty or equals label_ar); every other list, the shipments list, cards and CSV keep the single sheet label */
  var OC_BILINGUAL={crop:1,packing_station:1,port:1};
  function ocOptText(o,list){if(!o)return '';var a=o.label_ar||'',e=o.label_en||'';
    if(!OC_BILINGUAL[list]||!e||!a||e===a)return ocText(o,list);return e+' · '+a;}
  function ocLabel(code,list){if(code==null||code==='')return '';var o=REF.oc.byCode[code];return o?ocText(o,list||o.list_key):String(code)+' (not in list)';}
  /* active options only; the current value is kept (marked "off") when it was turned off or is unknown, so old rows still show it */
  function ocOpts(list,cur){var arr=(REF.oc.byList[list]||[]).filter(function(o){return o.active;}),h='<option value=""></option>',seen=false;
    arr.forEach(function(o){var on=o.code===cur;if(on)seen=true;h+='<option value="'+esc(o.code)+'"'+(on?' selected':'')+'>'+esc(ocOptText(o,list))+'</option>';});
    if(cur&&!seen){var o=REF.oc.byCode[cur];h+='<option value="'+esc(cur)+'" selected data-nil="'+(o?'off':'1')+'">'+esc(o?ocOptText(o,list)+' (off)':cur+' (not in list)')+'</option>';}
    return h;}
  function ocSel(list,v,k){return '<select class="csel" dir="auto" data-k="'+k+'">'+ocOpts(list,v)+'</select>';}
  function fillOc(id,list,cur){var e=el(id);if(e)e.innerHTML=ocOpts(list,cur||'');}
  function loadRefs(){
    REF.part=false;   /* 2026-11-25: a list read that failed but did not stop the form (varieties, ref options) -> Retry state */
    if(OC){
      return Promise.all([
        window.SV2Ref?window.SV2Ref.load(sb):Promise.resolve(sb.from('ref_options').select('code,list_key,label_ar,label_en,active,is_bulk,sort_order').eq('product_id','other_crops').order('sort_order')).then(function(r){if(r.error)throw r.error;return {rows:r.data||[]};}),
        Promise.resolve(sb.from('varieties').select('name,active,category_id,raw_names').eq('active',true).eq('product_id','other_crops').order('name')).then(function(r){if(r&&!r.error)return r.data||[];REF.part=true;return [];},function(){REF.part=true;return [];}),
        /* 2026-11-26: the 7 crops are categories of other_crops (Configurations > Varieties files each variety under its crop) */
        Promise.resolve(sb.from('categories').select('id,name').eq('product_id','other_crops')).then(function(r){return r&&!r.error?(r.data||[]):[];},function(){return [];})
      ]).then(function(r){ocSetRefs(r[0].rows);REF.ocSeed=!!r[0].seed;REF.vars=r[1].map(function(v){var a=(v.raw_names||[]).filter(function(x){return /[\u0600-\u06FF]/.test(String(x||''));})[0];return {name:v.name,category_id:v.category_id||null,ar:a?String(a).trim():null};});
        REF.ocCats={};r[2].forEach(function(c){REF.ocCats[String(c.name||'').trim().toLowerCase()]=c.id;});REF.varsLoaded=true;
        /* lines opened before the list arrived show the English name: switch them to the Arabic (display only, not a change) */
        if(LINES.some(function(d){return d.variety&&ocVarShow(d.variety)!==d.variety;})){LINES.forEach(function(d){d.variety=ocVarShow(d.variety);});if(!dead)renderLines();}
        ptFillDatalists();});
    }
    if(PT){ /* varieties from the shared registry (same list as potato inspections); the rest from the entry sheet,
               or (PTM, staging) from ref_options + the linked masters, each list falling back to the sheet's on its own */
      return Promise.all([Promise.resolve(sb.from('varieties').select('name,active').eq('active',true).eq('product_id','potatoes').order('name')).then(function(r){
        if(r.error)throw r.error;REF.vars=(r.data||[]).map(function(v){return {name:v.name};});}),PTM?ptLoadManaged():null]).then(function(){ptFillDatalists();});
    }
    return Promise.all([
      sb.from('clients').select('id,name,active').eq('active',true).order('name'),
      sb.from('sub_clients').select('id,client_id,name,active').eq('active',true).order('name'),
      sb.from('categories').select('id,product_id,name,active').eq('active',true).eq('product_id',PRODUCT).order('name'),
      sb.from('varieties').select('id,product_id,name,category_id,active').eq('active',true).eq('product_id',PRODUCT).order('name'),
      sb.from('packhouses').select('id,name,product_ids,active').eq('active',true),
      sb.from('carton_types').select('id,name,active').eq('active',true).order('name')
    ]).then(function(r){
      r.forEach(function(x){if(x.error)throw x.error;});
      REF.clients=(r[0].data||[]).map(function(c){return c.name;});
      (r[0].data||[]).forEach(function(c){REF.clientIdByName[c.name]=c.id;});
      (r[1].data||[]).forEach(function(s){(REF.subByClientId[s.client_id]=REF.subByClientId[s.client_id]||[]).push(s.name);});
      REF.cats=(r[2].data||[]).map(function(c){return {id:c.id,name:c.name};});
      REF.vars=(r[3].data||[]).map(function(v){return {name:v.name,category_id:v.category_id};});
      REF.packs=(r[4].data||[]).filter(function(p){return (p.product_ids||[]).indexOf(PRODUCT)>=0;}).map(function(p){return p.name;});
      REF.cartonTypes=(r[5].data||[]).map(function(c){return c.name;});
      var sr=regionOn()?Promise.resolve(sb.from('shipment_list_values').select('value').eq('list_key','sales_region').eq('product_id','citrus').eq('active',true).order('sort_order').order('value'))
        .then(function(x){REF.sregions=(x&&!x.error&&x.data)?x.data.map(function(v){return v.value;}):[];},function(){REF.sregions=[];}).then(showRegion):null;
      return Promise.all([sr,sb.rpc('get_shipment_v2_ref_options').then(function(rr){
        if(rr&&!rr.error&&rr.data){REF.ref=rr.data;fillAllDatalists();}else REF.part=true;
      },function(){REF.part=true;}),loadJde()]);
    });
  }
  /* Potatoes managed lists (PTM). Never rejects: a failed read just leaves that list on PT_LISTS. */
  function ptSafe(q){try{return Promise.resolve(q).then(function(r){return r&&!r.error?(r.data||[]):null;},function(){return null;});}catch(e){return Promise.resolve(null);}}
  function ptLoadManaged(){
    var keys=Object.keys(OC_PT_KEYS).map(function(n){return OC_PT_KEYS[n];}),names=Object.keys(PT_MASTER_KEYS);
    return Promise.all([ptSafe(sb.from('ref_options').select('code,list_key,label_ar,label_en,active,sort_order').eq('product_id','potatoes').in('list_key',keys).order('sort_order'))]
      .concat(names.map(function(n){return ptSafe(sb.rpc('config_list_values',{p_product:'potatoes',p_list:PT_MASTER_KEYS[n]}));})))
      .then(function(r){var ms={};names.forEach(function(n,i){ms[n]=r[i+1];});REF.pt=ptBuildLists(r[0],OC_PT_KEYS,ms);},function(){REF.pt=null;});}
  /* Potatoes' counterpart of ocLists(): PT_LISTS itself unless the managed lists are on and loaded */
  function ptLists(){return ptListsFrom(PTM?REF.pt:null);}
  /* potato suggestions = the sheet's defaults + whatever is already in this product's list */
  function ptFillDatalists(){
    var L=OC?ocLists():ptLists(),hd=function(k){return DATA.map(function(c){return c.hdr[k];});},ln=function(k){return [].concat.apply([],DATA.map(function(c){return c.lines.map(function(l){return l[k];});}));};
    fillDatalist('sv2-dl-client',L.clients.concat(hd('client')));fillDatalist('sv2-dl-country',L.countries.concat(hd('region'),hd('country2')));
    fillDatalist('sv2-dl-port',L.ports.concat(hd('port')));fillDatalist('sv2-dl-pivot',L.pivots.concat(ln('pivot')));fillDatalist('sv2-dl-farm',L.farms.concat(ln('farm')));
    if(OC)fillDatalist('sv2-dl-variety',varNames().concat(ln('v').map(ocVarShow)));
  }
  function fillAllDatalists(){var o=REF.ref||{};
    fillDatalist('sv2-dl-line',o.lines);fillDatalist('sv2-dl-depport',o.dep_ports);fillDatalist('sv2-dl-country',o.countries);
    /* 2026-11-25: with the managed lists on, Receiving Port / Shipper get no raw all-products suggestions (shipments_lists.js shows the list) */
    var lon=!!(window.SV2Lists&&typeof window.SV2Lists.enabled==='function'&&window.SV2Lists.enabled());
    fillDatalist('sv2-dl-port',lon?[]:o.rec_ports);fillDatalist('sv2-dl-agent',o.agents);fillDatalist('sv2-dl-shipper',lon?[]:o.shippers);
    fillDatalist('sv2-dl-source',o.source_types);fillDatalist('sv2-dl-rawsource',o.raw_sources);}
  function catNames(){return REF.cats.map(function(c){return c.name;});}
  function showRegion(){var e=el('sregion'),w=e&&e.closest('.sv2-f');if(w)w.classList.toggle('on',regionLive());}
  function varsFor(catName){
    var all=REF.vars;var names;
    if(catName){var c=REF.cats.find(function(x){return x.name===catName;});var cid=c?c.id:null;
      names=all.filter(function(v){return v.category_id===cid;}).map(function(v){return v.name;});
      if(!names.length)names=all.map(function(v){return v.name;});
    } else names=all.map(function(v){return v.name;});
    return uniq(names);
  }
  function fillHeaderSelects(cur){cur=cur||{};
    if(!('status' in cur))cur.status='';
    if(OC){fillOc('crop','crop',cur.crop);fillOc('station','packing_station',cur.station);fillOc('vessel','transport',cur.vessel);
      fillOc('client','client',cur.client);fillOc('port','port',cur.receiving_port);
      var OL=ocLists();fillSelect('sector',OL.sectors,cur.sector||'');fillSelect('pseason',OL.cropSeasons,cur.season||'');return;}
    if(PT){var PL=ptLists();fillSelect('station',PL.stations,cur.station||'');fillSelect('sector',PL.sectors,cur.sector||'');fillSelect('pseason',PL.cropSeasons,cur.season||'');return;}
    fillSelect('status',STATUS_OPTS,cur.status||'');
    fillSelect('client',REF.clients,cur.client||'');
    fillSubclients(cur.subclient||'');
    fillSelect('packdep',REF.packs,cur.pack_house_departure||'');
  }
  function fillSubclients(cur){
    var cid=REF.clientIdByName[val('client')];
    fillSelect('subclient',(cid&&REF.subByClientId[cid])?REF.subByClientId[cid]:[],(typeof cur==='string'?cur:''));
  }

  /* ---------------------------------------------------------- lines (desktop rows / phone cards) */
  var INTAKE_CALC_TITLE={pascol_pct:'Container Pascol weight (t) × line cartons ÷ Total cartons (read-only; the container value is entered once under Container)',packing_weight:'Cartons × Packaging per carton (t)',
    pascol_net:'Pascol share (t) − Packing weight (t)',weight_variance:'Pascol Net (t) − Net t'};
  /* r2 P1: tonne placeholders on the carton weights */
  var PH={carton_net_weight:'e.g. 0.015',carton_gross_weight:'e.g. 0.0165',packing_factor:'e.g. 0.0011'};   /* DB v0.4: Packing Net Weight placeholder; 2026-11-26: 'e.g.' so it never reads as a value */
  var PACK_BLANK_HINT='type it — Packing t stays blank until then';
  /* r2 P2: required marker (new orchard lines need variety, pallets, cartons, carton net: REQ_LINE) */
  function rq(){return PT?'':' <span class="req" title="Required on new lines">*</span>';}
  /* r2 P1: plain inline warning under a carton weight; painted by paintWarns, no data-k (never saved) */
  function wmsg(i,k){return '<div class="sv2-wmsg" data-wmsg="'+k+'" role="status" hidden></div>';}
  function cin(v,k,cls,list){if(isCitrus()&&(PAS_CALC[k]||(INTAKE&&k==='packing_weight')))return roIn(v,k,INTAKE?INTAKE_CALC_TITLE[k]:'Calculated from the pascol weight, gross, packing and net weights');
    var im=NUMKEYS[k]?' inputmode="'+(OC&&k==='pallets'?'decimal':NUMKEYS[k])+'"':'';
    list=list||(k==='source_type'?'sv2-dl-source':k==='raw_source'?'sv2-dl-rawsource':'');
    return '<input class="cin '+(cls||'')+'" data-k="'+k+'"'+im+(PH[k]?' placeholder="'+PH[k]+'"':'')+(NUMKEYS[k]?'':' dir="auto"')+' value="'+esc(v)+'"'+(list?' list="'+list+'"':'')+'>';}
  /* read-only computed line field (still data-k, so the computed value is what gets saved in the existing column) */
  function roIn(v,k,title){return '<input class="cin num calc" data-k="'+k+'" readonly tabindex="-1" title="'+esc(title)+'" value="'+esc(v)+'">';}
  /* Net t / Gross t: new lines are cartons × carton net/gross t (read-only); existing lines keep their stored, editable value */
  function netIn(d){return d.id?cin(d.net_weight,'net_weight','num'):roIn(d.net_weight,'net_weight','Cartons × carton net t');}
  function grsIn(d){return d.id?cin(d.gross_weight,'gross_weight','num'):roIn(d.gross_weight,'gross_weight','Cartons × carton gross t');}
  function cpct(i){return '<input class="cin num calc" data-cpct="'+i+'" readonly tabindex="-1" title="'+(INTAKE?'This line’s share of the container’s total cartons (line cartons ÷ Total cartons)':'This line’s share of the container’s net weight (worked out when saved)')+'" value="">';}
  /* display-only computed weight (no data-k: never written into the line) */
  function hintIn(attr,i,title){return '<input class="cin num calc" data-'+attr+'="'+i+'" readonly tabindex="-1" title="'+esc(title)+'" value="">';}
  /* old sheet carton gross: read-only hint under the (empty) tonnes input; no data-k, so it is never saved */
  function cgwRawHint(d){var r=d.id?RAWCGW[d.id]:null;return r!=null&&intakeBlank(d.carton_gross_weight)?'<div class="sv2-cgwraw" title="From the old sheet. Not saved: type the carton gross in tonnes to set it">old sheet value: '+esc(r)+'</div>':'';}
  /* weights block shared by the desktop detail row and the phone card */
  function wgroupHTML(d,i,phone){
    function g(lab,inner){return '<div><div class="sv2-dlab">'+lab+'</div>'+inner+'</div>';}
    var old=!!d.id;
    return '<div class="sv2-wgroup'+(phone?' full':'')+'" title="Net t = cartons × carton net t">'+
      '<div class="sv2-wgh">Weights (tonnes) <small>· Net t = cartons × carton net t</small></div>'+
      g('Carton net t'+rq(),cin(d.carton_net_weight,'carton_net_weight','num')+wmsg(i,'carton_net_weight'))+
      g('Carton gross t',cin(d.carton_gross_weight,'carton_gross_weight','num')+cgwRawHint(d)+wmsg(i,'carton_gross_weight'))+
      (INTAKE&&isCitrus()?g('Packaging per carton (t)',cin(d.packing_factor,'packing_factor','num')+wmsg(i,'packing_factor')):'')+
      g(old?'Computed net t · hint':'Net t · auto',hintIn('cnet',i,old?'Cartons × carton net t. A hint only: the stored Net t is not changed':'Cartons × carton net t'))+
      g(old?'Computed gross t · hint':'Gross t · auto',hintIn('cgrs',i,old?'Cartons × carton gross t. A hint only: the stored Gross t is not changed':'Cartons × carton gross t'))+
    '</div>';
  }
  function csel(list,v,k,chg){return '<select class="csel" dir="auto" data-k="'+k+'"'+(chg?' data-chg="'+chg+'"':'')+(k==='carton_type'&&v?' title="'+esc(v)+'"':'')+'>'+opts(list,v)+'</select>';}   /* title: full carton type when the select is cut (selects never carry a validation title) */
  /* 2026-11-17 layout (mock-up "Shipments Form Layout"): main row = what's on the packing list; the panel under it has
     Classification / Weight inputs / Results. Every tonne input shows its kg value underneath (data-echo). */
  var ECHO_KEYS={carton_net_weight:1,carton_gross_weight:1,packing_factor:1};
  function kgText(v){var n=intakeNum(v);if(n===null)return '';return '= '+(n*1000).toLocaleString('en-US',{maximumFractionDigits:2})+' kg';}
  function echo(k){return '<div class="sv2-echo" data-echo="'+k+'"></div>';}
  function catSel(d){return csel(catNames(),d.category,'category','cat').replace('class="csel"','class="csel sv2-cat" aria-label="Category"').replace('<option value=""></option>','<option value="">Category…</option>');}
  function packedAt(d){return '<select class="csel" dir="auto" data-k="pack_house" aria-label="Packed at" title="'+esc(d.pack_house||'Same as loaded at')+'">'+opts(REF.packs,d.pack_house).replace('<option value=""></option>','<option value="">Same as loaded at</option>')+'</select>';}
  function classFields(d,g){var cit=isCitrus();
    return (hasLot()?g('Lot #',cin(d.lot,'lot','mono')):'')+g('Daltex class',cin(d.daltex_class,'daltex_class'))+g('Client class',cin(d.client_class,'client_class'))+
      g('Brand',cin(d.brand,'brand'))+g('Packing',cin(d.packaging_type,'packaging_type'))+(cit?g('Caliber',cin(d.caliber,'caliber','mono')):'')+
      (cit&&REF.jde?g('Net / --',netSel(d)):'')+
      g('Count',cin(d.count_size,'count_size','mono'))+g('Source type',cin(d.source_type,'source_type'))+
      g('Raw source',cin(d.raw_source,'raw_source'),1)+g('Trace code',cin(d.traceability_code,'traceability_code','mono'),1);}
  function weightFields(d,i,g,withNet){var cit=isCitrus(),old=!!d.id;
    return (withNet?g('Carton net'+u('t')+rq(),cin(d.carton_net_weight,'carton_net_weight','num')+echo('carton_net_weight')+wmsg(i,'carton_net_weight')):'')+
      g('Carton gross'+u('t'),cin(d.carton_gross_weight,'carton_gross_weight','num')+echo('carton_gross_weight')+cgwRawHint(d)+wmsg(i,'carton_gross_weight'))+
      (INTAKE&&cit?g('Packaging per carton'+u('(t)'),cin(d.packing_factor,'packing_factor','num')+echo('packing_factor')+wmsg(i,'packing_factor')):'')+
      (cit&&!INTAKE?g('Pascol weight'+u('t')+' · weighbridge',cin(d.pascol_weight,'pascol_weight','num'))+g('Packing weight'+u('t'),cin(d.packing_weight,'packing_weight','num')):'')+
      (old?g('Computed net'+u('t')+' · hint',hintIn('cnet',i,'Cartons × carton net t. A hint only: the stored Net t is not changed'))+
           g('Computed gross'+u('t')+' · hint',hintIn('cgrs',i,'Cartons × carton gross t. A hint only: the stored Gross t is not changed')):'');}
  function resultFields(d,i,g){var cit=isCitrus();
    return g('Container %'+autoTag(),cpct(i))+
      (cit?(INTAKE?g('Pascol share'+u('t')+autoTag(),cin(d.pascol_pct,'pascol_pct','num'))+g('Packing'+u('t')+autoTag(),cin(d.packing_weight,'packing_weight','num'))
              :g('Pascol actual %'+autoTag(),cin(d.pascol_pct,'pascol_pct','num')))+
        g('Pascol net'+u('t')+autoTag(),cin(d.pascol_net,'pascol_net','num'))+g('Variance'+u('t')+autoTag(),cin(d.weight_variance,'weight_variance','num'))+
        (INTAKE?'<div class="sv2-pend" data-pend="'+i+'" hidden></div>':'')+
        (REF.jde?g('JDE item code'+autoTag(),'<div class="sv2-jde" data-jde="'+i+'"></div>',1):''):'');}
  function panelHTML(d,i){
    function g(lab,inner,wide){return '<div'+(wide?' class="s2"':'')+'><div class="sv2-dlab">'+lab+'</div>'+inner+'</div>';}
    return '<div class="sv2-panel">'+
      '<div class="sv2-blk"><div class="sv2-bt">Classification</div><div class="sv2-bgrid">'+classFields(d,g)+'</div></div>'+
      '<div class="sv2-blk"><div class="sv2-bt">Weight inputs</div>'+weightFields(d,i,g,false)+'</div>'+
      '<div class="sv2-blk"><div class="sv2-bt">Results</div><div class="sv2-rgrid" data-rgrid="'+i+'">'+resultFields(d,i,g)+'</div></div>'+
    '</div>';
  }
  function headHTML(){
    return '<tr><th></th><th>#</th><th>Variety'+rq()+'</th><th>Carton type</th><th>Packed at</th>'+
      '<th class="num">Pallets'+rq()+'</th><th class="num">Cartons'+rq()+'</th><th class="num">Carton net'+u('t')+rq()+'</th><th class="num">Net'+u('t')+'</th><th class="num">Gross'+u('t')+'</th><th></th></tr>';
  }
  function rowHTML_line(d,i){
    return '<tr data-line="'+i+'">'+
      '<td><button type="button" class="sv2-ib'+(openRows[i]?' open':'')+'" data-act="toggleLine" data-i="'+i+'" aria-expanded="'+(openRows[i]?'true':'false')+'" aria-label="Line '+(i+1)+' details">⌄</button></td>'+
      '<td class="idx">'+(i+1)+'</td>'+
      '<td style="min-width:170px">'+catSel(d)+csel(varsFor(d.category),d.variety,'variety')+'</td>'+
      '<td>'+csel(REF.cartonTypes,d.carton_type,'carton_type')+'</td>'+
      '<td>'+packedAt(d)+'</td>'+
      '<td>'+cin(d.pallet_count,'pallet_count','num')+'</td><td>'+cin(d.carton_count,'carton_count','num')+'</td>'+
      '<td>'+cin(d.carton_net_weight,'carton_net_weight','num')+echo('carton_net_weight')+wmsg(i,'carton_net_weight')+'</td>'+
      '<td>'+netIn(d)+'</td><td>'+grsIn(d)+'</td>'+
      '<td><button type="button" class="sv2-ib rm" tabindex="-1" data-act="rmLine" data-i="'+i+'" aria-label="Remove line '+(i+1)+'">×</button></td>'+
    '</tr>'+
    '<tr class="det'+(openRows[i]?' open':'')+'" data-line="'+i+'"><td></td><td colspan="10">'+panelHTML(d,i)+'</td></tr>';
  }
  function cardHTML_line(d,i){
    function f(lab,inner,full){return '<div class="'+(full?'full':'')+'"><div class="sv2-dlab">'+lab+'</div>'+inner+'</div>';}
    var title=(d.variety||d.category||'New line'),nt=intakeNum(d.net_weight);
    return '<div class="sv2-lcard'+(openRows[i]?' open':'')+'" data-line="'+i+'">'+
      '<div class="lh" data-act="toggleLine" data-i="'+i+'" role="button" tabindex="0" aria-expanded="'+(openRows[i]?'true':'false')+'">'+
        '<b>'+(i+1)+'. '+esc(title)+'</b><span class="sv2-sp"></span><span class="mono" style="color:var(--text2)">'+esc(d.carton_count||0)+' ctn'+(nt!==null?' · '+nt.toFixed(3)+' t':'')+'</span>'+
      '</div>'+
      '<div class="lb">'+
        f('Category',catSel(d))+f('Variety'+rq(),csel(varsFor(d.category),d.variety,'variety'))+
        f('Carton type',csel(REF.cartonTypes,d.carton_type,'carton_type'))+f('Packed at',packedAt(d))+
        f('Pallets'+rq(),cin(d.pallet_count,'pallet_count','num'))+f('Cartons'+rq(),cin(d.carton_count,'carton_count','num'))+
        weightFields(d,i,f,true)+
        f('Net'+u('t'),netIn(d))+f('Gross'+u('t'),grsIn(d))+
        '<div class="full"><div class="sv2-bt" style="margin:4px 0 6px">Results</div><div class="sv2-rgrid" data-rgrid="'+i+'">'+resultFields(d,i,f)+'</div></div>'+
        '<div class="full"><div class="sv2-bt" style="margin:4px 0 0">Classification</div></div>'+
        classFields(d,f)+
        '<div class="full"><button type="button" class="sv2-btn sec sm" data-act="rmLine" data-i="'+i+'">Remove this line</button></div>'+
      '</div>'+
    '</div>';
  }
  /* ---- potato lines: main row = what's scanned; detail = the rest of the 21 sheet fields ---- */
  /* 2026-11-26 (Tarek): Other crops varieties are stored in English (varieties.name) with the Arabic in raw_names; the form shows
     the Arabic like the other Other crops lists, and the line is saved with the English name. Unknown text is kept as typed. */
  function ocVarFind(t){t=String(t==null?'':t).trim();if(!t)return null;var lt=t.toLowerCase();
    return REF.vars.filter(function(v){return v.ar===t||String(v.name).toLowerCase()===lt;})[0]||null;}
  function ocVarShow(t){var v=OC?ocVarFind(t):null;return v?(v.ar||v.name):(t==null?'':t);}
  function ocVarStore(t){var v=OC?ocVarFind(t):null;return v?v.name:t;}
  function varNames(){var vs=REF.vars;
    if(OC){var o=REF.oc.byCode[val('crop')],cid=o&&o.label_en?REF.ocCats[String(o.label_en).trim().toLowerCase()]:null;
      if(cid)vs=vs.filter(function(v){return !v.category_id||v.category_id===cid;});}
    return vs.map(function(v){return OC?(v.ar||v.name):v.name;});}
  function ptHeadHTML(){return '<tr><th></th><th>#</th><th>Variety</th><th>Pivot</th><th>Farm</th><th>Grade</th><th>Packaging</th><th class="num">Pallets</th><th class="num">Jumbo #</th><th class="num">Sack #</th><th class="num">Std wt t</th><th class="num">Pascol t</th><th></th></tr>';}
  function dl(lab,inner){return '<div><div class="sv2-dlab">'+lab+'</div>'+inner+'</div>';}
  function ptDetail(d,L){
    L=L||PT_LISTS;
    return dl(ar('Lot No','رقم اللوط'),cin(d.lot,'lot','mono'))+dl(ar('Size 1','الحجم1'),cin(d.size1,'size1'))+
      dl(ar('Size 2','الحجم2'),csel(L.size2,d.size2,'size2'))+dl(ar('Crop type','محصول'),csel(L.cropTypes,d.crop_type,'crop_type'))+
      dl(ar('Package weight','وزن العبوه'),cin(d.package_weight,'package_weight','num'))+dl(ar('Pack size','عبوه1'),cin(d.pack_size,'pack_size','num'))+
      dl(ar('Brand','براند'),csel(L.brands,d.brand,'brand'))+dl(ar('Jumbo colour','لون الجامب'),csel(L.colours,d.jumbo_colour,'jumbo_colour'))+
      dl(ar('Sack colour','لون الشيكاره'),csel(L.colours,d.sack_colour,'sack_colour'))+dl(ar('Operation','نوع تشغيل'),csel(L.ops,d.op_type,'op_type'))+
      dl(ar('Condition','الحاله'),csel(L.conditions,d.condition,'condition'));
  }
  function ptRowHTML(d,i){
    var L=ptLists();
    return '<tr data-line="'+i+'">'+
      '<td><button type="button" class="sv2-ib'+(openRows[i]?' open':'')+'" data-act="toggleLine" data-i="'+i+'" title="More: size, brand, colours · المزيد" aria-label="More: size, brand, colours">⌄</button></td>'+
      '<td class="idx">'+(i+1)+'</td>'+
      '<td>'+csel(varNames(),d.variety,'variety')+'</td>'+
      '<td>'+cin(d.pivot,'pivot','','sv2-dl-pivot')+'</td><td>'+cin(d.farm,'farm','','sv2-dl-farm')+'</td>'+
      '<td>'+csel(L.grades,d.grade,'grade')+'</td><td>'+csel(L.packs,d.packaging,'packaging')+'</td>'+
      '<td>'+cin(d.pallets,'pallets','num')+'</td><td>'+cin(d.jumbo_count,'jumbo_count','num')+'</td><td>'+cin(d.sack_count,'sack_count','num')+'</td>'+
      '<td>'+cin(d.standard_weight,'standard_weight','num')+'</td><td>'+cin(d.pascol_weight,'pascol_weight','num')+'</td>'+
      '<td><button type="button" class="sv2-ib rm" data-act="rmLine" data-i="'+i+'" aria-label="Remove line '+(i+1)+'">×</button></td>'+
    '</tr>'+
    '<tr class="det'+(openRows[i]?' open':'')+'" data-line="'+i+'"><td></td><td colspan="12"><div class="sv2-dgrid">'+ptDetail(d,L)+'</div></td></tr>';
  }
  function ptCardHTML(d,i){
    var L=ptLists();
    return '<div class="sv2-lcard'+(openRows[i]?' open':'')+'" data-line="'+i+'">'+
      '<div class="lh" data-act="toggleLine" data-i="'+i+'" role="button" tabindex="0" aria-expanded="'+(openRows[i]?'true':'false')+'">'+
        '<b>'+(i+1)+'. '+esc(d.variety||'New line')+'</b><span class="sv2-sp"></span><span class="mono" style="color:var(--text3)">'+esc(d.pallets||0)+' plt · '+esc(d.standard_weight||0)+' t</span>'+
      '</div>'+
      '<div class="lb">'+
        dl(ar('Variety','الصنف'),csel(varNames(),d.variety,'variety'))+dl(ar('Grade','التصنيف'),csel(L.grades,d.grade,'grade'))+
        dl(ar('Pivot','البيفوت'),cin(d.pivot,'pivot','','sv2-dl-pivot'))+dl(ar('Farm','المزرعه'),cin(d.farm,'farm','','sv2-dl-farm'))+
        dl(ar('Packaging','التعبئه'),csel(L.packs,d.packaging,'packaging'))+dl(ar('Pallets','بالته'),cin(d.pallets,'pallets','num'))+
        dl(ar('Jumbo #','عدد الجامب'),cin(d.jumbo_count,'jumbo_count','num'))+dl(ar('Sack #','عدد الشكاير'),cin(d.sack_count,'sack_count','num'))+
        dl(ar('Standard wt t','الوزن القياسي'),cin(d.standard_weight,'standard_weight','num'))+dl(ar('Pascol t','وزن الباسكول'),cin(d.pascol_weight,'pascol_weight','num'))+
        ptDetail(d,L)+
        '<div class="full"><button type="button" class="sv2-btn sec sm" data-act="rmLine" data-i="'+i+'">Remove this line</button></div>'+
      '</div>'+
    '</div>';
  }
  /* ---- Other crops lines: the potato line + Cartons # and Benz # next to Jumbo # / Sack #; Farm and Packaging are codes.
     Card = 12 main + 11 detail = 23 fields. ---- */
  var OC_CARTONS_AR='عدد الكراتين',OC_BENZ_AR='بنز كرتون';   /* long-tail sheet headers (cols 17/18); Pixel's placeholders were عدد الكراتين / عدد البنز */
  function ocHeadHTML(){return '<tr><th></th><th>#</th><th class="oc-var">Variety</th><th>Pivot</th><th>Farm</th><th>Grade</th><th>Packaging</th><th class="num">Pallets</th><th class="num">Jumbo #</th><th class="num">Sack #</th>'+
    '<th class="num">Cartons #</th><th class="num">Benz #</th><th class="num">Std wt t</th><th class="num">Pascol t</th><th></th></tr>';}
  function ocRowHTML(d,i){
    var L=ocLists();
    return '<tr data-line="'+i+'">'+
      '<td><button type="button" class="sv2-ib'+(openRows[i]?' open':'')+'" data-act="toggleLine" data-i="'+i+'" title="More: size, brand, colours · المزيد" aria-label="More: size, brand, colours">⌄</button></td>'+
      '<td class="idx">'+(i+1)+'</td>'+
      '<td class="oc-var">'+cin(d.variety,'variety','','sv2-dl-variety')+'</td>'+
      '<td>'+cin(d.pivot,'pivot','','sv2-dl-pivot')+'</td><td>'+ocSel('farm',d.farm,'farm')+'</td>'+
      '<td>'+csel(L.grades,d.grade,'grade')+'</td><td>'+ocSel('packing_type',d.packaging,'packaging')+'</td>'+
      '<td>'+cin(d.pallets,'pallets','num')+'</td><td>'+cin(d.jumbo_count,'jumbo_count','num')+'</td><td>'+cin(d.sack_count,'sack_count','num')+'</td>'+
      '<td>'+cin(d.cartons_count,'cartons_count','num')+'</td><td>'+cin(d.benz_count,'benz_count','num')+'</td>'+
      '<td>'+cin(d.standard_weight,'standard_weight','num')+'</td><td>'+cin(d.pascol_weight,'pascol_weight','num')+'</td>'+
      '<td><button type="button" class="sv2-ib rm" data-act="rmLine" data-i="'+i+'" aria-label="Remove line '+(i+1)+'">×</button></td>'+
    '</tr>'+
    '<tr class="det'+(openRows[i]?' open':'')+'" data-line="'+i+'"><td></td><td colspan="14"><div class="sv2-dgrid">'+ptDetail(d,L)+'</div></td></tr>';
  }
  function ocCardHTML(d,i){
    var L=ocLists();
    return '<div class="sv2-lcard'+(openRows[i]?' open':'')+'" data-line="'+i+'">'+
      '<div class="lh" data-act="toggleLine" data-i="'+i+'" role="button" tabindex="0" aria-expanded="'+(openRows[i]?'true':'false')+'">'+
        '<b>'+(i+1)+'. '+esc(d.variety||'New line')+'</b><span class="sv2-sp"></span><span class="mono" style="color:var(--text3)">'+esc(d.pallets||0)+' plt · '+esc(d.standard_weight||0)+' t</span>'+
      '</div>'+
      '<div class="lb">'+
        dl(ar('Variety','الصنف'),cin(d.variety,'variety','','sv2-dl-variety'))+dl(ar('Grade','التصنيف'),csel(L.grades,d.grade,'grade'))+
        dl(ar('Pivot','البيفوت'),cin(d.pivot,'pivot','','sv2-dl-pivot'))+dl(ar('Farm','المزرعه'),ocSel('farm',d.farm,'farm'))+
        dl(ar('Packaging','التعبئه'),ocSel('packing_type',d.packaging,'packaging'))+dl(ar('Pallets','بالته'),cin(d.pallets,'pallets','num'))+
        dl(ar('Jumbo #','عدد الجامب'),cin(d.jumbo_count,'jumbo_count','num'))+dl(ar('Sack #','عدد الشكاير'),cin(d.sack_count,'sack_count','num'))+
        dl(ar('Cartons #',OC_CARTONS_AR),cin(d.cartons_count,'cartons_count','num'))+dl(ar('Benz #',OC_BENZ_AR),cin(d.benz_count,'benz_count','num'))+
        dl(ar('Standard wt t','الوزن القياسي'),cin(d.standard_weight,'standard_weight','num'))+dl(ar('Pascol t','وزن الباسكول'),cin(d.pascol_weight,'pascol_weight','num'))+
        ptDetail(d,L)+
        '<div class="full"><button type="button" class="sv2-btn sec sm" data-act="rmLine" data-i="'+i+'">Remove this line</button></div>'+
      '</div>'+
    '</div>';
  }
  function lockRO(){if(!RO)return;qa('#sv2-vform input,#sv2-vform select,#sv2-vform textarea').forEach(function(f){f.disabled=true;});var t=el('ftitle');if(t)t.textContent='View shipment';}
  function renderLines(){
    setTimeout(lockRO,0);
    if(PT){
      el('lfoot').innerHTML='';
      if(isNarrow()){el('lhead').innerHTML='';el('lbody').innerHTML='';el('lcards').innerHTML=LINES.map(OC?ocCardHTML:ptCardHTML).join('');}
      else{el('lcards').innerHTML='';el('lhead').innerHTML=OC?ocHeadHTML():ptHeadHTML();el('lbody').innerHTML=LINES.map(OC?ocRowHTML:ptRowHTML).join('');}
      recompute();ocVarHint();return;
    }
    if(isNarrow()){
      el('lhead').innerHTML='';el('lbody').innerHTML='';el('lfoot').innerHTML='';
      el('lcards').innerHTML=LINES.map(cardHTML_line).join('');
    } else {
      el('lcards').innerHTML='';
      el('lhead').innerHTML=headHTML();
      el('lbody').innerHTML=LINES.map(rowHTML_line).join('');
      el('lfoot').innerHTML='<tr><td colspan="5" style="font-family:var(--font-body);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--text2)">Totals</td><td id="sv2-tpal">0</td><td id="sv2-tctn">0</td><td></td><td id="sv2-tnet">0.000</td><td id="sv2-tgrs">0.000</td><td></td></tr>';
    }
    recompute();
  }
  function readLineDom(i){
    var nodes=qa('[data-line="'+i+'"]');if(!nodes.length)return null;
    var d=Object.assign(blankLine(),LINES[i]||{});
    nodes.forEach(function(n){Array.prototype.forEach.call(n.querySelectorAll('[data-k]'),function(f){d[f.getAttribute('data-k')]=f.value;});});
    return d;
  }
  function syncLines(){LINES=LINES.map(function(d,i){return readLineDom(i)||d;});}
  function recompute(){
    setTimeout(totFade,0);
    syncLines();
    if(OC){var opp=0,opk=0,osw=0;LINES.forEach(function(d){opp+=numOf(d.pallets);opk+=numOf(d.jumbo_count,1)+numOf(d.sack_count,1)+numOf(d.cartons_count,1)+numOf(d.benz_count,1);osw+=numOf(d.standard_weight);});
      var ost=function(id,v){var e=el(id);if(e)e.textContent=v;};
      ost('slines',LINES.length);ost('spal',(Math.round(opp*1000)/1000).toLocaleString());ost('spacks',opk.toLocaleString());ost('snet',osw.toFixed(2)+' t');return;}
    if(PT){var jn=0,sk=0,pp=0,sw=0,ps=0;LINES.forEach(function(d){jn+=numOf(d.jumbo_count,1);sk+=numOf(d.sack_count,1);pp+=numOf(d.pallets,1);sw+=numOf(d.standard_weight);ps+=numOf(d.pascol_weight);});
      var st=function(id,v){var e=el(id);if(e)e.textContent=v;};
      st('slines',LINES.length);st('spal',pp.toLocaleString());st('sjumbo',jn.toLocaleString());st('ssack',sk.toLocaleString());st('snet',sw.toFixed(2)+' t');st('spas',ps.toFixed(2)+' t');return;}
    calcNewLineWeights();
    if(isCitrus()&&PAS_LIVE){if(INTAKE)calcPascolIntake();else calcPascol();}
    var pal=0,ctn=0,net=0,grs=0;
    LINES.forEach(function(d){pal+=numOf(d.pallet_count,1);ctn+=numOf(d.carton_count,1);net+=numOf(d.net_weight);grs+=numOf(d.gross_weight);});
    var set=function(id,v){var e=el(id);if(e)e.textContent=v;};
    set('tpal',pal.toLocaleString());set('tctn',ctn.toLocaleString());set('tnet',net.toFixed(3));set('tgrs',grs.toFixed(3));
    paintJde();
    var html=function(id,v){var e=el(id);if(e)e.innerHTML=v;};
    set('slines',LINES.length);set('spal',pal.toLocaleString());
    html('snet',net.toFixed(3)+' <small>· '+grs.toFixed(3)+'</small>');
    /* kg echo under every tonne input (lines + header) */
    LINES.forEach(function(d,i){Object.keys(ECHO_KEYS).forEach(function(k){qa('[data-line="'+i+'"] [data-echo="'+k+'"]').forEach(function(e){var tx=kgText(d[k]),hint=!tx&&k==='packing_factor'&&INTAKE;   /* 2026-11-26: blank packaging per carton says why Packing t is empty (same reserved line) */
      e.textContent=hint?PACK_BLANK_HINT:tx;e.classList.toggle('hint',hint);e.title=hint?PACK_BLANK_HINT:'';});});});
    if(INTAKE){var tc=val('tcartons'),tcN=intakeNum(tc,1),match=tcN!==null&&tcN>0&&ctn===tcN;
      html('sctn',ctn.toLocaleString()+(tcN?' <small>/ '+tcN.toLocaleString()+'</small>':''));
      var cw=el('sctn-w');if(cw)cw.classList.toggle('warn',!!tcN&&!match);
      var te=el('tcecho');if(te){te.className='sv2-echo'+(tcN&&!match?' warn':tcN?' ok':'');te.textContent=!tcN?'':match?'lines: all '+ctn.toLocaleString()+' entered':ctn<tcN?'lines: '+ctn.toLocaleString()+' · '+(tcN-ctn).toLocaleString()+' to go':'lines: '+ctn.toLocaleString()+' · '+(ctn-tcN).toLocaleString()+' too many';}
      var he=el('hpecho');if(he&&!(el('hpascol')&&el('hpascol').classList.contains('invalid'))){he.className='sv2-echo';he.textContent=kgText(val('hpascol'));}
      LINES.forEach(function(d,i){var s=intakeShareRaw(d.carton_count,tc),v=s===null?'':(Math.round(s*1000)/10).toFixed(1)+' %';qa('[data-cpct="'+i+'"]').forEach(function(f){f.value=v;});
        /* Pascol share / net / variance only firm up once the lines cover every carton */
        qa('[data-pend="'+i+'"]').forEach(function(pe){pe.hidden=false;pe.classList.toggle('ok',match);pe.textContent=match?'All '+tcN.toLocaleString()+' cartons covered.':(tcN?'Pending: lines cover '+ctn.toLocaleString()+' of '+tcN.toLocaleString()+' cartons. These firm up when they match.':'Pending: enter Total cartons to split the Pascol weight.');});
        qa('[data-rgrid="'+i+'"]').forEach(function(rg){rg.classList.toggle('pending',!match);});});
      if(isCitrus()){var hp=intakeNum(val('hpascol')),pk=0;LINES.forEach(function(d){pk+=numOf(d.packing_weight);});
        html('spas',(hp===null?'—':hp.toFixed(3))+' <small>· '+pk.toFixed(3)+'</small>');
        var vr=hp!==null&&match?hp-pk-net:null;
        html('svar',vr===null?'<small>Pending</small>':(vr>=0?'+':'')+vr.toFixed(3)+(hp>0?' <small>'+(vr/hp*100).toFixed(1)+' %</small>':''));}
      var fw=el('ctnwarn');if(fw){var r=intakeCartonFooter(ctn,tc),ok=r.kind==='ok',show=ok||!(r.kind==='missing'&&ctn===0&&!TRIED);fw.classList.toggle('on',show);fw.classList.toggle('ok',ok);fw.textContent=ok?'Line cartons match Total cartons ('+ctn.toLocaleString()+')':show?r.message:'';fw.title=fw.textContent;}   /* 2026-11-26: stays visible (green) once they match, so the bar does not jump */
    }
    else {html('sctn',ctn.toLocaleString());
      LINES.forEach(function(d,i){var n=numOf(d.net_weight),v=net>0&&String(d.net_weight||'').trim()?(Math.round(n/net*1000)/10).toFixed(1)+' %':'';qa('[data-cpct="'+i+'"]').forEach(function(f){f.value=v;});});}
    /* computed net/gross display in the weights block (for existing lines a hint only — never written into the line) */
    LINES.forEach(function(d,i){
      var neg=lineNegWeight(d),n=neg?'':intakeLineNetT(d.carton_count,d.carton_net_weight),g=neg?'':intakeLineGrossT(d.carton_count,d.carton_gross_weight);
      qa('[data-cnet="'+i+'"]').forEach(function(f){f.value=n;});qa('[data-cgrs="'+i+'"]').forEach(function(f){f.value=g;});
    });
    paintWarns();
    paintProblems();
    if(!footRO)placeFoot();
  }
  /* Save bar: "N problems · Go to it" = every field marked invalid on the form right now */
  var TRIED=false;
  function paintProblems(){var b=el('goprob');if(!b)return;var n=qa('#sv2-vform .invalid').length;b.hidden=!n;b.textContent=n?n+' problem'+(n===1?'':'s')+' · Go to it':'';}
  /* open the line (desktop panel row or phone card) that holds a field, without re-rendering (keeps marks and typing) */
  function openFor(f){var box=f&&f.closest('tr.det,.sv2-lcard');if(!box||box.classList.contains('open'))return;
    box.classList.add('open');var li=+box.getAttribute('data-line');openRows[li]=true;
    qa('[data-act="toggleLine"][data-i="'+li+'"]').forEach(function(b){b.classList.add('open');b.setAttribute('aria-expanded','true');});}
  function goProblem(){var f=host.querySelector('#sv2-vform .invalid');if(!f)return;openFor(f);f.scrollIntoView({block:'center'});try{f.focus({preventScroll:true});}catch(e){f.focus();}}
  /* new (unsaved) lines: Net t / Gross t = cartons × carton net / gross t, saved in the existing net_weight / gross_weight columns.
     Existing lines (d.id) keep their stored net/gross — never silently overwritten. */
  function calcNewLineWeights(){
    LINES.forEach(function(d,i){if(d.id)return;
      var neg=lineNegWeight(d);
      var v={net_weight:neg?'':intakeLineNetT(d.carton_count,d.carton_net_weight),gross_weight:neg?'':intakeLineGrossT(d.carton_count,d.carton_gross_weight)};
      Object.keys(v).forEach(function(k){d[k]=v[k];qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.value=v[k];});});
    });
  }
  /* Anna's ranges: amber warn only (class "warn", never "invalid"), never blocks save */
  function warnCell(i,k,on,msg){qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.classList.toggle('warn',on);if(!f.classList.contains('invalid'))f.title=on?msg:'';});
    qa('[data-line="'+i+'"] [data-wmsg="'+k+'"]').forEach(function(m){m.hidden=!on;m.textContent=on?msg:'';});return on;}
  function paintWarns(){
    if(PT)return;var W=INTAKE_WARN;
    var kgL=[],oddL=[],negL=[],pkL=[];   /* r2 P1: line numbers for the footer note; gap 4: kgL = lines that can't be saved (over the max); negL = negative carton weight */
    LINES.forEach(function(d,i){
      var bin=isBinType(d.carton_type);
      var kn=cartonOverMax(d.carton_net_weight,d.carton_type),kg=cartonOverMax(d.carton_gross_weight,d.carton_type);
      var nn=isNegNum(d.carton_net_weight),ng=isNegNum(d.carton_gross_weight),anyNeg=nn||ng;
      /* gap 4: over the max = hard block (red, Save refused); bins skip the per-carton range warning (a bin is 0.55-0.6 t) */
      /* negative: only "can't be negative" under that field; the gross-vs-net range check is skipped while either is negative */
      var a=nn?warnCell(i,'carton_net_weight',true,NEG_WT_MSG):warnCell(i,'carton_net_weight',kn||(!bin&&intakeCartonNetWarn(d.carton_net_weight)),kn?cartonMaxMsg(d.carton_type):'Unusual carton net t (expected '+W.cartonNetMin+'–'+W.cartonNetMax+')');
      var b=ng?warnCell(i,'carton_gross_weight',true,NEG_WT_MSG):warnCell(i,'carton_gross_weight',kg||(!anyNeg&&intakeCartonGrossWarn(d.carton_net_weight,d.carton_gross_weight)),kg?cartonMaxMsg(d.carton_type):'Unusual carton gross t (expected carton net t to carton net t + '+W.grossHeadroom+')');
      var kp=INTAKE&&isCitrus()&&packOverMax(d.packing_factor,d.carton_type);
      warnCell(i,'packing_factor',!!kp,PACK_KG_MSG);
      [['carton_net_weight',kn||nn],['carton_gross_weight',kg||ng]].concat(INTAKE&&isCitrus()?[['packing_factor',kp]]:[]).forEach(function(x){
        if(x[1])markCell(i,x[0],true);
        else if(!lineNumProblem(x[0],d[x[0]],d.carton_type))qa('[data-line="'+i+'"] [data-k="'+x[0]+'"]').forEach(function(f){if(f.classList.contains('invalid')&&String(f.value||'').trim()){f.classList.remove('invalid');f.setAttribute('aria-invalid','false');}});
      });
      if(anyNeg)negL.push(i+1);else if(kn||kg)kgL.push({n:i+1,bin:bin});else if(a||b)oddL.push(i+1);
      if(kp)pkL.push(i+1);
    });
    /* amber note in the Save bar; over-max lines are refused on Save, the rest is warn-only */
    var fw=el('kgwarn');if(fw){var t=[];
      if(negL.length)t.push('Line '+negL.join(', ')+': '+NEG_WT_MSG+'. Can\u2019t be saved.');
      var kc=kgL.filter(function(x){return !x.bin;}).map(function(x){return x.n;}),kb=kgL.filter(function(x){return x.bin;}).map(function(x){return x.n;});
      if(kc.length)t.push('Line '+kc.join(', ')+': '+INTAKE_KG_MSG+'. Over 0.1 t per carton can\u2019t be saved.');
      if(kb.length)t.push('Line '+kb.join(', ')+': '+BIN_MAX_MSG+'. Can\u2019t be saved.');
      if(pkL.length)t.push('Line '+pkL.join(', ')+': '+PACK_KG_MSG+'. Can not be saved.');
      if(oddL.length)t.push('Line '+oddL.join(', ')+': unusual carton weights. Check before saving.');
      fw.textContent=t.join(' ');fw.title=fw.textContent;fw.classList.toggle('on',t.length>0);}
  }
  /* intake flag on (citrus): split the one container Pascol weight by cartons, like the sheet.
     Pascol share (t) = pascol × (line cartons ÷ Total cartons); Packing = cartons × packing factor;
     Pascol Net = Pascol share − Packing; Variance = Pascol Net − Net. Written into the existing line keys. */
  function calcPascolIntake(){
    var hp=val('hpascol'),tc=val('tcartons'),p=intakeNum(hp);
    LINES.forEach(function(d,i){
      d.pascol_weight=hp;   /* single header value copied into each line (today's line payload) */
      var s=intakeShareRaw(d.carton_count,tc),ok=p!==null&&s!==null,pa=ok?p*s:0;   /* unrounded share, so 1/3 splits exactly */
      var pw=intakePackingWeight(d.carton_count,d.packing_factor);
      /* existing rows have no packing_factor yet: keep the stored packing weight instead of blanking it */
      if(d.id&&intakeBlank(d.packing_factor))pw=intakeBlank(d.packing_weight)?'':String(d.packing_weight);
      var pn=pa-numOf(pw);
      var v={pascol_pct:ok?intakeR6(pa):'',packing_weight:pw,pascol_net:ok?intakeR6(pn):'',weight_variance:ok&&!lineNegWeight(d)?intakeR6(pn-numOf(d.net_weight)):''};
      Object.keys(v).forEach(function(k){d[k]=v[k];qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.value=v[k];});});
    });
  }

  function calcPascol(){
    var blank=function(v){return String(v==null?'':v).trim()==='';},r6=function(x){return String(Number(x.toFixed(6)));};
    var sg=0;LINES.forEach(function(d){sg+=numOf(d.gross_weight);});
    LINES.forEach(function(d,i){
      var ok=!blank(d.pascol_weight)&&!blank(d.gross_weight)&&sg>0,pct=ok?numOf(d.pascol_weight)*numOf(d.gross_weight)/sg:0,pn=pct-numOf(d.packing_weight);
      var v={pascol_pct:ok?r6(pct):'',pascol_net:ok?r6(pn):'',weight_variance:ok?r6(pn-numOf(d.net_weight)):''};
      Object.keys(v).forEach(function(k){d[k]=v[k];qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.value=v[k];});});
    });
  }
  /* ---------------------------------------------------------- dirty / leave */
  function setDirty(on){if(DIRTY===on)return;DIRTY=on;var c=el('dirty');if(c)c.classList.toggle('on',on);if(O.onDirty)O.onDirty(on);}
  function confirmLeave(){return !DIRTY||window.confirm('You have unsaved changes. Leave without saving?');}
  function onBeforeUnload(e){if(DIRTY){e.preventDefault();e.returnValue='';return '';}}
  window.addEventListener('beforeunload',onBeforeUnload);

  /* ---------------------------------------------------------- header helpers */
  function deriveDate(){
    if(!el('dmonth'))return;
    var v=val('ldate');if(!v){el('dmonth').textContent='—';el('dweek').textContent='—';return;}
    var dt=new Date(v+'T00:00');var m=['January','February','March','April','May','June','July','August','September','October','November','December'];
    el('dmonth').textContent=m[dt.getMonth()];
    var t=new Date(dt);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-((t.getDay()+6)%7));var w1=new Date(t.getFullYear(),0,4);
    el('dweek').textContent=1+Math.round(((t-w1)/86400000-3+((w1.getDay()+6)%7))/7);
  }
  function syncDep(){var cb=el('depdiff');if(!cb)return;var on=cb.checked,w=el('depwrap'),h=el('dephint'),ld=val('ldate');
    if(w)w.hidden=!on;if(h){h.hidden=on;h.textContent='Departure date: same as loading date ('+(ld?fmtDate(ld):'not set')+')';}
    if(!on){var d=el('depdate');if(d)d.classList.remove('invalid');}}
  function setDep(on,v){var cb=el('depdiff'),d=el('depdate');if(!cb)return;cb.checked=!!on;if(d){d.value=on&&v?v:'';d.classList.remove('invalid');}syncDep();}
  function syncCtxStatus(){var st=val('status');var p=el('ctxstatus');if(p){p.className='sv2-pill '+statusClass(st);p.textContent=st||'Status not set';}}
  function validateField(id){var e=el(id);if(!e)return true;var ok=!!String(e.value||'').trim();e.classList.toggle('invalid',!ok);return ok;}
  function setVoyageLock(on){['container','ldate'].forEach(function(id){var e=el(id);if(e){e.readOnly=on;}});var h=el('lockhint');if(h)h.hidden=!on;}
  var HDR_IDS=PT?['container','carta','ldate','vessel','ccount','client','country','country2','port','invoice','permit','workorder']:['container','carta','ldate','vessel','line','booking','invoice','po','etd','eta','arrival','depport','country','port','agent','shipper'];
  if(INTAKE)HDR_IDS=HDR_IDS.concat(['plandate','tcartons','hpascol']);
  if(regionOn())HDR_IDS=HDR_IDS.concat(['sregion']);
  function blankHeader(){HDR_IDS.forEach(function(id){var e=el(id);if(e){e.value='';e.classList.remove('invalid');}});qa('#sv2-vform [data-touched]').forEach(function(e){e.removeAttribute('data-touched');e.classList.remove('invalid');});}
  function readHeader(){
    if(OC)return {container_number:asciiDigits(val('container')),carta:asciiDigits(val('carta')),loading_date:val('ldate'),crop:val('crop'),station:val('station'),sector:val('sector'),
      season:val('pseason'),container_count:val('ccount'),client:val('client'),receiving_country:val('country'),country2:val('country2'),
      receiving_port:val('port'),vessel:val('vessel'),invoice_no:val('invoice'),permit_no:val('permit'),work_order:val('workorder')};
    if(PT)return {container_number:val('container'),carta:val('carta'),loading_date:val('ldate'),station:val('station'),sector:val('sector'),
      season:val('pseason'),container_count:val('ccount'),client:val('client'),receiving_country:val('country'),country2:val('country2'),
      receiving_port:val('port'),vessel:val('vessel'),invoice_no:val('invoice'),permit_no:val('permit'),work_order:val('workorder')};
    var h={product_id:PRODUCT,container_number:val('container'),carta:val('carta'),loading_date:val('ldate'),
      shipping_status:val('status'),vessel:val('vessel'),shipping_line:val('line'),booking_no:val('booking'),
      invoice_no:val('invoice'),po_number:val('po'),etd:val('etd'),eta:val('eta'),arrival_date:val('arrival'),
      departure_port:val('depport'),receiving_country:val('country'),receiving_port:val('port'),client:val('client'),
      subclient:val('subclient'),agent:val('agent'),shipper:val('shipper'),pack_house_departure:val('packdep')};
    if(SV2_SEND_DEPARTURE_DATE){var cb=el('depdiff');h.departure_date=(cb&&cb.checked)?val('depdate'):val('ldate');}
    if(INTAKE){h.planned_loading_date=val('plandate');h.total_cartons=val('tcartons');if(el('hpascol'))h.pascol_weight=val('hpascol');}
    if(regionLive()&&el('sregion'))h.sales_region=val('sregion');
    return h;
  }
  function setSeasonChip(){var c=el('ctxseason');if(c)c.textContent=MODE==='create'?('Season '+(SEASON_NAME||'—')+' · from the sidebar'):'Season kept from the record';}

  /* ---------------------------------------------------------- feedback */
  var toastEl=null,toastT=null;
  function toast(msg){
    if(!toastEl){toastEl=document.createElement('div');toastEl.className='sv2-toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);}
    toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){if(toastEl)toastEl.classList.remove('on');},2400);
  }
  var undoEl=null,undoT=null;
  function undoToast(msg,fn){
    if(undoEl)undoEl.remove();clearTimeout(undoT);
    undoEl=document.createElement('div');undoEl.className='sv2-undo';undoEl.setAttribute('role','status');
    undoEl.innerHTML='<span>'+esc(msg)+'</span><button type="button">Undo</button>';
    undoEl.querySelector('button').addEventListener('click',function(){if(undoEl){undoEl.remove();undoEl=null;}clearTimeout(undoT);fn();});
    document.body.appendChild(undoEl);undoT=setTimeout(function(){if(undoEl){undoEl.remove();undoEl=null;}},7000);
  }
  var BTN_LABEL={reload:'Reload',retry:'Retry',openExisting:'Open existing'};
  function showFormError(msg,act,warn){
    var e=el('ferr');if(!e)return;
    e.innerHTML='<div class="sv2-banner'+(warn?'':' err')+'" role="alert"><span aria-hidden="true">!</span><span style="flex:1;white-space:pre-line">'+esc(msg)+'</span>'+(act?'<button type="button" class="sv2-btn sec sm" data-act="'+act+'">'+(BTN_LABEL[act]||'Retry')+'</button>':'')+'</div>';
    if(e.getBoundingClientRect().top<0)e.scrollIntoView({block:'center'});
  }
  function clearFormError(){var e=el('ferr');if(e)e.innerHTML='';}
  /* v0.2 P3: neutral note (Other crops preview), not an error */
  function showFormNote(msg){var e=el('ferr');if(!e)return;e.innerHTML='<div class="sv2-banner info" role="status"><span aria-hidden="true">i</span><span style="flex:1;white-space:pre-line">'+esc(msg)+'</span></div>';}
  function showOverlay(on){var o=el('overlay');if(o)o.classList.toggle('on',on);}
  function friendlyErr(err){
    if(!err)return 'Something went wrong.';
    var m=String(err.message||err||'');
    if(err.code==='42501'||/permission/i.test(m))return m||'You don’t have permission to do this.';
    if(/jwt|not authenticated|401/i.test(m))return 'Your session expired. Reload the page and sign in to DalOS.';
    if(/Failed to fetch|NetworkError|network/i.test(m))return 'No connection. Check the network and try again — nothing was saved.';
    return m;
  }

  /* ---------------------------------------------------------- season confirm (new shipments only) */
  var modalEl=null;
  function closeModal(){if(modalEl){modalEl.remove();modalEl=null;}}
  function askSeason(onOk){
    closeModal();
    var active=O.trueActiveSeasonName||'the active season';
    modalEl=document.createElement('div');modalEl.className='sv2-modal';
    modalEl.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-labelledby="sv2-mt"><h3 id="sv2-mt">Save into '+esc(SEASON_NAME)+'?</h3>'+
      '<div>You are viewing <b>'+esc(SEASON_NAME)+'</b>, which is not the current active season (<b>'+esc(active)+'</b>). This shipment will be filed under <b>'+esc(SEASON_NAME)+'</b>.</div>'+
      '<div class="row"><button type="button" class="sv2-btn sec" data-m="no">Cancel</button><button type="button" class="sv2-btn" data-m="ok">Save to '+esc(SEASON_NAME)+'</button></div></div>';
    modalEl.addEventListener('click',function(e){
      var b=e.target.closest('[data-m]');
      if(e.target===modalEl||(b&&b.getAttribute('data-m')==='no')){closeModal();return;}
      if(b&&b.getAttribute('data-m')==='ok'){closeModal();SEASON_OK=true;onOk();}
    });
    modalEl.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
    document.body.appendChild(modalEl);
    var ok=modalEl.querySelector('[data-m="ok"]');if(ok)ok.focus();
  }

  /* ---------------------------------------------------------- duplicate pre-check (create only) */
  var EXISTING_IDX=-1;
  function normCn(s){return String(s||'').trim().replace(/\s+/g,' ').toUpperCase();}
  function checkExisting(){
    if(MODE!=='create')return false;
    var cn=normCn(val('container')),ld=val('ldate');EXISTING_IDX=-1;
    if(!cn||!ld)return false;
    EXISTING_IDX=DATA.findIndex(function(c){return normCn(c.ref)===cn&&c.hdr.loaded===ld;});
    if(EXISTING_IDX>=0){showFormError('Shipment '+cn+' loaded '+fmtDate(ld)+' already exists. Open it to add lines or make changes.','openExisting',true);return true;}
    var f=el('ferr');if(f&&/already exists/.test(f.textContent))clearFormError();
    return false;
  }

  /* ---------------------------------------------------------- line checks (before save) */
  var CARTON_WT={carton_net_weight:1,carton_gross_weight:1};
  /* Tarek 2026-11-17: a Returned shipment may have negative cartons (returns are booked negative); weights stay non-negative */
  function isReturned(){return !PT&&val('status')==='Returned';}
  function lineNumProblem(k,v,ct){var pr=numProblem(v,INTKEYS[k]&&!(OC&&k==='pallets'));if(!pr&&OC&&NUMKEYS[k]&&isNegNum(v))pr='can\u2019t be negative';if(!pr&&!PT&&NONNEG_LINE[k]&&isNegNum(v)&&!(k==='carton_count'&&isReturned()))pr=k==='carton_count'?'can\u2019t be negative unless the status is Returned':'can\u2019t be negative';
    if(!pr&&!PT&&CARTON_WT[k]&&cartonOverMax(v,ct))pr=isBinType(ct)?'over 1 t per bin':'over 0.1 t per carton (looks like kg)';
    if(!pr&&!PT&&k==='packing_factor'&&packOverMax(v,ct))pr='over '+packMax(ct)+' t per carton (looks like kg)';return pr;}
  function lineCt(el){var ln=el&&el.closest&&el.closest('[data-line]');if(!ln)return '';var f=qa('[data-line="'+ln.getAttribute('data-line')+'"] [data-k="carton_type"]')[0];return f?f.value:'';}
  function lineLabel(k){var m={variety:'Variety',pallet_count:'Pallets',net_weight:'Net t',pallets:'Pallets',standard_weight:'Standard wt',carton_count:'Cartons',
    gross_weight:'Gross t',jumbo_count:'Jumbo #',sack_count:'Sack #',pascol_weight:'Pascol t',package_weight:'Package weight',pack_size:'Pack size',
    carton_net_weight:'Carton net t',carton_gross_weight:'Carton gross t',pascol_pct:INTAKE?'Pascol share t':'Pascol %',packing_weight:'Packing t',packing_factor:'Packaging per carton t',pascol_net:'Pascol net t',weight_variance:'Variance t'};return m[k]||k;}
  /* flag on: pascol_weight is copied in from the header, so it doesn't count as the user touching a line */
  function isUntouched(d){return !d.id&&Object.keys(d).every(function(k){return k==='id'||k==='net_flag'||k.charAt(0)==='_'||(INTAKE&&k==='pascol_weight')||String(d[k]||'').trim()==='';});}
  /* new orchard lines: Net t is computed (cartons × carton net t, read-only), so cartons + carton net are what's required */
  var REQ_LINE=PT?['variety','pallets','standard_weight']:['variety','pallet_count','carton_count','carton_net_weight'];
  function markCell(i,k,on){qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.classList.toggle('invalid',on);f.setAttribute('aria-invalid',on?'true':'false');});}
  function checkLines(){
    var problems=[];
    LINES.forEach(function(d,i){
      var miss=[],bad=[];
      if(!d.id)REQ_LINE.forEach(function(k){var e=!String(d[k]||'').trim();markCell(i,k,e);if(e)miss.push(lineLabel(k));});   /* new lines: key fields required */
      Object.keys(NUMKEYS).forEach(function(k){if(!(k in d))return;var pr=lineNumProblem(k,d[k],d.carton_type);if(pr){markCell(i,k,true);bad.push(lineLabel(k)+' '+pr);}else if(REQ_LINE.indexOf(k)<0||d.id)markCell(i,k,false);});
      if(miss.length)problems.push('Line '+(i+1)+': '+miss.join(', ')+' missing');
      if(bad.length)problems.push('Line '+(i+1)+': '+bad.join(', '));
    });
    return problems;
  }

  /* ---------------------------------------------------------- save */
  function setSaving(on){SAVING=on;qa('[data-act="save"]').forEach(function(b){b.disabled=on;b.textContent=on?'Saving…':'Save shipment';});qa('[data-act="saveNew"]').forEach(function(b){b.disabled=on;});}
  /* Save & new: the next container usually shares these, so they carry over (lines, container, dates and weights don't) */
  var SAVE_NEW=false,KEEP_TEXT=['vessel','line','depport','country','port','agent','shipper'].concat(regionOn()?['sregion']:[]);
  function keepHeader(){var k={status:val('status'),client:val('client'),subclient:val('subclient'),pack_house_departure:val('packdep')};KEEP_TEXT.forEach(function(id){k[id]=val(id);});return k;}
  function restoreHeader(k){fillHeaderSelects({status:k.status,client:k.client,subclient:k.subclient,pack_house_departure:k.pack_house_departure});
    KEEP_TEXT.forEach(function(id){var e=el(id);if(e)e.value=k[id]||'';});syncCtxStatus();setDirty(false);}
  function submitShip(){
    if(RO)return;
    if(SAVING)return;
    clearFormError();TRIED=true;
    var okR=!OC||validateField('crop'),okC=validateField('container'),okL=validateField('ldate'),okS=PT||validateField('status');
    var missH=[];if(!okR)missH.push('Crop');if(!okC)missH.push('Container No.');if(!okL)missH.push(INTAKE?'Actual loading date':'Loading Date');if(!okS)missH.push('Shipping Status');
    if(missH.length){SAVE_NEW=false;showFormError(missH.join(', ')+(missH.length>1?' are':' is')+' required.');el(!okR?'crop':!okC?'container':!okL?'ldate':'status').focus();return;}
    /* v0.2 (Ash): no RPC, no edge function, no write. v0.2 P3: the required checks above still run, then a neutral note */
    if(OC&&!OC_WRITES){SAVE_NEW=false;showFormNote(OC_PENDING+'. Nothing was saved.');return;}
    if(!PT&&el('depdiff')&&el('depdiff').checked){var dd=val('depdate'),dErr=!dd?'Departure date is required':(dd<val('ldate')?'Departure date can\'t be before the loading date':(!SV2_SEND_DEPARTURE_DATE?'Preview only: departure date can\'t be saved yet. Untick the box to save':''));
      el('depdate').classList.toggle('invalid',!!dErr);if(dErr){showFormError(dErr+'.');el('depdate').focus();return;}}
    if(INTAKE){var hb=[];[['tcartons',1,'Total cartons'],['hpascol',0,'Pascol weight']].forEach(function(x){var e=el(x[0]);if(!e)return;
        var pr=numProblem(e.value,x[1])||(isNegNum(e.value)?'can\u2019t be negative':null)||(x[0]==='hpascol'&&(intakeNum(e.value)||0)>PASCOL_MAX?'over '+PASCOL_MAX+' t for one container (looks like kg)':null);e.classList.toggle('invalid',!!pr);e.setAttribute('aria-invalid',pr?'true':'false');if(pr)hb.push(x[2]+' '+pr);});
      if(hb.length){showFormError('Fix these before saving:\n'+hb.join('\n'));var hf=host.querySelector('.sv2-in.invalid');if(hf)hf.focus();return;}}
    if(checkExisting())return;
    recompute();   /* sync + computed net/gross on new lines before the checks */
    /* drop new lines nobody touched (the form starts with one blank line) */
    var before=LINES.length;LINES=LINES.filter(function(d){return !isUntouched(d);});
    if(LINES.length!==before){openRows={};renderLines();}
    if(!LINES.length){LINES=[blankLine()];openRows={0:true};renderLines();showFormError(PT?'Add at least one line with a variety, pallets and weight.':'Add at least one line with a variety, pallets, cartons and carton net.');return;}
    var problems=checkLines();
    if(problems.length){showFormError('Fix these before saving:\n'+problems.join('\n'));qa('.invalid[data-k]').forEach(openFor);paintProblems();var f=host.querySelector('.invalid[data-k]');if(f)f.focus();return;}
    var hdr=readHeader();
    if(MODE==='edit'&&ROW_VERSION)hdr.row_version=ROW_VERSION;   /* fixpkg: stale check (server compares, PT409 if changed) */
    if(MODE==='create'){
      if(!SEASON){showFormError('Pick a season in the sidebar before saving.');return;}
      if(O.trueActiveSeasonId&&SEASON!==O.trueActiveSeasonId&&!SEASON_OK){askSeason(submitShip);return;}
      hdr.season_id=SEASON;
    }
    SEASON_OK=false;
    var lines=LINES.map(function(d){var c=Object.assign({},d);Object.keys(c).forEach(function(k){if(k.charAt(0)==='_')delete c[k];});Object.keys(NUMKEYS).forEach(function(k){if(c[k]!=null&&c[k]!=='')c[k]=asciiDigits(c[k]);});delete c.carton_gross_weight_raw;
      if(OC&&c.variety)c.variety=ocVarStore(c.variety);   /* 2026-11-26: Arabic shown, English name saved */
      /* "Packed at" left as "Same as loaded at" on a NEW line takes the header pack house (stored lines are never changed this way) */
      if(!PT&&!c.id&&!String(c.pack_house||'').trim()&&hdr.pack_house_departure)c.pack_house=hdr.pack_house_departure;
      return c;});
    if(hdr.container_count)hdr.container_count=asciiDigits(hdr.container_count);
    if(hdr.total_cartons)hdr.total_cartons=asciiDigits(hdr.total_cartons);
    if(hdr.pascol_weight)hdr.pascol_weight=asciiDigits(hdr.pascol_weight);
    /* new intake columns only go to the server once the DB package is applied (flag on) */
    if(!INTAKE){delete hdr.planned_loading_date;delete hdr.total_cartons;delete hdr.pascol_weight;
      lines.forEach(function(c){delete c.packing_factor;});}
    /* DB v0.4: Packing Net Weight goes out under the new JSON key packing_net_weight (the RPCs still accept the old key
       packing_factor; if both are sent the new one wins). The DB column and the maths keep the name packing_factor. */
    if(INTAKE)lines.forEach(function(c){if('packing_factor' in c){c.packing_net_weight=c.packing_factor;delete c.packing_factor;}});
    /* DB v0.4 (Anna S5): an empty carton gross is sent as null, never '' (the RPC stores NULL either way, but '' also landed
       in raw_data 'Carton Gross Weight' as an empty string on new rows; null is dropped there) */
    lines.forEach(function(c){if(c.carton_gross_weight!=null&&String(c.carton_gross_weight).trim()==='')c.carton_gross_weight=null;});
    /* r2 P2: flag on (citrus) Pascol is one value per container. No per-line Pascol input; each line's pascol_weight
       is the header value (the same value the server writes to every sibling's pascol_weight column), never a
       stale per-line value from an untouched old row. */
    if(INTAKE&&isCitrus()&&'pascol_weight' in hdr)lines.forEach(function(c){c.pascol_weight=hdr.pascol_weight;});
    setSaving(true);
    var call=(MODE==='edit')
      ?sb.rpc(OC?'edit_shipment_v2_othercrops_full':PT?'edit_shipment_v2_potato_full':'edit_shipment_v2_full',{p_header:hdr,p_lines:lines,p_deleted_ids:EDIT.deletedIds})
      :sb.rpc(OC?'save_shipment_v2_othercrops_full':PT?'save_shipment_v2_potato_full':'save_shipment_v2_full',{p_header:hdr,p_lines:lines});
    Promise.resolve(call).then(function(res){
      if(dead)return;
      setSaving(false);
      if(res.error){
        var stale=isStaleErr(res.error);
        if(res.error.code==='23505'&&MODE==='create'){checkExisting();if(EXISTING_IDX>=0)return;}
        showFormError(friendlyErr(res.error),stale&&MODE==='edit'?'reload':null);return;
      }
      if(!res.data||res.data.ok!==true){showFormError('The shipment was not saved. Try again.');return;}
      toast(MODE==='edit'?'Shipment updated':'Shipment saved');
      setDirty(false);
      if(SAVE_NEW&&!PT){SAVE_NEW=false;var keep=keepHeader();openCreate();restoreHeader(keep);loadList();return;}
      var c=(res.data.container_number)||hdr.container_number,l=(res.data.loading_date)||hdr.loading_date;
      MODE='edit';EDIT={container:c,loaded:l,deletedIds:[]};
      loadForEdit(c,l);loadList();
    },function(e){if(dead)return;setSaving(false);showFormError(friendlyErr(e));});
  }

  /* ---------------------------------------------------------- delete shipment (edit mode) */
  /* Deletes the whole open shipment: every line of this product + container + loading date, as last loaded.
     Type-to-confirm; the server refuses if the stored lines differ from LOADED_IDS (PT409; was 40001) and logs each row to audit_log. */
  function syncDelBtn(){var b=el('delship');if(b)b.hidden=!(MODE==='edit'&&LOADED_IDS.length>0);}
  var DELETING=false;
  function askDelete(){
    if(MODE!=='edit'||!LOADED_IDS.length||DELETING)return;
    closeModal();
    var cn=EDIT.container,ld=EDIT.loaded,n=LOADED_IDS.length;
    modalEl=document.createElement('div');modalEl.className='sv2-modal';
    modalEl.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-labelledby="sv2-mt"><h3 id="sv2-mt">Delete this shipment?</h3>'+
      '<div><b>'+esc(cn)+'</b> loaded <b>'+esc(fmtDate(ld))+'</b> · '+esc(PRODUCT_NAME)+'. All <b>'+n+'</b> line'+(n===1?'':'s')+' will be deleted. This can’t be undone here.'+
      (DIRTY?' Your unsaved changes on this form are discarded.':'')+'</div>'+
      '<label style="display:block;margin-top:12px">Type the container number to confirm<input class="sv2-delin" data-m="cn" autocomplete="off" spellcheck="false" aria-label="Container number"></label>'+
      '<div class="sv2-delerr" role="alert" style="color:var(--red);margin-top:8px;white-space:pre-line"></div>'+
      '<div class="row"><button type="button" class="sv2-btn sec" data-m="no">Cancel</button><button type="button" class="sv2-btn sv2-delgo" data-m="ok" disabled>Delete shipment</button></div></div>';
    var inp=modalEl.querySelector('[data-m="cn"]'),go=modalEl.querySelector('[data-m="ok"]');
    var match=function(){return normCn(inp.value)===normCn(cn);};
    inp.addEventListener('input',function(){go.disabled=!match()||DELETING;});
    modalEl.addEventListener('click',function(e){
      var b=e.target.closest('[data-m]');
      if(DELETING)return;
      if(e.target===modalEl||(b&&b.getAttribute('data-m')==='no')){closeModal();return;}
      if(b&&b.getAttribute('data-m')==='ok'&&match())doDelete(cn,ld,LOADED_IDS.slice());
    });
    modalEl.addEventListener('keydown',function(e){if(e.key==='Escape'&&!DELETING)closeModal();if(e.key==='Enter'&&e.target===inp&&match()&&!DELETING)doDelete(cn,ld,LOADED_IDS.slice());});
    document.body.appendChild(modalEl);inp.focus();
  }
  function doDelete(cn,ld,ids){
    if(OC&&!OC_WRITES){var er0=modalEl&&modalEl.querySelector('.sv2-delerr');if(er0)er0.textContent='Preview: deleting turns on after the database step. Nothing was deleted.';return;}
    DELETING=true;
    var go=modalEl&&modalEl.querySelector('[data-m="ok"]'),er=modalEl&&modalEl.querySelector('.sv2-delerr');
    if(go){go.disabled=true;go.textContent='Deleting…';}if(er)er.textContent='';
    Promise.resolve(sb.rpc('delete_shipment_v2_container',{p_product:PRODUCT,p_container:cn,p_loaded:ld,p_ids:ids,p_row_version:ROW_VERSION||null})).then(function(res){
      DELETING=false;if(dead)return;
      if(res.error||!res.data||res.data.ok!==true){
        var m=res.error?friendlyErr(res.error):'The shipment was not deleted. Try again.';
        if(isStaleErr(res.error))m+='\nClose this, reload the shipment and try again.';
        if(er)er.textContent=m;if(go){go.textContent='Delete shipment';go.disabled=false;}return;
      }
      closeModal();
      toast('Shipment deleted ('+res.data.deleted+' line'+(res.data.deleted===1?'':'s')+')');
      formSeq++;setDirty(false);LOADED_IDS=[];ROW_VERSION='';MODE='list';EDIT={container:null,loaded:null,deletedIds:[]};syncDelBtn();
      showView('list');loadList();
    },function(e){DELETING=false;if(dead)return;if(er)er.textContent=friendlyErr(e);if(go){go.textContent='Delete shipment';go.disabled=false;}});
  }

  /* ---------------------------------------------------------- edit load */
  function loadForEdit(container,loaded){
    var my=++formSeq;
    clearFormError();blankHeader();setDep(false);LINES=[];RAWCGW={};openRows={};LOADED_IDS=[];ROW_VERSION='';syncDelBtn();renderLines();
    if(OC&&!OC_WRITES){showFormNote('Preview: opening saved Other crops shipments turns on after the database step.');return Promise.resolve();}
    setVoyageLock(true);showOverlay(true);
    var getCall=OC?sb.rpc('get_shipment_v2_othercrops_container',{p_container:container,p_loaded:loaded})
                  :PT?sb.rpc('get_shipment_v2_potato_container',{p_container:container,p_loaded:loaded})
                  :sb.rpc('get_shipment_v2_container',{p_container:container,p_loaded:loaded,p_product:PRODUCT});
    return Promise.resolve(getCall).then(function(res){
      if(dead||my!==formSeq)return;
      showOverlay(false);
      if(res.error){showFormError('Could not load '+container+' — '+friendlyErr(res.error),'retry');return;}
      var data=res.data||{},h=data.header,lines=data.lines||[];
      if(!h){showFormError('Shipment '+container+' loaded '+fmtDate(loaded)+' was not found.');return;}
      if(h.product_id&&h.product_id!==PRODUCT){showFormError('This container belongs to another product.');return;}
      LOADED_IDS=lines.map(function(l){return l.id;}).filter(Boolean);ROW_VERSION=data.row_version||'';syncDelBtn();
      var setv=function(id,v){var e=el(id);if(e)e.value=(v==null?'':v);};
      if(PT){
        setv('container',h.container_number);setv('carta',h.carta);setv('ldate',h.loading_date);setv('vessel',h.vessel);setv('ccount',h.container_count);
        setv('client',h.client);setv('country',h.receiving_country);setv('country2',h.country2);setv('port',h.receiving_port);
        setv('invoice',h.invoice_no);setv('permit',h.permit_no);setv('workorder',h.work_order);
        fillHeaderSelects({station:h.station,sector:h.sector,season:h.season,crop:h.crop,vessel:h.vessel,client:h.client,receiving_port:h.receiving_port});deriveDate();
        LINES=lines.map(function(l){var d=blankLine();Object.keys(d).forEach(function(k){if(l[k]!=null)d[k]=NUMKEYS[k]?tidyNum(l[k]):String(l[k]);});d.id=l.id||null;if(OC)d.variety=ocVarShow(d.variety);return d;});
        if(!LINES.length)LINES=[blankLine()];
        openRows={};renderLines();setDirty(false);lockRO();
        el('ftitle').textContent='Edit shipment';el('ctxref').textContent=h.container_number||container;setSeasonChip();return;
      }
      setv('container',h.container_number);setv('carta',h.carta);setv('ldate',h.loading_date);
      setv('vessel',h.vessel);setv('line',h.shipping_line);setv('booking',h.booking_no);setv('invoice',h.invoice_no);
      setv('po',h.po_number);setv('etd',h.etd);setv('eta',h.eta);setv('arrival',h.arrival_date);
      setv('depport',h.departure_port);setv('country',h.receiving_country);setv('port',h.receiving_port);
      setv('agent',h.agent);setv('shipper',h.shipper);if(LISTS&&LISTS.marks)LISTS.marks();
      setDep(!!h.departure_date&&h.departure_date!==h.loading_date,h.departure_date);
      fillHeaderSelects({status:h.shipping_status,client:h.client,subclient:h.subclient,pack_house_departure:h.pack_house_departure});
      deriveDate();syncCtxStatus();
      if(INTAKE){
        setv('plandate',h.planned_loading_date);setv('tcartons',h.total_cartons!=null&&h.total_cartons!==''?tidyNum(h.total_cartons):'');
        /* header pascol; older rows only have it per line → first non-empty line value */
        var hp=h.pascol_weight;
        if(hp==null||String(hp).trim()===''){var fl=lines.find(function(l){return l.pascol_weight!=null&&String(l.pascol_weight).trim()!=='';});hp=fl?fl.pascol_weight:'';}
        setv('hpascol',hp!=null&&String(hp).trim()!==''?tidyNum(hp):'');
        if(regionOn())setv('sregion',h.sales_region!=null?String(h.sales_region):'');
      }
      /* 2026-11-26: sheet rows keep their stored Pascol figures; Manage rows have none stored (the save/edit RPCs strip
         pascol_pct/packing_weight/pascol_net/weight_variance), so citrus intake recalculates them for display on open */
      PAS_LIVE=INTAKE&&isCitrus()&&lines.every(function(l){return l.pascol_pct==null||String(l.pascol_pct).trim()==='';});
      /* carton weights are tonnes in the DB and on screen (no kg conversion) */
      RAWCGW={};lines.forEach(function(l){if(l.id&&intakeBlank(l.carton_gross_weight)&&!intakeBlank(l.carton_gross_weight_raw))RAWCGW[l.id]=String(l.carton_gross_weight_raw);});
      /* DB v0.4: get returns packing_net_weight (alias of packing_factor); read the new key, fall back to the old one */
      lines.forEach(function(l){if(l.packing_net_weight!=null)l.packing_factor=l.packing_net_weight;delete l.packing_net_weight;});
      LINES=lines.map(function(l){var d=blankLine();Object.keys(d).forEach(function(k){if(l[k]!=null)d[k]=NUMKEYS[k]?tidyNum(l[k]):String(l[k]);});d.id=l.id||null;
        if(!PT&&l.jde_code){d._jdeSaved=String(l.jde_code);d._jdeKey=jdeKey(d);}return d;});
      if(!LINES.length)LINES=[blankLine()];
      openRows={};renderLines();setDirty(false);lockRO();
      el('ftitle').textContent='Edit shipment';el('ctxref').textContent=h.container_number||container;setSeasonChip();
    },function(e){if(dead||my!==formSeq)return;showOverlay(false);showFormError('Could not load '+container+' — '+friendlyErr(e),'retry');});
  }

  /* ---------------------------------------------------------- views */
  function scrollTop(){var r=host.getBoundingClientRect();if(r.top<0)host.scrollIntoView({block:'start'});}
  function showView(v){el('vlist').classList.toggle('on',v==='list');el('vform').classList.toggle('on',v==='form');scrollTop();
    if(v==='form'){var tr=q('.sv2-totrow');if(tr)tr.scrollLeft=0;}totFade();schedPill();}   /* 2026-11-25 P3b: totals line starts at the left on every open */
  function openContainer(i){
    var c=DATA[i];if(!c)return;
    MODE='edit';EDIT={container:c.ref,loaded:c.hdr.loaded,deletedIds:[]};
    el('ftitle').textContent='Edit shipment';el('ctxref').textContent=c.ref;setSeasonChip();
    showView('form');loadForEdit(c.ref,c.hdr.loaded);
  }
  function openCreate(){
    if(RO)return;
    formSeq++;MODE='create';EDIT={container:null,loaded:null,deletedIds:[]};SEASON_OK=false;LOADED_IDS=[];ROW_VERSION='';syncDelBtn();
    blankHeader();setDep(false);fillHeaderSelects({status:''});deriveDate();if(LISTS&&LISTS.marks)LISTS.marks();
    PAS_LIVE=true;TRIED=false;LINES=[blankLine()];RAWCGW={};openRows={0:true};renderLines();
    setVoyageLock(false);showOverlay(false);clearFormError();syncCtxStatus();setDirty(false);
    el('ftitle').textContent='New shipment';el('ctxref').textContent='New';setSeasonChip();
    showView('form');var c=el('container');if(c&&!isNarrow()&&!(OC&&isTouch()))c.focus();   /* v0.2 P3: no keyboard pop-up on touch devices */
  }
  function leaveForm(){if(!confirmLeave())return;formSeq++;setDirty(false);closeModal();MODE='list';showView('list');}

  /* ---------------------------------------------------------- list */
  var FACETS=OC?[
    {key:'crop',label:'Crop',vals:[],match:function(c,v){return c.hdr.cropL===v;}},
    {key:'station',label:'Packing station',vals:[],match:function(c,v){return c.hdr.stationL===v;}},
    {key:'region',label:'Country',vals:[],match:function(c,v){return c.hdr.region===v;}},
    {key:'grade',label:'Grade',vals:[],match:function(c,v){return c._grade.indexOf(v)>=0;}}
  ]:PT?[
    {key:'station',label:'Packing station',vals:[],match:function(c,v){return c.hdr.station===v;}},
    {key:'sector',label:'Sector',vals:[],match:function(c,v){return c.hdr.sector===v;}},
    {key:'region',label:'Country',vals:[],match:function(c,v){return c.hdr.region===v;}},
    {key:'grade',label:'Grade',vals:[],match:function(c,v){return c._grade.indexOf(v)>=0;}}
  ]:[
    {key:'cls',label:'Client class',vals:[],match:function(c,v){return c._cls.indexOf(v)>=0;}},
    {key:'region',label:'Destination',vals:[],match:function(c,v){return c.hdr.region===v;}},
    {key:'client',label:'Client',vals:[],match:function(c,v){return c.hdr.client===v;}},
    {key:'status',label:'Status',vals:[],match:function(c,v){return c.hdr.status===v;}},
    /* 2026-11-26 step 2: CQC / inspection links (were only on the old record views) */
    {key:'qc',label:'QC',vals:[],match:function(c,v){return v==='With CQC'?c._cqc>0:v==='No CQC'?!c._cqc:v==='With inspection'?c._insp>0:v==='No inspection'?!c._insp:true;}}
  ];
  function emptyF(){var f={};FACETS.forEach(function(x){f[x.key]=[];});return f;}
  ST.f=emptyF();
  function HEADS(){
    if(OC)return [{t:'Container',s:'ref'},{t:'Crop',s:'crop'},{t:'Station',s:'station'},{t:'Client',s:'client'},{t:'Country',s:'region'},{t:'Loaded',s:'loaded'},
      {t:'Lines',s:'lines',n:1},{t:'Pallets',s:'pal',n:1},{t:'Packs',s:'pkg',n:1,tip:'Jumbo bags + sacks + cartons + benz'},{t:'Standard t',s:'net',n:1},{t:'Grade'}];
    if(PT)return [{t:'Container',s:'ref'},{t:'Station',s:'station'},{t:'Client',s:'client'},{t:'Country',s:'region'},{t:'Loaded',s:'loaded'},
      {t:'Lines',s:'lines',n:1},{t:'Pallets',s:'pal',n:1},{t:'Packages',s:'pkg',n:1,tip:'Jumbo bags + sacks'},{t:'Standard t',s:'net',n:1},{t:'Grade'}];
    var h=[{t:'Container',s:'ref'},{t:'Client',s:'client'},{t:'Destination',s:'region'},{t:'Packing / class'},
      {t:'Loaded',s:'loaded'},{t:'Lines',s:'lines',n:1},{t:'Pallets',s:'pal',n:1},{t:'Cartons',s:'ctn',n:1},{t:'Net t',s:'net',n:1},{t:'Gross t',s:'grs',n:1}];
    if(isCitrus())h.push({t:'Weighbridge',s:'vr',tip:'Pascol weighbridge net vs packing weight. Green = within ±0.5 t, amber = over, grey = not weighed yet.'});
    h.push({t:'Status',s:'status'});h.push({t:'QC',tip:'Client QC reports (CQC) and export inspections with this container number in this season'});return h;
  }
  var GET={ref:function(c){return c.ref;},client:function(c){return c.hdr.client||'';},region:function(c){return c.hdr.region||'';},
    loaded:function(c){return c._t;},lines:function(c){return c.lines.length;},pal:function(c){return c._pal;},ctn:function(c){return c._ctn;},
    net:function(c){return c._net;},grs:function(c){return c._grs;},vr:function(c){return c._pending||c._vr===null?-Infinity:c._vr;},status:function(c){return c.hdr.status||'';},
    station:function(c){return OC?c.hdr.stationL||'':c.hdr.station||'';},pkg:function(c){return c._ctn;},crop:function(c){return c.hdr.cropL||'';}};
  if(OC)GET.client=function(c){return c.hdr.clientL||'';};
  var TEXTSORT={ref:1,client:1,region:1,status:1,station:1,crop:1};
  function deriveAll(){DATA.forEach(function(c){
    c._pal=sum(c.lines,'pal');c._ctn=sum(c.lines,'ctn');c._net=sum(c.lines,'net');c._grs=sum(c.lines,'grs');
    c._cls=uniq(c.lines.map(function(l){return l.cc;}));c._pack=uniq(c.lines.map(function(l){return packShort(l.pk);}));
    c._t=+new Date(c.hdr.loaded+'T00:00');
    c._pending=c.lines.every(function(l){return l.pas==='—'||l.pas==null||l.pas==='';});
    /* 2026-11-26: stored line variance, else line Pascol net − Net; a line with neither = not stored (null → '—', never a green 0.00) */
    var lvr=c.lines.map(function(l){var has=function(x){return x!=null&&String(x).trim()!==''&&isFinite(+x);};return has(l.vr)?+l.vr:has(l.pasnet)&&has(l.net)?(+l.pasnet)-(+l.net):null;});
    c._vr=lvr.some(function(x){return x===null;})?null:lvr.reduce(function(t,x){return t+x;},0);
    if(OC){c.hdr.cropL=ocLabel(c.hdr.crop,'crop');c.hdr.stationL=ocLabel(c.hdr.station,'packing_station');c.hdr.clientL=ocLabel(c.hdr.client,'client');
      c.hdr.portL=ocLabel(c.hdr.port,'port');c.hdr.vesselL=ocLabel(c.hdr.vessel,'transport');
      c.lines.forEach(function(l){l.farmL=ocLabel(l.farm,'farm');l.ptL=ocLabel(l.pt,'packing_type');});}
    if(OC){c._grade=uniq(c.lines.map(function(l){return l.grade;}));
      var op=[c.ref,c.hdr.crop,c.hdr.cropL,c.hdr.vesselL,c.hdr.carta,c.hdr.invoice,c.hdr.clientL,c.hdr.region,c.hdr.portL,c.hdr.stationL,c.hdr.sector,c.hdr.season];
      c.lines.forEach(function(l){op.push(l.v,l.pivot,l.farmL,l.grade,l.ptL,l.size2,l.crop,l.brand,l.op,l.lot);});
      c._search=op.join('  ').toLowerCase();return;}
    if(PT){c._grade=uniq(c.lines.map(function(l){return l.grade;}));
      var pp=[c.ref,c.hdr.vessel,c.hdr.carta,c.hdr.invoice,c.hdr.client,c.hdr.region,c.hdr.port,c.hdr.station,c.hdr.sector,c.hdr.season];
      c.lines.forEach(function(l){pp.push(l.v,l.pivot,l.farm,l.grade,l.ct,l.size2,l.crop,l.brand,l.op,l.lot);});
      c._search=pp.join('  ').toLowerCase();return;}
    var parts=[c.ref,c.hdr.vessel,c.hdr.line,c.hdr.booking,c.hdr.invoice,c.hdr.po,c.hdr.carta,c.hdr.client,c.hdr.subclient,c.hdr.port,c.hdr.region,c.hdr.pack,c.hdr.agent,c.hdr.shipper,c.hdr.status];
    c.lines.forEach(function(l){parts.push(l.v,l.cat,l.lot,l.dc,l.cc,l.ct,l.pk,l.cal,l.cnt);});
    c._search=parts.join('  ').toLowerCase();
  });}
  function rebuildFacetVals(){
    if(OC){FACETS[0].vals=uniq(DATA.map(function(c){return c.hdr.cropL;}));FACETS[1].vals=uniq(DATA.map(function(c){return c.hdr.stationL;}));
      FACETS[2].vals=uniq(DATA.map(function(c){return c.hdr.region;}));FACETS[3].vals=uniq([].concat.apply([],DATA.map(function(c){return c._grade;})));return;}
    if(PT){FACETS[0].vals=uniq(DATA.map(function(c){return c.hdr.station;}));FACETS[1].vals=uniq(DATA.map(function(c){return c.hdr.sector;}));
      FACETS[2].vals=uniq(DATA.map(function(c){return c.hdr.region;}));FACETS[3].vals=uniq([].concat.apply([],DATA.map(function(c){return c._grade;})));return;}
    FACETS[0].vals=uniq([].concat.apply([],DATA.map(function(c){return c._cls;})));
    FACETS[1].vals=uniq(DATA.map(function(c){return c.hdr.region;}));
    FACETS[2].vals=uniq(DATA.map(function(c){return c.hdr.client;}));
    FACETS[3].vals=uniq(DATA.map(function(c){return c.hdr.status;}));
    FACETS[4].vals=QCM.loaded?['With CQC','No CQC','With inspection','No inspection']:[];
  }
  function passSearch(c){return !ST.q||c._search.indexOf(ST.q)>=0;}
  function passFacets(c,except){return FACETS.every(function(f){if(f.key===except)return true;var a=ST.f[f.key];return !a.length||a.some(function(v){return f.match(c,v);});});}
  function filtered(){return DATA.filter(function(c){return passSearch(c)&&passFacets(c,null);});}
  function sortRows(rows){var g=GET[ST.sortKey]||GET.loaded,dir=ST.dir==='asc'?1:-1,txt=TEXTSORT[ST.sortKey];
    return rows.slice().sort(function(a,b){var x=g(a),y=g(b);if(txt)return String(x).localeCompare(String(y))*dir;return (x<y?-1:x>y?1:0)*dir;});}
  function anyFilter(){return !!ST.q||FACETS.some(function(f){return ST.f[f.key].length>0;});}
  function hl(s){s=String(s==null?'':s);var t=(ST.q||'').trim();if(!t)return esc(s);var i=s.toLowerCase().indexOf(t);if(i<0)return esc(s);
    return esc(s.slice(0,i))+'<span class="sv2-hl">'+esc(s.slice(i,i+t.length))+'</span>'+esc(s.slice(i+t.length));}
  var ALL_LABEL=OC?{crop:'All crops',station:'All stations',region:'All countries',grade:'All grades'}:PT?{station:'All stations',sector:'All sectors',region:'All countries',grade:'All grades'}
                 :{cls:'All client classes',region:'All destinations',client:'All clients',status:'All statuses',qc:'All QC'};
  function renderFacets(){
    el('facets').innerHTML=FACETS.filter(function(f){return f.vals.length>1;}).map(function(f){
      var cur=ST.f[f.key][0]||'';
      var opts=f.vals.slice().sort(function(a,b){return String(a).localeCompare(String(b));}).map(function(v){
        var n=DATA.filter(function(c){return passSearch(c)&&passFacets(c,f.key)&&f.match(c,v);}).length;
        return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+(n===0&&v!==cur?' disabled':'')+'>'+esc(v)+' ('+n+')</option>';
      }).join('');
      return '<select class="sv2-in sv2-fsel'+(cur?' on':'')+'" data-chg="facet" data-fk="'+f.key+'" aria-label="'+f.label+'"><option value="">'+ALL_LABEL[f.key]+'</option>'+opts+'</select>';
    }).join('');
  }
  function renderHead(){
    if(ST.view==='rows'){el('thead').innerHTML=ROWHEADS().map(function(h){return '<th class="'+(h.n?'num':'')+'">'+h.t+'</th>';}).join('');return;}
    el('thead').innerHTML=HEADS().map(function(h){
      var act=h.s&&ST.sortKey===h.s;var ar=h.s?'<span class="ar">'+(act?(ST.dir==='asc'?'▲':'▼'):'⇅')+'</span>':'';
      return '<th class="'+(h.n?'num ':'')+(h.s?'srt':'')+(act?' act':'')+'"'+(h.s?' data-act="sort" data-sk="'+h.s+'" tabindex="0"':'')+(h.tip?' title="'+esc(h.tip)+'"':'')+'>'+h.t+ar+'</th>';
    }).join('');
  }
  /* All rows view: one table row per shipment line; a click opens its container */
  function ROWHEADS(){
    if(PT)return [{t:'Container'},{t:'Loaded'},{t:'Client'},{t:'Variety'},{t:'Pivot / farm'},{t:'Grade'},{t:'Packaging'},
      {t:'Pallets',n:1},{t:OC?'Packs':'Packages',n:1},{t:'Standard t',n:1}];
    return [{t:'Container'},{t:'Loaded'},{t:'Client'},{t:'Destination'},{t:'Variety'},{t:'Class'},{t:'Packing'},
      {t:'Pallets',n:1},{t:'Cartons',n:1},{t:'Net t',n:1},{t:'Gross t',n:1},{t:'Status'}];
  }
  function lineRows(rows){var out=[];rows.forEach(function(c){c.lines.forEach(function(l){out.push({c:c,l:l});});});return out;}
  function lineRowHTML(x){
    var c=x.c,l=x.l,i=DATA.indexOf(c);
    if(PT)return '<tr tabindex="0" data-act="open" data-i="'+i+'">'+
      '<td><span class="sv2-ref">'+hl(c.ref)+'</span></td><td>'+fmtDate(c.hdr.loaded)+'</td>'+
      '<td>'+hl(OC?(c.hdr.clientL||'—'):(c.hdr.client||'—'))+'</td><td>'+hl(l.v||'—')+(OC&&c.hdr.cropL?'<span class="sv2-sub">'+hl(c.hdr.cropL)+'</span>':'')+'</td>'+
      '<td>'+hl(l.pivot||'—')+'<span class="sv2-sub">'+hl(OC?(l.farmL||''):(l.farm||''))+'</span></td><td>'+hl(l.grade||'—')+'</td>'+
      '<td>'+hl(OC?(l.ptL||'—'):(l.ct||'—'))+'</td><td class="num">'+(l.pal==null?'—':l.pal)+'</td><td class="num">'+(l.ctn==null?'—':Number(l.ctn).toLocaleString())+'</td>'+
      '<td class="num">'+fmtT(l.net)+'</td></tr>';
    return '<tr tabindex="0" data-act="open" data-i="'+i+'">'+
      '<td><span class="sv2-ref">'+hl(c.ref)+'</span></td><td>'+fmtDate(c.hdr.loaded)+'</td>'+
      '<td>'+hl(c.hdr.client||'—')+'</td><td>'+hl(c.hdr.region||'—')+'</td>'+
      '<td>'+hl(l.v||'—')+(l.cat?'<span class="sv2-sub">'+hl(l.cat)+'</span>':'')+'</td>'+
      '<td>'+hl(l.cc||'—')+(l.dc?'<span class="sv2-sub">'+hl(l.dc)+'</span>':'')+'</td><td>'+hl(packShort(l.pk)||'—')+'</td>'+
      '<td class="num">'+(l.pal==null?'—':l.pal)+'</td><td class="num">'+(l.ctn==null?'—':Number(l.ctn).toLocaleString())+'</td>'+
      '<td class="num">'+fmtT(l.net)+'</td><td class="num">'+fmtT(l.grs)+'</td>'+
      '<td><span class="sv2-pill '+statusClass(c.hdr.status)+'">'+esc(c.hdr.status||'—')+'</span></td></tr>';
  }
  function lineCardHTML(x){
    var c=x.c,l=x.l,i=DATA.indexOf(c);
    return '<div class="sv2-card" tabindex="0" role="button" data-act="open" data-i="'+i+'">'+
      '<div class="t"><span class="sv2-ref">'+hl(c.ref)+'</span><span class="sv2-sub">'+fmtDate(c.hdr.loaded)+'</span></div>'+
      '<div><b>'+hl(l.v||'—')+'</b> · '+hl(PT?(l.grade||''):(l.cc||''))+'</div>'+
      '<div class="sv2-sub">'+(l.pal==null?'—':l.pal)+' plt · '+(l.ctn==null?'—':Number(l.ctn).toLocaleString())+(PT?' packs':' ctn')+' · '+fmtT(l.net)+' t</div></div>';
  }
  function weighChip(c){if(c._pending)return '<span class="sv2-w pend">Pending</span>';if(c._vr===null)return '<span class="sv2-w pend" title="Variance not stored for this shipment">—</span>';var ok=Math.abs(c._vr)<=0.5;return '<span class="sv2-w '+(ok?'ok':'off')+'">'+(c._vr>0?'+':'')+fmtT(c._vr)+' t</span>';}
  function rowHTML(c){
    var i=DATA.indexOf(c);
    if(OC)return '<tr tabindex="0" data-act="open" data-i="'+i+'">'+
      '<td><span class="sv2-ref">'+hl(c.ref)+'</span><span class="sv2-sub">'+hl(c.hdr.vesselL||'')+(c.hdr.carta?' · '+hl(c.hdr.carta):'')+'</span></td>'+
      '<td>'+hl(c.hdr.cropL||'—')+'</td>'+
      '<td>'+hl(c.hdr.stationL||'—')+'<span class="sv2-sub">'+hl(c.hdr.sector||'')+(c.hdr.season?' · '+hl(c.hdr.season):'')+'</span></td>'+
      '<td>'+hl(c.hdr.clientL||'—')+'</td><td>'+hl(c.hdr.region||'—')+'<span class="sv2-sub">'+hl(c.hdr.portL||'')+'</span></td>'+
      '<td>'+fmtDate(c.hdr.loaded)+'</td><td class="num">'+c.lines.length+'</td><td class="num">'+(Math.round(c._pal*1000)/1000).toLocaleString()+'</td>'+
      '<td class="num">'+c._ctn.toLocaleString()+'</td><td class="num">'+fmtT(c._net)+'</td>'+
      '<td><div class="sv2-tags">'+c._grade.map(function(g){return '<span class="sv2-tg">'+hl(g)+'</span>';}).join('')+'</div></td></tr>';
    if(PT)return '<tr tabindex="0" data-act="open" data-i="'+i+'">'+
      '<td><span class="sv2-ref">'+hl(c.ref)+'</span><span class="sv2-sub">'+hl(c.hdr.vessel||'')+(c.hdr.carta?' · '+hl(c.hdr.carta):'')+'</span></td>'+
      '<td>'+hl(c.hdr.station||'—')+'<span class="sv2-sub">'+hl(c.hdr.sector||'')+(c.hdr.season?' · '+hl(c.hdr.season):'')+'</span></td>'+
      '<td>'+hl(c.hdr.client||'—')+'</td><td>'+hl(c.hdr.region||'—')+'<span class="sv2-sub">'+hl(c.hdr.port||'')+'</span></td>'+
      '<td>'+fmtDate(c.hdr.loaded)+'</td><td class="num">'+c.lines.length+'</td><td class="num">'+c._pal.toLocaleString()+'</td>'+
      '<td class="num">'+c._ctn.toLocaleString()+'</td><td class="num">'+fmtT(c._net)+'</td>'+
      '<td><div class="sv2-tags">'+c._grade.map(function(g){return '<span class="sv2-tg">'+hl(g)+'</span>';}).join('')+'</div></td></tr>';
    var subc=(c.hdr.subclient&&c.hdr.subclient!==c.hdr.client)?'<span class="sv2-sub">'+hl(c.hdr.subclient)+'</span>':'';
    return '<tr tabindex="0" data-act="open" data-i="'+i+'">'+
      '<td><span class="sv2-ref">'+hl(c.ref)+'</span><span class="sv2-sub">'+hl(c.hdr.vessel||'')+(c.hdr.line?' · '+hl(c.hdr.line):'')+'</span></td>'+
      '<td>'+hl(c.hdr.client||'—')+subc+'</td>'+
      '<td>'+hl(c.hdr.region||'—')+'<span class="sv2-sub">'+hl(c.hdr.port||'')+'</span></td>'+
      '<td><div class="sv2-tags">'+c._pack.map(function(p){return '<span class="sv2-tg">'+hl(p)+'</span>';}).join('')+'</div><span class="sv2-sub">'+c._cls.map(hl).join(' · ')+'</span></td>'+
      '<td>'+fmtDate(c.hdr.loaded)+'<span class="sv2-sub">ETA '+fmtEta(c.hdr.eta)+'</span></td>'+
      '<td class="num">'+c.lines.length+'</td><td class="num">'+c._pal+'</td><td class="num">'+c._ctn.toLocaleString()+'</td>'+
      '<td class="num">'+fmtT(c._net)+'</td><td class="num">'+fmtT(c._grs)+'</td>'+
      (isCitrus()?'<td>'+weighChip(c)+'</td>':'')+
      '<td><span class="sv2-pill '+statusClass(c.hdr.status)+'">'+esc(c.hdr.status||'—')+'</span></td><td>'+qcChips(c)+'</td></tr>';
  }
  function cardHTML(c){
    var i=DATA.indexOf(c);
    if(OC)return '<div class="sv2-card" tabindex="0" role="button" data-act="open" data-i="'+i+'">'+
      '<div class="t"><span class="sv2-ref">'+hl(c.ref)+'</span><span class="sv2-sub">'+hl(c.hdr.cropL||'')+'</span></div>'+
      '<div><b>'+hl(c.hdr.clientL||'—')+'</b> · '+hl(c.hdr.region||c.hdr.portL||'—')+'</div>'+
      '<div class="sv2-sub">Loaded '+fmtDate(c.hdr.loaded)+' · '+(Math.round(c._pal*1000)/1000)+' plt · '+c._ctn.toLocaleString()+' packs · '+fmtT(c._net)+' t</div></div>';
    if(PT)return '<div class="sv2-card" tabindex="0" role="button" data-act="open" data-i="'+i+'">'+
      '<div class="t"><span class="sv2-ref">'+hl(c.ref)+'</span><span class="sv2-sub">'+hl(c.hdr.station||'')+'</span></div>'+
      '<div><b>'+hl(c.hdr.client||'—')+'</b> · '+hl(c.hdr.region||c.hdr.port||'—')+'</div>'+
      '<div class="sv2-sub">Loaded '+fmtDate(c.hdr.loaded)+' · '+c._pal+' plt · '+c._ctn.toLocaleString()+' packages · '+fmtT(c._net)+' t</div></div>';
    return '<div class="sv2-card" tabindex="0" role="button" data-act="open" data-i="'+i+'">'+
      '<div class="t"><span class="sv2-ref">'+hl(c.ref)+'</span><span class="sv2-pill '+statusClass(c.hdr.status)+'">'+esc(c.hdr.status||'—')+'</span></div>'+
      '<div><b>'+hl(c.hdr.client||'—')+'</b> · '+hl(c.hdr.region||c.hdr.port||'—')+'</div>'+
      '<div class="sv2-sub">Loaded '+fmtDate(c.hdr.loaded)+' · '+c._pal+' plt · '+c._ctn.toLocaleString()+' ctn · '+fmtT(c._net)+' t</div></div>';
  }
  function renderList(){
    renderHead();renderFacets();
    var rows=sortRows(filtered()),shown=rows.length>ST.limit?rows.slice(0,ST.limit):rows;
    var lbl=PRODUCT_NAME.toLowerCase(),phone=isPhone();
    var emptyMsg=DATA.length?'No '+esc(lbl)+' shipments match <b>'+esc(ST.q||'these filters')+'</b>. <button type="button" class="sv2-reset show" data-act="resetAll">Reset filters</button>'
      :'No '+esc(lbl)+' shipments in '+esc(SEASON_NAME||'this season')+' yet. Use <b>+ New shipment</b> to add the first one.';
    var vc=el('vcont'),vr=el('vrows');if(vc)vc.setAttribute('aria-pressed',ST.view==='rows'?'false':'true');if(vr)vr.setAttribute('aria-pressed',ST.view==='rows'?'true':'false');
    if(ST.view==='rows'){
      var lr=lineRows(rows),lshown=lr.length>ST.limit?lr.slice(0,ST.limit):lr;
      el('listbody').innerHTML=(!lr.length&&!phone)?'<tr><td colspan="'+ROWHEADS().length+'"><div class="sv2-empty">'+emptyMsg+'</div></td></tr>':(phone?'':lshown.map(lineRowHTML).join(''));
      el('cards').innerHTML=phone?(!lr.length?'<div class="sv2-empty">'+emptyMsg+'</div>':lshown.map(lineCardHTML).join('')):'';
      var lmore=lr.length-lshown.length;
      el('showmore').innerHTML=lmore>0?'<button type="button" class="sv2-reset show" data-act="showMore">Show '+lmore.toLocaleString()+' more</button>':'';
      el('countnote').textContent='Showing '+lr.length.toLocaleString()+' lines in '+rows.length.toLocaleString()+' '+lbl+' shipments in '+(SEASON_NAME||'this season')+(anyFilter()?' (filtered)':'');
      el('resetbtn').classList.toggle('show',anyFilter());
      return;
    }
    el('listbody').innerHTML=(!rows.length&&!phone)?'<tr><td colspan="'+HEADS().length+'"><div class="sv2-empty">'+emptyMsg+'</div></td></tr>':(phone?'':shown.map(rowHTML).join(''));
    el('cards').innerHTML=phone?(!rows.length?'<div class="sv2-empty">'+emptyMsg+'</div>':shown.map(cardHTML).join('')):'';
    var more=rows.length-shown.length;
    el('showmore').innerHTML=more>0?'<button type="button" class="sv2-reset show" data-act="showMore">Show '+more.toLocaleString()+' more</button>':'';
    el('countnote').textContent=(rows.length===DATA.length?'Showing all '+DATA.length.toLocaleString():'Showing '+rows.length.toLocaleString()+' of '+DATA.length.toLocaleString())+' '+lbl+' shipments in '+(SEASON_NAME||'this season')+(anyFilter()?' (filtered)':'');
    el('resetbtn').classList.toggle('show',anyFilter());
  }
  function paintSkeleton(){
    var cols=HEADS().length,rows='';
    for(var r=0;r<6;r++){var tds='';for(var c=0;c<cols;c++)tds+='<td><div class="sv2-sk" style="width:'+(c<2?84:54)+'px"></div></td>';rows+='<tr>'+tds+'</tr>';}
    el('thead').innerHTML='';renderHead();el('listbody').innerHTML=rows;
    el('cards').innerHTML='<div class="sv2-card"><div class="sv2-sk" style="width:60%"></div><div class="sv2-sk" style="width:85%"></div></div>'.repeat(4);
    el('countnote').textContent='Loading '+PRODUCT_NAME.toLowerCase()+' shipments…';el('facets').innerHTML='';el('showmore').innerHTML='';
  }
  function setListBanner(err){
    var b=el('banner');if(!b)return;
    if(!err){b.className='sv2-banner';b.removeAttribute('role');b.innerHTML=bannerInner();return;}
    b.className='sv2-banner err';b.setAttribute('role','alert');
    b.innerHTML='<span aria-hidden="true">!</span><span style="flex:1">'+esc(err)+'</span><button type="button" class="sv2-btn sec sm" data-act="reloadList">Retry</button>';
  }
  /* 2026-11-26 step 2: CQC reports + inspections per container (same tables the old record view read), paged past 1,000 rows */
  var QCM={loaded:false,cqc:{},insp:{}};
  function normQC(cn){return String(cn||'').replace(/\s+/g,'').toUpperCase();}
  function pageAll(mk){var out=[];function step(from){return Promise.resolve(mk().range(from,from+999)).then(function(r){
      if(r.error)throw r.error;out=out.concat(r.data||[]);return (r.data||[]).length===1000?step(from+1000):out;});}return step(0);}
  function loadQc(){
    if(PT||!SEASON)return;var seq=listSeq;
    Promise.all([
      pageAll(function(){return sb.from('client_qc_reports').select('container_number,score').eq('product_id',PRODUCT).eq('season_id',SEASON).order('id');}),
      pageAll(function(){return sb.from('inspections_with_aggregates').select('container_number,decision').eq('product_id',PRODUCT).eq('season_id',SEASON).order('id');})
    ]).then(function(r){
      if(dead||seq!==listSeq)return;var cq={},ins={};
      r[0].forEach(function(x){var k=normQC(x.container_number);if(!k)return;(cq[k]=cq[k]||[]).push(x.score);});
      r[1].forEach(function(x){var k=normQC(x.container_number);if(!k)return;(ins[k]=ins[k]||[]).push(x.decision);});
      QCM={loaded:true,cqc:cq,insp:ins};applyQc();rebuildFacetVals();renderList();
    },function(){/* QC links are extra: a failed read leaves the column showing '…' and the list usable */});
  }
  function applyQc(){if(PT)return;DATA.forEach(function(c){var k=normQC(c.ref);c._cqcS=QCM.cqc[k]||[];c._inspD=QCM.insp[k]||[];c._cqc=c._cqcS.length;c._insp=c._inspD.length;});}
  function qcChips(c){
    if(!QCM.loaded)return '<span class="sv2-sub">…</span>';
    var h='';if(c._cqc)h+='<span class="q-c" title="Client QC report(s)'+(c._cqcS.filter(Boolean).length?': '+esc(c._cqcS.filter(Boolean).join(', ')):'')+'">CQC '+c._cqc+'</span>';
    if(c._insp)h+='<span class="q-i" title="Export inspection(s)'+(c._inspD.filter(Boolean).length?': '+esc(c._inspD.filter(Boolean).join(', ')):'')+'">INSP '+c._insp+'</span>';
    return '<span class="sv2-qc">'+(h||'<span class="q-n">none</span>')+'</span>';}
  function loadList(){
    var my=++listSeq;
    paintSkeleton();setListBanner(null);
    var path='citrus-shipments?product='+encodeURIComponent(PRODUCT)+(SEASON?'&season='+encodeURIComponent(SEASON):'');
    return Promise.resolve(sb.functions.invoke(path,{method:'GET'})).then(function(res){
      if(dead||my!==listSeq)return;
      if(res.error&&OC){DATA=[];el('listbody').innerHTML='';el('cards').innerHTML='';el('countnote').textContent='No Other crops shipments yet. '+OC_PENDING+'.';return;}   /* neutral, from OC_PENDING */
      if(res.error){
        var st=res.error.context&&res.error.context.status;
        var msg=st===401?'Your session expired. Reload the page and sign in to DalOS.':st===403?'You don’t have access to '+PRODUCT_NAME.toLowerCase()+' shipments.':'Shipments didn’t load. Check the connection and try again.';
        setListBanner(msg);DATA=[];el('listbody').innerHTML='';el('cards').innerHTML='';el('countnote').textContent='';return;
      }
      var d=res.data||{};DATA=(d.containers||[]).slice();
      deriveAll();if(QCM.loaded)applyQc();rebuildFacetVals();renderList();if(PT)ptFillDatalists();
      if(!QCM.loaded)loadQc();
    },function(){if(dead||my!==listSeq)return;if(OC){DATA=[];el('listbody').innerHTML='';el('cards').innerHTML='';el('countnote').textContent='No Other crops shipments yet. '+OC_PENDING+'.';return;}setListBanner('Shipments didn’t load. Check the connection and try again.');el('listbody').innerHTML='';el('cards').innerHTML='';el('countnote').textContent='';});
  }

  /* ---------------------------------------------------------- CSV export (Other crops): the shown shipments, one row per line */
  function ocCsvRows(){var rows=[['Container','Loading date','Crop','Packing station','Sector','Client','Country','Shipping port','Vessel','Carta',
      'Variety','Pivot','Farm','Grade','Packaging','Pallets','Jumbo #','Sack #','Cartons #','Benz #','Standard t']];
    sortRows(filtered()).forEach(function(c){c.lines.forEach(function(l){rows.push([c.ref,c.hdr.loaded,c.hdr.cropL,c.hdr.stationL,c.hdr.sector,c.hdr.clientL,c.hdr.region,c.hdr.portL,c.hdr.vesselL,c.hdr.carta,
      l.v,l.pivot,l.farmL,l.grade,l.ptL,l.pal,l.jumboN,l.sackN,l.cartonsN,l.benzN,l.net]);});});
    return rows;}
  function ocCsv(){var txt=csvText(ocCsvRows());
    var name='other-crops-shipments-'+(SEASON_NAME||'season').replace(/[^0-9A-Za-z]+/g,'-')+'.csv';
    try{var b=new Blob([txt],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},0);toast('CSV downloaded');}catch(e){showFormError('The CSV could not be made in this browser.');}}
  function ocConfig(){if(!window.SV2Ref)return;window.SV2Ref.openPanel({sb:sb,onClose:function(){if(dead)return;
    loadRefs().then(function(){if(dead)return;if(MODE==='list'){if(DATA.length){deriveAll();rebuildFacetVals();renderList();}}},function(){});}});}

  /* ---------------------------------------------------------- one delegated handler per event type */
  var searchT=null;
  function onClick(e){
    var wn=e.target.closest&&e.target.closest('.sv2-submit .sv2-ctnwarn,.sv2-submit .sv2-kgwarn');if(wn&&host.contains(wn))wn.classList.toggle('open');   /* P3b: a one-line warning opens on tap */
    var t=e.target.closest('[data-act]');if(!t||!host.contains(t))return;
    var a=t.getAttribute('data-act'),i=+t.getAttribute('data-i');
    switch(a){
      case 'openCreate':openCreate();break;
      case 'ocCsv':if(OC)ocCsv();break;
      case 'ocConfig':if(OC)ocConfig();break;
      case 'open':openContainer(i);break;
      case 'leave':leaveForm();break;
      case 'save':SAVE_NEW=false;submitShip();break;
      case 'saveNew':SAVE_NEW=true;submitShip();break;
      case 'goProblem':goProblem();break;
      case 'delShip':if(!RO)askDelete();break;
      case 'retry':if(EDIT.container)loadForEdit(EDIT.container,EDIT.loaded);break;
      case 'refsRetry':retryLists();break;
      case 'reload':if(EDIT.container){if(DIRTY&&!window.confirm('Reload the latest version? Your changes on this form will be lost.'))break;setDirty(false);loadForEdit(EDIT.container,EDIT.loaded);}break;
      case 'openExisting':if(EXISTING_IDX>=0&&confirmLeave()){var ix=EXISTING_IDX;setDirty(false);clearFormError();openContainer(ix);}break;
      case 'reloadList':loadList();break;
      case 'clearQ':clearTimeout(searchT);el('q').value='';ST.q='';ST.limit=RENDER_STEP;el('searchwrap').classList.remove('has');renderList();el('q').focus();break;
      case 'resetAll':ST.q='';ST.f=emptyF();ST.limit=RENDER_STEP;el('q').value='';el('searchwrap').classList.remove('has');renderList();break;
      case 'showMore':ST.limit+=RENDER_STEP;renderList();break;
      case 'view':{var nv=t.getAttribute('data-v')==='rows'?'rows':'container';if(nv!==ST.view){ST.view=nv;ST.limit=RENDER_STEP;try{localStorage.setItem('dalos_sv2_view',nv);}catch(_e){}renderList();}break;}
      case 'sort':{var sk=t.getAttribute('data-sk');if(ST.sortKey===sk)ST.dir=ST.dir==='asc'?'desc':'asc';else{ST.sortKey=sk;ST.dir=TEXTSORT[sk]?'asc':'desc';}renderList();break;}
      case 'toggleLine':syncLines();if(OC&&isNarrow()&&!openRows[i])openRows={};openRows[i]=!openRows[i];renderLines();break;
      case 'rmLine':{syncLines();var d=LINES[i];if(!d)break;
        /* a stored line is deleted on the server when the shipment is saved: ask first */
        if(d.id&&!window.confirm('Remove line '+(i+1)+'? It is deleted from this shipment when you save.'))break;
        PAS_LIVE=true;if(d.id)EDIT.deletedIds.push(d.id);LINES.splice(i,1);
        var no={};Object.keys(openRows).forEach(function(k){k=+k;if(k<i)no[k]=openRows[k];else if(k>i)no[k-1]=openRows[k];});openRows=no;renderLines();setDirty(true);
        undoToast('Line '+(i+1)+' removed',function(){syncLines();var ix=Math.min(i,LINES.length);LINES.splice(ix,0,d);
          if(d.id){var di=EDIT.deletedIds.indexOf(d.id);if(di>=0)EDIT.deletedIds.splice(di,1);}
          var nr={};if(!(OC&&isNarrow()))Object.keys(openRows).forEach(function(k){k=+k;nr[k>=ix?k+1:k]=openRows[k];});nr[ix]=true;openRows=nr;PAS_LIVE=true;renderLines();setDirty(true);});
        break;}
      case 'addLine':syncLines();LINES.push(blankLine());if(OC&&isNarrow())openRows={};openRows[LINES.length-1]=PT?isNarrow():true;renderLines();setDirty(true);break;
      case 'dupLast':{syncLines();PAS_LIVE=true;var last=LINES[LINES.length-1];var c=last?Object.assign({},last):blankLine();c.id=null;
        /* same pack, new lot: the fields that differ from line to line start empty */
        (PT?['lot','pallets','jumbo_count','sack_count','cartons_count','benz_count','standard_weight','pascol_weight']
           :['lot','traceability_code','pallet_count','carton_count','net_weight','gross_weight','pascol_pct','packing_weight','pascol_net','weight_variance']).forEach(function(k){if(k in c)c[k]='';});
        LINES.push(c);var ni=LINES.length-1;if(OC&&isNarrow())openRows={};openRows[ni]=PT?isNarrow():true;renderLines();setDirty(true);
        var nf=q('[data-line="'+ni+'"] [data-k="'+(PT?'pallets':'pallet_count')+'"]');if(nf)nf.focus();break;}
    }
  }
  function onKey(e){
    var t=e.target;
    if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('tr[data-act],.sv2-card[data-act],.lh[data-act],th[data-act]')){e.preventDefault();t.click();}
    if(e.key==='Escape'&&t.id==='sv2-q'){el('q').value='';ST.q='';el('searchwrap').classList.remove('has');renderList();}
  }
  function onChange(e){
    var t=e.target,c=t.getAttribute&&t.getAttribute('data-chg');
    if(OC&&t.id==='sv2-crop'){ptFillDatalists();ocVarHint();}
    if(c==='status'){syncCtxStatus();
      /* re-check carton counts: negative is fine only while the status is Returned */
      qa('[data-line] [data-k="carton_count"]').forEach(function(f){if(!String(f.value||'').trim())return;var pr=lineNumProblem('carton_count',f.value);f.classList.toggle('invalid',!!pr);f.setAttribute('aria-invalid',pr?'true':'false');f.title=pr?lineLabel('carton_count')+' '+pr:'';});}
    else if(c==='client')fillSubclients();
    else if(c==='ldate'){deriveDate();syncDep();}
    else if(c==='depdiff')syncDep();
    else if(!PT&&t.getAttribute&&t.getAttribute('data-k')==='carton_type'&&t.closest('[data-line]')){syncLines();paintWarns();}   /* gap 4: bin limit follows the carton type */
    else if(c==='facet'){var fk=t.getAttribute('data-fk');if(ST.f[fk]){ST.f[fk]=t.value?[t.value]:[];ST.limit=RENDER_STEP;renderList();}return;}
    else if(!INTAKE&&isCitrus()&&t.getAttribute&&t.getAttribute('data-k')==='pascol_weight'&&String(t.value).trim()){var me=t.closest('[data-line]');
      qa('[data-line] [data-k="pascol_weight"]').forEach(function(f){if(f!==t&&f.closest('[data-line]')!==me&&!String(f.value).trim())f.value=t.value;});recompute();}
    else if(c==='cat'){var line=t.closest('[data-line]');if(line){var i=+line.getAttribute('data-line');syncLines();LINES[i].variety='';renderLines();}}
    if(t.tagName==='SELECT'&&/^(carton_type|pack_house)$/.test(t.getAttribute('data-k')||''))t.title=t.selectedIndex>=0?t.options[t.selectedIndex].text:'';   /* tooltip follows the shown value */
    if(el('vform').classList.contains('on')&&t.closest('#sv2-vform'))setDirty(true);
  }
  function onInput(e){
    var t=e.target;
    if(OC&&t.getAttribute&&t.getAttribute('data-req'))t.setAttribute('data-touched','1');
    if(t.id==='sv2-q'){ST.q=t.value.trim().toLowerCase();ST.limit=RENDER_STEP;el('searchwrap').classList.toggle('has',!!t.value);clearTimeout(searchT);searchT=setTimeout(renderList,150);return;}
    if(INTAKE&&(t.id==='sv2-tcartons'||t.id==='sv2-hpascol')){PAS_LIVE=true;recompute();}
    var ln=t.closest('[data-line]');
    if(ln){var k=t.getAttribute('data-k'),li=LINES[+ln.getAttribute('data-line')];
      if(PAS_IN[k]||(INTAKE&&INTAKE_IN[k])||(CARTON_SRC[k]&&li&&!li.id))PAS_LIVE=true;recompute();}
    if(el('vform').classList.contains('on')&&t.closest('#sv2-vform'))setDirty(true);
  }
  function onBlur(e){var t=e.target;if(!t.getAttribute)return;
    if(OC&&t.id==='sv2-container'&&/[\u0660-\u0669\u06f0-\u06f9]/.test(t.value)){t.value=t.value.replace(/[\u0660-\u0669]/g,function(c){return String(c.charCodeAt(0)-0x0660);}).replace(/[\u06f0-\u06f9]/g,function(c){return String(c.charCodeAt(0)-0x06f0);});}   /* v0.2 P3 (Pixel): Arabic-Indic digits -> 0-9 */
    if(t.getAttribute('data-req')&&(!OC||TRIED||t.getAttribute('data-touched')==='1'))validateField(t.id.replace('sv2-',''));
    if(t.id==='sv2-container'||t.id==='sv2-ldate')checkExisting();
    var k=t.getAttribute('data-k');
    if(k&&NUMKEYS[k]){var pr=lineNumProblem(k,t.value,lineCt(t));t.classList.toggle('invalid',!!pr);t.setAttribute('aria-invalid',pr?'true':'false');t.title=pr?lineLabel(k)+' '+pr:'';}
    else if(k&&t.classList.contains('invalid')&&String(t.value||'').trim()){t.classList.remove('invalid');t.setAttribute('aria-invalid','false');}
    if(k&&WARN_KEYS[k]&&t.closest('[data-line]')){syncLines();paintWarns();}   /* range warn after number validation */
    if(INTAKE&&(t.id==='sv2-tcartons'||t.id==='sv2-hpascol')){var hpr=numProblem(t.value,t.id==='sv2-tcartons'?1:0)||(isNegNum(t.value)?'can\u2019t be negative':null)||(t.id==='sv2-hpascol'&&(intakeNum(t.value)||0)>PASCOL_MAX?'over '+PASCOL_MAX+' t for one container (looks like kg)':null);
      t.classList.toggle('invalid',!!hpr);t.setAttribute('aria-invalid',hpr?'true':'false');t.title=hpr?(t.id==='sv2-tcartons'?'Total cartons ':'Pascol weight ')+hpr:'';
      if(t.id==='sv2-hpascol'){var he=el('hpecho');if(he){he.className='sv2-echo'+(hpr?' warn':'');he.textContent=hpr?'Pascol weight '+hpr:kgText(t.value);}}
      paintProblems();}
  }
  host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);
  host.addEventListener('change',onChange);host.addEventListener('input',onInput);host.addEventListener('focusout',onBlur);

  /* the sticky Save bar sits above Vision's phone bottom nav when that nav is showing */
  function placeBar(){var n=document.querySelector('.mobile-nav'),h=0;
    if(n){var cs=getComputedStyle(n);if(cs.display!=='none'&&cs.position==='fixed')h=n.getBoundingClientRect().height;}
    host.style.setProperty('--sv2-bottom',(h+8)+'px');placeFoot();}
  /* r2: --sv2-footh = the Save bar's height (bottom padding + scroll margin at <=768px); re-measured when it changes */
  /* right-edge fade on the phone totals line only while some totals are out of view (not Citrus: it wraps) */
  function totFade(){var r=q('.sv2-totrow');if(!r||dead)return;var m=r.scrollWidth-r.clientWidth;r.classList.toggle('more',!r.classList.contains('wrap')&&m>1&&r.scrollLeft<m-1);}
  (function(){var r=q('.sv2-totrow');if(r)r.addEventListener('scroll',totFade,{passive:true});})();
  /* 2026-11-25 P2b (Pixel): while the Save bar is on screen and would sit under Vision's floating "View Vision as" pill (admin only),
     lift the pill above the bar: <html class="sv2-bar-on"> + --sv2-pill (CSS above). Position only; viewas.js is not touched. */
  var pillRaf=0;
  function placePill(){var d=document.documentElement,s=q('.sv2-submit'),off=0;
    var pp=0;if(!dead&&s&&el('vform')&&el('vform').classList.contains('on')){var pe=document.querySelector('.vas-bar');if(pe&&pe.offsetHeight)pp=pe.offsetHeight+8;}
    if(pp){if(host.style.getPropertyValue('--sv2-pillpad')!==pp+'px')host.style.setProperty('--sv2-pillpad',pp+'px');}else host.style.removeProperty('--sv2-pillpad');
    if(!dead&&s){var r=s.getBoundingClientRect(),vh=window.innerHeight||d.clientHeight,pb=document.querySelector('.vas-bar'),ph=pb&&pb.offsetHeight?pb.offsetHeight:44;
      if(r.height>0&&r.top<vh&&r.bottom>vh-14-ph-8)off=Math.max(14,Math.ceil(vh-r.top)+8);}
    if(off){d.classList.add('sv2-bar-on');d.style.setProperty('--sv2-pill',off+'px');}
    else if(d.classList.contains('sv2-bar-on')){d.classList.remove('sv2-bar-on');d.style.removeProperty('--sv2-pill');}}
  function schedPill(){if(!pillRaf&&!dead)pillRaf=requestAnimationFrame(function(){pillRaf=0;placePill();});}
  document.addEventListener('scroll',schedPill,{passive:true,capture:true});
  function placeFoot(){totFade();schedPill();var s=q('.sv2-submit');if(s){var fh=Math.ceil(s.getBoundingClientRect().height);if(fh>0)host.style.setProperty('--sv2-footh',fh+'px');}}
  var footRO=window.ResizeObserver?new ResizeObserver(placeFoot):null;if(footRO&&q('.sv2-submit'))footRO.observe(q('.sv2-submit'));
  placeBar();window.addEventListener('resize',placeBar);
  /* switching phone <-> desktop width re-renders in the other layout without losing input */
  function onMQ(){if(MODE!=='list')syncLines();renderLines();if(DATA.length)renderList();}
  if(phoneMQ){if(phoneMQ.addEventListener)phoneMQ.addEventListener('change',onMQ);else if(phoneMQ.addListener)phoneMQ.addListener(onMQ);}
  if(formMQ){if(formMQ.addEventListener)formMQ.addEventListener('change',onMQ);else if(formMQ.addListener)formMQ.addListener(onMQ);}

  /* ---------------------------------------------------------- form lists: loading / failed + Retry (2026-11-25)
     A list read that hangs (ERR_TIMED_OUT) or fails no longer leaves blank lists with no message: after 0.7 s a
     'Loading lists…' note shows; after 20 s, or on an error, 'Couldn’t load list' with a Retry button. Retry keeps what is typed. */
  var REFS_TIMEOUT_MS=20000,refsSeq=0,refsLoadT=0;
  function withTimeout(p,ms){return new Promise(function(res,rej){var t=setTimeout(function(){rej(new Error('timeout'));},ms);
    Promise.resolve(p).then(function(v){clearTimeout(t);res(v);},function(e){clearTimeout(t);rej(e);});});}
  /* 2026-11-25 P3 (Pixel): ONE status line for the form's lists (ref lists + managed lists, shipments_lists.js onStatus):
     'Couldn’t load list' if either failed, else 'Loading lists…' if either is loading. One Retry reloads whatever failed. */
  var refsState=null,listsState=null;
  function refStatus(state){refsState=state;paintStat();if(state!=='loading')ocVarHint();}
  function paintStat(){
    var box=el('lstat');if(!box)return;var s=box.querySelector('[data-src="lists"]');
    var state=refsState==='failed'||listsState==='failed'?'failed':refsState==='loading'||listsState==='loading'?'loading':null;
    if(!state){if(s)s.remove();return;}
    if(!s){s=document.createElement('div');s.setAttribute('data-src','lists');box.appendChild(s);}
    if(s.getAttribute('data-state')===state)return;s.setAttribute('data-state',state);
    s.innerHTML=state==='loading'
      ?'<div class="sv2-banner info" role="status"><span aria-hidden="true">i</span><span style="flex:1">Loading lists… · <bdi lang="ar" dir="rtl">جارٍ تحميل القوائم</bdi></span></div>'
      :'<div class="sv2-banner err" role="alert"><span aria-hidden="true">!</span><span style="flex:1">Couldn’t load list · <bdi lang="ar" dir="rtl">تعذر تحميل القائمة</bdi></span><button type="button" class="sv2-btn sec sm" data-act="refsRetry">Retry · <bdi lang="ar" dir="rtl">إعادة المحاولة</bdi></button></div>';
  }
  function retryLists(){
    var rf=refsState==='failed',lf=listsState==='failed';
    if(rf||!lf)bootRefs(true);
    if(lf&&LISTS&&typeof LISTS.retry==='function'){listsState=null;LISTS.retry();}
    paintStat();
  }
  /* 2026-11-25 P3 (Pixel): Other crops — a crop is picked but the Variety list has nothing to offer (no other_crops rows in
     varieties): say so instead of an empty suggestion list. Not shown while the lists are loading or failed. */
  function ocVarHint(){
    if(!OC||dead)return;var h=el('lhint');if(!h||!h.parentNode)return;var x=el('ocvhint');
    var show=!!val('crop')&&!!REF.varsLoaded&&refsState!=='failed'&&refsState!=='loading'&&!varNames().length;
    if(!show){if(x)x.remove();return;}
    if(!x){x=document.createElement('div');x.id='sv2-ocvhint';x.className='sv2-ocvhint';x.setAttribute('role','note');
      x.innerHTML='<i class="ic" aria-hidden="true">i</i><span>No varieties for this crop · <bdi lang="ar" dir="rtl">لا توجد أصناف لهذا المحصول</bdi></span>';h.parentNode.insertBefore(x,h.nextSibling);}
  }
  /* 2026-11-25 P3 (Pixel): phones — a focused field under the sticky Save bar scrolls up above it (scroll-margin-bottom = bar + offset) */
  function onFormFocus(e){
    var t=e.target;if(!isNarrow()||!t||!/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)||!t.closest('#sv2-vform')||t.closest('.sv2-submit'))return;
    setTimeout(function(){var b=q('.sv2-submit');if(dead||!b||document.activeElement!==t)return;
      var r=t.getBoundingClientRect(),br=b.getBoundingClientRect();
      if(r.bottom>br.top-4&&r.top<br.bottom&&t.scrollIntoView){try{t.scrollIntoView({block:'nearest'});}catch(_e){}}},60);
  }
  host.addEventListener('focusin',onFormFocus);
  function headerNow(){return {crop:val('crop'),station:val('station'),vessel:val('vessel'),client:val('client'),receiving_port:val('port'),sector:val('sector'),
    season:val('pseason'),status:val('status'),subclient:val('subclient'),pack_house_departure:val('packdep')};}
  /* 2026-11-25 (test only, staging only): ?sv2failLists=1 makes the FIRST load of the form's lists fail, so the single
     'Couldn’t load list' line and one Retry can be checked without going offline. Ignored unless VISION_IS_DEV. */
  function forceListFail(){try{return window.VISION_IS_DEV===true&&/(?:^|[?&#])sv2failLists=1(?:&|$)/.test(String(location.search)+'&'+String(location.hash));}catch(_e){return false;}}
  var FORCE_FAIL=forceListFail();
  function bootRefs(retry){
    var seq=++refsSeq;clearTimeout(refsLoadT);refsLoadT=setTimeout(function(){if(!dead&&seq===refsSeq)refStatus('loading');},700);
    var cur=retry?headerNow():{status:''};if(retry)syncLines();
    var lp=FORCE_FAIL&&!retry?Promise.reject(new Error('sv2failLists=1 (test)')):loadRefs();
    withTimeout(lp,REFS_TIMEOUT_MS).then(function(){if(dead||seq!==refsSeq)return;clearTimeout(refsLoadT);refStatus(REF.part?'failed':null);
      fillHeaderSelects(cur);renderLines();attachLists();attachPtSuggest();if(OC&&DATA.length){deriveAll();rebuildFacetVals();renderList();}},
      function(){if(dead||seq!==refsSeq)return;clearTimeout(refsLoadT);refStatus('failed');fillHeaderSelects(cur);if(retry)renderLines();attachLists();attachPtSuggest();});
  }

  /* ---------------------------------------------------------- boot */
  if(!sb){setListBanner('Not connected. Reload the page and sign in to DalOS.');}
  else{
    loadList();
    bootRefs(false);
  }

  var api={
    isDirty:function(){return DIRTY;},
    /* Vision's leave guard: true = OK to leave */
    confirmLeave:confirmLeave,
    unmount:function(){
      dead=true;window.removeEventListener('beforeunload',onBeforeUnload);window.removeEventListener('resize',placeBar);
      document.removeEventListener('scroll',schedPill,{passive:true,capture:true});if(pillRaf)cancelAnimationFrame(pillRaf);placePill();
      if(phoneMQ){if(phoneMQ.removeEventListener)phoneMQ.removeEventListener('change',onMQ);else if(phoneMQ.removeListener)phoneMQ.removeListener(onMQ);}
      if(formMQ){if(formMQ.removeEventListener)formMQ.removeEventListener('change',onMQ);else if(formMQ.removeListener)formMQ.removeListener(onMQ);}
      if(footRO)footRO.disconnect();
      host.removeEventListener('click',onClick);host.removeEventListener('keydown',onKey);
      host.removeEventListener('change',onChange);host.removeEventListener('input',onInput);host.removeEventListener('focusout',onBlur);host.removeEventListener('focusin',onFormFocus);
      clearTimeout(searchT);clearTimeout(toastT);clearTimeout(undoT);closeModal();if(toastEl){toastEl.remove();toastEl=null;}if(undoEl){undoEl.remove();undoEl=null;}
      if(LISTS&&LISTS.detach){try{LISTS.detach();}catch(_e){}}LISTS=null;
      if(PTS&&PTS.detach){try{PTS.detach();}catch(_e){}}PTS=null;
      host.innerHTML='';if(CUR&&CUR.api===api)CUR=null;
    }
  };
  return {api:api,unmount:api.unmount};
}

/* CSV text for Excel: UTF-8 BOM, CRLF, every cell quoted; a text cell starting with = + - @ gets a leading ' (no formulas) */
function csvCell(v){if(v==null)return '""';var s=String(v);if(typeof v!=='number'&&/^[=+\-@\t\r]/.test(s)&&!/^-?\d+(\.\d+)?$/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csvText(rows){return '\ufeff'+rows.map(function(r){return r.map(csvCell).join(',');}).join('\r\n')+'\r\n';}
window.ShipV2={mount:mount,version:'2026-11-23',otherCropsEnabled:otherCropsEnabled,ptListsEnabled:ptListsEnabled,ptBuildLists:ptBuildLists,ptListsFrom:ptListsFrom,PT_MASTER_KEYS:PT_MASTER_KEYS,PT_LISTS:PT_LISTS,newLineOC:newLineOC,csvText:csvText,asciiDigits:asciiDigits,numProblem:numProblem,PACK_BULK_SET:function(m){PACK_BULK=m||{};},
  intakeFieldsEnabled:intakeFieldsEnabled,isStaleErr:isStaleErr,isNegNum:isNegNum,lineNegWeight:lineNegWeight,NEG_WT_MSG:NEG_WT_MSG,isBinType:isBinType,cartonOverMax:cartonOverMax,cartonMaxMsg:cartonMaxMsg,NONNEG_LINE:NONNEG_LINE,INTAKE_WARN:INTAKE_WARN,
  intakeBlank:intakeBlank,intakeMul:intakeMul,intakeLineNetT:intakeLineNetT,intakeLineGrossT:intakeLineGrossT,
  intakeContainerShare:intakeContainerShare,intakePascolActual:intakePascolActual,intakePackingWeight:intakePackingWeight,
  intakeCartonNetWarn:intakeCartonNetWarn,intakeLooksKg:intakeLooksKg,INTAKE_KG_MSG:INTAKE_KG_MSG,intakeCartonGrossWarn:intakeCartonGrossWarn,intakePackingFactorWarn:intakePackingFactorWarn,
  intakeCartonFooter:intakeCartonFooter};
})();
