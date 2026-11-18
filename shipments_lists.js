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
 */
(function(){
'use strict';

var LIST_LABELS={brand:'Brands',packing_type:'Packing types',count_size:'Counts/Sizes',caliber:'Calibers',source_type:'Source types',
  raw_source:'Raw sources',departure_port:'Departure ports',agent:'Agents',shipping_line:'Shipping lines',client_class:'Client classes',
  shipping_status:'Shipping statuses',receiving_country:'Countries',daltex_class:'Daltex classes'};
var QUEUE_KEYS={brand:1,packing_type:1,count_size:1,caliber:1,source_type:1,raw_source:1,departure_port:1,agent:1,shipping_line:1,client_class:1,shipping_status:1};
/* intake field -> list. hdr = header input id (without sv2-), k = line data-k */
var FIELDS=[
  {hdr:'line',key:'shipping_line'},{hdr:'depport',key:'departure_port'},{hdr:'agent',key:'agent'},{hdr:'country',key:'receiving_country'},
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
'.sv2l-pop{position:fixed;z-index:2147482000;background:var(--card,#fff);border:1px solid var(--border2,#ccd);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);display:none;flex-direction:column;max-height:320px;min-width:220px;font:13px var(--font-body,inherit);color:var(--text,#222)}',
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
'.sv2l-tb{display:inline-flex;gap:6px}',
'.sv2l-scr{position:fixed;inset:0;z-index:2147481000;background:rgba(10,20,15,.35);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}',
'.sv2l-panel{background:var(--bg,#f7f7f4);color:var(--text,#222);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);width:min(1100px,100%);max-height:92vh;display:flex;flex-direction:column;font:13px var(--font-body,inherit)}',
'.sv2l-ph{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,#e2e2dc)}',
'.sv2l-ph h2{font:600 18px var(--font-display,inherit);margin:0;flex:1}',
'.sv2l-pb{padding:14px 18px;overflow:auto;display:grid;gap:12px}',
'.sv2l-x{border:1px solid var(--border2,#ccd);background:var(--card,#fff);border-radius:8px;min-width:36px;min-height:36px;cursor:pointer;font-size:15px}',
'@media (max-width:700px){.sv2l-scr{padding:0}.sv2l-panel{border-radius:0;max-height:100vh;min-height:100vh}}'
].join('\n');
function injectCss(){if(cssDone)return;cssDone=true;var st=document.createElement('style');st.id='sv2l-css';st.textContent=CSS;document.head.appendChild(st);}

/* ---------------------------------------------------------------- data */
function loadAll(sb,product){
  function q(p){return Promise.resolve(p).then(function(r){if(!r||r.error)throw (r&&r.error)||new Error('read failed');return r.data;});}
  return Promise.all([
    q(sb.rpc('get_shipment_list_rights')),
    q(sb.from('shipment_list_values').select('list_key,value,label,sort_order').eq('product_id',product).eq('active',true).order('sort_order').order('value')),
    q(sb.from('shipment_list_aliases').select('list_key,product_id,alias,canonical').eq('active',true)),
    q(sb.from('countries').select('name').eq('active',true).order('name')),
    q(sb.from('classes').select('name').eq('active',true).order('name'))
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
    if(!pop||!cur)return;if(!document.body.contains(cur.input)){close();return;}var r=cur.input.getBoundingClientRect(),vh=window.innerHeight||800,below=vh-r.bottom-8,above=r.top-8;
    pop.style.left=Math.max(4,Math.min(r.left,(window.innerWidth||1000)-Math.max(r.width,240)-4))+'px';
    pop.style.width=Math.max(r.width,240)+'px';
    var up=below<200&&above>below,h=Math.max(140,Math.min(320,up?above:below));
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
    if(typed&&!exact&&QUEUE_KEYS[key]&&D.rights.can_suggest){
      var b=mk('button','sv2l-act');b.type='button';
      if(typed.length>MAXLEN){b.disabled=true;b.textContent='Too long for the list (max '+MAXLEN+' characters)';}
      else{b.appendChild(document.createTextNode('＋ Not in list? Keep “'));b.appendChild(mk('bdi',null,typed));b.appendChild(document.createTextNode('” and send for review'));
        b.addEventListener('click',function(){suggest(key,typed);});}
      foot.appendChild(b);
      foot.appendChild(mk('div','sv2l-hint','Typed values stay on this shipment and wait for an admin to review. They are never added to the shared list automatically.'));
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

  function reload(){return loadAll(sb,product).then(function(d){if(!dead)D=d;},function(){});}
  host.addEventListener('focusin',onFocusIn);host.addEventListener('focusout',onFocusOut);
  host.addEventListener('input',onInput);host.addEventListener('keydown',onKey,true);
  window.addEventListener('scroll',onScroll,true);window.addEventListener('resize',onScroll);

  var ready=loadAll(sb,product).then(function(d){
    if(dead)return;D=d;buildPop();addToolbar();
  },function(err){
    D=null;   /* fail closed: tables/RPC missing or no access -> today's form, untouched */
    try{console.info('[SV2Lists] managed lists unavailable; form keeps text fields',err&&err.code?err.code:'');}catch(_e){}
  });

  return {
    active:true,ready:ready,reload:reload,openScreen:openScreen,
    detach:function(){
      dead=true;close();closeScreen();
      host.removeEventListener('focusin',onFocusIn);host.removeEventListener('focusout',onFocusOut);
      host.removeEventListener('input',onInput);host.removeEventListener('keydown',onKey,true);
      window.removeEventListener('scroll',onScroll,true);window.removeEventListener('resize',onScroll);
      tbBtns.forEach(function(w){w.remove();});tbBtns=[];
      Array.prototype.forEach.call(host.querySelectorAll('[data-sv2l-list]'),function(i){i.setAttribute('list',i.getAttribute('data-sv2l-list'));i.removeAttribute('data-sv2l-list');});
      if(pop){pop.remove();pop=null;}
    }
  };
}

function registerScreen(name,def){if(name&&def&&typeof def.mount==='function')SCREENS[name]=def;}

window.SV2Lists={attach:attach,registerScreen:registerScreen,enabled:enabled,labels:LIST_LABELS,version:'2026-11-15-draft-v0.2'};
})();
