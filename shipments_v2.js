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

var STATUS_OPTS=['Delivered','Shipped','Returned'];
var SNAPSHOT_NOTE='Copied from the live shipment records on 17 Sep 2026.';

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
'.sv2-f .req{color:var(--red)}',
'.sv2-in{width:100%;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:6px 9px;font:13px var(--font-body);color:var(--text);outline:none;min-width:0}',
'.sv2-in:focus{border-color:var(--accent)}',
'.sv2-in.mono{font-family:var(--font-mono);font-size:12.5px}',
'.sv2-in[readonly]{background:var(--bg2);color:var(--text3);cursor:not-allowed}',
'.sv2-in.invalid{border-color:var(--red);background:var(--red-bg)}',
'.sv2-derived{display:flex;gap:6px;align-items:center;font-size:11.5px;color:var(--text3)}',
'.sv2-derived b{font-family:var(--font-mono);color:var(--text2)}',
'.sv2-ar{font-weight:500;text-transform:none;letter-spacing:0;color:var(--text3);font-family:var(--font-body)}',
'.sv2-lines{border-collapse:collapse;width:100%;min-width:1180px;font-size:12px}',
'.sv2-lines th{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--text3);text-align:left;padding:6px 5px;border-bottom:2px solid var(--border2);font-weight:600;white-space:nowrap}',
'.sv2-lines td{padding:4px 5px;border-bottom:1px solid var(--bg2);vertical-align:middle}',
'.sv2 .cin,.sv2 .csel{width:100%;min-width:62px;background:var(--card);border:1px solid var(--border);border-radius:5px;padding:4px 6px;font:12px var(--font-body);color:var(--text)}',
'.sv2 .cin.mono,.sv2 .cin.num{font-family:var(--font-mono)}.sv2 .cin.num{text-align:right;min-width:58px}',
'.sv2-lines .idx{font-family:var(--font-mono);color:var(--text3)}',
'.sv2-lines tr.sub td,.sv2-lines tr.det td{background:var(--bg);font-size:11.5px}',
'.sv2-lines tr.det{display:none}.sv2-lines tr.det.open{display:table-row}',
'.sv2-lines tfoot td{font-family:var(--font-mono);font-weight:600;text-align:right;background:var(--bg2)}',
'.sv2-dgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px 10px;padding:4px 0}',
'.sv2-dlab{font-size:9.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text3)}',
'.sv2-ib{border:1px solid var(--border);background:var(--card);border-radius:5px;cursor:pointer;color:var(--text3);font-size:13px;line-height:1;padding:3px 7px}',
'.sv2-ib.open{transform:rotate(180deg)}.sv2-ib.rm:hover{color:var(--red);border-color:var(--red-border)}',
'.sv2-lcards{display:none;gap:8px}',
'.sv2-lcard{border:1px solid var(--border);border-radius:var(--r2);background:var(--bg);display:grid}',
'.sv2-lcard .lh{display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer}',
'.sv2-lcard .lb{display:none;padding:2px 11px 11px;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr))}',
'.sv2-lcard.open .lb{display:grid}',
'.sv2-lcard .lb .full{grid-column:1/-1}',
'.sv2-submit{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:10px 14px}',
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
'}'
].join('\n');
function injectCss(){
  if(document.getElementById('sv2-css'))return;
  var s=document.createElement('style');s.id='sv2-css';s.textContent=CSS;document.head.appendChild(s);
}

/* ---------------------------------------------------------------- helpers */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function uniq(a){return a.filter(function(v,i){return v!=null&&v!==''&&a.indexOf(v)===i;});}
function sum(a,k){return a.reduce(function(t,x){return t+(+x[k]||0);},0);}
function statusClass(s){s=String(s||'').toLowerCase();if(s.indexOf('deliver')>=0)return 'green';if(s.indexOf('ship')>=0)return 'blue';if(s.indexOf('return')>=0)return 'amber';return 'neutral';}
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
function newLine(){return {id:null,category:'',variety:'',lot:'',daltex_class:'',client_class:'',carton_type:'',brand:'',packaging_type:'',caliber:'',count_size:'',pack_house:'',source_type:'',raw_source:'',pallet_count:'',carton_count:'',net_weight:'',gross_weight:'',carton_net_weight:'',carton_gross_weight:'',pascol_weight:'',pascol_pct:'',packing_weight:'',pascol_net:'',weight_variance:'',traceability_code:''};}
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
  clients:['Burgess Farms','DANKERS'],countries:['انجلترا','المانيا','ايطاليا','روسيا','الكويت','قطر'],
  ports:['شرق التفريعة','دمياط'],pivots:['التيسير','31','4','70','58','65','57'],farms:['التيسير','الاوقاف']
};
function newLinePT(){return {id:null,variety:'',pivot:'',farm:'',lot:'',size1:'',size2:'',crop_type:'',grade:'',packaging:'',package_weight:'',pack_size:'',pallets:'',brand:'',jumbo_colour:'',jumbo_count:'',sack_colour:'',sack_count:'',standard_weight:'',pascol_weight:'',op_type:'',condition:''};}
var NUMKEYS={pallets:'numeric',jumbo_count:'numeric',sack_count:'numeric',standard_weight:'decimal',package_weight:'decimal',pack_size:'decimal',pallet_count:'numeric',carton_count:'numeric',net_weight:'decimal',gross_weight:'decimal',carton_net_weight:'decimal',carton_gross_weight:'decimal',pascol_weight:'decimal',pascol_pct:'decimal',packing_weight:'decimal',pascol_net:'decimal',weight_variance:'decimal'};

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
  var PT=(PRODUCT==='potatoes');           /* Pivots line: own fields, totals and RPCs; everything else shared */
  function blankLine(){return PT?newLinePT():newLine();}
  function q(sel){return host.querySelector(sel);}
  function qa(sel){return Array.prototype.slice.call(host.querySelectorAll(sel));}
  function el(id){return host.querySelector('#sv2-'+id);}
  function val(id){var e=el(id);return e?String(e.value||'').trim():'';}

  var REF={clients:[],clientIdByName:{},subByClientId:{},cats:[],vars:[],packs:[],cartonTypes:[],ref:{}};
  var LINES=[],openRows={},MODE='list',EDIT={container:null,loaded:null,deletedIds:[]};
  var DATA=[],DIRTY=false,SAVING=false,SEASON_OK=false,listSeq=0,formSeq=0;
  var ST={q:'',sortKey:'loaded',dir:'desc',limit:200,f:{cls:[],region:[],client:[],status:[],qc:[]}};
  var RENDER_STEP=200;
  var phoneMQ=window.matchMedia?window.matchMedia('(max-width:700px)'):null;
  function isPhone(){return !!(phoneMQ&&phoneMQ.matches);}

  /* ---------------------------------------------------------- markup */
  host.innerHTML=
  '<div class="sv2">'+
   '<div class="sv2-view on" id="sv2-vlist">'+
    '<div class="sv2-banner" id="sv2-banner"><span aria-hidden="true">✎</span><span><b>Entry sandbox.</b> Changes here are saved to the new shipments table for testing. They don’t change the shipment records or any report. '+SNAPSHOT_NOTE+'</span></div>'+
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
    '</div>'+
   '</div>'+
  '</div>';

  function orHeaderHTML(){return ''+
     '<div class="sv2-st">Logistics <small id="sv2-lockhint" hidden>· container + date locked while editing</small></div>'+
     '<div class="sv2-grid">'+
      fld('Loading Date','ldate','date',{req:1,chg:'ldate'})+
      '<div class="sv2-f"><label for="sv2-status">Shipping Status</label><select class="sv2-in" id="sv2-status" data-chg="status"></select></div>'+
      fld('Carta','carta','text',{mono:1})+
      fld('Container No.','container','text',{req:1,mono:1,ph:'e.g. MNBU 3751992'})+
      fld('Vessel','vessel')+fld('Shipping Line','line','text',{list:'sv2-dl-line'})+
      fld('Booking No.','booking','text',{mono:1})+fld('Invoice No.','invoice','text',{mono:1})+
      fld('PO Number','po','text',{mono:1})+fld('ETD','etd','date')+fld('ETA','eta','date')+fld('Actual Arrival','arrival','date')+
      fld('Departure Port','depport','text',{list:'sv2-dl-depport'})+
     '</div>'+
     '<div class="sv2-derived">Auto · Month <b id="sv2-dmonth">—</b> · Week <b id="sv2-dweek">—</b></div>'+
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
  function ar(en,arb){return en+' <span class="sv2-ar">· '+arb+'</span>';}
  function sel(label,id){return '<div class="sv2-f"><label for="sv2-'+id+'">'+label+'</label><select class="sv2-in" id="sv2-'+id+'"></select></div>';}
  function ptHeaderHTML(){return ''+
     '<div class="sv2-st">Voyage <small id="sv2-lockhint" hidden>· container + date locked while editing</small></div>'+
     '<div class="sv2-grid">'+
      fld(ar('Loading Date','التاريخ'),'ldate','date',{req:1})+sel(ar('Packing Station','محطه التعبئه'),'station')+
      sel(ar('Sector','القطاع'),'sector')+sel(ar('Crop season','الموسم'),'pseason')+
      fld(ar('Container No.','رقم الحاويه'),'container','text',{req:1,mono:1,ph:'e.g. MNBU 9188741'})+fld(ar('Carta','كارته شحن'),'carta','text',{mono:1})+
      fld(ar('Vessel','اسم المركب'),'vessel')+fld(ar('Container Count','عدد الحاويات'),'ccount','text',{mono:1,inputmode:'numeric'})+
     '</div>'+
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
    return '<div class="sv2-f"><label for="sv2-'+id+'">'+label+(o.req?' <span class="req">*</span>':'')+'</label>'+
      '<input class="sv2-in'+(o.mono?' mono':'')+'" id="sv2-'+id+'" type="'+(type||'text')+'"'+(o.list?' list="'+o.list+'"':'')+
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
    if(PT){fillSelect('station',PT_LISTS.stations,cur.station||'');fillSelect('sector',PT_LISTS.sectors,cur.sector||'');fillSelect('pseason',PT_LISTS.cropSeasons,cur.season||'');return;}
    fillSelect('status',STATUS_OPTS,cur.status||'Delivered');
    fillSelect('client',REF.clients,cur.client||'');
    fillSubclients(cur.subclient||'');
    fillSelect('packdep',REF.packs,cur.pack_house_departure||'');
  }
  function fillSubclients(cur){
    var cid=REF.clientIdByName[val('client')];
    fillSelect('subclient',(cid&&REF.subByClientId[cid])?REF.subByClientId[cid]:[],(typeof cur==='string'?cur:''));
  }

  /* ---------------------------------------------------------- lines (desktop rows / phone cards) */
  function cin(v,k,cls,list){var im=NUMKEYS[k]?' inputmode="'+NUMKEYS[k]+'"':'';
    list=list||(k==='source_type'?'sv2-dl-source':k==='raw_source'?'sv2-dl-rawsource':'');
    return '<input class="cin '+(cls||'')+'" data-k="'+k+'"'+im+' value="'+esc(v)+'"'+(list?' list="'+list+'"':'')+'>';}
  function csel(list,v,k,chg){return '<select class="csel" data-k="'+k+'"'+(chg?' data-chg="'+chg+'"':'')+'>'+opts(list,v)+'</select>';}
  function ncols(){return isCitrus()?18:17;}
  function headHTML(){
    return '<tr><th></th><th>#</th><th>Category</th><th>Variety</th><th>Lot #</th><th>Daltex Class</th><th>Client Class</th><th>Carton Type</th><th>Brand</th><th>Packing</th>'+(isCitrus()?'<th>Caliber</th>':'')+
      '<th class="num">Pallets</th><th class="num">Cartons</th><th class="num">Net t</th><th class="num">Gross t</th><th>Count</th><th>Trace code</th><th></th></tr>';
  }
  function rowHTML_line(d,i){
    return '<tr data-line="'+i+'">'+
      '<td><button type="button" class="sv2-ib'+(openRows[i]?' open':'')+'" data-act="toggleLine" data-i="'+i+'" aria-label="Carton weights'+(isCitrus()?' and weighbridge':'')+'">⌄</button></td>'+
      '<td class="idx">'+(i+1)+'</td>'+
      '<td>'+csel(catNames(),d.category,'category','cat')+'</td>'+
      '<td>'+csel(varsFor(d.category),d.variety,'variety')+'</td>'+
      '<td>'+cin(d.lot,'lot','mono')+'</td><td>'+cin(d.daltex_class,'daltex_class')+'</td><td>'+cin(d.client_class,'client_class')+'</td>'+
      '<td>'+csel(REF.cartonTypes,d.carton_type,'carton_type')+'</td><td>'+cin(d.brand,'brand')+'</td><td>'+cin(d.packaging_type,'packaging_type')+'</td>'+
      (isCitrus()?'<td>'+cin(d.caliber,'caliber','mono')+'</td>':'')+
      '<td>'+cin(d.pallet_count,'pallet_count','num')+'</td><td>'+cin(d.carton_count,'carton_count','num')+'</td>'+
      '<td>'+cin(d.net_weight,'net_weight','num')+'</td><td>'+cin(d.gross_weight,'gross_weight','num')+'</td>'+
      '<td>'+cin(d.count_size,'count_size','mono')+'</td><td>'+cin(d.traceability_code,'traceability_code','mono')+'</td>'+
      '<td><button type="button" class="sv2-ib rm" data-act="rmLine" data-i="'+i+'" aria-label="Remove line '+(i+1)+'">×</button></td>'+
    '</tr>'+
    '<tr class="sub" data-line="'+i+'"><td></td><td colspan="'+(ncols()-1)+'"><div class="sv2-dgrid">'+
      '<div><div class="sv2-dlab">Handling · this line — Pack House (Packing)</div>'+csel(REF.packs,d.pack_house,'pack_house')+'</div>'+
      '<div><div class="sv2-dlab">Source Type</div>'+cin(d.source_type,'source_type')+'</div>'+
      '<div><div class="sv2-dlab">Raw Source</div>'+cin(d.raw_source,'raw_source')+'</div>'+
    '</div></td></tr>'+
    '<tr class="det'+(openRows[i]?' open':'')+'" data-line="'+i+'"><td></td><td colspan="'+(ncols()-1)+'"><div class="sv2-dgrid">'+
      '<div><div class="sv2-dlab">Carton Net (kg)</div>'+cin(d.carton_net_weight,'carton_net_weight','num')+'</div>'+
      '<div><div class="sv2-dlab">Carton Gross (kg)</div>'+cin(d.carton_gross_weight,'carton_gross_weight','num')+'</div>'+
      (isCitrus()?
      '<div><div class="sv2-dlab">Pascol Weight (t)</div>'+cin(d.pascol_weight,'pascol_weight','num')+'</div>'+
      '<div><div class="sv2-dlab">Pascol Actual %</div>'+cin(d.pascol_pct,'pascol_pct','num')+'</div>'+
      '<div><div class="sv2-dlab">Packing Weight (t)</div>'+cin(d.packing_weight,'packing_weight','num')+'</div>'+
      '<div><div class="sv2-dlab">Pascol Net (t)</div>'+cin(d.pascol_net,'pascol_net','num')+'</div>'+
      '<div><div class="sv2-dlab">Weight Variance (t)</div>'+cin(d.weight_variance,'weight_variance','num')+'</div>':'')+
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
        f('Category',csel(catNames(),d.category,'category','cat'))+f('Variety',csel(varsFor(d.category),d.variety,'variety'))+
        f('Pallets',cin(d.pallet_count,'pallet_count','num'))+f('Cartons',cin(d.carton_count,'carton_count','num'))+
        f('Net t',cin(d.net_weight,'net_weight','num'))+f('Gross t',cin(d.gross_weight,'gross_weight','num'))+
        f('Carton type',csel(REF.cartonTypes,d.carton_type,'carton_type'))+f('Brand',cin(d.brand,'brand'))+
        f('Lot #',cin(d.lot,'lot','mono'))+f('Packing',cin(d.packaging_type,'packaging_type'))+
        f('Daltex class',cin(d.daltex_class,'daltex_class'))+f('Client class',cin(d.client_class,'client_class'))+
        (isCitrus()?f('Caliber',cin(d.caliber,'caliber','mono')):'')+f('Count',cin(d.count_size,'count_size','mono'))+
        f('Trace code',cin(d.traceability_code,'traceability_code','mono'),true)+
        f('Pack House (Packing)',csel(REF.packs,d.pack_house,'pack_house'),true)+
        f('Source Type',cin(d.source_type,'source_type'))+f('Raw Source',cin(d.raw_source,'raw_source'))+
        f('Carton net kg',cin(d.carton_net_weight,'carton_net_weight','num'))+f('Carton gross kg',cin(d.carton_gross_weight,'carton_gross_weight','num'))+
        (isCitrus()?f('Pascol t',cin(d.pascol_weight,'pascol_weight','num'))+f('Pascol %',cin(d.pascol_pct,'pascol_pct','num'))+
          f('Packing t',cin(d.packing_weight,'packing_weight','num'))+f('Pascol net t',cin(d.pascol_net,'pascol_net','num'))+
          f('Variance t',cin(d.weight_variance,'weight_variance','num')):'')+
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
      if(isPhone()){el('lhead').innerHTML='';el('lbody').innerHTML='';el('lcards').innerHTML=LINES.map(ptCardHTML).join('');}
      else{el('lcards').innerHTML='';el('lhead').innerHTML=ptHeadHTML();el('lbody').innerHTML=LINES.map(ptRowHTML).join('');}
      recompute();return;
    }
    if(isPhone()){
      el('lhead').innerHTML='';el('lbody').innerHTML='';el('lfoot').innerHTML='';
      el('lcards').innerHTML=LINES.map(cardHTML_line).join('');
    } else {
      el('lcards').innerHTML='';
      el('lhead').innerHTML=headHTML();
      el('lbody').innerHTML=LINES.map(rowHTML_line).join('');
      el('lfoot').innerHTML='<tr><td colspan="'+(isCitrus()?11:10)+'" style="font-family:var(--font-body);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--text3)">Totals</td><td id="sv2-tpal">0</td><td id="sv2-tctn">0</td><td id="sv2-tnet">0.00</td><td id="sv2-tgrs">0.00</td><td colspan="3"></td></tr>';
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
    var pal=0,ctn=0,net=0,grs=0;
    LINES.forEach(function(d){pal+=numOf(d.pallet_count,1);ctn+=numOf(d.carton_count,1);net+=numOf(d.net_weight);grs+=numOf(d.gross_weight);});
    var set=function(id,v){var e=el(id);if(e)e.textContent=v;};
    set('tpal',pal.toLocaleString());set('tctn',ctn.toLocaleString());set('tnet',net.toFixed(2));set('tgrs',grs.toFixed(2));
    set('slines',LINES.length);set('spal',pal.toLocaleString());set('sctn',ctn.toLocaleString());set('snet',net.toFixed(2)+' t');
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
  function syncCtxStatus(){var st=val('status');var p=el('ctxstatus');if(p){p.className='sv2-pill '+statusClass(st);p.textContent=st||'—';}}
  function validateField(id){var e=el(id);if(!e)return true;var ok=!!String(e.value||'').trim();e.classList.toggle('invalid',!ok);return ok;}
  function setVoyageLock(on){['container','ldate'].forEach(function(id){var e=el(id);if(e){e.readOnly=on;}});var h=el('lockhint');if(h)h.hidden=!on;}
  var HDR_IDS=PT?['container','carta','ldate','vessel','ccount','client','country','country2','port','invoice','permit','workorder']:['container','carta','ldate','vessel','line','booking','invoice','po','etd','eta','arrival','depport','country','port','agent','shipper'];
  function blankHeader(){HDR_IDS.forEach(function(id){var e=el(id);if(e){e.value='';e.classList.remove('invalid');}});}
  function readHeader(){
    if(PT)return {container_number:val('container'),carta:val('carta'),loading_date:val('ldate'),station:val('station'),sector:val('sector'),
      season:val('pseason'),container_count:val('ccount'),client:val('client'),receiving_country:val('country'),country2:val('country2'),
      receiving_port:val('port'),vessel:val('vessel'),invoice_no:val('invoice'),permit_no:val('permit'),work_order:val('workorder')};
    return {product_id:PRODUCT,container_number:val('container'),carta:val('carta'),loading_date:val('ldate'),
      shipping_status:val('status'),vessel:val('vessel'),shipping_line:val('line'),booking_no:val('booking'),
      invoice_no:val('invoice'),po_number:val('po'),etd:val('etd'),eta:val('eta'),arrival_date:val('arrival'),
      departure_port:val('depport'),receiving_country:val('country'),receiving_port:val('port'),client:val('client'),
      subclient:val('subclient'),agent:val('agent'),shipper:val('shipper'),pack_house_departure:val('packdep')};
  }
  function setSeasonChip(){var c=el('ctxseason');if(c)c.textContent=MODE==='create'?('Season '+(SEASON_NAME||'—')+' · from the sidebar'):'Season kept from the record';}

  /* ---------------------------------------------------------- feedback */
  var toastEl=null,toastT=null;
  function toast(msg){
    if(!toastEl){toastEl=document.createElement('div');toastEl.className='sv2-toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);}
    toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){if(toastEl)toastEl.classList.remove('on');},2400);
  }
  function showFormError(msg,retry){
    var e=el('ferr');if(!e)return;
    e.innerHTML='<div class="sv2-banner err" role="alert"><span aria-hidden="true">!</span><span style="flex:1">'+esc(msg)+'</span>'+(retry?'<button type="button" class="sv2-btn sec sm" data-act="'+retry+'">'+(retry==='reload'?'Reload':'Retry')+'</button>':'')+'</div>';
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

  /* ---------------------------------------------------------- save */
  function setSaving(on){SAVING=on;qa('[data-act="save"]').forEach(function(b){b.disabled=on;b.textContent=on?'Saving…':'Save shipment';});}
  function submitShip(){
    if(SAVING)return;
    clearFormError();
    var okC=validateField('container'),okL=validateField('ldate');
    if(!okC||!okL){showFormError((!okC?'Container No.':'Loading Date')+' is required.');(el(!okC?'container':'ldate')).focus();return;}
    syncLines();
    if(!LINES.length){showFormError('Add at least one line.');return;}
    var hdr=readHeader();
    if(MODE==='create'){
      if(!SEASON){showFormError('Pick a season in the sidebar before saving.');return;}
      if(O.trueActiveSeasonId&&SEASON!==O.trueActiveSeasonId&&!SEASON_OK){askSeason(submitShip);return;}
      hdr.season_id=SEASON;
    }
    SEASON_OK=false;
    var lines=LINES.map(function(d){var c=Object.assign({},d);Object.keys(NUMKEYS).forEach(function(k){if(c[k]!=null&&c[k]!=='')c[k]=asciiDigits(c[k]);});return c;});
    if(hdr.container_count)hdr.container_count=asciiDigits(hdr.container_count);
    setSaving(true);
    var call=(MODE==='edit')
      ?sb.rpc(PT?'edit_shipment_v2_potato_full':'edit_shipment_v2_full',{p_header:hdr,p_lines:lines,p_deleted_ids:EDIT.deletedIds})
      :sb.rpc(PT?'save_shipment_v2_potato_full':'save_shipment_v2_full',{p_header:hdr,p_lines:lines});
    Promise.resolve(call).then(function(res){
      if(dead)return;
      setSaving(false);
      if(res.error){
        var stale=res.error.code==='40001';
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

  /* ---------------------------------------------------------- edit load */
  function loadForEdit(container,loaded){
    var my=++formSeq;
    clearFormError();blankHeader();LINES=[];openRows={};renderLines();
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
      var setv=function(id,v){var e=el(id);if(e)e.value=(v==null?'':v);};
      if(PT){
        setv('container',h.container_number);setv('carta',h.carta);setv('ldate',h.loading_date);setv('vessel',h.vessel);setv('ccount',h.container_count);
        setv('client',h.client);setv('country',h.receiving_country);setv('country2',h.country2);setv('port',h.receiving_port);
        setv('invoice',h.invoice_no);setv('permit',h.permit_no);setv('workorder',h.work_order);
        fillHeaderSelects({station:h.station,sector:h.sector,season:h.season});
        LINES=lines.map(function(l){var d=newLinePT();Object.keys(d).forEach(function(k){if(l[k]!=null)d[k]=String(l[k]);});d.id=l.id||null;return d;});
        if(!LINES.length)LINES=[newLinePT()];
        openRows={};renderLines();setDirty(false);
        el('ftitle').textContent='Edit shipment';el('ctxref').textContent=h.container_number||container;setSeasonChip();return;
      }
      setv('container',h.container_number);setv('carta',h.carta);setv('ldate',h.loading_date);
      setv('vessel',h.vessel);setv('line',h.shipping_line);setv('booking',h.booking_no);setv('invoice',h.invoice_no);
      setv('po',h.po_number);setv('etd',h.etd);setv('eta',h.eta);setv('arrival',h.arrival_date);
      setv('depport',h.departure_port);setv('country',h.receiving_country);setv('port',h.receiving_port);
      setv('agent',h.agent);setv('shipper',h.shipper);
      fillHeaderSelects({status:h.shipping_status,client:h.client,subclient:h.subclient,pack_house_departure:h.pack_house_departure});
      deriveDate();syncCtxStatus();
      LINES=lines.map(function(l){var d=blankLine();Object.keys(d).forEach(function(k){if(l[k]!=null)d[k]=String(l[k]);});d.id=l.id||null;return d;});
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
    formSeq++;MODE='create';EDIT={container:null,loaded:null,deletedIds:[]};SEASON_OK=false;
    blankHeader();fillHeaderSelects({status:'Delivered'});deriveDate();
    LINES=[blankLine()];openRows={0:isPhone()};renderLines();
    setVoyageLock(false);showOverlay(false);clearFormError();syncCtxStatus();setDirty(false);
    el('ftitle').textContent='New shipment';el('ctxref').textContent='New';setSeasonChip();
    showView('form');var c=el('container');if(c&&!isPhone())c.focus();
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
    if(!err){b.className='sv2-banner';b.innerHTML='<span aria-hidden="true">✎</span><span><b>Entry sandbox.</b> Changes here are saved to the new shipments table for testing. They don’t change the shipment records or any report. '+SNAPSHOT_NOTE+'</span>';return;}
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
      case 'retry':if(EDIT.container)loadForEdit(EDIT.container,EDIT.loaded);break;
      case 'reload':if(EDIT.container){setDirty(false);loadForEdit(EDIT.container,EDIT.loaded);}break;
      case 'reloadList':loadList();break;
      case 'clearQ':clearTimeout(searchT);el('q').value='';ST.q='';ST.limit=RENDER_STEP;el('searchwrap').classList.remove('has');renderList();el('q').focus();break;
      case 'resetAll':ST.q='';ST.f=emptyF();ST.limit=RENDER_STEP;el('q').value='';el('searchwrap').classList.remove('has');renderList();break;
      case 'showMore':ST.limit+=RENDER_STEP;renderList();break;
      case 'sort':{var sk=t.getAttribute('data-sk');if(ST.sortKey===sk)ST.dir=ST.dir==='asc'?'desc':'asc';else{ST.sortKey=sk;ST.dir=TEXTSORT[sk]?'asc':'desc';}renderList();break;}
      case 'toggleLine':syncLines();openRows[i]=!openRows[i];renderLines();break;
      case 'rmLine':syncLines();var d=LINES[i];if(d&&d.id)EDIT.deletedIds.push(d.id);LINES.splice(i,1);
        var no={};Object.keys(openRows).forEach(function(k){k=+k;if(k<i)no[k]=openRows[k];else if(k>i)no[k-1]=openRows[k];});openRows=no;renderLines();setDirty(true);break;
      case 'addLine':syncLines();LINES.push(blankLine());openRows[LINES.length-1]=isPhone();renderLines();setDirty(true);break;
      case 'dupLast':syncLines();var last=LINES[LINES.length-1];var c=last?Object.assign({},last):blankLine();c.id=null;LINES.push(c);renderLines();setDirty(true);break;
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
    else if(c==='ldate')deriveDate();
    else if(c==='facet'){var fk=t.getAttribute('data-fk');if(ST.f[fk]){ST.f[fk]=t.value?[t.value]:[];ST.limit=RENDER_STEP;renderList();}return;}
    else if(c==='cat'){var line=t.closest('[data-line]');if(line){var i=+line.getAttribute('data-line');syncLines();LINES[i].variety='';renderLines();}}
    if(el('vform').classList.contains('on')&&t.closest('#sv2-vform'))setDirty(true);
  }
  function onInput(e){
    var t=e.target;
    if(t.id==='sv2-q'){ST.q=t.value.trim().toLowerCase();ST.limit=RENDER_STEP;el('searchwrap').classList.toggle('has',!!t.value);clearTimeout(searchT);searchT=setTimeout(renderList,150);return;}
    if(t.closest('[data-line]'))recompute();
    if(el('vform').classList.contains('on')&&t.closest('#sv2-vform'))setDirty(true);
  }
  function onBlur(e){var t=e.target;if(t.getAttribute&&t.getAttribute('data-req'))validateField(t.id.replace('sv2-',''));}
  host.addEventListener('click',onClick);host.addEventListener('keydown',onKey);
  host.addEventListener('change',onChange);host.addEventListener('input',onInput);host.addEventListener('focusout',onBlur);

  /* switching phone <-> desktop width re-renders in the other layout without losing input */
  function onMQ(){if(MODE!=='list')syncLines();renderLines();if(DATA.length)renderList();}
  if(phoneMQ){if(phoneMQ.addEventListener)phoneMQ.addEventListener('change',onMQ);else if(phoneMQ.addListener)phoneMQ.addListener(onMQ);}

  /* ---------------------------------------------------------- boot */
  if(!sb){setListBanner('Not connected. Reload the page and sign in to DalOS.');}
  else{
    loadList();
    loadRefs().then(function(){if(dead)return;fillHeaderSelects({status:'Delivered'});renderLines();},
      function(){if(dead)return;showFormError('Lists for this form didn’t load (clients, varieties). Reload to try again.');fillHeaderSelects({status:'Delivered'});});
  }

  var api={
    isDirty:function(){return DIRTY;},
    /* Vision's leave guard: true = OK to leave */
    confirmLeave:confirmLeave,
    unmount:function(){
      dead=true;window.removeEventListener('beforeunload',onBeforeUnload);
      if(phoneMQ){if(phoneMQ.removeEventListener)phoneMQ.removeEventListener('change',onMQ);else if(phoneMQ.removeListener)phoneMQ.removeListener(onMQ);}
      host.removeEventListener('click',onClick);host.removeEventListener('keydown',onKey);
      host.removeEventListener('change',onChange);host.removeEventListener('input',onInput);host.removeEventListener('focusout',onBlur);
      clearTimeout(searchT);clearTimeout(toastT);closeModal();if(toastEl){toastEl.remove();toastEl=null;}
      host.innerHTML='';if(CUR&&CUR.api===api)CUR=null;
    }
  };
  return {api:api,unmount:api.unmount};
}

window.ShipV2={mount:mount,version:'2026-10-12'};
})();
