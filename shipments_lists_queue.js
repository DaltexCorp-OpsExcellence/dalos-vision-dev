/* DalOS Vision — Shipments "Manage": "Not in list?" review queue (draft, Vera 2026-11-15)
 * Registers the 'queue' screen with window.SV2Lists. Admin + power_user only: the queue table is readable only
 * through the is_power_user_or_admin() SELECT policy, and every action goes through the SECURITY DEFINER RPC
 * resolve_shipment_list_suggestion (role check first, 42501). Approve = add to the list; Merge = record the typed
 * spelling as an alias of an existing value; Reject. Since 2026-11-26 (DB sv2_list_approve_updates_container_20261126)
 * Approve-as-another-name and Merge also rename that field on the container that sent the suggestion (all products since
 * 2026-11-26 sv2_list_approve_updates_container_pt_oc_20261126; only lines still holding the typed text). Other shipments keep their saved spelling.
 * Layout follows the mockup's "New values typed in intake" panel. createElement + textContent only.
 *  v0.2: optional "Approve as…" edited value (sent as p_value; typed spelling kept as a spelling match); 23505 message for conflicting spellings.
 *  2026-11-25 (Vera, notinlist): Potatoes + Other crops rows. Their lists are ref_options: merge targets are the active options
 *    (label), approve is admin only and lands in the list through ref_option_add on the server (no spelling match is kept).
 *    Opened from the Potatoes / Other crops form, the queue shows that product's rows only (args.product).
 */
(function(){
'use strict';
if(!window.SV2Lists||typeof window.SV2Lists.registerScreen!=='function')return;
var PNAME={citrus:'Citrus',grapes:'Grapes',mango:'Mango',pomegranate:'Pomegranate',potatoes:'Potatoes',other_crops:'Other crops'};
var REFP={potatoes:1,other_crops:1};   /* lists in ref_options (shared keys of potato-lists A) */
var CSS=[
'.sv2q{display:grid;gap:12px}',
'.sv2q-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
'.sv2q-bar select{background:var(--card,#fff);border:1px solid var(--border2,#ccd);border-radius:8px;padding:7px 10px;font:13px var(--font-body,inherit);min-height:36px}',
'.sv2q-list{display:grid;gap:8px}',
'.sv2q-item{background:var(--card,#fff);border:1px solid var(--border,#e2e2dc);border-radius:12px;padding:12px 14px;display:grid;gap:6px}',
'.sv2q-val{font:600 16px var(--font-body,inherit);word-break:break-word}',
'.sv2q-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:var(--text3,#777)}',
'.sv2q-pill{font-size:11px;padding:1px 8px;border-radius:20px;background:var(--bg2,#eee);color:var(--text2,#333)}',
'.sv2q-pill.prod{background:#fff3df;color:#8a5a12}',
'.sv2q-acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
'.sv2q-acts select,.sv2q-acts input{background:var(--card,#fff);border:1px solid var(--border2,#ccd);border-radius:8px;padding:6px 9px;font:13px var(--font-body,inherit);min-height:36px;max-width:100%}',
'.sv2q-msg{font-size:12.5px}.sv2q-msg.err{color:var(--red,#b42318)}.sv2q-msg.ok{color:var(--green,#1c7c3c)}',
'.sv2q-empty{padding:24px;text-align:center;color:var(--text3,#777)}'
].join('\n');
var cssDone=false;
function css(){if(cssDone)return;cssDone=true;var st=document.createElement('style');st.id='sv2q-css';st.textContent=CSS;document.head.appendChild(st);}
function fmt(ts){if(!ts)return '';var d=new Date(ts);if(isNaN(d))return '';
  try{return d.toLocaleString('en-GB',{timeZone:'Africa/Cairo',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' Cairo';}catch(_e){return d.toISOString();}}
function errText(e,it){
  if(!e)return 'Something went wrong. Try again.';
  if(e.code==='42501'&&it&&REFP[it.product_id])return /admin/i.test(e.message||'')?'Only an admin or this product’s list editor can add values to the Potatoes and Other crops lists.':'You can’t review these suggestions.';
  if(e.code==='42501')return 'Only admins and power users can review suggestions.';
  if(e.code==='55000')return 'Someone already reviewed this one. Refreshing.';
  if(e.code==='22023')return e.message||'Check the value and try again.';
  if(e.code==='23505')return 'That spelling is already matched to a different value. Change or remove that spelling match in Configurations first.';
  return 'Couldn’t save. Try again.';
}

function mount(body,ctx){
  css();
  var mk=ctx.mk,clear=ctx.clear,sb=ctx.sb,L=ctx.labels,dirty=false,st={status:'pending',msg:null,items:[],lists:{}};
  var root=mk('div','sv2q');body.appendChild(root);
  var intro=mk('div','sv2c-note sv2-note');
  intro.textContent='Values typed with “Not in list?” in the intake form. They stay on their shipments as typed; approving adds them to the shared list for next time, merging records them as another spelling of an existing value.';
  root.appendChild(intro);
  var bar=mk('div','sv2q-bar'),ss=mk('select');ss.setAttribute('aria-label','Show');
  [['pending','Waiting for review'],['approved','Approved'],['merged','Merged'],['rejected','Rejected']].forEach(function(o){var e=mk('option',null,o[1]);e.value=o[0];ss.appendChild(e);});
  ss.addEventListener('change',function(){st.status=ss.value;st.msg=null;load();});
  var rf=mk('button','sv2-btn sec sm','Refresh');rf.type='button';rf.addEventListener('click',function(){st.msg=null;load();});
  bar.appendChild(ss);bar.appendChild(rf);root.appendChild(bar);
  var msg=mk('div','sv2q-msg');msg.setAttribute('role','status');root.appendChild(msg);
  var list=mk('div','sv2q-list');root.appendChild(list);

  function load(){
    clear(list);list.appendChild(mk('div','sv2q-empty','Loading…'));
    var qq=sb.from('shipment_list_queue').select('id,list_key,product_id,value,container_number,status,submit_count,resolved_value,resolution_note,created_at,last_submitted_at')
      .eq('status',st.status);
    if(ctx.args&&ctx.args.product)qq=qq.eq('product_id',ctx.args.product);
    Promise.resolve(qq.order(st.status==='pending'?'created_at':'resolved_at',{ascending:st.status==='pending'}).limit(500)).then(function(r){
      if(r.error)throw r.error;st.items=r.data||[];
      var need={};st.items.forEach(function(i){need[i.list_key+'|'+i.product_id]=i;});
      var keys=Object.keys(need).filter(function(k){return !st.lists[k];});
      return Promise.all(keys.map(function(k){var i=need[k];
        if(REFP[i.product_id])return Promise.resolve(sb.from('ref_options').select('code,label_ar,label_en').eq('product_id',i.product_id).eq('list_key',i.list_key).eq('active',true).order('sort_order'))
          .then(function(x){st.lists[k]=(x&&!x.error&&x.data)?x.data.map(function(v){return v.label_ar;}):[];});
        return Promise.resolve(sb.from('shipment_list_values').select('value').eq('list_key',i.list_key).eq('product_id',i.product_id).eq('active',true).order('value'))
          .then(function(x){st.lists[k]=(x&&!x.error&&x.data)?x.data.map(function(v){return v.value;}):[];});
      }));
    }).then(draw).catch(function(e){clear(list);list.appendChild(mk('div','sv2q-msg err',e&&e.code==='42501'?'You don’t have access to the review queue.':'The review queue could not load. Try Refresh.'));});
  }
  function draw(){
    msg.className='sv2q-msg'+(st.msg?(st.msg.ok?' ok':' err'):'');msg.textContent=st.msg?st.msg.text:'';
    clear(list);
    if(!st.items.length){list.appendChild(mk('div','sv2q-empty',st.status==='pending'?'Nothing waiting for review.':'Nothing here.'));return;}
    st.items.forEach(function(it){
      var card=mk('div','sv2q-item');
      var v=mk('div','sv2q-val');var bd=mk('bdi',null,it.value);bd.setAttribute('dir','auto');v.appendChild(bd);card.appendChild(v);
      var meta=mk('div','sv2q-meta');
      meta.appendChild(mk('span','sv2q-pill prod',PNAME[it.product_id]||it.product_id));
      meta.appendChild(mk('span','sv2q-pill',L[it.list_key]||it.list_key));
      meta.appendChild(mk('span',null,(it.submit_count>1?('Typed '+it.submit_count+' times · '):'')+'first '+fmt(it.created_at)));
      if(it.container_number)meta.appendChild(mk('span',null,'Container '+it.container_number));
      card.appendChild(meta);
      if(it.status!=='pending'){
        card.appendChild(mk('div','sv2q-meta',(it.status==='merged'?'Merged into “'+(it.resolved_value||'')+'”':it.status==='approved'?'Added to the list as “'+(it.resolved_value||'')+'”':'Rejected')+(it.resolution_note?(' · '+it.resolution_note):'')));
        list.appendChild(card);return;
      }
      var acts=mk('div','sv2q-acts');
      var ap=mk('button','sv2-btn sm',REFP[it.product_id]?'Add to the list':'Approve into list');ap.type='button';
      if(REFP[it.product_id])ap.title='Admins and this product’s list editors: adds it to this product’s list';
      var ed=mk('input');ed.placeholder='Approve as… (optional)';ed.maxLength=120;ed.setAttribute('aria-label','Approve as edited value');ed.setAttribute('dir','auto');
      ap.addEventListener('click',function(){act(it,'approve',ed.value.trim()||null,null,ap);});
      var opts=st.lists[it.list_key+'|'+it.product_id]||[];
      var ms=mk('select');ms.setAttribute('aria-label','Merge into existing value');
      var o0=mk('option',null,opts.length?'Merge into…':'No values to merge into');o0.value='';ms.appendChild(o0);
      opts.forEach(function(x){var o=mk('option',null,x);o.value=x;ms.appendChild(o);});
      var mb=mk('button','sv2-btn sec sm','Merge');mb.type='button';mb.disabled=!opts.length;
      mb.addEventListener('click',function(){if(!ms.value){st.msg={ok:false,text:'Choose the existing value to merge into.'};draw();return;}act(it,'merge',ms.value,null,mb);});
      var rj=mk('button','sv2-btn sec sm','Reject');rj.type='button';
      var note=mk('input');note.placeholder='Note (optional)';note.maxLength=300;note.setAttribute('aria-label','Review note');
      rj.addEventListener('click',function(){act(it,'reject',null,note.value,rj);});
      acts.appendChild(ed);acts.appendChild(ap);acts.appendChild(ms);acts.appendChild(mb);acts.appendChild(note);acts.appendChild(rj);
      card.appendChild(acts);list.appendChild(card);
    });
  }
  function act(it,action,value,noteText,btn){
    if(btn)btn.disabled=true;
    Promise.resolve(sb.rpc('resolve_shipment_list_suggestion',{p_id:it.id,p_action:action,p_value:value,p_note:(noteText||'').trim()||null})).then(function(r){
      if(r&&r.error){st.msg={ok:false,text:errText(r.error,it)};if(r.error.code==='55000')load();else draw();return;}
      dirty=true;delete st.lists[it.list_key+'|'+it.product_id];
      var d=(r&&r.data)||{},n=+d.lines_updated||0,cn=d.container||it.container_number||'';
      var upd=n>0?' Updated '+n+' line'+(n===1?'':'s')+' on container '+cn+'.':'';   /* 2026-11-26: Potatoes / Other crops too (DB pt_oc) */
      if(action==='approve'&&REFP[it.product_id]){st.msg={ok:true,text:'Added to the '+(PNAME[it.product_id]||it.product_id)+' list'+(d.value?' as “'+d.value+'”':'')+'.'+upd};load();return;}
      st.msg={ok:true,text:(action==='approve'?(value?'Added to the list as “'+value+'”. The typed spelling is kept as a spelling match.':'Added to the list.'):action==='merge'?'Merged as another spelling.':'Rejected.')+upd};load();
      if(action==='approve')jdeNote(it,value||it.value);
    },function(e){st.msg={ok:false,text:errText(e,it)};draw();});
  }
  /* JDE (citrus): a newly approved brand / caliber / client class / packing has no JDE code until an admin adds one */
  var JDE_PART={brand:'brand',caliber:'caliber',client_class:'client_class',packing_type:'packaging_type'};
  function jdeFold(v){return String(v||'').replace(/\s/g,'').toLowerCase();}
  function jdeNote(it,v){
    var part=JDE_PART[it.list_key];if(it.product_id!=='citrus'||!part||!v)return;
    Promise.resolve(sb.from('jde_codes').select('value').eq('product_id','citrus').eq('part',part).eq('active',true)).then(function(r){
      if(!r||r.error)return;
      if((r.data||[]).some(function(x){return jdeFold(x.value)===jdeFold(v);}))return;
      if(st.msg&&st.msg.ok){st.msg={ok:true,text:st.msg.text+' No JDE code yet: add it in Lists \u2192 JDE codes (citrus), or citrus lines with it show \u201cJDE code incomplete\u201d.'};draw();}
    },function(){});
  }
  load();
  return {destroy:function(){if(dirty&&ctx.refresh)ctx.refresh();}};
}
window.SV2Lists.registerScreen('queue',{title:'Review queue · New values typed in intake',mount:mount});
})();
