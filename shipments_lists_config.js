/* DalOS Vision — Shipments "Manage": Configuration list editors (draft, Vera 2026-11-15)
 * Registers the 'lists' screen with window.SV2Lists (admin + power_user only; the toolbar button only shows
 * for them, and every write is enforced server-side by the single is_power_user_or_admin() ALL policy).
 * Layout follows /workspace/dropdown-mockup/dropdowns-config-mockup.html (Configurations tab): grouped list chips,
 * search + product filter + Add value, table Value / Applies to product / Active / Edit, plus Spelling matches.
 * createElement + textContent only. Renaming never changes values already saved on shipments.
 *  v0.2: optional label per value (shown, searchable, editable); rename notes the old spelling is kept as a spelling match; clearer 23505/23514 messages.
 */
(function(){
'use strict';
if(!window.SV2Lists||typeof window.SV2Lists.registerScreen!=='function')return;

var GROUPS=[
  {t:'Clients & markets',keys:['client_class']},
  {t:'Packing',keys:['brand','packing_type','count_size','caliber']},
  {t:'Logistics',keys:['source_type','raw_source','departure_port','agent','shipping_line','shipping_status']},
  {t:'Spelling',keys:['@aliases']}
];
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
'.sv2c-pill{font-size:11px;padding:1px 8px;border-radius:20px;background:#efeafd;color:#5b3cc4;border:1px solid #d8cdfa;display:inline-block}',
'.sv2c-link{background:none;border:none;color:var(--accent,#1c5c3c);text-decoration:underline;cursor:pointer;font:500 12.5px var(--font-body,inherit);min-height:32px;padding:0 4px}',
'.sv2c-sw{display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-height:32px}',
'.sv2c-msg{font-size:12.5px}.sv2c-msg.err{color:var(--red,#b42318)}.sv2c-msg.ok{color:var(--green,#1c7c3c)}',
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
  var st={key:(ctx.args.listKey&&ctx.queueKeys[ctx.args.listKey])?ctx.args.listKey:'brand',prod:ctx.product||'',q:'',rows:[],aliases:[],editing:null,msg:null};
  var root=mk('div','sv2c');body.appendChild(root);
  var note=mk('div','sv2c-note');
  note.appendChild(mk('b',null,'Admins and power users add, rename or turn off values. '));
  note.appendChild(document.createTextNode('Intake editors pick values only. Renaming or turning off a value never changes shipments that already have it saved.'));
  root.appendChild(note);
  var groups=mk('div','sv2c-groups');root.appendChild(groups);
  var card=mk('div','sv2c-card');root.appendChild(card);

  function drawGroups(){
    clear(groups);
    GROUPS.forEach(function(g){
      var box=mk('div');box.appendChild(mk('div','sv2c-gt',g.t));var chips=mk('div','sv2c-chips');
      g.keys.forEach(function(k){
        var c=mk('button','sv2c-chip',k==='@aliases'?'Spelling matches':(L[k]||k));c.type='button';
        c.setAttribute('aria-pressed',st.key===k?'true':'false');
        c.addEventListener('click',function(){st.key=k;st.editing=null;st.msg=null;st.q='';drawGroups();load();});
        chips.appendChild(c);
      });
      box.appendChild(chips);groups.appendChild(box);
    });
  }
  function productSelect(val,withAll,label){
    var s=mk('select');s.setAttribute('aria-label',label||'Product');
    if(withAll){var o=mk('option',null,'All products');o.value='';s.appendChild(o);}
    PRODUCTS.forEach(function(p){var o=mk('option',null,p[1]);o.value=p[0];s.appendChild(o);});
    s.value=val||'';return s;
  }
  function load(){
    clear(card);card.appendChild(mk('div','sv2c-count','Loading…'));
    var p=st.key==='@aliases'
      ?sb.from('shipment_list_aliases').select('id,list_key,product_id,alias,canonical,note,active').order('list_key').order('alias')
      :sb.from('shipment_list_values').select('id,list_key,product_id,value,label,sort_order,active').eq('list_key',st.key).order('product_id').order('sort_order').order('value');
    Promise.resolve(p).then(function(r){
      if(r.error)throw r.error;
      if(st.key==='@aliases')st.aliases=r.data||[];else st.rows=r.data||[];draw();
    }).catch(function(e){clear(card);card.appendChild(mk('div','sv2c-msg err',e&&e.code==='42501'?'You don’t have access to this list.':'This list could not load. Close and try again.'));});
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
      var td2=mk('td');var ps2=productSelect(r?r.product_id:(st.prod||ctx.product||'citrus'),false,'Product');if(r)ps2.disabled=true;td2.appendChild(ps2);row.appendChild(td2);
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
      var td3=mk('td'),ps3=productSelect(r?(r.product_id||''):'',true,'Product');if(r)ps3.disabled=true;td3.appendChild(ps3);row.appendChild(td3);
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
