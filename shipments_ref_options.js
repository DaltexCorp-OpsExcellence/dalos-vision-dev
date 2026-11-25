/* DalOS Vision — Configurations: Other crops lists (draft, Vera 2026-11-23)
 * window.SV2Ref: the 17 Other crops dropdown lists: the 7 code lists (crop, packing station, client, port, farm, transport/vessel,
 * packing type) + the 10 label lists on the shared keys of potato-lists A, options seeded by sv2dd 01 (saved as the Arabic label)
 * kept in public.ref_options (OC DB package oc_01). Every option has a code (fixed, what shipments store), an Arabic label
 * and an English label. Admins add, rename and turn options off/on ONLY through the RPCs ref_option_add / ref_option_update /
 * ref_option_set_active (SECURITY DEFINER, admin-checked on the server); there are no direct table writes. Renaming never
 * changes saved shipments (they store the code). Turned-off options stay on old shipments but are not offered for new ones.
 * Used by shipments_v2.js (Other crops form + Configurations button) and shipments_lists_config.js (the Configurations page).
 * createElement + textContent only (no innerHTML with data). Does nothing until a caller mounts it.
 */
(function(){
'use strict';
var LISTS=[
  ['crop','Crop','المحصول'],
  ['packing_station','Packing station','محطه التعبئه'],
  ['client','Client','العميل'],
  ['port','Shipping port','ميناء الشحن'],
  ['farm','Farm','المزرعه'],
  ['transport','Vessel / transport','اسم المركب'],
  ['packing_type','Packing type','العبوة'],
  ['sector','Sector','القطاع'],['crop_season','Crop season','الموسم'],['pivot','Pivot','البيفوت'],['grade','Grade','التصنيف'],
  ['size','Size 2','الحجم2'],['crop_type','Crop type','محصول'],['brand','Brand','براند'],['bag_colour','Jumbo / sack colour','لون الجامب / الشيكاره'],
  ['operation','Operation','نوع تشغيل'],['condition','Condition','الحاله']
];
var PRODUCT='other_crops';
/* v0.2 (Ash): no writes in this build. Add / rename / turn off only show PENDING (no RPC is called). A later commit turns
   this on, after the OC DB package is applied with Tarek's yes. Not a runtime switch. */
var WRITES=false;
var PENDING='Preview: changes turn on after the database step';   /* v0.2 P3: neutral wording */
/* v0.2: built-in copy of the DB package seed (db/src/oc_lists.py, same codes and labels; generated, ASCII escapes).
   Used read-only when public.ref_options can't be read yet (table missing before the DB step), so the dropdowns still work. */
var SEED=[["crop","CROP_SWEET_POTATO","\u0628\u0637\u0627\u0637\u0627","Sweet potato",0],["crop","CROP_BUTTERNUT","\u0642\u0631\u0639 \u0639\u0633\u0644\u0649","Butternut squash",0],["crop","CROP_ONION","\u0628\u0635\u0644","Onion",0],["crop","CROP_CARROT","\u062c\u0632\u0631","Carrot",0],["crop","CROP_BROCCOLI","\u0628\u0631\u0648\u0643\u0644\u0649","Broccoli",0],["crop","CROP_GARLIC","\u062b\u0648\u0645","Garlic",0],["crop","CROP_RADISH","\u0641\u062c\u0644","Radish",0],["packing_station","STN_MARIAM","\u0645\u0631\u064a\u0645","Mariam",0],["packing_station","STN_KAFR_ELZAYAT","\u0643\u0641\u0631 \u0627\u0644\u0632\u064a\u0627\u062a","Kafr El Zayat",0],["packing_station","STN_TAG","\u062a\u0627\u062c","Tag",0],["packing_station","STN_ELAMAL","\u0627\u0644\u0627\u0645\u0644","El Amal",0],["packing_station","STN_RASHED_COLD","\u062b\u0644\u0627\u062c\u0647 \u0645\u0624\u0633\u0633\u0647 \u0631\u0627\u0634\u062f","Rashed cold store",0],["packing_station","STN_ELSEIF","\u0627\u0644\u0633\u064a\u0641","El Seif",0],["packing_station","STN_RAYA","\u0631\u0627\u064a\u0627","Raya",0],["packing_station","STN_ELTAYSEER","\u0627\u0644\u062a\u064a\u0633\u064a\u0631","El Tayseer",0],["packing_station","STN_ELRAWDA","\u0627\u0644\u0631\u0648\u0636\u0647","El Rawda",0],["packing_station","STN_ELMOSTAQBAL_COLD","\u062b\u0644\u0627\u062c\u0647 \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644","El Mostaqbal cold store",0],["packing_station","STN_ELHOLANDIA","\u0627\u0644\u0647\u0648\u0644\u0627\u0646\u062f\u064a\u0647","El Holandia",0],["packing_station","STN_ELALAMIA","\u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0647","El Alamia",0],["packing_station","STN_ELANWAR","\u0627\u0644\u0627\u0646\u0648\u0627\u0631","El Anwar",0],["client","CLT_DANKERS","Dankers","Dankers",0],["client","CLT_LWM","LWM","LWM",0],["client","CLT_LENTA","LENTA","LENTA",0],["client","CLT_RGS","RGS","RGS",0],["client","CLT_PREMIUM_GLOBAL_FOODS","PREMUM GLOBAL FOODS","Premium Global Foods",0],["client","CLT_VERNY","VERNY","VERNY",0],["client","CLT_TANDAR","TANDAR","TANDAR",0],["client","CLT_TANDER","TANDER","TANDER",0],["client","CLT_CARREFOUR","\u0643\u0627\u0631\u0641\u0648\u0631","Carrefour",0],["client","CLT_CARREFOUR_DUBAI","CARREFOUY DUBAI","Carrefour Dubai",0],["client","CLT_FUTURTASTE","FUTURTASTE","FUTURTASTE",0],["client","CLT_MILES","Miles","Miles",0],["client","CLT_X5","X5","X5",0],["client","CLT_SEVILLANA","Sevillana","Sevillana",0],["client","CLT_METRO","METRO","METRO",0],["client","CLT_ETTEHAD_ELMONTAGEEN","\u0627\u062a\u062d\u0627\u062f \u0627\u0644\u0645\u0646\u062a\u062c\u064a\u0646","Producers Union",0],["client","CLT_SEL","SE&L","SE&L",0],["client","CLT_AL_GAMIL","AL GAMIL","AL GAMIL",0],["client","CLT_TOMATO_KING","TOMATO KING","TOMATO KING",0],["client","CLT_KUWAIT_INDO","kuwait indo","Kuwait Indo",0],["client","CLT_DE_FRUITS","De fruits","De fruits",0],["client","CLT_ROBERT_DEBONO","ROBERT DEBONO","ROBERT DEBONO",0],["client","CLT_MELENDEZ","MELENDEZ","MELENDEZ",0],["client","CLT_LAVKA","LAVKA","LAVKA",0],["client","CLT_EUROTORG","EUROTORG","EUROTORG",0],["client","CLT_AGUILAR","AGUILAR","AGUILAR",0],["client","CLT_LAZARO","LAZARO","LAZARO",0],["port","PORT_ALEXANDRIA","\u0627\u0644\u0625\u0633\u0643\u0646\u062f\u0631\u064a\u0629","Alexandria",0],["port","PORT_EAST_TAFREEA","\u0634\u0631\u0642 \u0627\u0644\u062a\u0641\u0631\u064a\u0639\u0629","East Port Said (Tafreea)",0],["port","PORT_DAMIETTA","\u062f\u0645\u064a\u0627\u0637","Damietta",0],["port","PORT_SAFAGA","\u0633\u0641\u0627\u062c\u0627","Safaga",0],["port","PORT_DEKHEILA","\u0627\u0644\u062f\u062e\u064a\u0644\u0629","Dekheila",0],["port","PORT_SOKHNA","\u0627\u0644\u0639\u064a\u0646 \u0627\u0644\u0633\u062e\u0646\u0647","Ain Sokhna",0],["port","PORT_PORT_SAID","\u0628\u0648\u0631\u0633\u0639\u064a\u062f","Port Said",0],["port","PORT_PORT_SAID_EAST","\u0628\u0648\u0631\u0633\u0639\u064a\u062f \u0634\u0631\u0642","Port Said East",0],["farm","FARM_SUPPLIERS","\u0645\u0648\u0631\u062f\u064a\u0646","Suppliers",0],["farm","FARM_MARIAM","\u0645\u0631\u064a\u0645","Mariam",0],["farm","FARM_SALMA","\u0633\u0644\u0645\u0649","Salma",0],["farm","FARM_HALIMA","\u062d\u0644\u064a\u0645\u0647","Halima",0],["farm","FARM_RAMY_KHATTAB","\u0631\u0627\u0645\u0649 \u062e\u0637\u0627\u0628",null,0],["farm","FARM_AHMED_SHAWKY","\u0627\u062d\u0645\u062f \u0634\u0648\u0642\u0649",null,0],["farm","FARM_HAMDY_ABDELDAYEM","\u062d\u0645\u062f\u0649 \u0639\u0628\u062f \u0627\u0644\u062f\u0627\u064a\u0645",null,0],["farm","FARM_ELOLA_FOOD","\u0627\u0644\u0639\u0644\u0627 \u0644\u0644\u0635\u0646\u0627\u0639\u0627\u062a \u0627\u0644\u063a\u0630\u0627\u0626\u064a\u0629",null,0],["farm","FARM_AHMED_FATHY_ZAGHLOUL","\u0627\u062d\u0645\u062f \u0641\u062a\u062d\u0649 \u0632\u063a\u0644\u0648\u0644",null,0],["farm","FARM_DAKAHLIA_CO","\u0634\u0631\u0643\u0647 \u0627\u0644\u062f\u0642\u0647\u0644\u064a\u0647",null,0],["farm","FARM_ELANWAR","\u0627\u0644\u0627\u0646\u0648\u0627\u0631",null,0],["farm","FARM_ELANWAR_INTL","\u0634\u0631\u0643\u0647 \u0627\u0644\u0627\u0646\u0648\u0627\u0631 \u0627\u0644\u062f\u0648\u0644\u064a\u0647 (\u0645\u0635\u0637\u0641\u0649)",null,0],["farm","FARM_WAHEED_FATTOUH","\u0648\u062d\u064a\u062f \u0641\u062a\u0648\u062d \u0625\u0628\u0631\u0627\u0647\u064a\u0645",null,0],["farm","FARM_WAHEED_KHEIRALLAH","\u0648\u062d\u064a\u062f \u062e\u064a\u0631 \u0627\u0644\u0644\u0647",null,0],["farm","FARM_EMAD_SHAWKY","\u0639\u0645\u0627\u062f \u0634\u0648\u0642\u0649 \u0623\u0646\u0648\u0631",null,0],["farm","FARM_WAEL_MOHAMED_KAMAL","\u0648\u0627\u0626\u0644 \u0645\u062d\u0645\u062f \u0643\u0645\u0627\u0644",null,0],["farm","FARM_MOHAMED_KHATTAB","\u0645\u062d\u0645\u062f \u062e\u0637\u0627\u0628",null,0],["farm","FARM_WAEL_KHEIRALLAH","\u0648\u0627\u0626\u0644 \u062e\u064a\u0631 \u0627\u0644\u0644\u0647",null,0],["farm","FARM_ESLAM_KHATTAB","\u0627\u0633\u0644\u0627\u0645 \u062e\u0637\u0627\u0628",null,0],["farm","FARM_SALAH_ABBASY","\u0635\u0644\u0627\u062d \u0639\u0628\u062f \u0627\u0644\u0639\u0644\u064a\u0645 \u0627\u0644\u0639\u0628\u0627\u0633\u0649",null,0],["farm","FARM_ESLAM_BAHY","\u0627\u0633\u0644\u0627\u0645 \u0645\u062d\u0645\u062f \u0628\u0627\u0647\u0649",null,0],["farm","FARM_SHAWKY_ANWAR","\u0634\u0648\u0642\u0649 \u0623\u0646\u0648\u0631 \u0645\u062d\u0645\u062f",null,0],["farm","FARM_GHAZAL_KORESH","\u063a\u0632\u0627\u0644 \u0645\u062d\u0645\u062f \u0639\u0628\u062f \u0627\u0644\u0641\u062a\u0627\u062d \u0642\u0631\u064a\u0634",null,0],["farm","FARM_MOHAMED_EID","\u0645\u062d\u0645\u062f \u0639\u064a\u062f",null,0],["farm","FARM_MINYA_CO","\u0634\u0631\u0643\u0647 \u0627\u0644\u0645\u0646\u064a\u0627",null,0],["transport","TRN_CONTAINER","\u062d\u0627\u0648\u064a\u0627\u062a","Containers",0],["transport","TRN_REEFER","\u0628\u0631\u0627\u062f","Reefer truck",0],["packing_type","PACK_JUMBO","\u062c\u0627\u0645\u0628","Jumbo bag",1],["packing_type","PACK_CARTON","\u0643\u0631\u062a\u0648\u0646","Carton",0],["packing_type","PACK_BENZ","\u0628\u0646\u0632","Benz (carton bin)",1],["packing_type","PACK_BASKET","\u0628\u0627\u0633\u0643\u062a","Basket",0],["packing_type","PACK_SACK","\u0634\u064a\u0643\u0627\u0631\u0647","Sack",0]];
var CSS=[
'.sv2r{display:grid;gap:12px;font-size:13px;color:var(--text,#222)}',
'.sv2r-note{font-size:12.5px;line-height:1.6;border-radius:10px;padding:9px 12px;background:var(--card,#fff);border:1px solid var(--border,#e2e2dc)}',
'.sv2r-chips{display:flex;flex-wrap:wrap;gap:6px}',
'.sv2r-chip{font:500 13px var(--font-body,inherit);border:1px solid var(--border2,#ccd);background:var(--card,#fff);color:var(--text2,#333);border-radius:20px;padding:6px 12px;cursor:pointer;min-height:36px}',
'.sv2r-chip[aria-pressed="true"]{background:var(--accent,#1c5c3c);border-color:var(--accent,#1c5c3c);color:#fff}',
'.sv2r-card{background:var(--card,#fff);border:1px solid var(--border,#e2e2dc);border-radius:12px;padding:14px;display:grid;gap:10px}',
'.sv2r-card h3{margin:0;font:600 17px var(--font-display,inherit)}',
'.sv2r-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}',
'.sv2r-bar label{display:grid;gap:3px;font-size:11.5px;color:var(--text3,#666)}',
'.sv2r input[type=text],.sv2r input[type=search],.sv2r input[type=number]{background:var(--card,#fff);border:1px solid var(--border2,#ccd);border-radius:8px;padding:7px 10px;font:14px var(--font-body,inherit);color:var(--text,#222);min-height:38px}',
'.sv2r-btn{font:500 13px var(--font-body,inherit);border-radius:8px;padding:8px 14px;border:1px solid var(--accent,#1c5c3c);background:var(--accent,#1c5c3c);color:#fff;cursor:pointer;min-height:38px}',
'.sv2r-btn.sec{background:var(--card,#fff);border-color:var(--border2,#ccd);color:var(--text2,#333)}',
'.sv2r-btn:disabled{opacity:.55;cursor:not-allowed}',
'.sv2r-tw{overflow-x:auto}',
'.sv2r-tbl{border-collapse:collapse;width:100%;min-width:560px}',
'.sv2r-tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3,#777);text-align:left;padding:7px 8px;border-bottom:2px solid var(--border2,#ccd)}',
'.sv2r-tbl td{padding:7px 8px;border-bottom:1px solid var(--bg2,#eee);vertical-align:middle}',
'.sv2r-tbl tr.off td.lab{color:var(--text3,#888);text-decoration:line-through}',
'.sv2r-code{font-family:var(--font-mono,monospace);font-size:12px;color:var(--text2,#444)}',
'.sv2r-msg{font-size:12.5px}.sv2r-msg.err{color:var(--red,#b42318)}.sv2r-msg.ok{color:var(--green,#1c7c3c)}.sv2r-msg.info{color:var(--text2,#555)}',
'.sv2r-tbl input[type=checkbox]{width:24px;height:24px;margin:0;vertical-align:middle;cursor:pointer}',   /* v0.2 P3 (Pixel): 24px */
'.sv2r-offtxt{margin-left:8px;font-size:12px;color:var(--text3,#888)}',   /* v0.2 P3: grey, only on options that are off */
'.sv2r-count{font-size:12px;color:var(--text3,#777)}',
'.sv2r-ovl{position:fixed;inset:0;background:rgba(20,20,20,.38);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 10px;overflow:auto}',
'.sv2r-panel{background:var(--bg,#f6f3ec);border-radius:14px;max-width:880px;width:100%;padding:14px;display:grid;gap:10px;box-shadow:0 10px 40px rgba(0,0,0,.25)}',
'.sv2r-ph{display:flex;align-items:center;gap:8px}.sv2r-ph h2{margin:0;font:600 18px var(--font-display,inherit);flex:1}',
'@media (max-width:700px){.sv2r input[type=text],.sv2r input[type=search]{font-size:16px;min-height:44px}.sv2r-btn,.sv2r-chip{min-height:44px}}'
].join('\n');
function css(){if(document.getElementById('sv2r-css'))return;var s=document.createElement('style');s.id='sv2r-css';s.textContent=CSS;document.head.appendChild(s);}
function mk(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;}
function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
function listLabel(k){for(var i=0;i<LISTS.length;i++)if(LISTS[i][0]===k)return LISTS[i];return [k,k,k];}
/* the server error text is shown when it is one of ours (22023 / 23505 raised by the RPCs); never raw SQL */
function errText(e){
  if(!e)return 'Something went wrong. Try again.';
  if(e.code==='42501')return 'Only an admin can change these lists.';
  if(e.code==='23505')return 'That name is already in this list (matching ignores case, hidden characters and extra spaces).';
  if(e.code==='22023'||e.code==='23514'){var m=String(e.message||'');return m&&m.length<200?m:'That value is not allowed.';}
  if(/Failed to fetch|NetworkError/i.test(String(e.message||'')))return 'No connection. Nothing was saved.';
  return 'Couldn\u2019t save. Try again.';
}
/* read every option of the 7 lists (RLS: users who can read other crops shipments) */
function seedData(){var rows=SEED.map(function(x,i){return {code:x[1],list_key:x[0],label_ar:x[2],label_en:x[3],active:true,is_bulk:!!x[4],sort_order:i+1};});
  var byList={},byCode={};rows.forEach(function(o){(byList[o.list_key]=byList[o.list_key]||[]).push(o);byCode[o.code]=o;});
  return {rows:rows,byList:byList,byCode:byCode,seed:true};}
/* table not there yet (PostgREST PGRST205 / 42P01 / 404) -> the built-in seed; a permission error stays an error */
function isMissing(e){if(!e)return false;var c=String(e.code||''),st=e.status||(e.context&&e.context.status);
  return c==='PGRST205'||c==='42P01'||c==='PGRST202'||st===404||/does not exist|Could not find the table/i.test(String(e.message||''));}
function load(sb){
  return loadDb(sb).catch(function(e){if(isMissing(e))return seedData();throw e;});
}
function loadDb(sb){
  return Promise.resolve(sb.from('ref_options').select('code,list_key,label_ar,label_en,active,is_bulk,sort_order')
      .eq('product_id',PRODUCT).order('sort_order').order('label_ar')).then(function(r){
    if(!r||r.error)throw (r&&r.error)||new Error('read failed');
    var byList={},byCode={};
    (r.data||[]).forEach(function(o){(byList[o.list_key]=byList[o.list_key]||[]).push(o);byCode[o.code]=o;});
    return {rows:r.data||[],byList:byList,byCode:byCode};
  });
}
function mountEditor(root,opts){
  css();opts=opts||{};var sb=opts.sb;
  var st={key:opts.listKey||'crop',q:'',data:null,msg:null,editing:null,busy:false};
  var box=mk('div','sv2r');root.appendChild(box);
  var note=mk('div','sv2r-note');
  note.appendChild(mk('b',null,'Admins add, rename or turn off options. '));
  note.appendChild(document.createTextNode('Each option keeps its code for good; shipments save the code, so renaming or turning off an option never changes saved shipments. A turned-off option stays on old shipments and is not offered for new ones.'));
  box.appendChild(note);
  var chips=mk('div','sv2r-chips');chips.setAttribute('role','group');chips.setAttribute('aria-label','Other crops lists');box.appendChild(chips);
  var card=mk('div','sv2r-card');box.appendChild(card);
  function drawChips(){clear(chips);LISTS.forEach(function(l){var c=mk('button','sv2r-chip',l[2]+' \u00b7 '+l[1]);c.type='button';c.setAttribute('data-list',l[0]);
    c.setAttribute('aria-pressed',st.key===l[0]?'true':'false');c.addEventListener('click',function(){st.key=l[0];st.editing=null;st.msg=null;st.q='';drawChips();draw();});chips.appendChild(c);});}
  function reload(){clear(card);card.appendChild(mk('div','sv2r-count','Loading\u2026'));
    return load(sb).then(function(d){st.data=d;draw();},function(e){clear(card);card.appendChild(mk('div','sv2r-msg err',e&&e.code==='42501'?'You don\u2019t have access to these lists.':'These lists could not load. Close and try again.'));});}
  function done(r,okText){st.busy=false;
    if(r&&r.error){st.msg={err:true,t:errText(r.error)};draw();return;}
    st.msg={err:false,t:okText};st.editing=null;if(opts.onChange)try{opts.onChange();}catch(_e){}reload();}
  function rpc(name,args,okText){if(!WRITES){st.msg={info:true,t:PENDING+'. Nothing was changed.'};draw();return;}
    if(st.busy)return;st.busy=true;st.msg=null;
    Promise.resolve(sb.rpc(name,args)).then(function(r){done(r,okText);},function(e){done({error:e});});}
  function draw(){
    clear(card);var L=listLabel(st.key);
    card.appendChild(mk('h3',null,L[2]+' \u00b7 '+L[1]));
    var rows=((st.data&&st.data.byList[st.key])||[]).slice();
    var q=st.q.trim().toLowerCase();
    var shown=q?rows.filter(function(o){return (o.code+' '+o.label_ar+' '+(o.label_en||'')).toLowerCase().indexOf(q)>=0;}):rows;
    /* add form */
    var bar=mk('div','sv2r-bar');
    var s=mk('input');s.type='search';s.placeholder='Search';s.setAttribute('aria-label','Search this list');s.value=st.q;
    s.addEventListener('input',function(){st.q=s.value;drawTableOnly();});
    bar.appendChild(s);card.appendChild(bar);
    var add=mk('div','sv2r-bar');add.setAttribute('data-form','add');
    function field(lab,inp){var l=mk('label');l.appendChild(document.createTextNode(lab));l.appendChild(inp);return l;}
    var ia=mk('input');ia.type='text';ia.dir='rtl';ia.lang='ar';ia.setAttribute('data-f','label_ar');ia.maxLength=120;
    var ie=mk('input');ie.type='text';ie.dir='ltr';ie.setAttribute('data-f','label_en');ie.maxLength=120;
    var ic=mk('input');ic.type='text';ic.dir='ltr';ic.setAttribute('data-f','code');ic.maxLength=40;ic.placeholder='auto';ic.style.width='130px';
    add.appendChild(field('Arabic name *',ia));add.appendChild(field('English name',ie));add.appendChild(field('Code (optional)',ic));
    var bulk=null;if(st.key==='packing_type'){bulk=mk('input');bulk.type='checkbox';bulk.setAttribute('data-f','is_bulk');var bl=mk('label');bl.style.display='flex';bl.style.alignItems='center';bl.style.gap='6px';bl.appendChild(bulk);bl.appendChild(document.createTextNode('Bulk (bags, bins)'));add.appendChild(bl);}
    var ab=mk('button','sv2r-btn','Add option');ab.type='button';ab.setAttribute('data-act','add');
    ab.addEventListener('click',function(){var a=ia.value.trim();if(!a){st.msg={err:true,t:'Type the Arabic name first.'};drawMsg();ia.focus();return;}
      rpc('ref_option_add',{p_product:PRODUCT,p_list_key:st.key,p_label_ar:a,p_label_en:ie.value.trim()||null,p_code:ic.value.trim()||null,p_is_bulk:bulk?bulk.checked:false,p_sort_order:null},'Added.');});
    add.appendChild(ab);card.appendChild(add);
    var msg=mk('div','sv2r-msg');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');card.appendChild(msg);
    function drawMsg(){msg.className='sv2r-msg'+(st.msg?(st.msg.info?' info':st.msg.err?' err':' ok'):'');msg.textContent=st.msg?st.msg.t:'';}
    drawMsg();
    var tw=mk('div','sv2r-tw');card.appendChild(tw);
    var cnt=mk('div','sv2r-count');card.appendChild(cnt);
    function drawTableOnly(){
      q=st.q.trim().toLowerCase();
      shown=q?rows.filter(function(o){return (o.code+' '+o.label_ar+' '+(o.label_en||'')).toLowerCase().indexOf(q)>=0;}):rows;
      clear(tw);var t=mk('table','sv2r-tbl'),th=mk('thead'),tr=mk('tr');
      ['Code','Arabic','English','Active',''].forEach(function(h){tr.appendChild(mk('th',null,h));});th.appendChild(tr);t.appendChild(th);
      var tb=mk('tbody');
      shown.forEach(function(o){var r=mk('tr',o.active?null:'off');r.setAttribute('data-code',o.code);
        r.appendChild(mk('td','sv2r-code',o.code));
        if(st.editing===o.code){
          var ea=mk('input');ea.type='text';ea.dir='rtl';ea.lang='ar';ea.value=o.label_ar;ea.setAttribute('data-f','label_ar');ea.setAttribute('aria-label','Arabic name');
          var ee=mk('input');ee.type='text';ee.dir='ltr';ee.value=o.label_en||'';ee.setAttribute('data-f','label_en');ee.setAttribute('aria-label','English name');
          var c1=mk('td');c1.appendChild(ea);r.appendChild(c1);var c2=mk('td');c2.appendChild(ee);r.appendChild(c2);
          r.appendChild(mk('td',null,o.active?'On':'Off'));
          var c4=mk('td'),sv=mk('button','sv2r-btn','Save');sv.type='button';sv.setAttribute('data-act','saveRename');
          sv.addEventListener('click',function(){var a=ea.value.trim();if(!a){st.msg={err:true,t:'The Arabic name can\u2019t be empty.'};drawMsg();return;}
            rpc('ref_option_update',{p_code:o.code,p_label_ar:a,p_label_en:ee.value.trim(),p_sort_order:null,p_is_bulk:null},'Renamed. Saved shipments keep the code, so they show the new name.');});
          var cx=mk('button','sv2r-btn sec','Cancel');cx.type='button';cx.addEventListener('click',function(){st.editing=null;drawTableOnly();});
          c4.appendChild(sv);c4.appendChild(document.createTextNode(' '));c4.appendChild(cx);r.appendChild(c4);
        } else {
          var la=mk('td','lab',o.label_ar);la.dir='rtl';la.lang='ar';r.appendChild(la);
          r.appendChild(mk('td','lab',o.label_en||'\u2014'));
          var ac=mk('td'),sw=mk('input');sw.type='checkbox';sw.checked=!!o.active;sw.setAttribute('data-act','toggle');sw.setAttribute('aria-label',(o.active?'Turn off ':'Turn on ')+o.label_ar);
          sw.addEventListener('change',function(){
            /* v0.2 P3 (Pixel): confirm before turning an option off */
            if(!sw.checked&&!window.confirm('Turn off \u201c'+o.label_ar+'\u201d? Saved shipments keep it; new shipments can\u2019t pick it.')){sw.checked=true;return;}
            rpc('ref_option_set_active',{p_code:o.code,p_active:sw.checked},sw.checked?'Turned on.':'Turned off. Old shipments keep it; new ones can\u2019t pick it.');});
          ac.appendChild(sw);if(!o.active)ac.appendChild(mk('span','sv2r-offtxt','Turned off'));r.appendChild(ac);
          var ed=mk('td'),eb=mk('button','sv2r-btn sec','Rename');eb.type='button';eb.setAttribute('data-act','rename');
          eb.addEventListener('click',function(){st.editing=o.code;st.msg=null;drawMsg();drawTableOnly();});ed.appendChild(eb);r.appendChild(ed);
        }
        tb.appendChild(r);});
      t.appendChild(tb);tw.appendChild(t);
      var on=rows.filter(function(o){return o.active;}).length;
      cnt.textContent=rows.length+' option'+(rows.length===1?'':'s')+' \u00b7 '+on+' on'+(q?' \u00b7 '+shown.length+' match':'');
    }
    drawTableOnly();
  }
  drawChips();reload();
  return {reload:reload,detach:function(){clear(root);}};
}
/* stand-alone panel (Other crops Manage toolbar, admins) */
function openPanel(opts){
  css();opts=opts||{};
  var ovl=mk('div','sv2r-ovl'),p=mk('div','sv2r-panel');p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-labelledby','sv2r-title');
  var h=mk('div','sv2r-ph'),t=mk('h2',null,'Configurations \u00b7 Other crops lists');t.id='sv2r-title';
  var x=mk('button','sv2r-btn sec','Close');x.type='button';x.setAttribute('aria-label','Close');
  h.appendChild(t);h.appendChild(x);p.appendChild(h);var body=mk('div');p.appendChild(body);ovl.appendChild(p);document.body.appendChild(ovl);
  var last=document.activeElement;
  function close(){document.removeEventListener('keydown',key,true);if(ovl.parentNode)ovl.parentNode.removeChild(ovl);if(opts.onClose)try{opts.onClose();}catch(_e){}if(last&&last.focus)try{last.focus();}catch(_e){}}
  function key(e){if(e.key==='Escape'){e.preventDefault();close();}}
  x.addEventListener('click',close);ovl.addEventListener('mousedown',function(e){if(e.target===ovl)close();});document.addEventListener('keydown',key,true);
  var ed=mountEditor(body,{sb:opts.sb,listKey:opts.listKey,onChange:opts.onChange});x.focus();
  return {close:close,editor:ed};
}
window.SV2Ref={LISTS:LISTS,PRODUCT:PRODUCT,WRITES:WRITES,PENDING:PENDING,SEED:SEED,load:load,mountEditor:mountEditor,openPanel:openPanel,errText:errText};
})();
