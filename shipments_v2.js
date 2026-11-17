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
var SV2_INTAKE_FIELDS_ENABLED=!!window.VISION_IS_DEV; // intake DB v0.5 is applied: ON on staging (/dalos-vision-dev/ + localhost) only, OFF anywhere else
/* testers: localStorage.setItem('SV2_INTAKE_FIELDS_ENABLED','true') then reload (read once at mount) */
function intakeFieldsEnabled(){
  if(SV2_INTAKE_FIELDS_ENABLED)return true;
  try{
    var v=window.localStorage&&localStorage.getItem('SV2_INTAKE_FIELDS_ENABLED');
    return v==='true'||v==='1';
  }catch(e){return false;}
}

/* ---------------------------------------------------------------- styles */
var CSS=[
'.sv2{--sv2-glass:color-mix(in srgb,var(--card) 82%,transparent);display:grid;gap:12px;font-size:13px;color:var(--text)}',
'.sv2 *,.sv2 *::before,.sv2 *::after{box-sizing:border-box}',
'.sv2-view{display:none;gap:12px}.sv2-view.on{display:grid}',
'.sv2 .mono{font-family:var(--font-mono)}',
'.sv2-banner{display:flex;gap:10px;align-items:flex-start;border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.5;background:var(--amber-bg);border:1px solid var(--amber-border);color:#7a4a10}',
'.sv2-banner b{color:#5c360a}.sv2-banner.err{background:var(--red-bg);border-color:var(--red-border);color:var(--red)}.sv2-banner.err b{color:var(--red)}',
'.sv2-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
'.sv2-sp{flex:1}',
'.sv2-search{position:relative;flex:1 1 220px;max-width:340px}',
'.sv2-search input{width:100%;background:var(--card);border:1px solid var(--border2);border-radius:8px;padding:7px 30px 7px 10px;font:13px var(--font-body);color:var(--text);outline:none}',
'.sv2-search input:focus{border-color:var(--accent)}',
'.sv2-clr{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;color:var(--text3);cursor:pointer;font-size:13px;display:none;padding:2px 4px}',
'.sv2-search.has .sv2-clr{display:block}',
'.sv2-btn{font:500 13px var(--font-body);border-radius:var(--r);padding:7px 14px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;white-space:nowrap}',
'.sv2-btn:hover{background:var(--accent2);border-color:var(--accent2)}',
'.sv2-btn.sec{background:var(--card);border-color:var(--border2);color:var(--text2)}.sv2-btn.sec:hover{background:var(--bg2)}',
'.sv2-btn.sm{padding:4px 10px;font-size:12px}',
'.sv2-btn:disabled{opacity:.55;cursor:not-allowed}',
'.sv2-btn:focus-visible,.sv2 [data-act]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
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
'.sv2-pill.amber{color:var(--amber);background:var(--amber-bg);border-color:var(--amber-border)}',
'.sv2-pill.neutral{color:var(--text2);background:var(--bg2);border-color:var(--border)}',
'.sv2-w{font-family:var(--font-mono);font-size:10.5px;padding:1px 6px;border-radius:4px}.sv2-w.pend{background:var(--bg2);color:var(--text3)}.sv2-w.ok{background:var(--green-bg);color:var(--green)}.sv2-w.off{background:var(--amber-bg);color:var(--amber)}',
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
'.sv2-dirty{font-size:12px;color:var(--amber);display:none}.sv2-dirty.on{display:inline}',
'.sv2-ctx{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
'.sv2-chip{font-size:11.5px;padding:2px 9px;border-radius:20px;background:var(--card);border:1px solid var(--border);color:var(--text2)}',
'.sv2-chip.season{border-color:var(--accent2);color:var(--accent)}',
'.sv2-chip .pd{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:0}',
'.sv2-box{background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:12px 14px;display:grid;gap:10px;min-width:0;position:relative}',
'.sv2-st{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--text3)}',
'.sv2-st::before{content:"";width:20px;height:2px;background:var(--accent)}',
'.sv2-st small{text-transform:none;letter-spacing:0;font-weight:500}',
'.sv2-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 10px}',
'.sv2-f label{display:block;font-size:9.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--text3);margin-bottom:2px}',
'.sv2-f .req,.sv2 .req{color:var(--red)}',
'.sv2-in{width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:6px 9px;font:13px var(--font-body);color:var(--text);outline:none;min-width:0}',
'.sv2-in:focus{border-color:var(--accent)}',
'.sv2-in.mono{font-family:var(--font-mono);font-size:12.5px}',
'.sv2-in[readonly]{background:var(--bg2);color:var(--text3);cursor:not-allowed}',
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
'.sv2-lines{border-collapse:collapse;width:100%;min-width:1040px;font-size:12px}',
'.sv2-lines th{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);text-align:left;padding:6px 5px;border-bottom:2px solid var(--border2);font-weight:600;white-space:nowrap}',
'.sv2-lines td{padding:4px 5px;border-bottom:1px solid var(--bg2);vertical-align:middle}',
'.sv2 .cin,.sv2 .csel{width:100%;min-width:62px;background:var(--card);border:1px solid var(--border);border-radius:5px;padding:4px 6px;font:12px var(--font-body);color:var(--text)}',
'.sv2 .cin.mono,.sv2 .cin.num{font-family:var(--font-mono)}.sv2 .cin.num{text-align:right;min-width:58px}',
'.sv2 .cin.calc{background:var(--bg2);color:var(--text2);border-style:dashed;cursor:default}',
'.sv2 .cin.warn,.sv2-in.warn{border-color:var(--amber);background:var(--amber-bg)}',
'.sv2-wgroup{grid-column:1/-1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px 10px;padding:6px 8px;border:1px dashed var(--border2);border-radius:8px;background:var(--bg)}',
'.sv2-wgh{grid-column:1/-1;font-size:9.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text3)}',
'.sv2-wgh small{text-transform:none;letter-spacing:0;font-weight:500}',
'.sv2-ctnwarn,.sv2-kgwarn{display:none;font-size:12px;color:#7a4a10;background:var(--amber-bg);border:1px solid var(--amber-border);border-radius:8px;padding:6px 10px;flex-basis:100%}',
'.sv2-ctnwarn.on,.sv2-kgwarn.on{display:block}',
/* r2 P1: plain inline message under a flagged carton weight (warn-only, never blocks save) */
'.sv2-wmsg{font-size:12px;line-height:1.35;color:#7a4a10;margin-top:3px}.sv2-wmsg[hidden]{display:none}',
'.sv2-lines .idx{font-family:var(--font-mono);color:var(--text3)}',
'.sv2-lines tr.sub td,.sv2-lines tr.det td{background:var(--bg);font-size:11.5px}',
'.sv2-lines tr.det{display:none}.sv2-lines tr.det.open{display:table-row}',
'.sv2-lines tfoot td{font-family:var(--font-mono);font-weight:600;text-align:right;background:var(--bg2)}',
'.sv2-dgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px 10px;padding:4px 0}',
'.sv2-dlab{font-size:9.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text3)}',
'.sv2-cgwraw{font-size:10.5px;color:var(--text3);margin-top:2px}',
'.sv2-ib{border:1px solid var(--border);background:var(--card);border-radius:5px;cursor:pointer;color:var(--text3);font-size:13px;line-height:1;padding:3px 7px}',
'.sv2-ib.open{transform:rotate(180deg)}.sv2-ib.rm:hover{color:var(--red);border-color:var(--red-border)}',
'.sv2-lcards{display:none;gap:8px}',
'.sv2-lcard{border:1px solid var(--border);border-radius:var(--r2);background:var(--bg);display:grid}',
'.sv2-lcard .lh{display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer}',
'.sv2-lcard .lb{display:none;padding:2px 11px 11px;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr))}',
'.sv2-lcard.open .lb{display:grid}',
'.sv2-lcard .lb .full{grid-column:1/-1}',
'.sv2-submit{position:sticky;bottom:var(--sv2-bottom,8px);z-index:6;box-shadow:0 -2px 18px rgba(26,26,23,.10);display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;background:linear-gradient(var(--card),var(--card)),#fff;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:var(--r2);padding:10px 14px}',
'.sv2-tot{display:grid}.sv2-tot .k{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--text3)}.sv2-tot .v{font-family:var(--font-display);font-size:19px;font-variant-numeric:tabular-nums}',
'.sv2-ferr .sv2-banner{align-items:center}',
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
'  .sv2-fsels{width:100%}.sv2 .sv2-fsel{flex:1 1 140px;width:auto;max-width:none}',
'  .sv2-search{flex-basis:100%;max-width:none}',
'  .sv2-in,.sv2-search input{font-size:16px}',  /* no iOS zoom-on-focus */
'  .sv2-btn,.sv2-back{min-height:40px}',
'  .sv2-submit .sv2-btn{flex-basis:100%}',
'}',
/* r2 P2 (Pixel): <=768px the form lines are cards (no sideways scroll), weights wrap to 2 columns, and the
   form keeps room for the sticky Save bar (--sv2-footh = its measured height, set by placeFoot) */
'@media (max-width:768px){',
'  #sv2-vform .sv2-desk{display:none!important}#sv2-vform .sv2-lcards{display:grid}',
'  .sv2-lcard .sv2-wgroup{grid-template-columns:repeat(2,minmax(0,1fr))}',
'  .sv2-wgroup .sv2-dlab{white-space:normal;overflow-wrap:anywhere}',
'  #sv2-vform.on{padding-bottom:var(--sv2-footh,0px)}',
'  #sv2-vform input,#sv2-vform select{scroll-margin-bottom:calc(var(--sv2-footh,0px) + var(--sv2-bottom,8px) + 8px)}',
'}',
/* r2 P2: touch layouts — tap targets >= 44px, inputs >= 16px (no iOS zoom-on-focus); this form only */
'@media (max-width:768px),(pointer:coarse){',
'  #sv2-vform .sv2-in,#sv2-vform .cin,#sv2-vform .csel{font-size:16px!important;min-height:44px}',   /* !important: index.html sets 14px!important at >=768px */
'  #sv2-vform .sv2-btn,#sv2-vform .sv2-back,#sv2-vform .lh{min-height:44px}',
'  #sv2-vform .sv2-ib{min-height:44px;min-width:44px}',
'}',
/* r2 P3: <=420px the two loading dates take a full row each (no wrapped labels, no clipped mm/dd/yyyy) */
'@media (max-width:420px){#sv2-vform .sv2-fdate{grid-column:1/-1}#sv2-vform .sv2-fdate label{white-space:nowrap}}'
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
function newLine(){return {id:null,category:'',variety:'',lot:'',daltex_class:'',client_class:'',carton_type:'',brand:'',packaging_type:'',caliber:'',count_size:'',pack_house:'',source_type:'',raw_source:'',pallet_count:'',carton_count:'',net_weight:'',gross_weight:'',carton_net_weight:'',carton_gross_weight:'',pascol_weight:'',pascol_pct:'',packing_weight:'',packing_factor:'',pascol_net:'',weight_variance:'',traceability_code:''};}
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
/* whole-number fields (server: _shipments_v2_int) — everything else in NUMKEYS is a decimal */
var INTKEYS={pallet_count:1,carton_count:1,punnet_count:1,pallets:1,jumbo_count:1,sack_count:1};
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
var NUMKEYS={pallets:'numeric',jumbo_count:'numeric',sack_count:'numeric',standard_weight:'decimal',package_weight:'decimal',pack_size:'decimal',pallet_count:'numeric',carton_count:'numeric',net_weight:'decimal',gross_weight:'decimal',carton_net_weight:'decimal',carton_gross_weight:'decimal',pascol_weight:'decimal',pascol_pct:'decimal',packing_weight:'decimal',packing_factor:'decimal',pascol_net:'decimal',weight_variance:'decimal'};

/* ---------------------------------------------------------------- intake maths (all weights in tonnes, never ÷1000)
   Strings in, strings out ('' = blank), same 6-decimal tidy as calcPascol. Invalid numbers count as blank here
   (numProblem flags them as invalid separately). Exported on window.ShipV2 for tests. */
var INTAKE_WARN={cartonNetMin:0.001,cartonNetMax:0.05,grossHeadroom:0.01,packingFactorMin:0,packingFactorMax:0.01};
function intakeBlank(v){return String(v==null?'':v).trim()==='';}
function intakeR6(x){return String(Number(x.toFixed(6)));}
/* gap 3 (2026-11-17): the save RPCs refuse negatives on these (via _sv2_intake_nonneg / the Cartons check), so refuse them inline
   before Save too. Pallets are NOT here: returned containers carry negative pallets and the RPC allows them. Not used for potatoes. */
var NONNEG_LINE={carton_count:1,carton_net_weight:1,carton_gross_weight:1,packing_factor:1};
function isNegNum(v){var s=asciiDigits(v==null?'':v).trim();return /^-/.test(s)&&!numProblem(v,0);}
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
var INTAKE_KG_MSG='Looks like kg. Carton weights are in tons, e.g. 0.015';
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
  function isCitrus(){return PRODUCT==='citrus';}
  function hasLot(){return PRODUCT!=='grapes';}   /* Tarek 2026-10-13: Lot # everywhere except Grapes */
  var PT=(PRODUCT==='potatoes');           /* Pivots line: own fields, totals and RPCs; everything else shared */
  /* new-column intake fields (planned date, total cartons, header pascol, packing factor). Read once at mount. Never potatoes. */
  var INTAKE=!PT&&intakeFieldsEnabled();
  function blankLine(){return PT?newLinePT():newLine();}
  function snapNote(){return SNAPSHOT_PRODUCTS[PRODUCT]?SNAPSHOT_NOTE:'';}
  function q(sel){return host.querySelector(sel);}
  function qa(sel){return Array.prototype.slice.call(host.querySelectorAll(sel));}
  function el(id){return host.querySelector('#sv2-'+id);}
  function val(id){var e=el(id);return e?String(e.value||'').trim():'';}

  var REF={clients:[],clientIdByName:{},subByClientId:{},cats:[],vars:[],packs:[],cartonTypes:[],ref:{}};
  var LINES=[],openRows={},MODE='list',EDIT={container:null,loaded:null,deletedIds:[]};
  var LOADED_IDS=[];   /* ids of the lines as last loaded from the server; Delete shipment sends exactly these */
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
  var ST={q:'',sortKey:'loaded',dir:'desc',limit:200,f:{cls:[],region:[],client:[],status:[],qc:[]}};
  var RENDER_STEP=200;
  var phoneMQ=window.matchMedia?window.matchMedia('(max-width:700px)'):null;
  function isPhone(){return !!(phoneMQ&&phoneMQ.matches);}
  /* r2: the form's lines switch to cards at <=768px (the list keeps its 700px switch) */
  var formMQ=window.matchMedia?window.matchMedia('(max-width:768px)'):null;
  function isNarrow(){return !!(formMQ&&formMQ.matches);}

  /* ---------------------------------------------------------- markup */
  host.innerHTML=
  '<div class="sv2">'+
   '<div class="sv2-view on" id="sv2-vlist">'+
    '<div class="sv2-banner" id="sv2-banner"><span aria-hidden="true">✎</span><span><b>Entry sandbox.</b> Changes here are saved to the new shipments table for testing. They don’t change the shipment records or any report. '+snapNote()+'</span></div>'+
    '<div class="sv2-toolbar">'+
     '<div class="sv2-search" id="sv2-searchwrap"><input id="sv2-q" type="search" placeholder="'+(PT?'Search container, client, station, variety, pivot, farm, lot, grade…':'Search container, client, vessel, booking, invoice, lot, port…')+'" autocomplete="off" aria-label="Search shipments"><button type="button" class="sv2-clr" data-act="clearQ" aria-label="Clear search">✕</button></div>'+
     '<span class="sv2-fsels" id="sv2-facets"></span>'+
     '<button type="button" class="sv2-reset" id="sv2-resetbtn" data-act="resetAll">Reset filters</button>'+
     '<span class="sv2-sp"></span>'+
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
    '<div class="sv2-box">'+
     '<div class="sv2-overlay" id="sv2-overlay"><span class="sv2-spin"></span>Loading container…</div>'+
     (PT?ptHeaderHTML():orHeaderHTML())+
    '</div>'+
    '<div class="sv2-box">'+
     '<div class="sv2-st" id="sv2-lhint">'+esc(PRODUCT_NAME)+' lines <small>· at least one line</small></div>'+
     '<div class="sv2-tw sv2-desk" style="border:none"><table class="sv2-lines"><thead id="sv2-lhead"></thead><tbody id="sv2-lbody"></tbody><tfoot id="sv2-lfoot"></tfoot></table></div>'+
     '<div class="sv2-lcards" id="sv2-lcards"></div>'+
     '<div class="sv2-toolbar"><button type="button" class="sv2-btn sec sm" data-act="addLine">+ Add line</button><button type="button" class="sv2-btn sec sm" data-act="dupLast">⧉ Duplicate last line</button></div>'+
    '</div>'+
    '<div class="sv2-submit">'+
     tot('Lines','slines')+tot('Pallets','spal')+
     (PT?tot('Jumbo bags','sjumbo')+tot('Sacks','ssack')+tot('Standard wt','snet')+tot('Pascol wt','spas')
        :tot('Cartons','sctn')+tot('Net weight','snet'))+
     '<span class="sv2-sp"></span><button type="button" class="sv2-btn" data-act="save">Save shipment</button>'+
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
     (INTAKE?'<div class="sv2-st">Container weights <small>· once per container, not per line</small></div>'+
      '<div class="sv2-grid">'+
       fld('Total cartons','tcartons','text',{mono:1,inputmode:'numeric'})+
       (isCitrus()?fld('Pascol weight (t)','hpascol','text',{mono:1,inputmode:'decimal'}):'')+
      '</div>':'')+
     '<div class="sv2-st">Destination &amp; commercial</div>'+
     '<div class="sv2-grid">'+
      fld('Receiving Country','country','text',{list:'sv2-dl-country'})+fld('Receiving Port','port','text',{list:'sv2-dl-port'})+
      '<div class="sv2-f"><label for="sv2-client">Client</label><select class="sv2-in" id="sv2-client" data-chg="client"></select></div>'+
      '<div class="sv2-f"><label for="sv2-subclient">Subclient</label><select class="sv2-in" id="sv2-subclient"></select></div>'+
      fld('Agent','agent','text',{list:'sv2-dl-agent'})+fld('Shipper','shipper','text',{list:'sv2-dl-shipper'})+
     '</div>'+
     '<div class="sv2-st">Handling</div>'+
     '<div class="sv2-grid"><div class="sv2-f"><label for="sv2-packdep">Pack House (Departure)</label><select class="sv2-in" id="sv2-packdep"></select></div></div>'+
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
  function tot(k,id){return '<div class="sv2-tot"><span class="k">'+k+'</span><span class="v" id="sv2-'+id+'">0</span></div>';}
  function fld(label,id,type,o){o=o||{};
    var im=(type==='text'&&o.inputmode)?' inputmode="'+o.inputmode+'"':'';
    return '<div class="sv2-f'+(o.cls?' '+o.cls:'')+'"><label for="sv2-'+id+'">'+label+(o.req?' <span class="req">*</span>':'')+'</label>'+
      '<input class="sv2-in'+(o.mono?' mono':'')+'" id="sv2-'+id+'" type="'+(type||'text')+'"'+(type==='text'||!type?' dir="auto"':'')+(o.list?' list="'+o.list+'"':'')+
      (o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.req?' data-req="1"':'')+(o.chg?' data-chg="'+o.chg+'"':'')+im+' autocomplete="off"></div>';}

  /* ---------------------------------------------------------- reference data */
  function opts(list,cur){
    var arr=uniq((list||[]).slice());if(cur&&arr.indexOf(cur)<0)arr.unshift(cur);
    return '<option value=""></option>'+arr.map(function(o){return '<option'+(o===cur?' selected':'')+'>'+esc(o)+'</option>';}).join('');
  }
  function fillSelect(id,list,cur){var e=el(id);if(e)e.innerHTML=opts(list,cur);}
  function fillDatalist(id,list){var e=host.querySelector('#'+id);if(e)e.innerHTML=uniq(list||[]).map(function(o){return '<option value="'+esc(o)+'">';}).join('');}
  function loadRefs(){
    if(PT){ /* varieties from the shared registry (same list as potato inspections); the rest from the entry sheet */
      return Promise.resolve(sb.from('varieties').select('name,active').eq('active',true).eq('product_id','potatoes').order('name')).then(function(r){
        if(r.error)throw r.error;REF.vars=(r.data||[]).map(function(v){return {name:v.name};});ptFillDatalists();});
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
      return sb.rpc('get_shipment_v2_ref_options').then(function(rr){
        if(rr&&!rr.error&&rr.data){REF.ref=rr.data;fillAllDatalists();}
      },function(){});
    });
  }
  /* potato suggestions = the sheet's defaults + whatever is already in this product's list */
  function ptFillDatalists(){
    var L=PT_LISTS,hd=function(k){return DATA.map(function(c){return c.hdr[k];});},ln=function(k){return [].concat.apply([],DATA.map(function(c){return c.lines.map(function(l){return l[k];});}));};
    fillDatalist('sv2-dl-client',L.clients.concat(hd('client')));fillDatalist('sv2-dl-country',L.countries.concat(hd('region'),hd('country2')));
    fillDatalist('sv2-dl-port',L.ports.concat(hd('port')));fillDatalist('sv2-dl-pivot',L.pivots.concat(ln('pivot')));fillDatalist('sv2-dl-farm',L.farms.concat(ln('farm')));
  }
  function fillAllDatalists(){var o=REF.ref||{};
    fillDatalist('sv2-dl-line',o.lines);fillDatalist('sv2-dl-depport',o.dep_ports);fillDatalist('sv2-dl-country',o.countries);
    fillDatalist('sv2-dl-port',o.rec_ports);fillDatalist('sv2-dl-agent',o.agents);fillDatalist('sv2-dl-shipper',o.shippers);
    fillDatalist('sv2-dl-source',o.source_types);fillDatalist('sv2-dl-rawsource',o.raw_sources);}
  function catNames(){return REF.cats.map(function(c){return c.name;});}
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
    if(PT){fillSelect('station',PT_LISTS.stations,cur.station||'');fillSelect('sector',PT_LISTS.sectors,cur.sector||'');fillSelect('pseason',PT_LISTS.cropSeasons,cur.season||'');return;}
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
  var INTAKE_CALC_TITLE={pascol_pct:'Container Pascol weight (t) × line cartons ÷ Total cartons (read-only; the container value is entered once under Container weights)',packing_weight:'Cartons × Packing Net Weight (t per carton)',
    pascol_net:'Pascol share (t) − Packing weight (t)',weight_variance:'Pascol Net (t) − Net t'};
  /* r2 P1: tonne placeholders on the carton weights */
  var PH={carton_net_weight:'0.015',carton_gross_weight:'0.0165',packing_factor:'0.0011'};   /* DB v0.4: Packing Net Weight placeholder */
  /* r2 P2: required marker (new orchard lines need variety, pallets, cartons, carton net: REQ_LINE) */
  function rq(){return PT?'':' <span class="req" title="Required on new lines">*</span>';}
  /* r2 P1: plain inline warning under a carton weight; painted by paintWarns, no data-k (never saved) */
  function wmsg(i,k){return '<div class="sv2-wmsg" data-wmsg="'+k+'" role="status" hidden></div>';}
  function cin(v,k,cls,list){if(isCitrus()&&(PAS_CALC[k]||(INTAKE&&k==='packing_weight')))return roIn(v,k,INTAKE?INTAKE_CALC_TITLE[k]:'Calculated from the pascol weight, gross, packing and net weights');
    var im=NUMKEYS[k]?' inputmode="'+NUMKEYS[k]+'"':'';
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
      (INTAKE&&isCitrus()?g('Packing Net Weight (t per carton)',cin(d.packing_factor,'packing_factor','num')+wmsg(i,'packing_factor')):'')+
      g(old?'Computed net t · hint':'Net t · auto',hintIn('cnet',i,old?'Cartons × carton net t. A hint only: the stored Net t is not changed':'Cartons × carton net t'))+
      g(old?'Computed gross t · hint':'Gross t · auto',hintIn('cgrs',i,old?'Cartons × carton gross t. A hint only: the stored Gross t is not changed':'Cartons × carton gross t'))+
    '</div>';
  }
  function csel(list,v,k,chg){return '<select class="csel" dir="auto" data-k="'+k+'"'+(chg?' data-chg="'+chg+'"':'')+'>'+opts(list,v)+'</select>';}
  function ncols(){return (isCitrus()?16:15)-(hasLot()?0:1);}
  function headHTML(){
    return '<tr><th></th><th>#</th><th>Category</th><th>Variety'+rq()+'</th>'+(hasLot()?'<th>Lot #</th>':'')+'<th>Daltex Class</th><th>Client Class</th><th>Carton Type</th><th>Brand</th><th>Packing</th>'+(isCitrus()?'<th>Caliber</th>':'')+
      '<th class="num">Pallets'+rq()+'</th><th class="num">Cartons'+rq()+'</th><th class="num">Net t</th><th class="num">Gross t</th><th></th></tr>';
  }
  function rowHTML_line(d,i){
    return '<tr data-line="'+i+'">'+
      '<td><button type="button" class="sv2-ib'+(openRows[i]?' open':'')+'" data-act="toggleLine" data-i="'+i+'" aria-label="Carton weights'+(isCitrus()?' and weighbridge':'')+'">⌄</button></td>'+
      '<td class="idx">'+(i+1)+'</td>'+
      '<td>'+csel(catNames(),d.category,'category','cat')+'</td>'+
      '<td>'+csel(varsFor(d.category),d.variety,'variety')+'</td>'+
      (hasLot()?'<td>'+cin(d.lot,'lot','mono')+'</td>':'')+'<td>'+cin(d.daltex_class,'daltex_class')+'</td><td>'+cin(d.client_class,'client_class')+'</td>'+
      '<td>'+csel(REF.cartonTypes,d.carton_type,'carton_type')+'</td><td>'+cin(d.brand,'brand')+'</td><td>'+cin(d.packaging_type,'packaging_type')+'</td>'+
      (isCitrus()?'<td>'+cin(d.caliber,'caliber','mono')+'</td>':'')+
      '<td>'+cin(d.pallet_count,'pallet_count','num')+'</td><td>'+cin(d.carton_count,'carton_count','num')+'</td>'+
      '<td>'+netIn(d)+'</td><td>'+grsIn(d)+'</td>'+
      '<td><button type="button" class="sv2-ib rm" data-act="rmLine" data-i="'+i+'" aria-label="Remove line '+(i+1)+'">×</button></td>'+
    '</tr>'+
    '<tr class="sub" data-line="'+i+'"><td></td><td colspan="'+(ncols()-1)+'"><div class="sv2-dgrid">'+
      '<div><div class="sv2-dlab">Handling · this line — Pack House (Packing)</div>'+csel(REF.packs,d.pack_house,'pack_house')+'</div>'+
      '<div><div class="sv2-dlab">Source Type</div>'+cin(d.source_type,'source_type')+'</div>'+
      '<div><div class="sv2-dlab">Raw Source</div>'+cin(d.raw_source,'raw_source')+'</div>'+
      '<div><div class="sv2-dlab">Count</div>'+cin(d.count_size,'count_size','mono')+'</div>'+
      '<div><div class="sv2-dlab">Trace code</div>'+cin(d.traceability_code,'traceability_code','mono')+'</div>'+
    '</div></td></tr>'+
    '<tr class="det'+(openRows[i]?' open':'')+'" data-line="'+i+'"><td></td><td colspan="'+(ncols()-1)+'"><div class="sv2-dgrid">'+
      wgroupHTML(d,i,false)+
      '<div><div class="sv2-dlab">Container % · auto</div>'+cpct(i)+'</div>'+
      (isCitrus()?
      (INTAKE?'':'<div><div class="sv2-dlab">Pascol Weight (t) · weighbridge</div>'+cin(d.pascol_weight,'pascol_weight','num')+'</div>')+
      '<div><div class="sv2-dlab">'+(INTAKE?'Pascol share (t) · auto':'Pascol Actual % · auto')+'</div>'+cin(d.pascol_pct,'pascol_pct','num')+'</div>'+
      '<div><div class="sv2-dlab">'+(INTAKE?'Packing Weight (t) · auto':'Packing Weight (t)')+'</div>'+cin(d.packing_weight,'packing_weight','num')+'</div>'+
      '<div><div class="sv2-dlab">Pascol Net (t) · auto</div>'+cin(d.pascol_net,'pascol_net','num')+'</div>'+
      '<div><div class="sv2-dlab">Weight Variance (t) · auto</div>'+cin(d.weight_variance,'weight_variance','num')+'</div>':'')+
    '</div></td></tr>';
  }
  function cardHTML_line(d,i){
    function f(lab,inner,full){return '<div class="'+(full?'full':'')+'"><div class="sv2-dlab">'+lab+'</div>'+inner+'</div>';}
    var title=(d.variety||d.category||'New line');
    return '<div class="sv2-lcard'+(openRows[i]?' open':'')+'" data-line="'+i+'">'+
      '<div class="lh" data-act="toggleLine" data-i="'+i+'" role="button" tabindex="0" aria-expanded="'+(openRows[i]?'true':'false')+'">'+
        '<b>'+(i+1)+'. '+esc(title)+'</b><span class="sv2-sp"></span><span class="mono" style="color:var(--text3)">'+esc(d.pallet_count||0)+' plt · '+esc(d.carton_count||0)+' ctn</span>'+
      '</div>'+
      '<div class="lb">'+
        f('Category',csel(catNames(),d.category,'category','cat'))+f('Variety'+rq(),csel(varsFor(d.category),d.variety,'variety'))+
        f('Pallets'+rq(),cin(d.pallet_count,'pallet_count','num'))+f('Cartons'+rq(),cin(d.carton_count,'carton_count','num'))+
        f('Net t',netIn(d))+f('Gross t',grsIn(d))+
        f('Carton type',csel(REF.cartonTypes,d.carton_type,'carton_type'))+f('Brand',cin(d.brand,'brand'))+
        (hasLot()?f('Lot #',cin(d.lot,'lot','mono')):'')+f('Packing',cin(d.packaging_type,'packaging_type'))+
        f('Daltex class',cin(d.daltex_class,'daltex_class'))+f('Client class',cin(d.client_class,'client_class'))+
        (isCitrus()?f('Caliber',cin(d.caliber,'caliber','mono')):'')+f('Count',cin(d.count_size,'count_size','mono'))+
        f('Trace code',cin(d.traceability_code,'traceability_code','mono'),true)+
        f('Pack House (Packing)',csel(REF.packs,d.pack_house,'pack_house'),true)+
        f('Source Type',cin(d.source_type,'source_type'))+f('Raw Source',cin(d.raw_source,'raw_source'))+
        wgroupHTML(d,i,true)+
        f('Container % · auto',cpct(i))+
        (isCitrus()?(INTAKE?'':f('Pascol t',cin(d.pascol_weight,'pascol_weight','num')))+f(INTAKE?'Pascol share (t) · auto':'Pascol % · auto',cin(d.pascol_pct,'pascol_pct','num'))+
          f(INTAKE?'Packing t · auto':'Packing t',cin(d.packing_weight,'packing_weight','num'))+f('Pascol net t · auto',cin(d.pascol_net,'pascol_net','num'))+
          f('Variance t · auto',cin(d.weight_variance,'weight_variance','num')):'')+
        '<div class="full"><button type="button" class="sv2-btn sec sm" data-act="rmLine" data-i="'+i+'">Remove this line</button></div>'+
      '</div>'+
    '</div>';
  }
  /* ---- potato lines: main row = what's scanned; detail = the rest of the 21 sheet fields ---- */
  function varNames(){return REF.vars.map(function(v){return v.name;});}
  function ptHeadHTML(){return '<tr><th></th><th>#</th><th>Variety</th><th>Pivot</th><th>Farm</th><th>Grade</th><th>Packaging</th><th class="num">Pallets</th><th class="num">Jumbo #</th><th class="num">Sack #</th><th class="num">Std wt t</th><th class="num">Pascol t</th><th></th></tr>';}
  function dl(lab,inner){return '<div><div class="sv2-dlab">'+lab+'</div>'+inner+'</div>';}
  function ptDetail(d){
    var L=PT_LISTS;
    return dl(ar('Lot No','رقم اللوط'),cin(d.lot,'lot','mono'))+dl(ar('Size 1','الحجم1'),cin(d.size1,'size1'))+
      dl(ar('Size 2','الحجم2'),csel(L.size2,d.size2,'size2'))+dl(ar('Crop type','محصول'),csel(L.cropTypes,d.crop_type,'crop_type'))+
      dl(ar('Package weight','وزن العبوه'),cin(d.package_weight,'package_weight','num'))+dl(ar('Pack size','عبوه1'),cin(d.pack_size,'pack_size','num'))+
      dl(ar('Brand','براند'),csel(L.brands,d.brand,'brand'))+dl(ar('Jumbo colour','لون الجامب'),csel(L.colours,d.jumbo_colour,'jumbo_colour'))+
      dl(ar('Sack colour','لون الشيكاره'),csel(L.colours,d.sack_colour,'sack_colour'))+dl(ar('Operation','نوع تشغيل'),csel(L.ops,d.op_type,'op_type'))+
      dl(ar('Condition','الحاله'),csel(L.conditions,d.condition,'condition'));
  }
  function ptRowHTML(d,i){
    var L=PT_LISTS;
    return '<tr data-line="'+i+'">'+
      '<td><button type="button" class="sv2-ib'+(openRows[i]?' open':'')+'" data-act="toggleLine" data-i="'+i+'" aria-label="Lot, sizing, packaging and handling">⌄</button></td>'+
      '<td class="idx">'+(i+1)+'</td>'+
      '<td>'+csel(varNames(),d.variety,'variety')+'</td>'+
      '<td>'+cin(d.pivot,'pivot','','sv2-dl-pivot')+'</td><td>'+cin(d.farm,'farm','','sv2-dl-farm')+'</td>'+
      '<td>'+csel(L.grades,d.grade,'grade')+'</td><td>'+csel(L.packs,d.packaging,'packaging')+'</td>'+
      '<td>'+cin(d.pallets,'pallets','num')+'</td><td>'+cin(d.jumbo_count,'jumbo_count','num')+'</td><td>'+cin(d.sack_count,'sack_count','num')+'</td>'+
      '<td>'+cin(d.standard_weight,'standard_weight','num')+'</td><td>'+cin(d.pascol_weight,'pascol_weight','num')+'</td>'+
      '<td><button type="button" class="sv2-ib rm" data-act="rmLine" data-i="'+i+'" aria-label="Remove line '+(i+1)+'">×</button></td>'+
    '</tr>'+
    '<tr class="det'+(openRows[i]?' open':'')+'" data-line="'+i+'"><td></td><td colspan="12"><div class="sv2-dgrid">'+ptDetail(d)+'</div></td></tr>';
  }
  function ptCardHTML(d,i){
    var L=PT_LISTS;
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
        ptDetail(d)+
        '<div class="full"><button type="button" class="sv2-btn sec sm" data-act="rmLine" data-i="'+i+'">Remove this line</button></div>'+
      '</div>'+
    '</div>';
  }
  function renderLines(){
    if(PT){
      el('lfoot').innerHTML='';
      if(isNarrow()){el('lhead').innerHTML='';el('lbody').innerHTML='';el('lcards').innerHTML=LINES.map(ptCardHTML).join('');}
      else{el('lcards').innerHTML='';el('lhead').innerHTML=ptHeadHTML();el('lbody').innerHTML=LINES.map(ptRowHTML).join('');}
      recompute();return;
    }
    if(isNarrow()){
      el('lhead').innerHTML='';el('lbody').innerHTML='';el('lfoot').innerHTML='';
      el('lcards').innerHTML=LINES.map(cardHTML_line).join('');
    } else {
      el('lcards').innerHTML='';
      el('lhead').innerHTML=headHTML();
      el('lbody').innerHTML=LINES.map(rowHTML_line).join('');
      el('lfoot').innerHTML='<tr><td colspan="'+((isCitrus()?11:10)-(hasLot()?0:1))+'" style="font-family:var(--font-body);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--text3)">Totals</td><td id="sv2-tpal">0</td><td id="sv2-tctn">0</td><td id="sv2-tnet">0.00</td><td id="sv2-tgrs">0.00</td><td></td></tr>';
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
    syncLines();
    if(PT){var jn=0,sk=0,pp=0,sw=0,ps=0;LINES.forEach(function(d){jn+=numOf(d.jumbo_count,1);sk+=numOf(d.sack_count,1);pp+=numOf(d.pallets,1);sw+=numOf(d.standard_weight);ps+=numOf(d.pascol_weight);});
      var st=function(id,v){var e=el(id);if(e)e.textContent=v;};
      st('slines',LINES.length);st('spal',pp.toLocaleString());st('sjumbo',jn.toLocaleString());st('ssack',sk.toLocaleString());st('snet',sw.toFixed(2)+' t');st('spas',ps.toFixed(2)+' t');return;}
    calcNewLineWeights();
    if(isCitrus()&&PAS_LIVE){if(INTAKE)calcPascolIntake();else calcPascol();}
    var pal=0,ctn=0,net=0,grs=0;
    LINES.forEach(function(d){pal+=numOf(d.pallet_count,1);ctn+=numOf(d.carton_count,1);net+=numOf(d.net_weight);grs+=numOf(d.gross_weight);});
    var set=function(id,v){var e=el(id);if(e)e.textContent=v;};
    set('tpal',pal.toLocaleString());set('tctn',ctn.toLocaleString());set('tnet',net.toFixed(2));set('tgrs',grs.toFixed(2));
    set('slines',LINES.length);set('spal',pal.toLocaleString());set('sctn',ctn.toLocaleString());set('snet',net.toFixed(2)+' t');
    if(INTAKE){var tc=val('tcartons');
      LINES.forEach(function(d,i){var s=intakeShareRaw(d.carton_count,tc),v=s===null?'':(Math.round(s*1000)/10).toFixed(1)+' %';qa('[data-cpct="'+i+'"]').forEach(function(f){f.value=v;});});
      var fw=el('ctnwarn');if(fw){var r=intakeCartonFooter(ctn,tc);fw.classList.toggle('on',r.kind!=='ok');fw.textContent=r.message;}
    }
    else LINES.forEach(function(d,i){var n=numOf(d.net_weight),v=net>0&&String(d.net_weight||'').trim()?(Math.round(n/net*1000)/10).toFixed(1)+' %':'';qa('[data-cpct="'+i+'"]').forEach(function(f){f.value=v;});});
    /* computed net/gross display in the weights block (for existing lines a hint only — never written into the line) */
    LINES.forEach(function(d,i){
      var n=intakeLineNetT(d.carton_count,d.carton_net_weight),g=intakeLineGrossT(d.carton_count,d.carton_gross_weight);
      qa('[data-cnet="'+i+'"]').forEach(function(f){f.value=n;});qa('[data-cgrs="'+i+'"]').forEach(function(f){f.value=g;});
    });
    paintWarns();
    if(!footRO)placeFoot();
  }
  /* new (unsaved) lines: Net t / Gross t = cartons × carton net / gross t, saved in the existing net_weight / gross_weight columns.
     Existing lines (d.id) keep their stored net/gross — never silently overwritten. */
  function calcNewLineWeights(){
    LINES.forEach(function(d,i){if(d.id)return;
      var v={net_weight:intakeLineNetT(d.carton_count,d.carton_net_weight),gross_weight:intakeLineGrossT(d.carton_count,d.carton_gross_weight)};
      Object.keys(v).forEach(function(k){d[k]=v[k];qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.value=v[k];});});
    });
  }
  /* Anna's ranges: amber warn only (class "warn", never "invalid"), never blocks save */
  function warnCell(i,k,on,msg){qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.classList.toggle('warn',on);if(!f.classList.contains('invalid'))f.title=on?msg:'';});
    qa('[data-line="'+i+'"] [data-wmsg="'+k+'"]').forEach(function(m){m.hidden=!on;m.textContent=on?msg:'';});return on;}
  function paintWarns(){
    if(PT)return;var W=INTAKE_WARN;
    var kgL=[],oddL=[];   /* r2 P1: line numbers for the footer note */
    LINES.forEach(function(d,i){
      var kn=intakeLooksKg(d.carton_net_weight),kg=intakeLooksKg(d.carton_gross_weight);
      var a=warnCell(i,'carton_net_weight',intakeCartonNetWarn(d.carton_net_weight),kn?INTAKE_KG_MSG:'Unusual carton net t (expected '+W.cartonNetMin+'–'+W.cartonNetMax+')');
      var b=warnCell(i,'carton_gross_weight',intakeCartonGrossWarn(d.carton_net_weight,d.carton_gross_weight),kg?INTAKE_KG_MSG:'Unusual carton gross t (expected carton net t to carton net t + '+W.grossHeadroom+')');
      var c=INTAKE&&isCitrus()&&warnCell(i,'packing_factor',intakePackingFactorWarn(d.packing_factor),'Unusual Packing Net Weight (expected '+W.packingFactorMin+'–'+W.packingFactorMax+')');
      if((a&&kn)||(b&&kg))kgL.push(i+1);else if(a||b||c)oddL.push(i+1);
    });
    /* soft amber note in the Save bar; warn-only, the save is never blocked */
    var fw=el('kgwarn');if(fw){var t=[];
      if(kgL.length)t.push('Line '+kgL.join(', ')+': '+INTAKE_KG_MSG+'.');
      if(oddL.length)t.push('Line '+oddL.join(', ')+': unusual carton weights. Check before saving.');
      fw.textContent=t.join(' ');fw.classList.toggle('on',t.length>0);}
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
      var v={pascol_pct:ok?intakeR6(pa):'',packing_weight:pw,pascol_net:ok?intakeR6(pn):'',weight_variance:ok?intakeR6(pn-numOf(d.net_weight)):''};
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
  function blankHeader(){HDR_IDS.forEach(function(id){var e=el(id);if(e){e.value='';e.classList.remove('invalid');}});}
  function readHeader(){
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
    return h;
  }
  function setSeasonChip(){var c=el('ctxseason');if(c)c.textContent=MODE==='create'?('Season '+(SEASON_NAME||'—')+' · from the sidebar'):'Season kept from the record';}

  /* ---------------------------------------------------------- feedback */
  var toastEl=null,toastT=null;
  function toast(msg){
    if(!toastEl){toastEl=document.createElement('div');toastEl.className='sv2-toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);}
    toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){if(toastEl)toastEl.classList.remove('on');},2400);
  }
  var BTN_LABEL={reload:'Reload',retry:'Retry',openExisting:'Open existing'};
  function showFormError(msg,act,warn){
    var e=el('ferr');if(!e)return;
    e.innerHTML='<div class="sv2-banner'+(warn?'':' err')+'" role="alert"><span aria-hidden="true">!</span><span style="flex:1;white-space:pre-line">'+esc(msg)+'</span>'+(act?'<button type="button" class="sv2-btn sec sm" data-act="'+act+'">'+(BTN_LABEL[act]||'Retry')+'</button>':'')+'</div>';
    if(e.getBoundingClientRect().top<0)e.scrollIntoView({block:'center'});
  }
  function clearFormError(){var e=el('ferr');if(e)e.innerHTML='';}
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
  function lineNumProblem(k,v){var pr=numProblem(v,INTKEYS[k]);if(!pr&&!PT&&NONNEG_LINE[k]&&isNegNum(v))pr='can\u2019t be negative';return pr;}
  function lineLabel(k){var m={variety:'Variety',pallet_count:'Pallets',net_weight:'Net t',pallets:'Pallets',standard_weight:'Standard wt',carton_count:'Cartons',
    gross_weight:'Gross t',jumbo_count:'Jumbo #',sack_count:'Sack #',pascol_weight:'Pascol t',package_weight:'Package weight',pack_size:'Pack size',
    carton_net_weight:'Carton net t',carton_gross_weight:'Carton gross t',pascol_pct:INTAKE?'Pascol share t':'Pascol %',packing_weight:'Packing t',packing_factor:'Packing Net Weight',pascol_net:'Pascol net t',weight_variance:'Variance t'};return m[k]||k;}
  /* flag on: pascol_weight is copied in from the header, so it doesn't count as the user touching a line */
  function isUntouched(d){return !d.id&&Object.keys(d).every(function(k){return k==='id'||(INTAKE&&k==='pascol_weight')||String(d[k]||'').trim()==='';});}
  /* new orchard lines: Net t is computed (cartons × carton net t, read-only), so cartons + carton net are what's required */
  var REQ_LINE=PT?['variety','pallets','standard_weight']:['variety','pallet_count','carton_count','carton_net_weight'];
  function markCell(i,k,on){qa('[data-line="'+i+'"] [data-k="'+k+'"]').forEach(function(f){f.classList.toggle('invalid',on);f.setAttribute('aria-invalid',on?'true':'false');});}
  function checkLines(){
    var problems=[];
    LINES.forEach(function(d,i){
      var miss=[],bad=[];
      if(!d.id)REQ_LINE.forEach(function(k){var e=!String(d[k]||'').trim();markCell(i,k,e);if(e)miss.push(lineLabel(k));});   /* new lines: key fields required */
      Object.keys(NUMKEYS).forEach(function(k){if(!(k in d))return;var pr=lineNumProblem(k,d[k]);if(pr){markCell(i,k,true);bad.push(lineLabel(k)+' '+pr);}else if(REQ_LINE.indexOf(k)<0||d.id)markCell(i,k,false);});
      if(miss.length)problems.push('Line '+(i+1)+': '+miss.join(', ')+' missing');
      if(bad.length)problems.push('Line '+(i+1)+': '+bad.join(', '));
    });
    return problems;
  }

  /* ---------------------------------------------------------- save */
  function setSaving(on){SAVING=on;qa('[data-act="save"]').forEach(function(b){b.disabled=on;b.textContent=on?'Saving…':'Save shipment';});}
  function submitShip(){
    if(SAVING)return;
    clearFormError();
    var okC=validateField('container'),okL=validateField('ldate'),okS=PT||validateField('status');
    var missH=[];if(!okC)missH.push('Container No.');if(!okL)missH.push(INTAKE?'Actual loading date':'Loading Date');if(!okS)missH.push('Shipping Status');
    if(missH.length){showFormError(missH.join(', ')+(missH.length>1?' are':' is')+' required.');el(!okC?'container':!okL?'ldate':'status').focus();return;}
    if(!PT&&el('depdiff')&&el('depdiff').checked){var dd=val('depdate'),dErr=!dd?'Departure date is required':(dd<val('ldate')?'Departure date can\'t be before the loading date':(!SV2_SEND_DEPARTURE_DATE?'Preview only: departure date can\'t be saved yet. Untick the box to save':''));
      el('depdate').classList.toggle('invalid',!!dErr);if(dErr){showFormError(dErr+'.');el('depdate').focus();return;}}
    if(INTAKE){var hb=[];[['tcartons',1,'Total cartons'],['hpascol',0,'Pascol weight']].forEach(function(x){var e=el(x[0]);if(!e)return;
        var pr=numProblem(e.value,x[1])||(isNegNum(e.value)?'can\u2019t be negative':null);e.classList.toggle('invalid',!!pr);e.setAttribute('aria-invalid',pr?'true':'false');if(pr)hb.push(x[2]+' '+pr);});
      if(hb.length){showFormError('Fix these before saving:\n'+hb.join('\n'));var hf=host.querySelector('.sv2-in.invalid');if(hf)hf.focus();return;}}
    if(checkExisting())return;
    recompute();   /* sync + computed net/gross on new lines before the checks */
    /* drop new lines nobody touched (the form starts with one blank line) */
    var before=LINES.length;LINES=LINES.filter(function(d){return !isUntouched(d);});
    if(LINES.length!==before){openRows={};renderLines();}
    if(!LINES.length){LINES=[blankLine()];openRows={0:isNarrow()};renderLines();showFormError(PT?'Add at least one line with a variety, pallets and weight.':'Add at least one line with a variety, pallets, cartons and carton net.');return;}
    var problems=checkLines();
    if(problems.length){showFormError('Fix these before saving:\n'+problems.join('\n'));var f=host.querySelector('.invalid[data-k]');if(f)f.focus();return;}
    var hdr=readHeader();
    if(MODE==='create'){
      if(!SEASON){showFormError('Pick a season in the sidebar before saving.');return;}
      if(O.trueActiveSeasonId&&SEASON!==O.trueActiveSeasonId&&!SEASON_OK){askSeason(submitShip);return;}
      hdr.season_id=SEASON;
    }
    SEASON_OK=false;
    var lines=LINES.map(function(d){var c=Object.assign({},d);Object.keys(NUMKEYS).forEach(function(k){if(c[k]!=null&&c[k]!=='')c[k]=asciiDigits(c[k]);});delete c.carton_gross_weight_raw;return c;});
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
      ?sb.rpc(PT?'edit_shipment_v2_potato_full':'edit_shipment_v2_full',{p_header:hdr,p_lines:lines,p_deleted_ids:EDIT.deletedIds})
      :sb.rpc(PT?'save_shipment_v2_potato_full':'save_shipment_v2_full',{p_header:hdr,p_lines:lines});
    Promise.resolve(call).then(function(res){
      if(dead)return;
      setSaving(false);
      if(res.error){
        var stale=res.error.code==='40001';
        if(res.error.code==='23505'&&MODE==='create'){checkExisting();if(EXISTING_IDX>=0)return;}
        showFormError(friendlyErr(res.error),stale&&MODE==='edit'?'reload':null);return;
      }
      if(!res.data||res.data.ok!==true){showFormError('The shipment was not saved. Try again.');return;}
      toast(MODE==='edit'?'Shipment updated':'Shipment saved');
      setDirty(false);
      var c=(res.data.container_number)||hdr.container_number,l=(res.data.loading_date)||hdr.loading_date;
      MODE='edit';EDIT={container:c,loaded:l,deletedIds:[]};
      loadForEdit(c,l);loadList();
    },function(e){if(dead)return;setSaving(false);showFormError(friendlyErr(e));});
  }

  /* ---------------------------------------------------------- delete shipment (edit mode) */
  /* Deletes the whole open shipment: every line of this product + container + loading date, as last loaded.
     Type-to-confirm; the server refuses if the stored lines differ from LOADED_IDS (40001) and logs each row to audit_log. */
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
    DELETING=true;
    var go=modalEl&&modalEl.querySelector('[data-m="ok"]'),er=modalEl&&modalEl.querySelector('.sv2-delerr');
    if(go){go.disabled=true;go.textContent='Deleting…';}if(er)er.textContent='';
    Promise.resolve(sb.rpc('delete_shipment_v2_container',{p_product:PRODUCT,p_container:cn,p_loaded:ld,p_ids:ids})).then(function(res){
      DELETING=false;if(dead)return;
      if(res.error||!res.data||res.data.ok!==true){
        var m=res.error?friendlyErr(res.error):'The shipment was not deleted. Try again.';
        if(res.error&&res.error.code==='40001')m+='\nClose this, reload the shipment and try again.';
        if(er)er.textContent=m;if(go){go.textContent='Delete shipment';go.disabled=false;}return;
      }
      closeModal();
      toast('Shipment deleted ('+res.data.deleted+' line'+(res.data.deleted===1?'':'s')+')');
      formSeq++;setDirty(false);LOADED_IDS=[];MODE='list';EDIT={container:null,loaded:null,deletedIds:[]};syncDelBtn();
      showView('list');loadList();
    },function(e){DELETING=false;if(dead)return;if(er)er.textContent=friendlyErr(e);if(go){go.textContent='Delete shipment';go.disabled=false;}});
  }

  /* ---------------------------------------------------------- edit load */
  function loadForEdit(container,loaded){
    var my=++formSeq;
    clearFormError();blankHeader();setDep(false);LINES=[];RAWCGW={};openRows={};LOADED_IDS=[];syncDelBtn();renderLines();
    setVoyageLock(true);showOverlay(true);
    var getCall=PT?sb.rpc('get_shipment_v2_potato_container',{p_container:container,p_loaded:loaded})
                  :sb.rpc('get_shipment_v2_container',{p_container:container,p_loaded:loaded,p_product:PRODUCT});
    return Promise.resolve(getCall).then(function(res){
      if(dead||my!==formSeq)return;
      showOverlay(false);
      if(res.error){showFormError('Could not load '+container+' — '+friendlyErr(res.error),'retry');return;}
      var data=res.data||{},h=data.header,lines=data.lines||[];
      if(!h){showFormError('Shipment '+container+' loaded '+fmtDate(loaded)+' was not found.');return;}
      if(h.product_id&&h.product_id!==PRODUCT){showFormError('This container belongs to another product.');return;}
      LOADED_IDS=lines.map(function(l){return l.id;}).filter(Boolean);syncDelBtn();
      var setv=function(id,v){var e=el(id);if(e)e.value=(v==null?'':v);};
      if(PT){
        setv('container',h.container_number);setv('carta',h.carta);setv('ldate',h.loading_date);setv('vessel',h.vessel);setv('ccount',h.container_count);
        setv('client',h.client);setv('country',h.receiving_country);setv('country2',h.country2);setv('port',h.receiving_port);
        setv('invoice',h.invoice_no);setv('permit',h.permit_no);setv('workorder',h.work_order);
        fillHeaderSelects({station:h.station,sector:h.sector,season:h.season});deriveDate();
        LINES=lines.map(function(l){var d=newLinePT();Object.keys(d).forEach(function(k){if(l[k]!=null)d[k]=NUMKEYS[k]?tidyNum(l[k]):String(l[k]);});d.id=l.id||null;return d;});
        if(!LINES.length)LINES=[newLinePT()];
        openRows={};renderLines();setDirty(false);
        el('ftitle').textContent='Edit shipment';el('ctxref').textContent=h.container_number||container;setSeasonChip();return;
      }
      setv('container',h.container_number);setv('carta',h.carta);setv('ldate',h.loading_date);
      setv('vessel',h.vessel);setv('line',h.shipping_line);setv('booking',h.booking_no);setv('invoice',h.invoice_no);
      setv('po',h.po_number);setv('etd',h.etd);setv('eta',h.eta);setv('arrival',h.arrival_date);
      setv('depport',h.departure_port);setv('country',h.receiving_country);setv('port',h.receiving_port);
      setv('agent',h.agent);setv('shipper',h.shipper);
      setDep(!!h.departure_date&&h.departure_date!==h.loading_date,h.departure_date);
      fillHeaderSelects({status:h.shipping_status,client:h.client,subclient:h.subclient,pack_house_departure:h.pack_house_departure});
      deriveDate();syncCtxStatus();
      if(INTAKE){
        setv('plandate',h.planned_loading_date);setv('tcartons',h.total_cartons!=null&&h.total_cartons!==''?tidyNum(h.total_cartons):'');
        /* header pascol; older rows only have it per line → first non-empty line value */
        var hp=h.pascol_weight;
        if(hp==null||String(hp).trim()===''){var fl=lines.find(function(l){return l.pascol_weight!=null&&String(l.pascol_weight).trim()!=='';});hp=fl?fl.pascol_weight:'';}
        setv('hpascol',hp!=null&&String(hp).trim()!==''?tidyNum(hp):'');
      }
      PAS_LIVE=false;
      /* carton weights are tonnes in the DB and on screen (no kg conversion) */
      RAWCGW={};lines.forEach(function(l){if(l.id&&intakeBlank(l.carton_gross_weight)&&!intakeBlank(l.carton_gross_weight_raw))RAWCGW[l.id]=String(l.carton_gross_weight_raw);});
      /* DB v0.4: get returns packing_net_weight (alias of packing_factor); read the new key, fall back to the old one */
      lines.forEach(function(l){if(l.packing_net_weight!=null)l.packing_factor=l.packing_net_weight;delete l.packing_net_weight;});
      LINES=lines.map(function(l){var d=blankLine();Object.keys(d).forEach(function(k){if(l[k]!=null)d[k]=NUMKEYS[k]?tidyNum(l[k]):String(l[k]);});d.id=l.id||null;return d;});
      if(!LINES.length)LINES=[blankLine()];
      openRows={};renderLines();setDirty(false);
      el('ftitle').textContent='Edit shipment';el('ctxref').textContent=h.container_number||container;setSeasonChip();
    },function(e){if(dead||my!==formSeq)return;showOverlay(false);showFormError('Could not load '+container+' — '+friendlyErr(e),'retry');});
  }

  /* ---------------------------------------------------------- views */
  function scrollTop(){var r=host.getBoundingClientRect();if(r.top<0)host.scrollIntoView({block:'start'});}
  function showView(v){el('vlist').classList.toggle('on',v==='list');el('vform').classList.toggle('on',v==='form');scrollTop();}
  function openContainer(i){
    var c=DATA[i];if(!c)return;
    MODE='edit';EDIT={container:c.ref,loaded:c.hdr.loaded,deletedIds:[]};
    el('ftitle').textContent='Edit shipment';el('ctxref').textContent=c.ref;setSeasonChip();
    showView('form');loadForEdit(c.ref,c.hdr.loaded);
  }
  function openCreate(){
    formSeq++;MODE='create';EDIT={container:null,loaded:null,deletedIds:[]};SEASON_OK=false;LOADED_IDS=[];syncDelBtn();
    blankHeader();setDep(false);fillHeaderSelects({status:''});deriveDate();
    PAS_LIVE=true;LINES=[blankLine()];RAWCGW={};openRows={0:isNarrow()};renderLines();
    setVoyageLock(false);showOverlay(false);clearFormError();syncCtxStatus();setDirty(false);
    el('ftitle').textContent='New shipment';el('ctxref').textContent='New';setSeasonChip();
    showView('form');var c=el('container');if(c&&!isNarrow())c.focus();
  }
  function leaveForm(){if(!confirmLeave())return;formSeq++;setDirty(false);closeModal();MODE='list';showView('list');}

  /* ---------------------------------------------------------- list */
  var FACETS=PT?[
    {key:'station',label:'Packing station',vals:[],match:function(c,v){return c.hdr.station===v;}},
    {key:'sector',label:'Sector',vals:[],match:function(c,v){return c.hdr.sector===v;}},
    {key:'region',label:'Country',vals:[],match:function(c,v){return c.hdr.region===v;}},
    {key:'grade',label:'Grade',vals:[],match:function(c,v){return c._grade.indexOf(v)>=0;}}
  ]:[
    {key:'cls',label:'Client class',vals:[],match:function(c,v){return c._cls.indexOf(v)>=0;}},
    {key:'region',label:'Destination',vals:[],match:function(c,v){return c.hdr.region===v;}},
    {key:'client',label:'Client',vals:[],match:function(c,v){return c.hdr.client===v;}},
    {key:'status',label:'Status',vals:[],match:function(c,v){return c.hdr.status===v;}}
  ];
  function emptyF(){var f={};FACETS.forEach(function(x){f[x.key]=[];});return f;}
  ST.f=emptyF();
  function HEADS(){
    if(PT)return [{t:'Container',s:'ref'},{t:'Station',s:'station'},{t:'Client',s:'client'},{t:'Country',s:'region'},{t:'Loaded',s:'loaded'},
      {t:'Lines',s:'lines',n:1},{t:'Pallets',s:'pal',n:1},{t:'Packages',s:'pkg',n:1,tip:'Jumbo bags + sacks'},{t:'Standard t',s:'net',n:1},{t:'Grade'}];
    var h=[{t:'Container',s:'ref'},{t:'Client',s:'client'},{t:'Destination',s:'region'},{t:'Packing / class'},
      {t:'Loaded',s:'loaded'},{t:'Lines',s:'lines',n:1},{t:'Pallets',s:'pal',n:1},{t:'Cartons',s:'ctn',n:1},{t:'Net t',s:'net',n:1},{t:'Gross t',s:'grs',n:1}];
    if(isCitrus())h.push({t:'Weighbridge',s:'vr',tip:'Pascol weighbridge net vs packing weight. Green = within ±0.5 t, amber = over, grey = not weighed yet.'});
    h.push({t:'Status',s:'status'});return h;
  }
  var GET={ref:function(c){return c.ref;},client:function(c){return c.hdr.client||'';},region:function(c){return c.hdr.region||'';},
    loaded:function(c){return c._t;},lines:function(c){return c.lines.length;},pal:function(c){return c._pal;},ctn:function(c){return c._ctn;},
    net:function(c){return c._net;},grs:function(c){return c._grs;},vr:function(c){return c._pending?-Infinity:c._vr;},status:function(c){return c.hdr.status||'';},
    station:function(c){return c.hdr.station||'';},pkg:function(c){return c._ctn;}};
  var TEXTSORT={ref:1,client:1,region:1,status:1,station:1};
  function deriveAll(){DATA.forEach(function(c){
    c._pal=sum(c.lines,'pal');c._ctn=sum(c.lines,'ctn');c._net=sum(c.lines,'net');c._grs=sum(c.lines,'grs');
    c._cls=uniq(c.lines.map(function(l){return l.cc;}));c._pack=uniq(c.lines.map(function(l){return packShort(l.pk);}));
    c._t=+new Date(c.hdr.loaded+'T00:00');
    c._pending=c.lines.every(function(l){return l.pas==='—'||l.pas==null||l.pas==='';});c._vr=sum(c.lines,'vr');
    if(PT){c._grade=uniq(c.lines.map(function(l){return l.grade;}));
      var pp=[c.ref,c.hdr.vessel,c.hdr.carta,c.hdr.invoice,c.hdr.client,c.hdr.region,c.hdr.port,c.hdr.station,c.hdr.sector,c.hdr.season];
      c.lines.forEach(function(l){pp.push(l.v,l.pivot,l.farm,l.grade,l.ct,l.size2,l.crop,l.brand,l.op,l.lot);});
      c._search=pp.join('  ').toLowerCase();return;}
    var parts=[c.ref,c.hdr.vessel,c.hdr.line,c.hdr.booking,c.hdr.invoice,c.hdr.po,c.hdr.carta,c.hdr.client,c.hdr.subclient,c.hdr.port,c.hdr.region,c.hdr.pack,c.hdr.agent,c.hdr.shipper,c.hdr.status];
    c.lines.forEach(function(l){parts.push(l.v,l.cat,l.lot,l.dc,l.cc,l.ct,l.pk,l.cal,l.cnt);});
    c._search=parts.join('  ').toLowerCase();
  });}
  function rebuildFacetVals(){
    if(PT){FACETS[0].vals=uniq(DATA.map(function(c){return c.hdr.station;}));FACETS[1].vals=uniq(DATA.map(function(c){return c.hdr.sector;}));
      FACETS[2].vals=uniq(DATA.map(function(c){return c.hdr.region;}));FACETS[3].vals=uniq([].concat.apply([],DATA.map(function(c){return c._grade;})));return;}
    FACETS[0].vals=uniq([].concat.apply([],DATA.map(function(c){return c._cls;})));
    FACETS[1].vals=uniq(DATA.map(function(c){return c.hdr.region;}));
    FACETS[2].vals=uniq(DATA.map(function(c){return c.hdr.client;}));
    FACETS[3].vals=uniq(DATA.map(function(c){return c.hdr.status;}));
  }
  function passSearch(c){return !ST.q||c._search.indexOf(ST.q)>=0;}
  function passFacets(c,except){return FACETS.every(function(f){if(f.key===except)return true;var a=ST.f[f.key];return !a.length||a.some(function(v){return f.match(c,v);});});}
  function filtered(){return DATA.filter(function(c){return passSearch(c)&&passFacets(c,null);});}
  function sortRows(rows){var g=GET[ST.sortKey]||GET.loaded,dir=ST.dir==='asc'?1:-1,txt=TEXTSORT[ST.sortKey];
    return rows.slice().sort(function(a,b){var x=g(a),y=g(b);if(txt)return String(x).localeCompare(String(y))*dir;return (x<y?-1:x>y?1:0)*dir;});}
  function anyFilter(){return !!ST.q||FACETS.some(function(f){return ST.f[f.key].length>0;});}
  function hl(s){s=String(s==null?'':s);var t=(ST.q||'').trim();if(!t)return esc(s);var i=s.toLowerCase().indexOf(t);if(i<0)return esc(s);
    return esc(s.slice(0,i))+'<span class="sv2-hl">'+esc(s.slice(i,i+t.length))+'</span>'+esc(s.slice(i+t.length));}
  var ALL_LABEL=PT?{station:'All stations',sector:'All sectors',region:'All countries',grade:'All grades'}
                 :{cls:'All client classes',region:'All destinations',client:'All clients',status:'All statuses'};
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
    el('thead').innerHTML=HEADS().map(function(h){
      var act=h.s&&ST.sortKey===h.s;var ar=h.s?'<span class="ar">'+(act?(ST.dir==='asc'?'▲':'▼'):'⇅')+'</span>':'';
      return '<th class="'+(h.n?'num ':'')+(h.s?'srt':'')+(act?' act':'')+'"'+(h.s?' data-act="sort" data-sk="'+h.s+'" tabindex="0"':'')+(h.tip?' title="'+esc(h.tip)+'"':'')+'>'+h.t+ar+'</th>';
    }).join('');
  }
  function weighChip(c){if(c._pending)return '<span class="sv2-w pend">Pending</span>';var ok=Math.abs(c._vr)<=0.5;return '<span class="sv2-w '+(ok?'ok':'off')+'">'+(c._vr>0?'+':'')+fmtT(c._vr)+' t</span>';}
  function rowHTML(c){
    var i=DATA.indexOf(c);
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
      '<td><span class="sv2-pill '+statusClass(c.hdr.status)+'">'+esc(c.hdr.status||'—')+'</span></td></tr>';
  }
  function cardHTML(c){
    var i=DATA.indexOf(c);
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
    if(!err){b.className='sv2-banner';b.innerHTML='<span aria-hidden="true">✎</span><span><b>Entry sandbox.</b> Changes here are saved to the new shipments table for testing. They don’t change the shipment records or any report. '+snapNote()+'</span>';return;}
    b.className='sv2-banner err';b.setAttribute('role','alert');
    b.innerHTML='<span aria-hidden="true">!</span><span style="flex:1">'+esc(err)+'</span><button type="button" class="sv2-btn sec sm" data-act="reloadList">Retry</button>';
  }
  function loadList(){
    var my=++listSeq;
    paintSkeleton();setListBanner(null);
    var path='citrus-shipments?product='+encodeURIComponent(PRODUCT)+(SEASON?'&season='+encodeURIComponent(SEASON):'');
    return Promise.resolve(sb.functions.invoke(path,{method:'GET'})).then(function(res){
      if(dead||my!==listSeq)return;
      if(res.error){
        var st=res.error.context&&res.error.context.status;
        var msg=st===401?'Your session expired. Reload the page and sign in to DalOS.':st===403?'You don’t have access to '+PRODUCT_NAME.toLowerCase()+' shipments.':'Shipments didn’t load. Check the connection and try again.';
        setListBanner(msg);DATA=[];el('listbody').innerHTML='';el('cards').innerHTML='';el('countnote').textContent='';return;
      }
      var d=res.data||{};DATA=(d.containers||[]).slice();
      deriveAll();rebuildFacetVals();renderList();if(PT)ptFillDatalists();
    },function(){if(dead||my!==listSeq)return;setListBanner('Shipments didn’t load. Check the connection and try again.');el('listbody').innerHTML='';el('cards').innerHTML='';el('countnote').textContent='';});
  }

  /* ---------------------------------------------------------- one delegated handler per event type */
  var searchT=null;
  function onClick(e){
    var t=e.target.closest('[data-act]');if(!t||!host.contains(t))return;
    var a=t.getAttribute('data-act'),i=+t.getAttribute('data-i');
    switch(a){
      case 'openCreate':openCreate();break;
      case 'open':openContainer(i);break;
      case 'leave':leaveForm();break;
      case 'save':submitShip();break;
      case 'delShip':askDelete();break;
      case 'retry':if(EDIT.container)loadForEdit(EDIT.container,EDIT.loaded);break;
      case 'reload':if(EDIT.container){if(DIRTY&&!window.confirm('Reload the latest version? Your changes on this form will be lost.'))break;setDirty(false);loadForEdit(EDIT.container,EDIT.loaded);}break;
      case 'openExisting':if(EXISTING_IDX>=0&&confirmLeave()){var ix=EXISTING_IDX;setDirty(false);clearFormError();openContainer(ix);}break;
      case 'reloadList':loadList();break;
      case 'clearQ':clearTimeout(searchT);el('q').value='';ST.q='';ST.limit=RENDER_STEP;el('searchwrap').classList.remove('has');renderList();el('q').focus();break;
      case 'resetAll':ST.q='';ST.f=emptyF();ST.limit=RENDER_STEP;el('q').value='';el('searchwrap').classList.remove('has');renderList();break;
      case 'showMore':ST.limit+=RENDER_STEP;renderList();break;
      case 'sort':{var sk=t.getAttribute('data-sk');if(ST.sortKey===sk)ST.dir=ST.dir==='asc'?'desc':'asc';else{ST.sortKey=sk;ST.dir=TEXTSORT[sk]?'asc':'desc';}renderList();break;}
      case 'toggleLine':syncLines();openRows[i]=!openRows[i];renderLines();break;
      case 'rmLine':syncLines();PAS_LIVE=true;var d=LINES[i];if(d&&d.id)EDIT.deletedIds.push(d.id);LINES.splice(i,1);
        var no={};Object.keys(openRows).forEach(function(k){k=+k;if(k<i)no[k]=openRows[k];else if(k>i)no[k-1]=openRows[k];});openRows=no;renderLines();setDirty(true);break;
      case 'addLine':syncLines();LINES.push(blankLine());openRows[LINES.length-1]=isNarrow();renderLines();setDirty(true);break;
      case 'dupLast':syncLines();PAS_LIVE=true;var last=LINES[LINES.length-1];var c=last?Object.assign({},last):blankLine();c.id=null;LINES.push(c);renderLines();setDirty(true);break;
    }
  }
  function onKey(e){
    var t=e.target;
    if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('tr[data-act],.sv2-card[data-act],.lh[data-act],th[data-act]')){e.preventDefault();t.click();}
    if(e.key==='Escape'&&t.id==='sv2-q'){el('q').value='';ST.q='';el('searchwrap').classList.remove('has');renderList();}
  }
  function onChange(e){
    var t=e.target,c=t.getAttribute&&t.getAttribute('data-chg');
    if(c==='status')syncCtxStatus();
    else if(c==='client')fillSubclients();
    else if(c==='ldate'){deriveDate();syncDep();}
    else if(c==='depdiff')syncDep();
    else if(c==='facet'){var fk=t.getAttribute('data-fk');if(ST.f[fk]){ST.f[fk]=t.value?[t.value]:[];ST.limit=RENDER_STEP;renderList();}return;}
    else if(!INTAKE&&isCitrus()&&t.getAttribute&&t.getAttribute('data-k')==='pascol_weight'&&String(t.value).trim()){var me=t.closest('[data-line]');
      qa('[data-line] [data-k="pascol_weight"]').forEach(function(f){if(f!==t&&f.closest('[data-line]')!==me&&!String(f.value).trim())f.value=t.value;});recompute();}
    else if(c==='cat'){var line=t.closest('[data-line]');if(line){var i=+line.getAttribute('data-line');syncLines();LINES[i].variety='';renderLines();}}
    if(el('vform').classList.contains('on')&&t.closest('#sv2-vform'))setDirty(true);
  }
  function onInput(e){
    var t=e.target;
    if(t.id==='sv2-q'){ST.q=t.value.trim().toLowerCase();ST.limit=RENDER_STEP;el('searchwrap').classList.toggle('has',!!t.value);clearTimeout(searchT);searchT=setTimeout(renderList,150);return;}
    if(INTAKE&&(t.id==='sv2-tcartons'||t.id==='sv2-hpascol')){PAS_LIVE=true;recompute();}
    var ln=t.closest('[data-line]');
    if(ln){var k=t.getAttribute('data-k'),li=LINES[+ln.getAttribute('data-line')];
      if(PAS_IN[k]||(INTAKE&&INTAKE_IN[k])||(CARTON_SRC[k]&&li&&!li.id))PAS_LIVE=true;recompute();}
    if(el('vform').classList.contains('on')&&t.closest('#sv2-vform'))setDirty(true);
  }
  function onBlur(e){var t=e.target;if(!t.getAttribute)return;
    if(t.getAttribute('data-req'))validateField(t.id.replace('sv2-',''));
    if(t.id==='sv2-container'||t.id==='sv2-ldate')checkExisting();
    var k=t.getAttribute('data-k');
    if(k&&NUMKEYS[k]){var pr=lineNumProblem(k,t.value);t.classList.toggle('invalid',!!pr);t.setAttribute('aria-invalid',pr?'true':'false');t.title=pr?lineLabel(k)+' '+pr:'';}
    else if(k&&t.classList.contains('invalid')&&String(t.value||'').trim()){t.classList.remove('invalid');t.setAttribute('aria-invalid','false');}
    if(k&&WARN_KEYS[k]&&t.closest('[data-line]')){syncLines();paintWarns();}   /* range warn after number validation */
    if(INTAKE&&(t.id==='sv2-tcartons'||t.id==='sv2-hpascol')){var hpr=numProblem(t.value,t.id==='sv2-tcartons'?1:0)||(isNegNum(t.value)?'can\u2019t be negative':null);
      t.classList.toggle('invalid',!!hpr);t.setAttribute('aria-invalid',hpr?'true':'false');t.title=hpr?(t.id==='sv2-tcartons'?'Total cartons ':'Pascol weight ')+hpr:'';}
  }
  host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);
  host.addEventListener('change',onChange);host.addEventListener('input',onInput);host.addEventListener('focusout',onBlur);

  /* the sticky Save bar sits above Vision's phone bottom nav when that nav is showing */
  function placeBar(){var n=document.querySelector('.mobile-nav'),h=0;
    if(n){var cs=getComputedStyle(n);if(cs.display!=='none'&&cs.position==='fixed')h=n.getBoundingClientRect().height;}
    host.style.setProperty('--sv2-bottom',(h+8)+'px');placeFoot();}
  /* r2: --sv2-footh = the Save bar's height (bottom padding + scroll margin at <=768px); re-measured when it changes */
  function placeFoot(){var s=q('.sv2-submit');if(s){var fh=Math.ceil(s.getBoundingClientRect().height);if(fh>0)host.style.setProperty('--sv2-footh',fh+'px');}}
  var footRO=window.ResizeObserver?new ResizeObserver(placeFoot):null;if(footRO&&q('.sv2-submit'))footRO.observe(q('.sv2-submit'));
  placeBar();window.addEventListener('resize',placeBar);
  /* switching phone <-> desktop width re-renders in the other layout without losing input */
  function onMQ(){if(MODE!=='list')syncLines();renderLines();if(DATA.length)renderList();}
  if(phoneMQ){if(phoneMQ.addEventListener)phoneMQ.addEventListener('change',onMQ);else if(phoneMQ.addListener)phoneMQ.addListener(onMQ);}
  if(formMQ){if(formMQ.addEventListener)formMQ.addEventListener('change',onMQ);else if(formMQ.addListener)formMQ.addListener(onMQ);}

  /* ---------------------------------------------------------- boot */
  if(!sb){setListBanner('Not connected. Reload the page and sign in to DalOS.');}
  else{
    loadList();
    loadRefs().then(function(){if(dead)return;fillHeaderSelects({status:''});renderLines();},
      function(){if(dead)return;showFormError('Lists for this form didn’t load (clients, varieties). Reload to try again.');fillHeaderSelects({status:''});});
  }

  var api={
    isDirty:function(){return DIRTY;},
    /* Vision's leave guard: true = OK to leave */
    confirmLeave:confirmLeave,
    unmount:function(){
      dead=true;window.removeEventListener('beforeunload',onBeforeUnload);window.removeEventListener('resize',placeBar);
      if(phoneMQ){if(phoneMQ.removeEventListener)phoneMQ.removeEventListener('change',onMQ);else if(phoneMQ.removeListener)phoneMQ.removeListener(onMQ);}
      if(formMQ){if(formMQ.removeEventListener)formMQ.removeEventListener('change',onMQ);else if(formMQ.removeListener)formMQ.removeListener(onMQ);}
      if(footRO)footRO.disconnect();
      host.removeEventListener('click',onClick);host.removeEventListener('keydown',onKey);
      host.removeEventListener('change',onChange);host.removeEventListener('input',onInput);host.removeEventListener('focusout',onBlur);
      clearTimeout(searchT);clearTimeout(toastT);closeModal();if(toastEl){toastEl.remove();toastEl=null;}
      host.innerHTML='';if(CUR&&CUR.api===api)CUR=null;
    }
  };
  return {api:api,unmount:api.unmount};
}

window.ShipV2={mount:mount,version:'2026-11-16',
  intakeFieldsEnabled:intakeFieldsEnabled,isNegNum:isNegNum,NONNEG_LINE:NONNEG_LINE,INTAKE_WARN:INTAKE_WARN,
  intakeBlank:intakeBlank,intakeMul:intakeMul,intakeLineNetT:intakeLineNetT,intakeLineGrossT:intakeLineGrossT,
  intakeContainerShare:intakeContainerShare,intakePascolActual:intakePascolActual,intakePackingWeight:intakePackingWeight,
  intakeCartonNetWarn:intakeCartonNetWarn,intakeLooksKg:intakeLooksKg,INTAKE_KG_MSG:INTAKE_KG_MSG,intakeCartonGrossWarn:intakeCartonGrossWarn,intakePackingFactorWarn:intakePackingFactorWarn,
  intakeCartonFooter:intakeCartonFooter};
})();
