/* DalOS Vision — "View Vision as…" (STAGING ONLY, admins only). Tarek 2026-11-25.
 * ----------------------------------------------------------------------------
 * An admin picks a user; the page reloads and Vision draws itself with that user's role, packhouses and Manage rights.
 *  - Inert unless VISION_IS_DEV (staging address / localhost). Loaded before vision.js so the Supabase client's fetch
 *    (dalosReauth captures window.fetch at load) goes through the guard below.
 *  - WRITES ARE BLOCKED while previewing: any non-GET to the REST API, storage or edge functions, and every RPC that is
 *    not a read (get_/list_/has_/is_/search_ + a few named reads) gets a 403 back and a "not saved" toast. Nothing is
 *    written to the database as anyone.
 *  - get_shipment_list_rights is answered with the previewed user's rights (same rules as the DB function).
 *  - Limit: the DATA is still what the admin's login can read (RLS runs as the admin). The menus, buttons and rights
 *    follow the previewed user. Server-side checks (e.g. has_analytics_access) still answer for the admin.
 *  - State lives in sessionStorage (this tab only); Exit or closing the tab ends it.
 *  - vision.js hook (one line after dalosReauth.setUser in App): liveCurrentUser = VisionViewAs.userFor(real) || real.
 */
(function(){
'use strict';
if(window.VISION_IS_DEV!==true)return;

var KEY='dalos_viewas_v1';
var nativeFetch=window.fetch.bind(window);
var READ_RPC=/^(get_|list_|has_|is_|search_|fetch_|lookup_)/;
var READ_NAMED={config_list_values:1,cqc_container_duplicate_check:1,compute_inspection_aggregates:1};
var real=null,bar=null,toastEl=null,blocked=0;

function load(){try{var s=JSON.parse(sessionStorage.getItem(KEY)||'null');return s&&s.user&&s.by?s:null;}catch(e){return null;}}
function save(s){try{if(s)sessionStorage.setItem(KEY,JSON.stringify(s));else sessionStorage.removeItem(KEY);}catch(e){}}
var state=load();

function isSb(url){return /^https:\/\/[a-z0-9]+\.supabase\.co\//i.test(url);}
function active(){return !!(state&&real&&real.role==='admin'&&state.by===real.id);}
/* Before the app has told us who is signed in, a stored preview still blocks writes (fail closed). */
function guarding(){return !!state&&(!real||active());}

function jsonResp(status,obj){return new Response(JSON.stringify(obj),{status:status,headers:{'Content-Type':'application/json'}});}
function block(what){
  blocked++;toast('Not saved: viewing as '+(state&&state.user?state.user.name:'another user')+'. ('+what+')');
  try{console.warn('[ViewAs] blocked',what);}catch(e){}
  return Promise.resolve(jsonResp(403,{code:'42501',message:'Preview mode: viewing as '+(state&&state.user?state.user.name:'another user')+', saving is off.',details:null,hint:null}));
}

window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url)||String(input);
  if(!guarding()||!isSb(url)||url.indexOf('/auth/v1/')>=0)return nativeFetch(input,init);
  var method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
  var rpc=(url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i)||[])[1];
  if(rpc){
    rpc=rpc.toLowerCase();
    if(rpc==='get_shipment_list_rights')return Promise.resolve(jsonResp(200,state.rights||{can_suggest:false,can_manage:false}));
    if(READ_RPC.test(rpc)||READ_NAMED[rpc])return nativeFetch(input,init);
    return block(rpc);
  }
  if(method==='GET'||method==='HEAD')return nativeFetch(input,init);
  var path=(url.match(/\.supabase\.co\/([^?]+)/)||[])[1]||url;
  return block(method+' '+path.replace(/^rest\/v1\//,''));
};

/* ---- rights, same rules as the DB (get_shipment_list_rights / _shipments_v2_can_edit / is_power_user_or_admin) ---- */
function rightsFor(u,editor){
  var on=!!u.active;
  return {can_suggest:on&&u.role!=='client_qc'&&(u.role==='admin'||editor),
          can_manage:on&&(u.role==='admin'||u.role==='power_user')};
}
var ALL_ACCESS={admin:1,qc_manager:1,board:1,commercial:1,executive:1};   /* as vision.js sign-in */
var VIEW_PERM={fg:'viewFG',clientqc:'viewClientQC',shipments:'viewShipments',analytics:'viewAnalytics',escalation:'viewEscalation',admin:'viewAdmin',export:'viewExport'};

function sb(){return window.supabase&&window.supabase.from?window.supabase:null;}
function q(p){return Promise.resolve(p).then(function(r){if(!r||r.error)throw (r&&r.error)||new Error('read failed');return r.data;});}

function start(uid){
  var c=sb();if(!c||!real)return Promise.reject(new Error('Not ready'));
  return Promise.all([
    q(c.from('users').select('id,full_name,email,role,active').eq('id',uid).single()),
    q(c.from('user_packhouse_access').select('packhouse_id').eq('user_id',uid)).catch(function(){return null;}),
    q(c.from('shipments_v2_editors').select('user_id,revoked_at').eq('user_id',uid)).catch(function(){return null;})
  ]).then(function(r){
    var p=r[0];
    var ph=ALL_ACCESS[p.role]?['All']:((r[1]||[]).map(function(x){return x.packhouse_id;}));
    var editor=!!(r[2]||[]).some(function(x){return !x.revoked_at;});
    var user={id:p.id,name:p.full_name,email:p.email,role:p.role,active:p.active,packhouses:ph};
    var s={by:real.id,byName:real.name,user:user,editor:editor,editorKnown:r[2]!==null,rights:rightsFor(p,editor),at:Date.now()};
    save(s);
    /* stay on the current page only if this user can open it */
    var v=(location.hash||'').slice(1)||'home',perm=VIEW_PERM[v],R=window.ROLES&&window.ROLES[p.role];
    if(perm&&!(R&&R.perms&&R.perms[perm]))location.hash='home';
    location.reload();
  });
}
function exit(){save(null);location.reload();}

/* ---- UI ---- */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function css(){
  if(document.getElementById('vas-css'))return;
  var s=document.createElement('style');s.id='vas-css';
  s.textContent=
    '.vas-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9990;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);box-sizing:border-box;'+
      'background:#2b1d4a;color:#fff;border-radius:999px;padding:6px 6px 6px 14px;font:500 12.5px var(--font-body,"Instrument Sans",system-ui,sans-serif);box-shadow:0 8px 28px rgba(0,0,0,.28)}'+
    '.vas-bar.idle{padding:0;background:none;box-shadow:none}'+
    '.vas-bar b{font-weight:700}.vas-bar .vas-sub{opacity:.75;white-space:nowrap}'+
    '.vas-bar .vas-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.vas-btn{font:600 12px var(--font-body,"Instrument Sans",system-ui,sans-serif);border:0;border-radius:999px;padding:6px 12px;cursor:pointer;background:#fff;color:#2b1d4a;white-space:nowrap}'+
    '.vas-btn.ghost{background:rgba(255,255,255,.14);color:#fff}'+
    '.vas-bar.idle .vas-btn{background:#2b1d4a;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25)}'+
    '.vas-btn:focus-visible{outline:2px solid #c9b6ff;outline-offset:2px}'+
    '.vas-scrim{position:fixed;inset:0;z-index:9995;background:rgba(26,26,23,.42);display:flex;align-items:center;justify-content:center;padding:16px}'+
    '.vas-box{width:100%;max-width:440px;max-height:80vh;display:flex;flex-direction:column;background:#fff;color:#1a1a17;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:20px;gap:10px;box-sizing:border-box;font-family:var(--font-body,"Instrument Sans",system-ui,sans-serif)}'+
    '.vas-box h2{margin:0;font:400 22px var(--font-display,"DM Serif Display",serif)}'+
    '.vas-box p{margin:0;font-size:12.5px;line-height:1.5;color:#4a4840}'+
    '.vas-box input{font:inherit;font-size:14px;padding:8px 10px;border:1px solid #bcb8ae;border-radius:6px;outline:none}'+
    '.vas-box input:focus{border-color:#2b5c3f}'+
    '.vas-list{overflow:auto;border:1px solid #e3dfd4;border-radius:8px;min-height:120px}'+
    '.vas-row{display:flex;justify-content:space-between;gap:10px;align-items:center;width:100%;text-align:left;font:inherit;font-size:13.5px;background:none;border:0;border-bottom:1px solid #eeebe3;padding:9px 11px;cursor:pointer;color:inherit}'+
    '.vas-row:hover,.vas-row:focus-visible{background:#f3f0fa;outline:none}'+
    '.vas-role{font-size:11px;color:#6b675b;white-space:nowrap}'+
    '.vas-msg{font-size:12.5px;color:#6b675b;padding:12px}'+
    '.vas-err{font-size:12.5px;color:#9a2525}'+
    '.vas-foot{display:flex;justify-content:flex-end}'+
    '.vas-close{font:600 13px inherit;background:none;border:1px solid #d0cbbe;border-radius:8px;padding:7px 14px;cursor:pointer}'+
    '.vas-toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:9996;max-width:min(460px,calc(100vw - 32px));background:#2b1d4a;color:#fff;border-radius:10px;padding:10px 14px;font:500 12.5px var(--font-body,system-ui,sans-serif);box-shadow:0 8px 24px rgba(0,0,0,.25)}'+
    '@media(max-width:700px){.vas-bar .vas-sub{display:none}}';
  document.head.appendChild(s);
}
function toast(msg){
  if(!document.body)return;css();
  if(!toastEl){toastEl=document.createElement('div');toastEl.className='vas-toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);}
  toastEl.textContent=msg;toastEl.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(function(){toastEl.hidden=true;},4200);
}
function roleLabel(r){var R=window.ROLES&&window.ROLES[r];return R&&R.label||r||'';}

function drawBar(){
  if(!document.body)return;
  var show=real&&real.role==='admin';
  if(!show){if(bar){bar.remove();bar=null;}return;}
  css();
  if(!bar){bar=document.createElement('div');bar.className='vas-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','View Vision as');document.body.appendChild(bar);
    bar.addEventListener('click',function(e){var a=e.target.closest('[data-vas]');if(!a)return;var k=a.getAttribute('data-vas');if(k==='pick')openPicker();else if(k==='exit')exit();});}
  if(active()){
    var u=state.user,r=state.rights||{};
    var manage=u.role==='admin'||(window.ROLES&&window.ROLES[u.role]&&window.ROLES[u.role].perms&&window.ROLES[u.role].perms.editShipments);
    var sub=roleLabel(u.role)+(manage?' · Manage: '+(r.can_suggest?'editor':'no save rights'):'')+' · saving is off';
    bar.className='vas-bar';
    bar.innerHTML='<span class="vas-txt">Viewing as <b>'+esc(u.name)+'</b> <span class="vas-sub">'+esc(sub)+'</span></span>'+
      '<button type="button" class="vas-btn ghost" data-vas="pick">Switch…</button><button type="button" class="vas-btn" data-vas="exit">Exit</button>';
  }else{
    bar.className='vas-bar idle';
    bar.innerHTML='<button type="button" class="vas-btn" data-vas="pick" title="Staging only: see Vision as another user (nothing is saved)">View Vision as…</button>';
  }
}

function openPicker(){
  var c=sb();if(!c)return;css();
  var scrim=document.createElement('div');scrim.className='vas-scrim';
  scrim.innerHTML='<div class="vas-box" role="dialog" aria-modal="true" aria-labelledby="vas-h"><h2 id="vas-h">View Vision as…</h2>'+
    '<p>Vision reloads with this person’s role, packhouses and Manage rights. Saving is off while you look. You still see the data your own login can read.</p>'+
    '<input type="search" placeholder="Search name, email or role" aria-label="Search users">'+
    '<div class="vas-list" role="listbox"><div class="vas-msg">Loading users…</div></div><div class="vas-err" role="alert"></div>'+
    '<div class="vas-foot"><button type="button" class="vas-close">Cancel</button></div></div>';
  document.body.appendChild(scrim);
  var inp=scrim.querySelector('input'),list=scrim.querySelector('.vas-list'),err=scrim.querySelector('.vas-err'),users=[];
  function close(){document.removeEventListener('keydown',onKey,true);scrim.remove();}
  function onKey(e){if(e.key==='Escape'){e.stopPropagation();close();}}
  document.addEventListener('keydown',onKey,true);
  scrim.addEventListener('click',function(e){if(e.target===scrim||e.target.classList.contains('vas-close'))close();});
  function paint(){
    var t=inp.value.trim().toLowerCase();
    var rows=users.filter(function(u){return u.id!==real.id&&(!t||(u.full_name+' '+(u.email||'')+' '+u.role+' '+roleLabel(u.role)).toLowerCase().indexOf(t)>=0);});
    list.innerHTML=rows.length?'':'<div class="vas-msg">No matching active users.</div>';
    rows.forEach(function(u){var b=document.createElement('button');b.type='button';b.className='vas-row';b.setAttribute('role','option');
      var n=document.createElement('span');n.textContent=u.full_name||u.email;var r=document.createElement('span');r.className='vas-role';r.textContent=roleLabel(u.role);
      b.appendChild(n);b.appendChild(r);
      b.addEventListener('click',function(){err.textContent='';list.innerHTML='<div class="vas-msg">Opening Vision as '+esc(u.full_name)+'…</div>';
        start(u.id).catch(function(e){err.textContent='Could not load this user: '+((e&&e.message)||'error');paint();});});
      list.appendChild(b);});
  }
  inp.addEventListener('input',paint);
  q(c.from('users').select('id,full_name,email,role,active').eq('active',true).order('full_name')).then(function(d){users=d||[];paint();inp.focus();},
    function(e){list.innerHTML='';err.textContent='Could not load users: '+((e&&e.message)||'error');});
}

window.VisionViewAs={
  /* called by vision.js App on every render with the real signed-in user; returns the previewed user or null */
  userFor:function(u){
    var was=real&&real.id+'|'+real.role;real=u||null;
    if(was!==(real&&real.id+'|'+real.role))setTimeout(drawBar,0);
    if(state&&real&&state.by!==real.id){state=null;save(null);setTimeout(drawBar,0);}   /* another person signed in: drop it */
    return active()?state.user:null;
  },
  active:active,
  exit:exit
};
})();
