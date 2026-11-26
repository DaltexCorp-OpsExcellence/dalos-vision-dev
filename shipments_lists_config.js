/* DalOS Vision — Shipments "Manage": Configuration list editors (draft, Vera 2026-11-15)
 * Registers the 'lists' screen with window.SV2Lists (admin + power_user only; the toolbar button only shows
 * for them, and every write is enforced server-side by the single is_power_user_or_admin() ALL policy).
 * Layout follows /workspace/dropdown-mockup/dropdowns-config-mockup.html (Configurations tab): grouped list chips,
 * search + product filter + Add value, table Value / Applies to product / Active / Edit, plus Spelling matches.
 * createElement + textContent only. Renaming never changes values already saved on shipments.
 *  v0.2: optional label per value (shown, searchable, editable); rename notes the old spelling is kept as a spelling match; clearer 23505/23514 messages.
 *  2026-11-18: Raw sources tab is a read-only view of Configurations > Farms (the intake Raw source list).
 */
(function(){
'use strict';
if(!window.SV2Lists||typeof window.SV2Lists.registerScreen!=='function')return;

var GROUPS=[
  /* 2026-11-26: Regions (sales) for citrus, staging only (SV2_SALES_REGION_ENABLED); its list key needs DB step B01 */
  {t:'Clients & markets',keys:['client_class'].concat(window.SV2_SALES_REGION_ENABLED===true&&window.VISION_IS_DEV===true?['sales_region']:[])},
  {t:'Packing',keys:['brand','packing_type','count_size','caliber']},
  {t:'Logistics',keys:['source_type','raw_source','departure_port','receiving_port','shipper','agent','shipping_line','shipping_status']},
  {t:'Spelling',keys:['@aliases']},
  {t:'JDE',keys:['@jde']}
];
/* 2026-11-23: Other crops lists (ref_options, codes + Arabic/English labels, RPC writes only) live on this same page; shipments_ref_options.js draws them */
if(window.SV2Ref&&typeof window.SV2Ref.mountEditor==='function')GROUPS.push({t:'Other crops',keys:['@oc']});
var PRODUCTS=[['citrus','Citrus'],['grapes','Grapes'],['mango','Mango'],['pomegranate','Pomegranate']];
var PNAME={citrus:'Citrus',grapes:'Grapes',mango:'Mango',pomegranate:'Pomegranate',potatoes:'Potatoes'};
var CSS=[
'.sv2c{display:grid;gap:12px}',
'.sv2c-note{font-size:12.5px;line-height:1.5;border-radius:10px;padding:9px 12px;background:var(--card,#fff);border:1px solid var(--border,#e2e2dc)}',
'.sv2c-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}',
'.sv2c-gt{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3,#777);margin-bottom:6px}',
'.sv2c-chips{display:flex;flex-wrap:wrap;gap:6px}',
'.sv2c-chip{font:500 12.5px var(--font-body,inherit);border:1px solid var(--border2,#ccd);background:var(--card,#fff);color:var(--text2,#333);border-radius:20px;padding:6px 12px;cursor:pointer;min-height:32px}',
'.sv2c-chip[aria-pressed="true"]{background:var(--accent,#1c5c3c);border-color:var(--accent,#1c5c3c);color:#fff}',
'.sv2c-card{background:var(--card,#fff);border:1px solid var(--border,#e2e2dc);border-radius:12px;padding:14px;display:grid;gap:10px}',
'.sv2c-card h3{margin:0;font:600 17px var(--font-display,inherit)}',
'.sv2c-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
'.sv2c-bar input,.sv2c-bar select,.sv2c-tbl input{background:var(--card,#fff);border:1px solid var(--border2,#ccd);border-radius:8px;padding:7px 10px;font:13px var(--font-body,inherit);color:var(--text,#222);min-height:36px}',
'.sv2c-bar input[type=search]{flex:1 1 220px}',
'.sv2c-tw{overflow-x:auto}',
'.sv2c-tbl{border-collapse:collapse;width:100%;min-width:560px}',
'.sv2c-tbl th{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text3,#777);text-align:left;padding:7px 8px;border-bottom:2px solid var(--border2,#ccd)}',
'.sv2c-tbl td{padding:7px 8px;border-bottom:1px solid var(--bg2,#eee);vertical-align:middle}',
'.sv2c-tbl tr.off td.v{color:var(--text3,#888);text-decoration:line-through}',
'.sv2c-nocode{font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;background:#fdf1dc;color:#7a4a10;border:1px solid #f0d49c;display:inline-block}',
'.sv2c-tbl tr.miss td{background:#fffaf0}',
'.sv2c-pill{font-size:11px;padding:1px 8px;border-radius:20px;background:#efeafd;color:#5b3cc4;border:1px solid #d8cdfa;display:inline-block}',
'.sv2c-link{background:none;border:none;color:var(--accent,#1c5c3c);text-decoration:underline;cursor:pointer;font:500 12.5px var(--font-body,inherit);min-height:32px;padding:0 4px}',
'.sv2c-sw{display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-height:32px}',
'.sv2c-msg{font-size:12.5px}.sv2c-msg.err{color:var(--red,#b42318)}.sv2c-msg.ok{color:var(--green,#1c7c3c)}.sv2c-msg.warn{color:#7a4a10;background:#fdf1dc;border:1px solid #f0d49c;border-radius:8px;padding:7px 10px}',
'.sv2c-count{font-size:12px;color:var(--text3,#777)}',
'.sv2c-lbl{font-size:12px;color:#6b7280}'
].join('\n');
var cssDone=false;
function css(){if(cssDone)return;cssDone=true;var st=document.createElement('style');st.id='sv2c-css';st.textContent=CSS;document.head.appendChild(st);}
function errText(e){
  if(!e)return 'Something went wrong. Try again.';
  if(e.code==='42501')return 'Only admins and power users can change lists.';
  if(e.code==='23505')return 'That value is already in this list for this product (matching ignores case, accents and extra spaces).';
  if(e.code==='23514'){var m=String(e.message||'');
    if(m.indexOf('Spelling match rejected:')===0||m.indexOf('Rename conflicts')===0)return m;
    return 'Value must be 1–120 characters with single spaces, no leading/trailing spaces, and no control or hidden formatting characters.';}
  return 'Couldn’t save. Try again.';
}

function mount(body,ctx){
  css();
  var mk=ctx.mk,clear=ctx.clear,sb=ctx.sb,L=ctx.labels,dirty=false;
  /* 2026-11-26 shipment_list_editors_v1: scoped editors see only their products, no JDE / Other crops / all-products matches */
  var R=ctx.rights||{},MP=R.full?null:(R.manage_products||[]);
  function prodOk(p){return !MP||MP.indexOf(p)>=0;}
  var st={key:(ctx.args.listKey&&ctx.queueKeys[ctx.args.listKey])?ctx.args.listKey:'brand',prod:(MP&&!prodOk(ctx.product))?(MP[0]||''):(ctx.product||''),q:'',rows:[],aliases:[],editing:null,msg:null};
  var root=mk('div','sv2c');body.appendChild(root);
  var note=mk('div','sv2c-note');
  note.appendChild(mk('b',null,MP?('You can add, rename or turn off values for '+MP.map(function(p){return PNAME[p]||p;}).join(', ')+'. JDE codes stay with admins; a rename carries its JDE code over. '):'Admins and power users add, rename or turn off values. '));
  note.appendChild(document.createTextNode('Intake editors pick values only. Renaming or turning off a value never changes shipments that already have it saved.'));
  root.appendChild(note);
  var groups=mk('div','sv2c-groups');root.appendChild(groups);
  var card=mk('div','sv2c-card');root.appendChild(card);

  function drawGroups(){
    clear(groups);
    GROUPS.filter(function(g){return !(g.keys[0]==='@jde'&&!R.can_manage_jde)&&!(g.keys[0]==='@oc'&&!R.full);}).forEach(function(g){
      var box=mk('div');box.appendChild(mk('div','sv2c-gt',g.t));var chips=mk('div','sv2c-chips');
      g.keys.forEach(function(k){
        var c=mk('button','sv2c-chip',k==='@aliases'?'Spelling matches':k==='@jde'?'JDE codes (citrus)':k==='@oc'?'Other crops lists':(L[k]||k));c.type='button';
        c.setAttribute('aria-pressed',st.key===k?'true':'false');
        c.addEventListener('click',function(){st.key=k;st.editing=null;st.msg=null;st.q='';drawGroups();load();});
        chips.appendChild(c);
      });
      box.appendChild(chips);groups.appendChild(box);
    });
  }
  function productSelect(val,withAll,label){
    var s=mk('select');s.setAttribute('aria-label',label||'Product');
    if(withAll&&!MP){var o=mk('option',null,'All products');o.value='';s.appendChild(o);}
    PRODUCTS.forEach(function(p){if(!prodOk(p[0]))return;var o=mk('option',null,p[1]);o.value=p[0];s.appendChild(o);});
    if(MP&&val&&!prodOk(val)){var x=mk('option',null,PNAME[val]||val);x.value=val;s.appendChild(x);}   /* read-only row of another product */
    s.value=val||'';return s;
  }
  function load(){
    clear(card);card.appendChild(mk('div','sv2c-count','Loading…'));
    if(st.key==='raw_source'){loadFarms();return;}
    if(st.key==='@jde'){loadJde();return;}
    if(st.key==='@oc'){clear(card);window.SV2Ref.mountEditor(card,{sb:sb});return;}
    var p=st.key==='@aliases'
      ?sb.from('shipment_list_aliases').select('id,list_key,product_id,alias,canonical,note,active').order('list_key').order('alias')
      :sb.from('shipment_list_values').select('id,list_key,product_id,value,label,sort_order,active').eq('list_key',st.key).order('product_id').order('sort_order').order('value');
    Promise.resolve(p).then(function(r){
      if(r.error)throw r.error;
      if(st.key==='@aliases')st.aliases=r.data||[];else st.rows=r.data||[];draw();
    }).catch(function(e){clear(card);card.appendChild(mk('div','sv2c-msg err',e&&e.code==='42501'?'You don’t have access to this list.':'This list could not load. Close and try again.'));});
  }
  function loadFarms(){
    Promise.resolve(sb.from('farms').select('name,source_type,raw_names,active').eq('active',true).order('name')).then(function(r){
      if(r.error)throw r.error;
      drawFarms((r.data||[]).filter(function(f){return !(f.raw_names||[]).some(function(x){return x==='OUTSOURCE_BUDGET';});}));
    }).catch(function(){clear(card);card.appendChild(mk('div','sv2c-msg err','The farms list could not load. Close and try again.'));});
  }
  function drawFarms(rows){
    clear(card);
    card.appendChild(mk('h3',null,'Raw sources = Farms'));
    card.appendChild(mk('div','sv2c-count','The intake Raw source list is the farms in Configurations \u2192 Farms (Vision Settings), for every product. Add, rename or turn off a farm there and the dropdown follows. Spellings listed for a farm are matched to its name.'));
    var bar=mk('div','sv2c-bar'),q=mk('input');q.type='search';q.placeholder='Search farms or spellings…';q.setAttribute('aria-label','Search farms');q.value=st.q;
    bar.appendChild(q);card.appendChild(bar);var tw=mk('div','sv2c-tw');card.appendChild(tw);
    function tbl(){
      clear(tw);var t=mk('table','sv2c-tbl'),th=mk('thead'),tr=mk('tr');
      ['Farm','Type','Spellings matched'].forEach(function(h){tr.appendChild(mk('th',null,h));});th.appendChild(tr);t.appendChild(th);
      var tb=mk('tbody'),ql=st.q.trim().toLowerCase(),n=0;t.appendChild(tb);
      rows.forEach(function(f){
        var sp=(f.raw_names||[]).filter(function(x){return x&&x.toLowerCase()!==String(f.name).toLowerCase();});
        if(ql&&(f.name+' '+sp.join(' ')).toLowerCase().indexOf(ql)<0)return;n++;
        var row=mk('tr'),a=mk('td','v'),bd=mk('bdi',null,f.name);bd.setAttribute('dir','auto');a.appendChild(bd);row.appendChild(a);
        var b=mk('td');b.appendChild(mk('span','sv2c-pill',f.source_type||'\u2013'));row.appendChild(b);
        row.appendChild(mk('td','sv2c-lbl',sp.length?sp.join(', '):'\u2013'));tb.appendChild(row);
      });
      if(!n){var er=mk('tr'),ed=mk('td','sv2c-count','No farms match.');ed.colSpan=3;er.appendChild(ed);tb.appendChild(er);}
      tw.appendChild(t);
    }
    q.addEventListener('input',function(){st.q=q.value;tbl();});tbl();
  }
  /* JDE codes (citrus): the 7 lookup tables of the sheet's 'JD.E. Code Mapping' tab (public.jde_codes).
     Admins and power users add a code, change one or turn one off; the intake form builds each line's code from them. */
  var JDE_PART_LABEL={category:'Category',variety:'Variety',client_class:'Client class',caliber:'Caliber',packaging_type:'Packing',brand:'Brand',net:'Net / --'};
  var JDE_LEN={category:4,variety:3,client_class:1,caliber:2,packaging_type:1,brand:2,net:1};
  /* dropdown lists that feed a JDE part: a value with no active code here is listed as 'No code yet' */
  var JDE_LIST={brand:'brand',caliber:'caliber',client_class:'client_class',packaging_type:'packing_type'};
  function jfold(v){return String(v||'').replace(/\s/g,'').toLowerCase();}
  function jdeMissing(part){
    var lk=JDE_LIST[part];if(!lk)return [];
    var have={};(st.jrows||[]).forEach(function(r){if(r.part===part&&r.active)have[jfold(r.value)]=1;});
    var seen={};return (st.jlist||[]).filter(function(v){var k=jfold(v.value);if(v.list_key!==lk||have[k]||seen[k])return false;seen[k]=1;return true;}).map(function(v){return v.value;});
  }
  st.jpart=st.jpart||'caliber';
  function loadJde(){
    Promise.all([
      Promise.resolve(sb.from('jde_codes').select('id,part,value,code,note,active,sort_order').eq('product_id','citrus').order('part').order('sort_order').order('value')),
      Promise.resolve(sb.from('shipment_list_values').select('list_key,value').eq('product_id','citrus').eq('active',true).in('list_key',['brand','caliber','client_class','packing_type']).order('value'))
    ]).then(function(rs){
      var r=rs[0];if(r.error)throw r.error;st.jrows=r.data||[];st.jlist=(rs[1]&&!rs[1].error&&rs[1].data)||[];drawJde();
    }).catch(function(e){clear(card);card.appendChild(mk('div','sv2c-msg err',e&&e.code==='42P01'?'JDE codes are not set up yet.':'The JDE codes could not load. Close and try again.'));});
  }
  function drawJde(){
    clear(card);
    card.appendChild(mk('h3',null,'JDE codes · Citrus'));
    card.appendChild(mk('div','sv2c-count','Same tables as the sheet’s JD.E. Code Mapping tab. A line’s JDE code = Category + Variety + Client class + Caliber + Packing + Brand + Net/--. Changing a code here changes new and edited lines only; codes already saved stay.'));
    var bar=mk('div','sv2c-bar'),ps=mk('select');ps.setAttribute('aria-label','Part');
    var totMiss=0;
    Object.keys(JDE_PART_LABEL).forEach(function(k){var nm=jdeMissing(k).length;totMiss+=nm;var o=mk('option',null,JDE_PART_LABEL[k]+(nm?' \u2014 '+nm+' without a code':''));o.value=k;ps.appendChild(o);});ps.value=st.jpart;
    ps.addEventListener('change',function(){st.jpart=ps.value;st.editing=null;st.msg=null;drawJde();});
    var q=mk('input');q.type='search';q.placeholder='Search values or codes…';q.setAttribute('aria-label','Search JDE codes');q.value=st.q;
    var add=mk('button','sv2-btn sm','+ Add code');add.type='button';add.addEventListener('click',function(){st.editing={id:null};tbl();});
    bar.appendChild(ps);bar.appendChild(q);bar.appendChild(add);card.appendChild(bar);
    if(totMiss){var mw=mk('div','sv2c-msg warn',totMiss+(totMiss===1?' value in the intake lists has':' values in the intake lists have')+' no JDE code yet. Citrus lines using '+(totMiss===1?'it':'them')+' show \u201cJDE code incomplete\u201d. Look for \u201cNo code yet\u201d below (the Part list shows where).');mw.setAttribute('role','note');card.appendChild(mw);}
    var msg=mk('div','sv2c-msg');msg.setAttribute('role','status');card.appendChild(msg);
    var tw=mk('div','sv2c-tw');card.appendChild(tw);
    function form(r){
      var row=mk('tr'),a=mk('td'),vi=mk('input');vi.maxLength=120;vi.value=r?r.value:((st.editing&&st.editing.value)||'');vi.setAttribute('aria-label','Value');a.appendChild(vi);row.appendChild(a);
      var b=mk('td'),ci=mk('input');ci.maxLength=JDE_LEN[st.jpart];ci.value=r?r.code:'';ci.placeholder=JDE_LEN[st.jpart]+' characters';ci.setAttribute('aria-label','JDE code');ci.style.fontFamily='var(--font-mono,monospace)';b.appendChild(ci);row.appendChild(b);
      row.appendChild(mk('td',null,r?(r.active?'Active':'Off'):'Active'));
      var e=mk('td'),ok=mk('button','sv2-btn sm',r?'Save':'Add');ok.type='button';var cx=mk('button','sv2c-link','Cancel');cx.type='button';
      ok.addEventListener('click',function(){var v=vi.value.trim(),c=ci.value.trim().toUpperCase();
        if(!v||c.length!==JDE_LEN[st.jpart]||!/^[A-Z0-9]+$/.test(c)){st.msg={ok:false,text:'Enter a value and a '+JDE_LEN[st.jpart]+'-character code (letters and digits).'};tbl();return;}
        var call=r?sb.from('jde_codes').update({value:v,code:c}).eq('id',r.id).select('id'):sb.from('jde_codes').insert({product_id:'citrus',part:st.jpart,value:v,code:c}).select('id');
        Promise.resolve(call).then(function(res){
          if(res&&!res.error&&(!res.data||!res.data.length))res={error:{code:'42501'}};
          if(res.error){st.msg={ok:false,text:res.error.code==='23505'?'That value already has a code in this part.':res.error.code==='42501'?'Only admins and power users can change JDE codes.':'Couldn’t save. Try again.'};tbl();return;}
          st.editing=null;st.msg={ok:true,text:r?'Saved.':'Added.'};dirty=true;loadJde();
        },function(){st.msg={ok:false,text:'Couldn’t save. Try again.'};tbl();});});
      cx.addEventListener('click',function(){st.editing=null;tbl();});
      e.appendChild(ok);e.appendChild(cx);row.appendChild(e);setTimeout(function(){(r||vi.value?ci:vi).focus();},0);return row;
    }
    function tbl(){
      clear(tw);msg.className='sv2c-msg'+(st.msg?(st.msg.ok?' ok':' err'):'');msg.textContent=st.msg?st.msg.text:'';
      var t=mk('table','sv2c-tbl'),th=mk('thead'),tr=mk('tr');['Value','JDE code','Active','Edit'].forEach(function(h){tr.appendChild(mk('th',null,h));});th.appendChild(tr);t.appendChild(th);
      var tb=mk('tbody'),ql=st.q.trim().toLowerCase(),n=0;t.appendChild(tb);
      if(st.editing&&!st.editing.id)tb.appendChild(form(null));
      jdeMissing(st.jpart).forEach(function(v){
        if(ql&&v.toLowerCase().indexOf(ql)<0)return;if(st.editing&&!st.editing.id&&jfold(st.editing.value)===jfold(v))return;n++;
        var row=mk('tr','miss'),a=mk('td','v');a.appendChild(mk('bdi',null,v));a.appendChild(mk('div','sv2c-lbl','In the intake '+JDE_PART_LABEL[st.jpart]+' list'));row.appendChild(a);
        var b=mk('td');b.appendChild(mk('span','sv2c-nocode','No code yet'));row.appendChild(b);
        row.appendChild(mk('td','sv2c-lbl','\u2013'));
        var et=mk('td'),ab=mk('button','sv2-btn sm','Add code');ab.type='button';ab.addEventListener('click',function(){st.editing={id:null,value:v};st.msg=null;tbl();});et.appendChild(ab);row.appendChild(et);
        tb.appendChild(row);
      });
      (st.jrows||[]).forEach(function(r){
        if(r.part!==st.jpart)return;
        if(ql&&(r.value+' '+r.code).toLowerCase().indexOf(ql)<0)return;n++;
        if(st.editing&&st.editing.id===r.id){tb.appendChild(form(r));return;}
        var row=mk('tr',r.active?'':'off'),a=mk('td','v');a.appendChild(mk('bdi',null,r.value));if(r.note)a.appendChild(mk('div','sv2c-lbl',r.note));row.appendChild(a);
        var b=mk('td');b.appendChild(mk('span',null,r.code));b.style.fontFamily='var(--font-mono,monospace)';row.appendChild(b);
        var at=mk('td'),lab=mk('label','sv2c-sw'),cb=mk('input');cb.type='checkbox';cb.checked=!!r.active;cb.setAttribute('aria-label',(r.active?'Turn off ':'Turn on ')+r.value);
        cb.addEventListener('change',function(){Promise.resolve(sb.from('jde_codes').update({active:cb.checked}).eq('id',r.id).select('id')).then(function(res){
          if(res&&!res.error&&(!res.data||!res.data.length))res={error:{code:'42501'}};
          st.msg=res.error?{ok:false,text:'Only admins and power users can change JDE codes.'}:{ok:true,text:'Saved.'};if(!res.error)dirty=true;loadJde();});});
        lab.appendChild(cb);lab.appendChild(mk('span',null,r.active?'Active':'Off'));at.appendChild(lab);row.appendChild(at);
        var et=mk('td'),eb=mk('button','sv2c-link','Edit');eb.type='button';eb.addEventListener('click',function(){st.editing={id:r.id};st.msg=null;tbl();});et.appendChild(eb);row.appendChild(et);
        tb.appendChild(row);
      });
      if(!n&&!(st.editing&&!st.editing.id)){var er=mk('tr'),ed=mk('td','sv2c-count','No codes match.');ed.colSpan=4;er.appendChild(ed);tb.appendChild(er);}
      tw.appendChild(t);
    }
    q.addEventListener('input',function(){st.q=q.value;tbl();});tbl();
  }
  function draw(){
    clear(card);
    var isA=st.key==='@aliases';
    card.appendChild(mk('h3',null,isA?'Spelling matches':(L[st.key]||st.key)));
    card.appendChild(mk('div','sv2c-count',isA?'Sheet spelling → DalOS name. Used to suggest the DalOS name in the intake form and by the one-time cleanup.':'Used in: New intake → '+(L[st.key]||st.key)+' (product-filtered, active values only)'));
    var bar=mk('div','sv2c-bar');
    var q=mk('input');q.type='search';q.placeholder='Search values…';q.setAttribute('aria-label','Search values');q.value=st.q;
    q.addEventListener('input',function(){st.q=q.value;drawTable();});
    var ps=productSelect(st.prod,true,'Filter by product');ps.addEventListener('change',function(){st.prod=ps.value;drawTable();});
    bar.appendChild(q);bar.appendChild(ps);
    var add=mk('button','sv2-btn sm',isA?'+ Add spelling match':'+ Add value');add.type='button';
    add.addEventListener('click',function(){st.editing={id:null};drawTable();});
    bar.appendChild(add);card.appendChild(bar);
    var msg=mk('div','sv2c-msg');msg.setAttribute('role','status');card.appendChild(msg);
    var tw=mk('div','sv2c-tw');card.appendChild(tw);
    function drawTable(){
      clear(tw);msg.className='sv2c-msg'+(st.msg?(st.msg.ok?' ok':' err'):'');msg.textContent=st.msg?st.msg.text:'';
      var t=mk('table','sv2c-tbl'),th=mk('thead'),tr=mk('tr');
      (isA?['List','Sheet spelling','DalOS name','Product','Active','Edit']:['Value','Applies to product','Active','Edit']).forEach(function(h){tr.appendChild(mk('th',null,h));});
      th.appendChild(tr);t.appendChild(th);var tb=mk('tbody');t.appendChild(tb);
      if(st.editing&&!st.editing.id)tb.appendChild(isA?aliasForm(null):valueForm(null));
      var ql=st.q.trim().toLowerCase(),n=0;
      (isA?st.aliases:st.rows).forEach(function(r){
        if(st.prod&&r.product_id&&r.product_id!==st.prod)return;
        if(st.prod&&isA&&!r.product_id){/* all-product alias: keep */}
        var hay=(isA?(r.alias+' '+r.canonical+' '+r.list_key):(r.value+' '+(r.label||''))).toLowerCase();
        if(ql&&hay.indexOf(ql)<0)return;n++;
        if(st.editing&&st.editing.id===r.id){tb.appendChild(isA?aliasForm(r):valueForm(r));return;}
        var row=mk('tr',r.active?'':'off');
        if(isA){row.appendChild(mk('td',null,L[r.list_key]||r.list_key));var a=mk('td','v');a.appendChild(mk('bdi',null,r.alias));row.appendChild(a);
          var c=mk('td');c.appendChild(mk('bdi',null,r.canonical));row.appendChild(c);}
        else{var v=mk('td','v');var bd=mk('bdi',null,r.value);bd.setAttribute('dir','auto');v.appendChild(bd);
          if(r.label){var lb=mk('div','sv2c-lbl');var lbd=mk('bdi',null,r.label);lbd.setAttribute('dir','auto');lb.appendChild(lbd);v.appendChild(lb);}
          row.appendChild(v);}
        var pt=mk('td');pt.appendChild(mk('span','sv2c-pill',r.product_id?(PNAME[r.product_id]||r.product_id):'All products'));row.appendChild(pt);
        /* scoped editor: another product's row or an all-products match is shown read-only (the DB refuses the write anyway) */
        if(MP&&!(r.product_id&&prodOk(r.product_id))){row.appendChild(mk('td',null,r.active?'Active':'Off'));row.appendChild(mk('td','sv2c-count','Admins'));tb.appendChild(row);return;}
        var at=mk('td'),lab=mk('label','sv2c-sw'),cb=mk('input');cb.type='checkbox';cb.checked=!!r.active;
        cb.setAttribute('aria-label',(r.active?'Turn off ':'Turn on ')+(isA?r.alias:r.value));
        cb.addEventListener('change',function(){save(isA?'shipment_list_aliases':'shipment_list_values',r.id,{active:cb.checked});});
        lab.appendChild(cb);lab.appendChild(mk('span',null,r.active?'Active':'Off'));at.appendChild(lab);row.appendChild(at);
        var et=mk('td'),eb=mk('button','sv2c-link',isA?'Edit':'Rename');eb.type='button';
        eb.addEventListener('click',function(){st.editing={id:r.id};st.msg=null;drawTable();});et.appendChild(eb);row.appendChild(et);
        tb.appendChild(row);
      });
      if(!n&&!(st.editing&&!st.editing.id)){var er=mk('tr'),ed=mk('td','sv2c-count','No values match.');ed.colSpan=isA?6:4;er.appendChild(ed);tb.appendChild(er);}
      tw.appendChild(t);
    }
    function valueForm(r){
      var row=mk('tr'),td1=mk('td'),inp=mk('input');inp.maxLength=120;inp.value=r?r.value:'';inp.setAttribute('aria-label','Value');inp.setAttribute('dir','auto');
      var lin=mk('input');lin.maxLength=120;lin.value=r&&r.label?r.label:'';lin.placeholder='Label (optional)';lin.setAttribute('aria-label','Label');lin.setAttribute('dir','auto');
      var w1=mk('div'),w2=mk('div');w2.style.marginTop='4px';w1.appendChild(inp);w2.appendChild(lin);
      td1.appendChild(w1);td1.appendChild(w2);row.appendChild(td1);
      var td2=mk('td');var ps2=productSelect(r?r.product_id:(st.prod||(prodOk(ctx.product)?ctx.product:'')||(MP?MP[0]:'')||'citrus'),false,'Product');if(r)ps2.disabled=true;td2.appendChild(ps2);row.appendChild(td2);
      row.appendChild(mk('td',null,r?(r.active?'Active':'Off'):'Active'));
      var td4=mk('td'),ok=mk('button','sv2-btn sm',r?'Save':'Add');ok.type='button';var cx=mk('button','sv2c-link','Cancel');cx.type='button';
      ok.addEventListener('click',function(){var v=inp.value.trim();if(!v){st.msg={ok:false,text:'Enter a value.'};drawTable();return;}
        var lt=lin.value.trim()||null;
        if(r)save('shipment_list_values',r.id,{value:v,label:lt},v!==r.value?'Renamed. The old spelling “'+r.value+'” is kept as a spelling match automatically. Shipments keep their saved values.':null);
        else insert('shipment_list_values',{list_key:st.key,product_id:ps2.value,value:v,label:lt});});
      cx.addEventListener('click',function(){st.editing=null;drawTable();});
      td4.appendChild(ok);td4.appendChild(cx);row.appendChild(td4);setTimeout(function(){inp.focus();},0);return row;
    }
    function aliasForm(r){
      var row=mk('tr');
      var td0=mk('td'),ks=mk('select');ks.setAttribute('aria-label','List');
      Object.keys(L).forEach(function(k){var o=mk('option',null,L[k]);o.value=k;ks.appendChild(o);});ks.value=r?r.list_key:'receiving_country';if(r)ks.disabled=true;
      td0.appendChild(ks);row.appendChild(td0);
      var td1=mk('td'),a=mk('input');a.maxLength=120;a.value=r?r.alias:'';a.setAttribute('aria-label','Sheet spelling');td1.appendChild(a);row.appendChild(td1);
      var td2=mk('td'),c=mk('input');c.maxLength=120;c.value=r?r.canonical:'';c.setAttribute('aria-label','DalOS name');td2.appendChild(c);row.appendChild(td2);
      var td3=mk('td'),ps3=productSelect(r?(r.product_id||''):(MP?(st.prod||MP[0]||''):''),true,'Product');if(r)ps3.disabled=true;td3.appendChild(ps3);row.appendChild(td3);
      row.appendChild(mk('td',null,r?(r.active?'Active':'Off'):'Active'));
      var td5=mk('td'),ok=mk('button','sv2-btn sm',r?'Save':'Add');ok.type='button';var cx=mk('button','sv2c-link','Cancel');cx.type='button';
      ok.addEventListener('click',function(){var av=a.value.trim(),cv=c.value.trim();
        if(!av||!cv||av===cv){st.msg={ok:false,text:'Enter a sheet spelling and a different DalOS name.'};drawTable();return;}
        if(r)save('shipment_list_aliases',r.id,{alias:av,canonical:cv});
        else insert('shipment_list_aliases',{list_key:ks.value,product_id:ps3.value||null,alias:av,canonical:cv});});
      cx.addEventListener('click',function(){st.editing=null;drawTable();});
      td5.appendChild(ok);td5.appendChild(cx);row.appendChild(td5);setTimeout(function(){a.focus();},0);return row;
    }
    function after(r,okText){
      if(r&&r.error){st.msg={ok:false,text:errText(r.error)};drawTable();return;}
      st.editing=null;st.msg={ok:true,text:okText};dirty=true;load();
    }
    function save(table,id,patch,okText){Promise.resolve(sb.from(table).update(patch).eq('id',id).select('id')).then(function(r){
      if(r&&!r.error&&(!r.data||!r.data.length))r={error:{code:'42501'}};   /* RLS filtered the update: no rights */
      after(r,okText||'Saved.');},function(e){after({error:e});});}
    function insert(table,row){Promise.resolve(sb.from(table).insert(row).select('id')).then(function(r){after(r,'Added.');},function(e){after({error:e});});}
    drawTable();
  }
  drawGroups();load();
  return {destroy:function(){if(dirty&&ctx.refresh)ctx.refresh();}};
}

window.SV2Lists.registerScreen('lists',{title:'Configurations · Shipment lists',mount:mount});
})();
