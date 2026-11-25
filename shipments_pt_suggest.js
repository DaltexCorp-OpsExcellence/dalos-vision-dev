/* DalOS Vision — Shipments: "Not in list?" suggestions for the Potatoes + Other crops lists (Vera 2026-11-25, branch vera/notinlist)
 * ----------------------------------------------------------------------------
 * window.SV2PtSuggest. Attached by shipments_v2.js for Potatoes (managed lists on) and Other crops, after the form's lists load.
 *  - SWITCH: does nothing unless window.SV2_PT_SUGGEST_ENABLED === true AND window.VISION_IS_DEV === true (index.html:
 *    SV2_PT_SUGGEST_ENABLED=VISION_IS_DEV), so the prod address is always OFF.
 *  - FAIL CLOSED: if get_shipment_list_rights fails, or the user can neither suggest nor review, attach() returns an inert handle
 *    and the form is exactly as before. Nothing throws into shipments_v2.js.
 *  - Same pattern as the citrus lists (shipments_lists.js): the typed value is KEPT on this shipment (saved as text by the
 *    existing save RPCs) and sent to the review queue with submit_shipment_list_suggestion (queue only, never ref_options).
 *    An admin adds it to the list from the review queue (resolve_shipment_list_suggestion -> ref_option_add, admin only).
 *  - The 10 shared list keys of potato-lists A only: Sector, Crop season, Pivot, Grade, Size 2, Crop type, Brand,
 *    Jumbo / Sack colour (one list), Operation, Condition. The 6 master-linked lists (station, client, country, port, farm,
 *    packaging) are not here: they are added in Configurations.
 *  - Selects get a last option "＋ Not in list…"; picking it opens a small box to type the value. Pivot (free text with
 *    suggestions) shows "＋ Not in list? Keep … and send for review" after a value that is not in its suggestions.
 *  - DOM: createElement + textContent only (no innerHTML with data).
 */
(function(){
'use strict';
var HDR={sector:'sector',pseason:'crop_season'};   /* header select id (without sv2-) -> list key */
var LINE={grade:'grade',size2:'size',crop_type:'crop_type',brand:'brand',jumbo_colour:'bag_colour',sack_colour:'bag_colour',op_type:'operation',condition:'condition',pivot:'pivot'};
var PRODUCTS={potatoes:1,other_crops:1};
var NIL='__sv2_nil__',MAXLEN=120,cssDone=false;
/* 2026-11-25 (Pixel P2-1): Arabic next to the English, same words as the form's own labels */
var LABELS_AR={sector:'القطاع',crop_season:'الموسم',pivot:'البيفوت',grade:'التصنيف',size:'الحجم2',crop_type:'محصول',brand:'براند',bag_colour:'لون الجامب / الشكاره',operation:'نوع تشغيل',condition:'الحاله'};
var AR_NIL='غير موجود في القائمة',AR_KEEP='احتفظ وأرسل للمراجعة',AR_CANCEL='إلغاء',
    NOTE_EN='We’ll save this on this shipment. An admin can add it to the list.',NOTE_AR='سنحفظ هذه القيمة في هذه الشحنة، ويمكن للمسؤول إضافتها إلى القائمة.';
var LABELS={sector:'Sector',crop_season:'Crop season',pivot:'Pivot',grade:'Grade',size:'Size 2',crop_type:'Crop type',brand:'Brand',bag_colour:'Jumbo / sack colour',operation:'Operation',condition:'Condition'};
var CSS=[
'.sv2n-pop{position:fixed;z-index:2147482000;background:#fff;border:1px solid var(--border2,#ccd);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:10px;display:grid;gap:8px;width:min(320px,calc(100vw - 16px));font:13px var(--font-body,inherit);color:var(--text,#222)}',
'.sv2n-pop label{font-weight:600;font-size:12.5px}',
'.sv2n-pop input{border:1px solid var(--border2,#ccd);border-radius:6px;padding:7px 9px;font:14px var(--font-body,inherit);min-height:36px}',
'.sv2n-row{display:flex;flex-wrap:wrap;gap:6px}',
'.sv2n-row .sv2-btn{min-height:36px}',   /* P3: was 25px tall on desktop */
'.sv2n-pop bdi{unicode-bidi:isolate}',
'.sv2n-hint{font-size:11.5px;color:var(--text3,#777);line-height:1.4}',
'.sv2n-msg{font-size:12px}.sv2n-msg.ok{color:var(--green,#1c7c3c)}.sv2n-msg.err{color:var(--red,#b42318)}',
'.sv2n-act{font:500 12.5px var(--font-body,inherit);text-align:left;background:none;border:none;color:var(--accent,#1c5c3c);cursor:pointer;padding:5px 4px;border-radius:6px;min-height:32px}',
'.sv2n-act:hover,.sv2n-act:focus-visible{background:var(--bg2,#f2f2f2);outline:none}',
'.sv2n-scr{position:fixed;inset:0;z-index:2147481000;background:rgba(10,20,15,.35);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}',
'.sv2n-panel{background:#f7f7f4;color:var(--text,#222);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);width:min(1100px,100%);max-height:92vh;display:flex;flex-direction:column;font:13px var(--font-body,inherit)}',
'.sv2n-ph{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,#e2e2dc)}',
'.sv2n-ph h2{font:600 18px var(--font-display,inherit);margin:0;flex:1}',
'.sv2n-pb{padding:14px 18px;overflow:auto;display:grid;gap:12px}',
'.sv2n-x{border:1px solid var(--border2,#ccd);background:var(--card,#fff);border-radius:8px;min-width:36px;min-height:36px;cursor:pointer;font-size:15px}',
'@media (max-width:700px){.sv2n-scr{padding:0}.sv2n-panel{border-radius:0;max-height:100vh;min-height:100vh}}'
].join('\n');
function css(){if(cssDone)return;cssDone=true;var st=document.createElement('style');st.id='sv2n-css';st.textContent=CSS;document.head.appendChild(st);}
function enabled(){try{return window.SV2_PT_SUGGEST_ENABLED===true&&window.VISION_IS_DEV===true;}catch(_e){return false;}}
function norm(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();}
function fold(s){return norm(s).toLowerCase();}
function mk(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;}
function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
/* 'English · عربي' as text + an isolated Arabic part (createElement / textContent only) */
function bi(el,en,ar){el.appendChild(document.createTextNode(en+' · '));var b=document.createElement('bdi');b.setAttribute('lang','ar');b.setAttribute('dir','rtl');b.textContent=ar;el.appendChild(b);return el;}
/* same checks as the server (submit_shipment_list_suggestion): 1-120 characters, no control or invisible formatting characters */
function textProblem(v){
  if(!v)return 'Type a value first.';
  if(v.length>MAXLEN)return 'At most '+MAXLEN+' characters.';
  if(/[\u0000-\u001f\u007f-\u009f]/.test(v)||/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/.test(v))return 'Remove the hidden characters and try again.';
  return null;
}
function errText(e){
  var code=e&&e.code;
  if(code==='42501')return 'You can’t send list suggestions for this product. The value is still kept on this shipment.';
  if(code==='54000')return 'Too many suggestions are waiting for review. Ask an admin to review the queue. The value is still kept on this shipment.';
  if(code==='22023'||code==='22001')return ((e&&e.message)||'Check the value.')+' The value is still kept on this shipment.';
  return 'Couldn’t send it for review. The value is still kept on this shipment.';
}
/* list key of a form field, or null (only inside the shipment form) */
function keyOf(t){
  if(!t||!t.getAttribute||!t.closest||!t.closest('#sv2-vform'))return null;
  if(t.tagName==='SELECT'&&t.id&&t.id.indexOf('sv2-')===0&&HDR[t.id.slice(4)])return HDR[t.id.slice(4)];
  var k=t.getAttribute('data-k');
  return k&&LINE[k]&&t.closest('[data-line]')?LINE[k]:null;
}
function inert(){return {active:false,detach:function(){},decorate:function(){}};}

function attach(host,opts){
  opts=opts||{};
  var sb=opts.sb,product=opts.product;
  if(!enabled()||!host||!sb||typeof sb.rpc!=='function'||!PRODUCTS[product])return inert();
  css();
  var dead=false,rights=null,pop=null,popFor=null,mo=null,tbBtn=null,scr=null,scrApi=null,lastFocus=null,timer=0;
  var isSuggest=function(){return !!(rights&&rights.can_suggest);};

  /* ---- select decoration: one '＋ Not in list…' option at the end of each list select */
  function decorate(){
    if(dead||!isSuggest())return;
    Array.prototype.forEach.call(host.querySelectorAll('#sv2-vform select'),function(s){
      if(!keyOf(s)||s.querySelector('option[value="'+NIL+'"]'))return;
      var o=mk('option',null,'＋ Not in list… · '+AR_NIL);o.value=NIL;o.setAttribute('data-sv2n','1');s.appendChild(o);
    });
  }
  function schedule(){if(timer)return;timer=setTimeout(function(){timer=0;decorate();},0);}
  function undecorate(){Array.prototype.forEach.call(host.querySelectorAll('option[data-sv2n]'),function(o){o.remove();});}

  /* ---- popover */
  function closePop(){if(pop){pop.remove();pop=null;popFor=null;}document.removeEventListener('mousedown',outside,true);document.removeEventListener('keydown',popKey,true);}
  function outside(e){if(pop&&!pop.contains(e.target)&&e.target!==popFor)closePop();}
  function popKey(e){if(e.key==='Escape'&&pop){e.preventDefault();var f=popFor;closePop();if(f&&f.focus)f.focus();}}
  function place(el){
    if(!pop||!el||!el.getBoundingClientRect)return;
    var r=el.getBoundingClientRect(),w=pop.offsetWidth||320,h=pop.offsetHeight||160,vw=window.innerWidth||1024,vh=window.innerHeight||768;
    var top=r.bottom+4;if(top+h>vh-8)top=Math.max(8,r.top-h-4);
    pop.style.top=top+'px';pop.style.left=Math.max(8,Math.min(r.left,vw-w-8))+'px';
  }
  function openPop(el){closePop();pop=mk('div','sv2n-pop');pop.setAttribute('role','dialog');popFor=el;host.appendChild(pop);
    setTimeout(function(){document.addEventListener('mousedown',outside,true);},0);document.addEventListener('keydown',popKey,true);return pop;}
  function msgEl(){var m=mk('div','sv2n-msg');m.setAttribute('role','status');return m;}
  function show(m,ok,text){m.className='sv2n-msg '+(ok?'ok':'err');m.textContent=text;}

  /* ---- keep the typed value on the field, then send it for review */
  function optionFor(s,v){var f=fold(v),hit=null;Array.prototype.forEach.call(s.options,function(o){if(!hit&&o.value!==NIL&&o.value!==''&&fold(o.value)===f)hit=o;});return hit;}
  function keepOnSelect(s,v){
    var o=optionFor(s,v),had=!!o;
    if(!o){o=mk('option',null,v);o.value=v;var nil=s.querySelector('option[value="'+NIL+'"]');s.insertBefore(o,nil||null);}
    s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));s.dispatchEvent(new Event('input',{bubbles:true}));
    return had;
  }
  function send(key,v,m,done){
    var cn='';try{cn=typeof opts.container==='function'?norm(opts.container()):'';}catch(_e){}
    show(m,true,'Sending for review…');
    Promise.resolve(sb.rpc('submit_shipment_list_suggestion',{p_product_id:product,p_list_key:key,p_value:v,p_container_number:cn||null})).then(function(r){
      if(dead)return;
      if(r&&r.error){show(m,false,errText(r.error));return;}
      var st=r&&r.data&&r.data.status;
      show(m,true,st==='in_list'?'“'+v+'” is already in the list.':'Sent for review. “'+v+'” is kept on this shipment; an admin adds it to the list.');
      if(done)done(st);
    },function(e){if(!dead)show(m,false,errText(e));});
  }
  function askFor(s,key){
    var p=openPop(s),lab=bi(mk('label'),'Not in list? '+(LABELS[key]||key),AR_NIL+(LABELS_AR[key]?'؟ '+LABELS_AR[key]:'؟'));
    var inp=mk('input');inp.type='text';inp.maxLength=MAXLEN;inp.setAttribute('dir','auto');inp.setAttribute('autocomplete','off');
    var id='sv2n-in-'+Date.now();inp.id=id;lab.setAttribute('for',id);
    var row=mk('div','sv2n-row'),ok=bi(mk('button','sv2-btn sm'),'Keep and send for review',AR_KEEP),no=bi(mk('button','sv2-btn sec sm'),'Cancel',AR_CANCEL);ok.type='button';no.type='button';
    var hint=bi(mk('div','sv2n-hint'),NOTE_EN,NOTE_AR),m=msgEl();
    row.appendChild(ok);row.appendChild(no);p.appendChild(lab);p.appendChild(inp);p.appendChild(row);p.appendChild(hint);p.appendChild(m);
    place(s);inp.focus();
    function go(){
      var v=norm(inp.value),pr=textProblem(v);if(pr){show(m,false,pr);inp.focus();return;}
      var had=keepOnSelect(s,v);
      if(had){show(m,true,'“'+v+'” is already in the list. Picked it.');setTimeout(closePop,1200);return;}
      ok.disabled=true;inp.disabled=true;send(key,v,m,function(){setTimeout(function(){if(popFor===s)closePop();},2500);});
    }
    ok.addEventListener('click',go);no.addEventListener('click',function(){closePop();if(s.focus)s.focus();});
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go();}});
  }
  function offerFor(inp,key){
    var v=norm(inp.value);if(!v||textProblem(v))return;
    var dl=inp.list,f=fold(v),known=false;
    if(dl&&dl.options)Array.prototype.forEach.call(dl.options,function(o){if(fold(o.value)===f)known=true;});
    if(known)return;
    var p=openPop(inp),b=mk('button','sv2n-act'),m=msgEl();b.type='button';
    b.appendChild(document.createTextNode('＋ Not in list? Keep “'));var bd=mk('bdi',null,v);b.appendChild(bd);b.appendChild(document.createTextNode('” and send for review · '));var ba=mk('bdi',null,AR_NIL+'؟ '+AR_KEEP);ba.setAttribute('lang','ar');ba.setAttribute('dir','rtl');b.appendChild(ba);
    p.appendChild(b);p.appendChild(m);place(inp);
    b.addEventListener('click',function(){b.disabled=true;send(key,v,m,function(){setTimeout(function(){if(popFor===inp)closePop();},2500);});});
  }

  /* ---- events (capture: the sentinel never reaches shipments_v2.js, so it is never saved and never marks the form dirty) */
  var prev=new WeakMap();
  function onFocus(e){var t=e.target;if(t&&t.tagName==='SELECT'&&keyOf(t)&&t.value!==NIL)prev.set(t,t.value);}
  function onChange(e){
    var t=e.target,key=keyOf(t);if(!key||!isSuggest())return;
    if(t.tagName==='SELECT'){
      if(t.value!==NIL){prev.set(t,t.value);return;}
      e.stopImmediatePropagation();
      t.value=prev.has(t)?prev.get(t):'';if(t.value===NIL)t.value='';
      askFor(t,key);
    }else if(t.tagName==='INPUT'){offerFor(t,key);}
  }
  function onScroll(){if(pop&&popFor)place(popFor);}

  /* ---- review queue button (admins / power users), Potatoes + Other crops rows only */
  function addToolbar(){
    if(!rights||!rights.can_manage||!window.SV2Lists||typeof window.SV2Lists.screen!=='function'||!window.SV2Lists.screen('queue'))return;
    var tb=host.querySelector('#sv2-vlist .sv2-toolbar');if(!tb)return;
    var anchor=tb.querySelector('[data-act="openCreate"]');
    tbBtn=mk('button','sv2-btn sec','Review queue');tbBtn.type='button';tbBtn.setAttribute('data-sv2n-queue','1');
    tbBtn.addEventListener('click',openQueue);tb.insertBefore(tbBtn,anchor||null);
  }
  function closeQueue(){if(scrApi&&scrApi.destroy){try{scrApi.destroy();}catch(_e){}}scrApi=null;if(scr){scr.remove();scr=null;}
    document.removeEventListener('keydown',scrKey,true);if(lastFocus&&lastFocus.focus){try{lastFocus.focus();}catch(_e){}}}
  function scrKey(e){if(e.key==='Escape'&&scr){e.preventDefault();closeQueue();}}
  function openQueue(){
    var S=window.SV2Lists&&window.SV2Lists.screen&&window.SV2Lists.screen('queue');if(!S||dead)return;
    closeQueue();lastFocus=document.activeElement;
    scr=mk('div','sv2n-scr');var panel=mk('div','sv2n-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    var head=mk('div','sv2n-ph'),h=mk('h2',null,(S.title||'Review queue')+' · '+(opts.productName||product)),x=mk('button','sv2n-x','✕');x.type='button';x.setAttribute('aria-label','Close');
    h.id='sv2n-scr-title';panel.setAttribute('aria-labelledby','sv2n-scr-title');x.addEventListener('click',closeQueue);head.appendChild(h);head.appendChild(x);
    var body=mk('div','sv2n-pb');panel.appendChild(head);panel.appendChild(body);scr.appendChild(panel);
    scr.addEventListener('mousedown',function(e){if(e.target===scr)closeQueue();});host.appendChild(scr);document.addEventListener('keydown',scrKey,true);x.focus();
    try{scrApi=S.mount(body,{sb:sb,product:product,productName:opts.productName||product,rights:rights,labels:(window.SV2Lists&&window.SV2Lists.labels)||{},
      args:{product:product},mk:mk,clear:clear,close:closeQueue,refresh:function(){return Promise.resolve();},open:function(){}})||null;}
    catch(_e){clear(body);body.appendChild(mk('div','sv2-banner err','This screen could not open. Reload and try again.'));}
  }

  var ready=Promise.resolve(sb.rpc('get_shipment_list_rights')).then(function(r){
    if(dead)return;if(!r||r.error||!r.data)throw (r&&r.error)||new Error('rights');
    rights={can_suggest:r.data.can_suggest===true,can_manage:r.data.can_manage===true};
    if(!rights.can_suggest&&!rights.can_manage)return;
    host.addEventListener('focusin',onFocus,true);host.addEventListener('mousedown',onFocus,true);host.addEventListener('change',onChange,true);
    window.addEventListener('scroll',onScroll,true);window.addEventListener('resize',onScroll);
    if(typeof MutationObserver==='function'){mo=new MutationObserver(schedule);mo.observe(host,{childList:true,subtree:true});}
    decorate();addToolbar();
  }).catch(function(err){rights=null;try{console.info('[SV2PtSuggest] off: rights unavailable',err&&err.code?err.code:'');}catch(_e){}});

  return {active:true,ready:ready,decorate:decorate,
    detach:function(){
      dead=true;clearTimeout(timer);closePop();closeQueue();if(mo){mo.disconnect();mo=null;}
      host.removeEventListener('focusin',onFocus,true);host.removeEventListener('mousedown',onFocus,true);host.removeEventListener('change',onChange,true);
      window.removeEventListener('scroll',onScroll,true);window.removeEventListener('resize',onScroll);
      if(tbBtn){tbBtn.remove();tbBtn=null;}undecorate();
    }};
}
window.SV2PtSuggest={attach:attach,enabled:enabled,keys:{header:HDR,line:LINE},NIL:NIL,textProblem:textProblem,version:'2026-11-25-notinlist-v0.2'};
})();
