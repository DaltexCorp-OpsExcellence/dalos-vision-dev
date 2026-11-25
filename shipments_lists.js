/* DalOS Vision — Shipments "Manage": managed dropdown lists (draft, Vera 2026-11-15)
 * ----------------------------------------------------------------------------
 * window.SV2Lists. Attached by shipments_v2.js after the form's lists load (non-potato products only).
 *
 *  - FEATURE FLAG: does nothing unless window.SV2_LISTS_ENABLED === true (index.html config, default false),
 *    or, on the staging copy only (VISION_IS_DEV), this browser opted in with localStorage dalos_sv2_lists = '1'.
 *  - FAIL CLOSED: if the list tables / RPCs are missing or any read fails, attach() returns an inert handle and the
 *    form keeps today's behaviour (text + datalist). Nothing throws into shipments_v2.js.
 *  - Reads shipment_list_values (this product, active only), shipment_list_aliases, countries, classes.
 *    "Not in list?" calls submit_shipment_list_suggestion (queue only, never the list table); the typed value
 *    stays in the field and is saved on the shipment by the existing save RPCs.
 *  - DOM is built with createElement + textContent only. No innerHTML with data anywhere in this file.
 *  - Extra screens (Configuration list editors, review queue) register via SV2Lists.registerScreen().
 *  v0.2: labels (value stored, label shown), product-specific spelling matches win over all-products ones, 54000/22023 messages.
 *  2026-11-18: Raw source = Configurations > Farms (active farms, all products); each farm's raw_names are its spelling matches.
 *    No 'Not in list?' for Raw source: new farms are added in Configurations > Farms only.
 */
(function(){
'use strict';

var LIST_LABELS={brand:'Brands',packing_type:'Packing types',count_size:'Counts/Sizes',caliber:'Calibers',source_type:'Source types',
  raw_source:'Raw sources',departure_port:'Departure ports',agent:'Agents',shipping_line:'Shipping lines',client_class:'Client classes',
  shipping_status:'Shipping statuses',receiving_country:'Countries',daltex_class:'Daltex classes',
  receiving_port:'Receiving ports',shipper:'Shippers',sales_region:'Regions (sales)',
  /* Potatoes + Other crops (ref_options, shared keys of potato-lists A; 'brand' above is shared): queue labels only */
  sector:'Sectors',crop_season:'Crop seasons',pivot:'Pivots',grade:'Grades',size:'Sizes (Size 2)',crop_type:'Crop types',
  bag_colour:'Jumbo / sack colours',operation:'Operations',condition:'Conditions'};
var FARM_KEYS={raw_source:1};   /* list comes from public.farms, not shipment_list_values */
var QUEUE_KEYS={brand:1,packing_type:1,count_size:1,caliber:1,source_type:1,raw_source:1,departure_port:1,agent:1,shipping_line:1,client_class:1,shipping_status:1,receiving_port:1,shipper:1};
/* intake field -> list. hdr = header input id (without sv2-), k = line data-k */
var FIELDS=[
  {hdr:'line',key:'shipping_line'},{hdr:'depport',key:'departure_port'},{hdr:'agent',key:'agent'},{hdr:'country',key:'receiving_country'},
  {hdr:'port',key:'receiving_port'},{hdr:'shipper',key:'shipper'},{hdr:'sregion',key:'sales_region'},   /* 2026-11-26: citrus, staging flag */
  {k:'brand',key:'brand'},{k:'packaging_type',key:'packing_type'},{k:'count_size',key:'count_size'},{k:'caliber',key:'caliber'},
  {k:'source_type',key:'source_type'},{k:'raw_source',key:'raw_source'},{k:'client_class',key:'client_class'},{k:'daltex_class',key:'daltex_class'}
];
var MAXLEN=120,SCREENS={},cssDone=false;

function enabled(){
  try{
    if(window.SV2_LISTS_ENABLED===true)return true;
    return window.VISION_IS_DEV===true&&window.localStorage&&window.localStorage.getItem('dalos_sv2_lists')==='1';
  }catch(_e){return false;}
}
function norm(s){return String(s==null?'':s).trim();}
function low(s){return norm(s).toLowerCase();}
function mk(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;}
function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}

var CSS=[
'.sv2l-pop{position:fixed;z-index:2147482000;background:#fff;border:1px solid var(--border2,#ccd);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);display:none;flex-direction:column;max-height:320px;min-width:220px;font:13px var(--font-body,inherit);color:var(--text,#222)}',
'.sv2l-pop.on{display:flex}',
'.sv2l-opts{overflow:auto;padding:4px 0;flex:1 1 auto;min-height:0}',
'.sv2l-opt{padding:7px 12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.sv2l-opt[aria-selected="true"],.sv2l-opt:hover{background:var(--green-bg,#e9f3ec)}',
'.sv2l-empty{padding:8px 12px;color:var(--text3,#777)}',
'.sv2l-foot{border-top:1px solid var(--bg2,#eee);padding:6px 8px;display:grid;gap:4px;flex:0 0 auto}',
'.sv2l-act{font:500 12.5px var(--font-body,inherit);text-align:left;background:none;border:none;color:var(--accent,#1c5c3c);cursor:pointer;padding:5px 4px;border-radius:6px;min-height:32px}',
'.sv2l-act:hover,.sv2l-act:focus-visible{background:var(--bg2,#f2f2f2);outline:none}',
'.sv2l-hint{font-size:11.5px;color:var(--text3,#777);padding:0 4px;line-height:1.4}',
'.sv2l-msg{font-size:12px;padding:2px 4px}.sv2l-msg.ok{color:var(--green,#1c7c3c)}.sv2l-msg.err{color:var(--red,#b42318)}',
'.sv2l-tb{display:inline-flex;flex-wrap:wrap;gap:6px;max-width:100%}',
'.sv2l-scr{position:fixed;inset:0;z-index:2147481000;background:rgba(10,20,15,.35);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}',
'.sv2l-panel{background:#f7f7f4;color:var(--text,#222);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);width:min(1100px,100%);max-height:92vh;display:flex;flex-direction:column;font:13px var(--font-body,inherit)}',
'.sv2l-ph{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,#e2e2dc)}',
'.sv2l-ph h2{font:600 18px var(--font-display,inherit);margin:0;flex:1}',
'.sv2l-pb{padding:14px 18px;overflow:auto;display:grid;gap:12px}',
'.sv2l-offm{display:inline-block;margin-top:3px;font-size:11px;line-height:1.3;color:var(--amber,#9a6700);background:var(--amber-bg,#fff4d6);border-radius:4px;padding:1px 6px}',
'.sv2l-cnt{font-weight:400;text-transform:none;letter-spacing:0;color:var(--text3,#777);font-size:11px;margin-left:4px;white-space:nowrap}',
'.sv2l-x{border:1px solid var(--border2,#ccd);background:var(--card,#fff);border-radius:8px;min-width:36px;min-height:36px;cursor:pointer;font-size:15px}',
'@media (max-width:700px){.sv2l-scr{padding:0}.sv2l-panel{border-radius:0;max-height:100vh;min-height:100vh}}'
].join('\n');
var CHEVRON="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23667' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
function chevronCss(){
  return FIELDS.map(function(f){
    var sel=f.hdr?'#sv2-'+f.hdr:'input.cin[data-k="'+f.k+'"]';
    return '.sv2l-on:not(.sv2l-no-'+f.key+') '+sel+'{background-image:'+CHEVRON+';background-repeat:no-repeat;background-position:right 8px center;background-size:12px 12px;padding-right:26px}';
  }).join('\n');
}
function injectCss(){if(cssDone)return;cssDone=true;var st=document.createElement('style');st.id='sv2l-css';st.textContent=CSS+'\n'+chevronCss();document.head.appendChild(st);}

/* ---------------------------------------------------------------- data */
/* 2026-11-25: a read that hangs counts as failed after LIST_TIMEOUT_MS (the browser's own ERR_TIMED_OUT can take a minute) */
var LIST_TIMEOUT_MS=15000;
function withTimeout(p,ms){return new Promise(function(res,rej){var t=setTimeout(function(){rej(new Error('timeout'));},ms);
  Promise.resolve(p).then(function(v){clearTimeout(t);res(v);},function(e){clearTimeout(t);rej(e);});});}
function loadAll(sb,product){
  function q(p){return withTimeout(p,LIST_TIMEOUT_MS).then(function(r){if(!r||r.error)throw (r&&r.error)||new Error('read failed');return r.data;});}
  /* 2026-11-25: only the list values are required. Any other read that fails counts as empty (no rights, no spelling
     matches, no countries / classes / farms) instead of switching every list off. */
  function soft(p){try{return q(p).then(function(d){return d;},function(){return null;});}catch(_e){return Promise.resolve(null);}}
  return Promise.all([
    soft(sb.rpc('get_shipment_list_rights')),
    q(sb.from('shipment_list_values').select('list_key,value,label,sort_order').eq('product_id',product).eq('active',true).order('sort_order').order('value')),
    soft(sb.from('shipment_list_aliases').select('list_key,product_id,alias,canonical').eq('active',true)),
    soft(sb.from('countries').select('name').eq('active',true).order('name')),
    soft(sb.from('classes').select('name').eq('active',true).order('name')),
    soft(sb.from('farms').select('name,raw_names').eq('active',true).order('name'))
  ]).then(function(r){
    var rights=r[0]||{},lists={},aliases={},labels={};
    (r[1]||[]).forEach(function(x){(lists[x.list_key]=lists[x.list_key]||[]).push(x.value);
      var lb=norm(x.label);if(lb)(labels[x.list_key]=labels[x.list_key]||{})[x.value]=lb;});
    lists.receiving_country=(r[3]||[]).map(function(x){return x.name;});
    var seen={};lists.daltex_class=(r[4]||[]).map(function(x){return x.name;}).filter(function(n){var k=low(n);if(seen[k])return false;seen[k]=1;return true;});
    /* two passes: all-products matches first, then this product's matches overwrite them (product-specific wins) */
    function addAlias(a){(aliases[a.list_key]=aliases[a.list_key]||{})[low(a.alias)]=a.canonical;}
    (r[2]||[]).forEach(function(a){if(!a.product_id)addAlias(a);});
    (r[2]||[]).forEach(function(a){if(a.product_id&&a.product_id===product)addAlias(a);});
    /* Raw source = active farms (same list as Configurations > Farms); the planner placeholder farm is left out */
    var farms=(r[5]||[]).filter(function(f){return !(f.raw_names||[]).some(function(x){return x==='OUTSOURCE_BUDGET';});}),fseen={},fal={};
    lists.raw_source=farms.map(function(f){return norm(f.name);}).filter(function(n){var k=low(n);if(!n||fseen[k])return false;fseen[k]=1;return true;})
      .sort(function(a,b){return a.localeCompare(b);});
    farms.forEach(function(f){(f.raw_names||[]).forEach(function(x){var k=low(x);if(!k||fseen[k]||fal[k])return;fal[k]=norm(f.name);});});
    aliases.raw_source=fal;   /* farm spellings replace any raw_source rows in shipment_list_aliases */
    return {rights:{can_suggest:rights.can_suggest===true,can_manage:rights.can_manage===true},lists:lists,aliases:aliases,labels:labels};
  });
}

/* ---------------------------------------------------------------- attach */
function inert(){return {active:false,detach:function(){},reload:function(){return Promise.resolve();}};}

function attach(host,opts){
  opts=opts||{};
  if(!enabled()||!host||!opts.sb||!opts.product||opts.product==='potatoes')return inert();
  injectCss();
  var sb=opts.sb,product=opts.product,dead=false,D=null,pop=null,cur=null,active=-1,shown=[],tbBtns=[];

  function fieldFor(t){
    if(!t||t.tagName!=='INPUT')return null;
    for(var i=0;i<FIELDS.length;i++){var f=FIELDS[i];
      if(f.hdr&&t.id==='sv2-'+f.hdr)return f;
      if(f.k&&t.getAttribute('data-k')===f.k&&t.classList.contains('cin'))return f;}
    return null;
  }
  function listOf(key){return (D&&D.lists[key])||[];}
  function aliasOf(key,v){var m=D&&D.aliases[key];return m?m[low(v)]||null:null;}
  function labelOf(key,v){var m=D&&D.labels&&D.labels[key];return m&&Object.prototype.hasOwnProperty.call(m,v)?m[v]:null;}

  function buildPop(){
    pop=mk('div','sv2l-pop');pop.setAttribute('role','listbox');pop.id='sv2l-pop';
    pop.appendChild(mk('div','sv2l-opts'));pop.appendChild(mk('div','sv2l-foot'));
    pop.addEventListener('mousedown',function(e){e.preventDefault();});   /* keep focus in the field */
    host.appendChild(pop);
  }
  function place(){
    if(!pop||!cur)return;if(!document.body.contains(cur.input)){close();return;}var r=cur.input.getBoundingClientRect(),vh=window.innerHeight||800,lim=vh;
    /* 2026-11-25 P3a (Pixel): the list stops above the sticky Save bar (or opens upward when there is no room below it) */
    var bar=host.querySelector('.sv2-submit'),bb=bar&&bar.getClientRects().length?bar.getBoundingClientRect():null;if(bb&&bb.top>r.bottom&&bb.top<vh)lim=bb.top;
    var below=lim-r.bottom-8,above=r.top-8;
    pop.style.left=Math.max(4,Math.min(r.left,(window.innerWidth||1000)-Math.max(r.width,240)-4))+'px';
    pop.style.width=Math.max(r.width,240)+'px';
    var up=below<200&&above>below,h=Math.max(Math.min(100,up?above:below),Math.min(320,up?above:below));
    pop.style.maxHeight=h+'px';
    if(up){pop.style.top='';pop.style.bottom=(vh-r.top+4)+'px';}else{pop.style.bottom='';pop.style.top=(r.bottom+4)+'px';}
  }
  function close(){
    if(pop)pop.classList.remove('on');
    if(cur){cur.input.setAttribute('aria-expanded','false');cur.input.removeAttribute('aria-activedescendant');}
    cur=null;active=-1;shown=[];
  }
  function setValue(v){
    if(!cur)return;var inp=cur.input;inp.value=v;
    inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function render(){
    if(!cur)return;
    var key=cur.f.key,typed=norm(cur.input.value),t=low(typed),all=listOf(key),opts=pop.firstChild,foot=pop.lastChild;
    clear(opts);clear(foot);
    shown=all.filter(function(v){var lb=labelOf(key,v);return !t||low(v).indexOf(t)>=0||(lb!=null&&low(lb).indexOf(t)>=0);}).slice(0,200);
    shown.forEach(function(v,i){
      var o=mk('div','sv2l-opt',labelOf(key,v)||v);o.id='sv2l-o'+i;o.setAttribute('role','option');o.setAttribute('dir','auto');
      o.setAttribute('aria-selected',i===active?'true':'false');
      o.addEventListener('click',function(){setValue(v);close();});
      opts.appendChild(o);
    });
    if(!shown.length)opts.appendChild(mk('div','sv2l-empty',all.length?'No match in the list':'No list for this product yet'));
    var exact=all.some(function(v){return low(v)===t;}),canon=typed?aliasOf(key,typed):null;
    if(canon&&low(canon)!==t){
      var a=mk('button','sv2l-act');a.type='button';
      a.appendChild(document.createTextNode('Use “'));a.appendChild(mk('bdi',null,canon));a.appendChild(document.createTextNode('” — DalOS name for “'));
      a.appendChild(mk('bdi',null,typed));a.appendChild(document.createTextNode('”'));
      a.addEventListener('click',function(){setValue(canon);close();});foot.appendChild(a);
    }
    if(typed&&!exact&&QUEUE_KEYS[key]&&!FARM_KEYS[key]&&D.rights.can_suggest){
      var b=mk('button','sv2l-act');b.type='button';
      if(typed.length>MAXLEN){b.disabled=true;b.textContent='Too long for the list (max '+MAXLEN+' characters)';}
      else{b.appendChild(document.createTextNode('＋ Not in list? Keep “'));b.appendChild(mk('bdi',null,typed));b.appendChild(document.createTextNode('” and send for review'));
        b.addEventListener('click',function(){suggest(key,typed);});}
      foot.appendChild(b);
      foot.appendChild(mk('div','sv2l-hint','Typed values stay on this shipment and wait for an admin to review. They are never added to the shared list automatically.'));
    }else if(typed&&!exact&&FARM_KEYS[key]&&!(canon&&low(canon)!==t)){   /* a spelling match was offered: no 'not a farm' line */
      foot.appendChild(mk('div','sv2l-hint','Not a farm yet. The typed value is kept on this shipment as entered. Admins add farms in Configurations \u2192 Farms.'));
    }else if(typed&&!exact&&!QUEUE_KEYS[key]){
      foot.appendChild(mk('div','sv2l-hint','Not in the list. The typed value is kept on this shipment as entered.'));
    }
    if(D.rights.can_manage&&SCREENS.lists&&QUEUE_KEYS[key]){
      var l=mk('button','sv2l-act','Manage this list → Configurations · '+(LIST_LABELS[key]||key));l.type='button';
      l.addEventListener('click',function(){var k=key;close();openScreen('lists',{listKey:k});});foot.appendChild(l);
    }
    if(cur.msg){var m=mk('div','sv2l-msg '+(cur.msg.ok?'ok':'err'),cur.msg.text);m.setAttribute('role','status');foot.appendChild(m);}
    if(!foot.firstChild)foot.style.display='none';else foot.style.display='';
    pop.classList.add('on');cur.input.setAttribute('aria-expanded','true');
    if(active>=0&&shown[active])cur.input.setAttribute('aria-activedescendant','sv2l-o'+active);else cur.input.removeAttribute('aria-activedescendant');
    place();
  }
  function errText(code){
    if(code==='42501')return 'You can’t send list suggestions. The value is still kept on this shipment.';
    if(code==='54000')return 'Too many suggestions are waiting for review. Ask an admin to review the queue. The value is still kept on this shipment.';
    if(code==='22023')return 'This value can’t be sent: it is empty or has hidden formatting characters. Retype it. The value is still kept on this shipment.';
    return 'Couldn’t send for review. The value is still kept on this shipment.';
  }
  function suggest(key,typed){
    var c=cur;if(!c)return;c.msg={ok:true,text:'Sending for review…'};render();
    var cn=typeof opts.container==='function'?norm(opts.container()):'';
    Promise.resolve(sb.rpc('submit_shipment_list_suggestion',{p_product_id:product,p_list_key:key,p_value:typed,p_container_number:cn||null})).then(function(r){
      if(dead)return;
      var msg=r&&!r.error&&r.data&&r.data.status==='in_list'?{ok:true,text:'Already in the list.'}
        :r&&!r.error?{ok:true,text:'Sent for review. The value is saved on this shipment when you save.'}
        :{ok:false,text:errText(r&&r.error&&r.error.code)};
      if(cur===c){c.msg=msg;render();}
    },function(){if(!dead&&cur===c){c.msg={ok:false,text:'Couldn’t send for review. The value is still kept on this shipment.'};render();}});
  }
  function open(input,f){
    if(cur&&cur.input===input)return;
    if(!listOf(f.key).length&&!(D.aliases[f.key]))return;   /* e.g. Mango/Pomegranate agents: stay free text */
    cur={input:input,f:f,msg:null};active=-1;
    if(input.hasAttribute('list')){input.setAttribute('data-sv2l-list',input.getAttribute('list'));input.removeAttribute('list');}
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls','sv2l-pop');
    input.setAttribute('autocomplete','off');
    render();
  }
  function onFocusIn(e){if(!D)return;var f=fieldFor(e.target);if(f)open(e.target,f);else if(cur&&e.target!==cur.input&&!pop.contains(e.target))close();}
  function onClickOpen(e){if(!D||dead)return;var f=fieldFor(e.target);if(f&&(!cur||cur.input!==e.target))open(e.target,f);}   /* after Escape, a tap opens it again */
  function onFocusOut(e){if(cur&&e.target===cur.input){setTimeout(function(){if(cur&&document.activeElement!==cur.input)close();},0);}}
  function onInput(e){if(cur&&e.target===cur.input){cur.msg=null;active=-1;render();}else if(D&&!cur){var f=fieldFor(e.target);if(f&&document.activeElement===e.target)open(e.target,f);}}
  function onKey(e){
    if(!cur||e.target!==cur.input)return;
    if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(shown.length-1,active+1);render();scrollAct();}
    else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(-1,active-1);render();scrollAct();}
    else if(e.key==='Enter'&&active>=0&&shown[active]){e.preventDefault();setValue(shown[active]);close();}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
    else if(e.key==='Tab'){close();}
  }
  function scrollAct(){var o=pop&&pop.querySelector('#sv2l-o'+active);if(o&&o.scrollIntoView)o.scrollIntoView({block:'nearest'});}
  function onScroll(){if(cur)place();}

  function addToolbar(){
    if(!D||!D.rights.can_manage)return;
    var tb=host.querySelector('#sv2-vlist .sv2-toolbar');if(!tb)return;
    var anchor=tb.querySelector('[data-act="openCreate"]'),wrap=mk('span','sv2l-tb');
    [['lists','Lists'],['queue','Review queue']].forEach(function(p){
      if(!SCREENS[p[0]])return;
      var b=mk('button','sv2-btn sec sm',p[1]);b.type='button';b.setAttribute('data-sv2l-screen',p[0]);
      b.addEventListener('click',function(){openScreen(p[0],{});});wrap.appendChild(b);
    });
    if(wrap.firstChild){tb.insertBefore(wrap,anchor||null);tbBtns.push(wrap);}
  }

  /* ---- screens (overlay dialog; content provided by registered modules) ---- */
  var scrEl=null,scrApi=null,lastFocus=null;
  function closeScreen(){
    if(scrApi&&scrApi.destroy){try{scrApi.destroy();}catch(_e){}}scrApi=null;
    if(scrEl){scrEl.remove();scrEl=null;}
    document.removeEventListener('keydown',scrKey,true);
    if(lastFocus&&lastFocus.focus){try{lastFocus.focus();}catch(_e){}}
  }
  function scrKey(e){if(e.key==='Escape'&&scrEl){e.preventDefault();closeScreen();}}
  function openScreen(name,args){
    var S=SCREENS[name];if(!S||!D||!D.rights.can_manage)return;
    closeScreen();lastFocus=document.activeElement;
    scrEl=mk('div','sv2l-scr');var panel=mk('div','sv2l-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    var head=mk('div','sv2l-ph'),h=mk('h2',null,S.title||name),x=mk('button','sv2l-x','✕');x.type='button';x.setAttribute('aria-label','Close');
    h.id='sv2l-scr-title';panel.setAttribute('aria-labelledby','sv2l-scr-title');
    x.addEventListener('click',closeScreen);head.appendChild(h);head.appendChild(x);
    var body=mk('div','sv2l-pb');panel.appendChild(head);panel.appendChild(body);scrEl.appendChild(panel);
    scrEl.addEventListener('mousedown',function(e){if(e.target===scrEl)closeScreen();});
    host.appendChild(scrEl);document.addEventListener('keydown',scrKey,true);x.focus();
    try{scrApi=S.mount(body,{sb:sb,product:product,productName:opts.productName||product,rights:D.rights,labels:LIST_LABELS,
      queueKeys:QUEUE_KEYS,args:args||{},mk:mk,clear:clear,close:closeScreen,refresh:reload,open:openScreen})||null;}
    catch(err){clear(body);body.appendChild(mk('div','sv2-banner err','This screen could not open. Reload and try again.'));}
  }

  /* 2026-11-25: a saved Receiving Port / Shipper that is not in this product's list (case-insensitive) gets a small
     'not in list' mark next to the field. The value itself is never changed; it is saved exactly as it is. */
  var MARK_KEYS={receiving_port:1,shipper:1};
  function marks(){
    if(dead)return;
    FIELDS.forEach(function(f){
      if(!f.hdr||!MARK_KEYS[f.key])return;var inp=host.querySelector('#sv2-'+f.hdr);if(!inp||!inp.parentNode)return;
      var v=low(inp.value),l=listOf(f.key),off=!!(D&&v&&l.length&&!l.some(function(x){return low(x)===v;}));
      var m=inp.parentNode.querySelector('.sv2l-offm[data-for="'+f.hdr+'"]');
      if(off&&!m){m=mk('span','sv2l-offm','not in list');m.setAttribute('data-for',f.hdr);m.title='This value is not in the list. It is kept and saved as it is.';inp.parentNode.appendChild(m);}
      if(!off&&m)m.remove();
      inp.classList.toggle('sv2l-off',off);
    });
  }
  function onChangeMark(e){var f=fieldFor(e.target);if(f&&f.hdr&&MARK_KEYS[f.key])marks();}

  var loadedAt=Date.now();
  /* dropdown arrow on every field that has a list (CSS keyed on the host class; keys with no list for this product get none) */
  function markHost(){
    host.classList.add('sv2l-on');
    FIELDS.forEach(function(f){host.classList.toggle('sv2l-no-'+f.key,!listOf(f.key).length&&!(D&&D.aliases[f.key]));});
    counts();
  }
  /* 2026-11-25 P2 (Pixel): Receiving Port / Shipper are comboboxes (no <datalist>): the label shows how many values the list has,
     e.g. 'Receiving Port · 60 in list'. The list is this product's whole list; it does not depend on the country. */
  var COUNT_KEYS={receiving_port:1,shipper:1};
  function counts(){
    FIELDS.forEach(function(f){
      if(!f.hdr||!COUNT_KEYS[f.key])return;var lab=host.querySelector('label[for="sv2-'+f.hdr+'"]');if(!lab)return;
      var c=lab.querySelector('.sv2l-cnt'),n=listOf(f.key).length;
      if(!n||dead){if(c)c.remove();return;}
      if(!c){c=mk('span','sv2l-cnt');c.setAttribute('data-for',f.hdr);lab.appendChild(c);}
      c.textContent='· '+n+' in list';c.title=n+' in the list · '+n+' في القائمة. Tap the field to pick.';
    });
  }
  function reload(){loadedAt=Date.now();return loadAll(sb,product).then(function(d){if(dead)return;D=d;markHost();marks();if(cur)render();},function(){});}
  /* lists approved/edited in another tab or by another admin: re-read when the user comes back to this tab (at most every 30 s) */
  function onReturn(){if(dead||!D||document.visibilityState!=='visible'||Date.now()-loadedAt<30000)return;reload();}
  document.addEventListener('visibilitychange',onReturn);window.addEventListener('focus',onReturn);
  host.addEventListener('focusin',onFocusIn);host.addEventListener('focusout',onFocusOut);host.addEventListener('click',onClickOpen);
  host.addEventListener('input',onInput);host.addEventListener('keydown',onKey,true);
  host.addEventListener('change',onChangeMark);host.addEventListener('focusout',onChangeMark);
  window.addEventListener('scroll',onScroll,true);window.addEventListener('resize',onScroll);

  /* 2026-11-25: loading / 'Couldn’t load list' + Retry in the form's #sv2-lstat (shipments_v2.js), instead of blank lists with no message */
  var booted=false,startSeq=0,loadNoteT=0;
  /* test only (staging): ?sv2failLists=1 -> the first managed-list load fails; Retry loads normally */
  var forced=(function(){try{return window.VISION_IS_DEV===true&&/(?:^|[?&#])sv2failLists=1(?:&|$)/.test(String(location.search)+'&'+String(location.hash));}catch(_e){return false;}})();
  function lstat(state){
    if(typeof opts.onStatus==='function'){try{opts.onStatus(state||null);}catch(_e){}return;}   /* 2026-11-25: the form shows one combined status line */
    var box=host.querySelector('#sv2-lstat');if(!box)return;var s=box.querySelector('[data-src="lists"]');
    if(!state){if(s)s.remove();return;}
    if(!s){s=mk('div');s.setAttribute('data-src','lists');box.appendChild(s);}
    clear(s);
    var b=mk('div','sv2-banner '+(state==='loading'?'info':'err')),ic=mk('span',null,state==='loading'?'i':'!'),tx=mk('span');ic.setAttribute('aria-hidden','true');tx.style.flex='1';
    b.setAttribute('role',state==='loading'?'status':'alert');
    tx.appendChild(document.createTextNode(state==='loading'?'Loading lists… · ':'Couldn’t load list · '));
    var ar=mk('bdi',null,state==='loading'?'جارٍ تحميل القوائم':'تعذر تحميل القائمة');ar.setAttribute('lang','ar');ar.setAttribute('dir','rtl');tx.appendChild(ar);
    b.appendChild(ic);b.appendChild(tx);
    if(state==='failed'){var r=mk('button','sv2-btn sec sm','Retry · ');r.type='button';var ra=mk('bdi',null,'إعادة المحاولة');ra.setAttribute('lang','ar');ra.setAttribute('dir','rtl');r.appendChild(ra);
      r.setAttribute('data-sv2l-retry','1');r.addEventListener('click',function(){start();});b.appendChild(r);}
    s.appendChild(b);
  }
  function start(){
    var seq=++startSeq;clearTimeout(loadNoteT);loadNoteT=setTimeout(function(){if(!dead&&seq===startSeq&&!D)lstat('loading');},700);
    var lp=forced?Promise.reject(new Error('sv2failLists=1 (test)')):loadAll(sb,product);forced=false;
    return lp.then(function(d){
      if(dead||seq!==startSeq)return;clearTimeout(loadNoteT);lstat(null);D=d;loadedAt=Date.now();
      if(!booted){booted=true;buildPop();addToolbar();}
      markHost();marks();
      /* 2026-11-25: a list field that got focus while the lists were loading opens its dropdown now */
      var a=document.activeElement,af=a&&host.contains(a)?fieldFor(a):null;if(af)open(a,af);
    },function(err){
      if(dead||seq!==startSeq)return;clearTimeout(loadNoteT);
      D=null;   /* fail closed: tables/RPC missing, no access or timeout -> text fields, plus 'Couldn’t load list' + Retry */
      lstat('failed');
      try{console.info('[SV2Lists] managed lists unavailable; form keeps text fields',err&&err.code?err.code:(err&&err.message)||'');}catch(_e){}
    });
  }
  var ready=start();

  return {
    active:true,ready:ready,reload:reload,retry:start,openScreen:openScreen,marks:marks,
    detach:function(){
      dead=true;close();closeScreen();clearTimeout(loadNoteT);lstat(null);
      host.removeEventListener('focusin',onFocusIn);host.removeEventListener('focusout',onFocusOut);host.removeEventListener('click',onClickOpen);
      Array.prototype.forEach.call(host.querySelectorAll('.sv2l-cnt'),function(c){c.remove();});
      host.removeEventListener('input',onInput);host.removeEventListener('keydown',onKey,true);
      host.removeEventListener('change',onChangeMark);host.removeEventListener('focusout',onChangeMark);
      Array.prototype.forEach.call(host.querySelectorAll('.sv2l-offm'),function(m){m.remove();});
      Array.prototype.forEach.call(host.querySelectorAll('.sv2l-off'),function(i){i.classList.remove('sv2l-off');});
      window.removeEventListener('scroll',onScroll,true);window.removeEventListener('resize',onScroll);
      document.removeEventListener('visibilitychange',onReturn);window.removeEventListener('focus',onReturn);
      tbBtns.forEach(function(w){w.remove();});tbBtns=[];
      host.classList.remove('sv2l-on');FIELDS.forEach(function(f){host.classList.remove('sv2l-no-'+f.key);});
      Array.prototype.forEach.call(host.querySelectorAll('[data-sv2l-list]'),function(i){i.setAttribute('list',i.getAttribute('data-sv2l-list'));i.removeAttribute('data-sv2l-list');});
      if(pop){pop.remove();pop=null;}
    }
  };
}

function registerScreen(name,def){if(name&&def&&typeof def.mount==='function')SCREENS[name]=def;}

/* 2026-11-25 (Vera, notinlist): the Potatoes / Other crops form (shipments_pt_suggest.js) opens the review queue screen itself */
function screen(name){return Object.prototype.hasOwnProperty.call(SCREENS,name)?SCREENS[name]:null;}
window.SV2Lists={attach:attach,registerScreen:registerScreen,screen:screen,enabled:enabled,labels:LIST_LABELS,version:'2026-11-25-retry-v0.5'};
})();
