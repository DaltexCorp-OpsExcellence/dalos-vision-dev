/* ═══════════════════════════════════════════════════════════════════════════════════════
   DalOS Vision — PIVOTS line (Potatoes) module
   Loaded by index.html before the main script. Everything potato-specific lives HERE, so a
   potato fix is a commit to this file only — index.html (Orchards: grapes, citrus, mango,
   pomegranate) is never touched.
   index.html only keeps small generic hooks that hand potatoes over to window.Pivots:
     · App config load      → Pivots.bootstrapConfig(cfg)
     · FGView listing        → Pivots.listing.*  (KPI tile, columns, detail panel)
     · FGView New/Edit form  → Pivots.InspectionForm
     · App addBatch (Save)   → Pivots.save(newBatch, ctx)
     · Escalation Review     → Pivots.EscalationSummary
   This file uses Vision's shared globals (ce, useState, supabase, Typeahead, jsPDF helpers…)
   at call time; it defines no globals except window.Pivots.
   PivotsInspectionForm started as a copy of the Vision inspection form (staging c25f41d); its
   orchards-only branches were removed mechanically (cropId is always 'potatoes' here), so what
   is left is the code that actually runs for potatoes.
   ═══════════════════════════════════════════════════════════════════════════════════════ */
(function(){

try{
/* ── styles (potato header groups) ─────────────────────────────────────────────────────── */
(function(){var st=document.createElement('style');st.id='pivots-css';st.textContent=`
.hdr-grp{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.09em;color:var(--text2);margin:4px 0 8px;padding-top:10px;border-top:1px solid var(--border)}
.grid4>.pt-s2{grid-column:span 2}
.pt-pair{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:8px}
.pt-pair .form-field{margin-bottom:0}
.pt-rm{background:none;border:0;cursor:pointer;color:var(--text3);font-size:11px;padding:0;text-transform:none;letter-spacing:0}
.pt-addtile-wrap{display:flex;align-items:flex-end}
.pt-addtile{width:100%;min-height:38px;border:1.5px dashed var(--border2);border-radius:6px;background:transparent;color:var(--accent);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer}
.pt-addtile:hover{border-color:var(--accent);background:var(--green-bg)}
.pt-seg{display:flex;border:1px solid var(--border2);border-radius:6px;overflow:hidden;min-height:38px;background:var(--card)}
.pt-seg button{flex:1;border:0;background:transparent;font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;padding:0 8px}
.pt-seg button+button{border-left:1px solid var(--border2)}
.pt-seg button.on{background:var(--accent);color:#fff}
.pt-seg button.on.bad{background:var(--red)}
.pt-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-height:38px}
.pt-chip{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--border2);border-radius:6px;background:var(--card);padding:2px 2px 2px 6px}
.pt-chip select{border:0;background:transparent;font-size:13px;color:var(--text);font-family:var(--font-body)}
.pt-chip button{border:0;background:none;cursor:pointer;color:var(--text3);font-size:16px;line-height:1;padding:2px 6px}
.pt-add{border:1px dashed var(--border2);background:transparent;border-radius:6px;color:var(--accent);font-family:var(--font-body);font-size:12px;font-weight:600;padding:6px 10px;cursor:pointer}
.pt-seg button:focus-visible,.pt-addtile:focus-visible,.pt-add:focus-visible,.pt-chip button:focus-visible,.pt-rm:focus-visible{outline:2px solid var(--accent2);outline-offset:-2px}
@media(max-width:767px){.grid4>.pt-s2{grid-column:1/-1}.pt-seg{min-height:44px}.pt-addtile{min-height:44px}.pt-add{min-height:44px;padding:0 14px}.pt-chip{min-height:44px}.pt-chip button{min-width:36px;min-height:40px}}`;(document.head||document.documentElement).appendChild(st);})();

/* ─── POTATOES (Pivots line) — reference lists ───────────────────────────────────────────
   Client-side until the potato DB part is approved (defect sections/defects, varieties and
   these lists are not in the database yet). ptApplyBootstrap() only fills a gap: as soon as
   the DB has potato defects / varieties they win and these constants are ignored.
   Values come from the فحص الصادر sheet (spellings merged). */
var PT_DEFECT_SECTIONS=[
  {section:'Rots',sectionAr:'الأعفان',color:'#b03030',display_order:1,items:[
    {key:'pt_hollow_heart',en:'Hollow heart',ar:'قلب اجوف',sev:'Major',thresh:0.5},
    {key:'pt_early_blight',en:'Early blight',ar:'ندوة مبكرة',sev:'Major',thresh:0.5},
    {key:'pt_late_blight',en:'Late blight',ar:'ندوة متاخرة',sev:'Major',thresh:0.5},
    {key:'pt_fusarium',en:'Fusarium dry rot',ar:'عفن جاف',sev:'Major',thresh:0.5},
    {key:'pt_mothers',en:'Mother tubers',ar:'امهات',sev:'Major',thresh:0.5},
    {key:'pt_soft_rot',en:'Soft rot',ar:'عفن طرى',sev:'Major',thresh:0.5},
    {key:'pt_white_rot',en:'White rot',ar:'عفن ابيض',sev:'Major',thresh:0.5},
    {key:'pt_brown_rot',en:'Brown rot',ar:'عفن بني',sev:'Major',thresh:0.5},
    {key:'pt_gelatin_rot',en:'Gelatinous rot',ar:'عفن جيلاتينى',sev:'Major',thresh:0.5},
    {key:'pt_black_leg',en:'Black leg',ar:'ساق سوداء',sev:'Major',thresh:0.5}
  ]},
  {section:'Skin',sectionAr:'عيوب القشرة',color:'#b87820',display_order:2,items:[
    {key:'pt_tuber_moth',en:'Tuber moth',ar:'فراشة',sev:'Critical',thresh:0},
    {key:'pt_common_scab',en:'Common scab',ar:'جرب عادى',sev:'Minor',thresh:3},
    {key:'pt_powdery_scab',en:'Powdery scab',ar:'جرب مسحوقى',sev:'Minor',thresh:3},
    {key:'pt_rhizoctonia',en:'Rhizoctonia',ar:'ريزوكتونيا',sev:'Minor',thresh:3},
    {key:'pt_greening',en:'Greening',ar:'اخضرار',sev:'Minor',thresh:3},
    {key:'pt_insect',en:'Insect injury',ar:'اصابات حشرية',sev:'Minor',thresh:3},
    {key:'pt_growth_cracks',en:'Growth cracks',ar:'تشقق نمو',sev:'Minor',thresh:3},
    {key:'pt_variety_mix',en:'Variety mix',ar:'خلط اصناف',sev:'Minor',thresh:3},
    {key:'pt_grass_roots',en:'Grass roots',ar:'نجيلة',sev:'Minor',thresh:3},
    {key:'pt_virus',en:'Virus',ar:'فيروس',sev:'Minor',thresh:3},
    {key:'pt_nematodes',en:'Nematodes',ar:'نيماتودا',sev:'Minor',thresh:3},
    {key:'pt_sunburn',en:'Sun hit',ar:'لسعة شمس',sev:'Minor',thresh:3},
    {key:'pt_softness',en:'Softness',ar:'ليونه',sev:'Minor',thresh:3},
    {key:'pt_silver_scurf',en:'Silver scurf',ar:'قشرة فضية',sev:'Minor',thresh:3},
    {key:'pt_secondary_growth',en:'Secondary growth',ar:'نموات ثانوية',sev:'Minor',thresh:3},
    {key:'pt_mech',en:'Mechanical damage & bruising',ar:'تلف ميكانيكي-كدمات',sev:'Minor',thresh:3},
    {key:'pt_abrasions',en:'Abrasions',ar:'تسلخات',sev:'Minor',thresh:3}
  ]},
  {section:'Size',sectionAr:'الأحجام',color:'#2a50c0',display_order:3,items:[
    {key:'pt_oversize',en:'Oversize',ar:'احجام اكبر',sev:'Minor',thresh:10},
    {key:'pt_undersize',en:'Undersize',ar:'احجام اقل',sev:'Minor',thresh:10}
  ]}
];
var PT_VARIETIES=['Santana','Spunta','Lilly','Lady Rosetta','Jelly','Mondial','Karelia','Marisper','Almundo','Safiya','El Dorado','Princess','Larisa','Bellini','Hermes','Karosa'];
/* kg = nominal weight for the bag-weight check (null = no check, e.g. big bags in tonnes) */
var PT_BAG_TYPES=[{name:'25 kg bag',kg:25},{name:'10 kg bag',kg:10},{name:'15 kg bag',kg:15},{name:'30 kg bag',kg:30},{name:'12 kg bag',kg:12},{name:'5 kg bag',kg:5},{name:'4 kg bag',kg:4},{name:'2.5 kg bag',kg:2.5},{name:'Big bag',kg:null}];
var PT_SIZE_GRADES=['0/45','20/40','20/45','20/60','35/45','35/90','35+','38/60','40/60','40/90','40+','45/60','45/70','45/80','45+','50/70','50/75','50/80','50+','55/70','55/80','55+','60+'];
var PT_OUTCOMES=['Shipped as is','Floor re-grade','Re-worked','Field export','Rejected','Exception'];
var PT_OUTCOME_AR={'Shipped as is':'شحن كما هو','Floor re-grade':'تشغيل أرضى','Re-worked':'تم التدوير','Field export':'صادر حقلي','Rejected':'مرفوض','Exception':'استثناء'};
/* الشحن grade bands — on the LOT (bag averages): A rots<0.5 & skin<3 · B rots≤1 & skin≤10 · C above */
function ptGrade(rots,skin){rots=+rots||0;skin=+skin||0;return (rots<0.5&&skin<3)?'A':(rots<=1&&skin<=10)?'B':'C';}
function ptBagKg(name){var b=PT_BAG_TYPES.find(function(x){return x.name===name;});return b?b.kg:null;}
/* Section helpers work on a {defect_key: value} map (one bag, or a lot average) */
function ptSectionTotal(defs,sectionName,sections){var sec=(sections||PT_DEFECT_SECTIONS).find(function(s){return s.section===sectionName;});if(!sec)return 0;return sec.items.reduce(function(t,d){return t+(parseFloat((defs||{})[d.key])||0);},0);}
function ptApplyBootstrap(cfg){
  try{
    /* Bag types (+ nominal kg), size grades and outcomes come from products.specifics (potatoes):
       the database wins; the constants above are only a fallback if it is empty. */
    var sp=((cfg.products||[]).find(function(p){return p.id==='potatoes';})||{}).specifics||{};
    if(Array.isArray(sp.package_type)&&sp.package_type.length){var kg=sp.bag_kg||{};PT_BAG_TYPES=sp.package_type.map(function(n){return {name:n,kg:Object.prototype.hasOwnProperty.call(kg,n)?kg[n]:null};});}
    if(Array.isArray(sp.size_grade)&&sp.size_grade.length) PT_SIZE_GRADES=sp.size_grade.slice();
    if(Array.isArray(sp.outcome)&&sp.outcome.length) PT_OUTCOMES=sp.outcome.slice();
    var ds=cfg.defectSections||{};
    if(!Array.isArray(ds)&&!(ds.potatoes&&ds.potatoes.length)){ds=Object.assign({},ds,{potatoes:PT_DEFECT_SECTIONS});cfg.defectSections=ds;}
    var vf=Object.assign({},cfg.varietiesFull||{});
    if(!(vf.potatoes&&vf.potatoes.length)){
      vf.potatoes=PT_VARIETIES.map(function(n){return {id:'pt:'+n,name:n,categoryId:null};});
      cfg.varietiesFull=vf;
      cfg.varieties=Object.assign({},cfg.varieties||{},{potatoes:PT_VARIETIES.slice()});
    }
    /* STAGING ONLY: Test Packhouse handles Potatoes (no DB change — Tarek 2026-10-06). */
    var href=(typeof window!=='undefined'&&window.location&&window.location.href)||'';
    if(href.indexOf('dalos-vision-dev')>-1||href.indexOf('localhost')>-1){
      cfg.packhouses=(cfg.packhouses||[]).map(function(p){
        var isTest=(p.initials==='TP')||/^test packhouse$/i.test(p.name||'');
        if(isTest&&(p.crops||[]).indexOf('potatoes')<0) return Object.assign({},p,{crops:(p.crops||[]).concat(['potatoes'])});
        return p;
      });
    }
  }catch(e){console.warn('[DalOS] potato bootstrap skipped:',e&&e.message);}
  return cfg;
}

/* ── inspection form (New / Edit) ───────────────────────────────────────────────────────── */
function PivotsInspectionForm(props){
  var onClose=props.onClose, batch=props.batch||null;
  var packhouse=props.packhouse||{name:'—',id:'—',color:'#2b5c3f'};
  var cropId=props.cropId||'citrus';
  var isPT=cropId==='potatoes'; /* Pivots line — sampled bags, no pallet layer */
  var config=props.config||INITIAL_CONFIG;
  var allBatches=props.batches||[];
  var isEdit=!!batch;

  /* ── Land Cloud plot picker (citrus prototype) ── pull ACTIVE plot codes per farm
     from farm_blocks (shared farms table = same farm_id Vision writes). Plot fields
     then offer the chosen farm's registered plots, but stay free-type (allowFree) for
     farms/plots not yet in Land Cloud. One tiny RPC call per form open. */
  var sPlotsByFarm=useState({}); var plotsByFarm=sPlotsByFarm[0]; var setPlotsByFarm=sPlotsByFarm[1];
  React.useEffect(function(){
    return;
    var cancelled=false;
    supabase.rpc('get_farm_plots',{p_product_id:'citrus'}).then(function(r){
      if(cancelled||r.error||!r.data) return;
      var m={}; r.data.forEach(function(row){ (m[row.farm_id]=m[row.farm_id]||[]).push(row.plot_code); });
      setPlotsByFarm(m);
    });
    return function(){cancelled=true;};
  },[cropId]);
  /* Farm plot alias — some farms are the same physical location registered under a
     different name in Land Cloud. Selecting the "mask" farm surfaces the aliased
     farm's plots too (combined). Non-destructive: purely a client-side plot-lookup
     merge; Land Cloud farm_blocks and the farms table are untouched. */
  var PLOT_ALIAS_BY_NAME={ 'Hana':['Badr'] }; /* pick Hana -> show Hana + Badr plots */
  
  

  /* Guard: saving into a season that isn't the current active one prompts a confirm. */
  var sSeasonConfirm=useState(null); var seasonConfirm=sSeasonConfirm[0]; var setSeasonConfirm=sSeasonConfirm[1];
  var seasonConfirmedRef=React.useRef(false);

  /* Warn before browser navigation while form is open */
  React.useEffect(function(){
    var handler=function(e){e.preventDefault();e.returnValue='';return '';};
    window.addEventListener('beforeunload',handler);
    return function(){window.removeEventListener('beforeunload',handler);};
  },[]);

  /* ── Form presence — show who else has this form open ── */
  var sPresence=useState([]); var otherUsers=sPresence[0]; var setOtherUsers=sPresence[1];
  React.useEffect(function(){
    if(!isEdit||!batch||!batch.id) return;
    var inspId=batch.id;
    var uid=props.currentUser&&(props.currentUser.id||props.currentUser.userId);
    var uname=(props.currentUser&&props.currentUser.name)||'Unknown';
    if(!uid) return;
    supabase.from('form_presence').upsert({inspection_id:inspId,user_id:uid,user_name:uname,last_seen:new Date().toISOString()},{onConflict:'inspection_id,user_id'}).then(function(){});
    var hb=setInterval(function(){
      supabase.from('form_presence').update({last_seen:new Date().toISOString()}).eq('inspection_id',inspId).eq('user_id',uid).then(function(){});
    },30000);
    var fetchOthers=function(){
      var cutoff=new Date(Date.now()-90000).toISOString();
      supabase.from('form_presence').select('user_id,user_name,last_seen').eq('inspection_id',inspId).gt('last_seen',cutoff).then(function(r){
        if(r.data) setOtherUsers(r.data.filter(function(u){return u.user_id!==uid;}));
      });
    };
    fetchOthers();
    var chan=supabase.channel('presence:'+inspId)
      .on('postgres_changes',{event:'*',schema:'public',table:'form_presence',filter:'inspection_id=eq.'+inspId},function(){fetchOthers();})
      .subscribe();
    return function(){
      clearInterval(hb);
      try{supabase.removeChannel(chan);}catch(e){}
      supabase.from('form_presence').delete().eq('inspection_id',inspId).eq('user_id',uid).then(function(){});
    };
  },[]);
  /* ── Dirty tracking + draft — must be first so setIsDirty is in scope ── */
  var sIsDirty=useState(false); var isDirty=sIsDirty[0]; var setIsDirty=sIsDirty[1];
  useVisionCrumbGuard(function(){return {isDirty:isDirty,draftKey:draftKey};}); /* leaving via the path asks about unsaved changes */
  /* User edits mark the form dirty (drives autosave + leave warning). Programmatic loads — draft restore,
     LOT prefill, edit-load, New-LOT reset — keep using the raw setters so they don't. */
  function markDirty(){setIsDirty(true);}
  /* A sample's saved farm/plot stays VISIBLE even when it is no longer one of the header farms/plots
     (changing a header farm used to blank the sample on screen while the DB kept the old value, inviting
     an accidental overwrite). Shown as "<name> (not in header)". */
  /* same idea for carton companies (sample / pallet dropdowns blanked after the header company changed) */
  
  
  /* Track when this form was first opened — used for draft_started_at + completion_minutes audit fields */
  var formOpenedAtRef=React.useRef(new Date());
  /* Unique tab ID — ensures parallel tabs don't overwrite each other's draft */
  var tabId=React.useRef((function(){
    try{
      var k='dalos_tab_id';
      var t=sessionStorage.getItem(k);
      if(!t){t=Math.random().toString(36).slice(2,7);sessionStorage.setItem(k,t);}
      return t;
    }catch(e){return Math.random().toString(36).slice(2,7);}
  })()).current;
  var draftKey='dalos_draft_'+(packhouse.id||'')+'_'+cropId+(isEdit&&batch?'_'+batch.id:'_new')+'_'+tabId;
  /* Stable UUID for this form instance — used to upsert a single Supabase draft row.
     Stored in sessionStorage so "Add more pallets" continuation reuses the same row. */
  var sDraftSavedAt=useState(null); var draftSavedAt=sDraftSavedAt[0]; var setDraftSavedAt=sDraftSavedAt[1];
  var sDraftFail=useState(false); var draftSyncFailed=sDraftFail[0]; var setDraftSyncFailed=sDraftFail[1];
  /* draftId is unique per form instance:
     - Edit mode: keyed by batch.id → each inspection gets its own draft row, even across tabs
     - New inspection: keyed by tabId → each tab gets its own draft row, never overwrites another tab */
  var draftIdRef=React.useRef((function(){
    try{
      var suffix=isEdit&&batch?('_edit_'+batch.id):('_new_'+tabId);
      var k='dalos_draftid_'+(packhouse.id||'')+'_'+(cropId||'grapes')+suffix;
      var t=sessionStorage.getItem(k);
      if(!t){
        t=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():(Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2));
        sessionStorage.setItem(k,t);
      }
      return t;
    }catch(e){return Math.random().toString(36).slice(2);}
  })());
  /* FIX 1+2: When restoring a draft in edit mode, apply header fields from the snapshot.
     Pallets are handled by initPallets above. Header fields need a useEffect since
     they're initialized from batch (DB state) which takes priority in useState. */
  React.useEffect(function(){
    var rd=props.recoveryDraft;
    if(!rd||!isEdit) return; /* only needed for edit-mode recovery */
    /* Apply draft header overrides — snapshot values replace DB-loaded batch values */
    /* FIX (draft-restore): these header fields were previously OMITTED here, so on
       edit-mode recovery they silently reverted to the DB (batch) value instead of the
       draft's edited value — most visibly LOT came back as the old DB lot. Restore them
       from the snapshot too. Raw setters (no setIsDirty side-effect) to match the rest. */
    if(rd.lot!==undefined) setLotRaw(rd.lot);
    if(rd.date!==undefined) setDateRaw(rd.date);
    if(rd.additionalFarms!==undefined) setAdditionalFarms(rd.additionalFarms);
    if(rd.farm3!==undefined) setFarm3(rd.farm3);
    if(rd.farm4!==undefined) setFarm4(rd.farm4);
    if(rd.plot3!==undefined) setPlot3(rd.plot3);
    if(rd.plot4!==undefined) setPlot4(rd.plot4);
    if(rd.cartonCompany2!==undefined) setCartonCompany2(rd.cartonCompany2);
    if(rd.importer!==undefined) setImporter(rd.importer);
    if(rd.importerAddr!==undefined) setImporterAddr(rd.importerAddr);
    if(rd.stickerImg!==undefined) setStickerImg(rd.stickerImg);
    if(rd.variety!==undefined) setVariety(rd.variety);
    if(rd.variety2!==undefined) setVariety2(rd.variety2);
    if(rd.varietyType) setVarietyType(rd.varietyType);
    if(rd.category!==undefined) setCategory(rd.category);
    if(rd.category2!==undefined) setCategory2(rd.category2);
    if(rd.client!==undefined) setClient(rd.client);
    if(rd.country!==undefined) setCountry(rd.country);
    if(rd.farm!==undefined) setFarm(rd.farm);
    if(rd.farm2!==undefined) setFarm2(rd.farm2);
    if(rd.plot!==undefined) setPlot(rd.plot);
    if(rd.plot2!==undefined) setPlot2(rd.plot2);
    if(rd.container!==undefined) setContainer(rd.container);
    if(rd.cls!==undefined) setCls(rd.cls);
    if(rd.wax!==undefined) setWax(rd.wax);
    if(rd.packing!==undefined) setPacking(rd.packing);
    if(rd.labelling!==undefined) setLabelling(rd.labelling);
    if(rd.cartonType!==undefined) setCartonType(rd.cartonType);
    if(rd.cartonColor!==undefined) setCartonColor(rd.cartonColor);
    if(rd.cartonCompany!==undefined) setCartonCompany(rd.cartonCompany);
    if(rd.traceCodes&&rd.traceCodes.length) setTraceCodes(rd.traceCodes);
    if(rd.ggn!==undefined) setGGN(rd.ggn);
    if(rd.phCode!==undefined) setPHCode(rd.phCode);
    if(rd.farmCode!==undefined) setFarmCode(rd.farmCode);
    if(rd.netWt!==undefined) setNetWt(rd.netWt);
    if(rd.decision) setDecision(rd.decision);
    if(rd.extraVarieties) setExtraVarieties(rd.extraVarieties);
    if(rd.outcome!==undefined) setOutcome(rd.outcome);
    console.log('[DalOS] Draft applied to edit-mode form —',Object.keys(rd).length,'fields restored');
  },[]); /* empty deps: run once on mount */
  /* FIX: restore the label checklist + extra labels from a recovered draft, in BOTH new and
     edit mode. Previously omitted from recovery, so a recovered session reverted the checklist
     to empty and a later save persisted it as all-unverified. */
  React.useEffect(function(){
    var rd=props.recoveryDraft;
    if(!rd) return;
    if(rd.stickerChecks) setStickerChecks(rd.stickerChecks);
    if(rd.extraLabels) setExtraLabels(rd.extraLabels);
  },[]);
  function safeClose(){
    if(isDirty&&!window.confirm('You have unsaved changes. Leave without saving?')) return;
    try{localStorage.removeItem(draftKey);}catch(e){}
    onClose();
  }
  /* Snapshot lives in a ref, rebuilt every render, so the autosave always writes
     CURRENT values. Previously the snapshot was built inside the interval closure
     and the effect depended on a hand-maintained field list — any field missing
     from that list was captured stale, and because the interval was torn down and
     recreated on every keystroke it only ever fired after 30s of inactivity. The
     draft written could therefore be older than what the inspector had typed, and
     on a remount the form re-initialises from that draft — which is how a filled
     header came back blank on staging. */
  var snapRef=React.useRef(null);

  React.useEffect(function(){
    if(!isDirty) return;
    var timer=setInterval(function(){
      /* ── localStorage snapshot (existing) ── */
      try{
        var snap=Object.assign({},snapRef.current,{ts:Date.now()});
        /* Never persist an empty draft over a real one — see dalosDraftHasContent. */
        if(!dalosDraftHasContent(snap)) return;
        localStorage.setItem(draftKey,JSON.stringify(snap));
      }catch(e){}
      /* ── Supabase save_drafts upsert (fire-and-forget) ── */
      try{
        var uid=props.currentUser&&(props.currentUser.id||props.currentUser.userId);
        if(uid&&draftIdRef.current){
          supabase.from('save_drafts').upsert({
            id:draftIdRef.current,
            user_id:uid,
            packhouse_id:packhouse.id||'',
            product_id:cropId||'grapes',
            inspection_id:grpSessionId||null,
            snapshot:snap,
            last_autosaved_at:new Date().toISOString()
          },{onConflict:'id'}).then(function(r){
            if(r.error){
              console.warn('[DalOS] Autosave to Supabase failed:',r.error.message);
              setDraftSyncFailed(true);
            } else {
              var t=new Date();
              var ts=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
              setDraftSavedAt(ts);
              setDraftSyncFailed(false);
              console.log('[DalOS] Autosave OK —',ts);
            }
          });
        }
      }catch(e){console.warn('[DalOS] Autosave error:',e);}
    },30000);
    return function(){clearInterval(timer);};
    /* Deps are intentionally just [isDirty]: the snapshot comes from snapRef, which
       is current on every render, so the interval no longer needs to be recreated
       when a field changes. It also means the timer actually fires every 30s while
       the inspector is typing, instead of being reset by each keystroke and only
       firing after 30s of stillness. */
  },[isDirty]);
  /* MOVED UP (was defined ~140 lines below): compute restoredDraft BEFORE _d so that
     _d — and every useState() default that reads _d — actually sees the recovered
     draft. Previously restoredDraft was declared later, so at this point it was
     undefined (var-hoisted), _d became {}, and fields like LOT restored blank. */
  /* Decided ONCE at mount. It used to be re-read from localStorage on every render, so after the first
     30s autosave a brand-new form suddenly showed "Draft recovered" (seen by all QA agents). */
  var _restoredDraftRef=React.useRef(undefined);
  var sDraftBanner=useState(true); var showDraftBanner=sDraftBanner[0]; var setShowDraftBanner=sDraftBanner[1];
  if(_restoredDraftRef.current===undefined) _restoredDraftRef.current=(function(){
    if(props.recoveryDraft) return props.recoveryDraft;
    if(isEdit) return null;
    try{
      var raw=localStorage.getItem(draftKey);
      if(!raw) return null;
      var d=JSON.parse(raw);
      if(!d.ts||Date.now()-d.ts>86400000){localStorage.removeItem(draftKey);return null;}
      return d;
    }catch(e){return null;}
  })()||null;
  var restoredDraft=_restoredDraftRef.current;
  var _d=restoredDraft||{};
  var sf=useState(batch?batch.date:(_d.date||new Date().toISOString().slice(0,10))); var date=sf[0]; var setDateRaw=sf[1];
  function setDate(v){setDateRaw(v);setIsDirty(true);}
  var sCat=useState(batch?batch.category||'':(_d.category||'')); var category=sCat[0]; var setCategory=sCat[1];  var sv=useState(batch?batch.variety:(_d.variety||'')); var variety=sv[0]; var setVariety=sv[1];
  var sVT=useState(batch?batch.varietyType||'single':(_d.varietyType||'single')); var varietyType=sVT[0]; var setVarietyType=sVT[1];
  var sCat2=useState(batch?batch.category2||'':(_d.category2||'')); var category2=sCat2[0]; var setCategory2=sCat2[1];
  var sV2=useState(batch?batch.variety2||'':(_d.variety2||'')); var variety2=sV2[0]; var setVariety2=sV2[1];
  var sc=useState(batch?batch.container:(_d.container||'')); var container=sc[0]; var setContainer=sc[1];
  var sl=useState(batch?batch.lot:(_d.lot||'')); var lot=sl[0]; var setLotRaw=sl[1];
  function setLot(v){setLotRaw(v);setIsDirty(true);}
  var scls=useState(batch?batch.cls:(_d.cls||'')); var cls=scls[0]; var setCls=scls[1];
  var scli=useState(batch?batch.client:(_d.client||'')); var client=scli[0]; var setClient=scli[1];
  var sco=useState(batch?batch.country:(_d.country||'')); var country=sco[0]; var setCountry=sco[1];
  var sfm=useState(batch?batch.farm:(_d.farm||'')); var farm=sfm[0]; var setFarm=sfm[1];
  var sPlot=useState(batch?batch.plot||'':(_d.plot||'')); var plot=sPlot[0]; var setPlot=sPlot[1];
  var sFarm2=useState(batch?batch.farm2||'':(_d.farm2||'')); var farm2=sFarm2[0]; var setFarm2=sFarm2[1];
  var sPlot2=useState(batch?batch.plot2||'':(_d.plot2||'')); var plot2=sPlot2[0]; var setPlot2=sPlot2[1];
  var sFarm3=useState(batch?batch.farm3||'':(_d.farm3||'')); var farm3=sFarm3[0]; var setFarm3=sFarm3[1];
  var sPlot3=useState(batch?batch.plot3||'':(_d.plot3||'')); var plot3=sPlot3[0]; var setPlot3=sPlot3[1];
  var sFarm4=useState(batch?batch.farm4||'':(_d.farm4||'')); var farm4=sFarm4[0]; var setFarm4=sFarm4[1];
  var sPlot4=useState(batch?batch.plot4||'':(_d.plot4||'')); var plot4=sPlot4[0]; var setPlot4=sPlot4[1];
  /* additional_farms: [{farmId:'uuid', farmName:'...', plot:'...'}, ...] */
  var sAddFarms=useState(batch?batch.additionalFarms||[]:(_d.additionalFarms||[])); var additionalFarms=sAddFarms[0]; var setAdditionalFarms=sAddFarms[1];
  var spk=useState(batch?batch.packing:(_d.packing||'')); var packing=spk[0]; var setPacking=spk[1];
  var slb=useState(batch?batch.labelling:(_d.labelling||('Ok'))); var labelling=slb[0]; var setLabelling=slb[1];
  var swx=useState(batch?batch.wax:(_d.wax||'')); var wax=swx[0]; var setWax=swx[1];
  var strace=useState((function(){var r=normTC(batch&&batch.traceCodes?batch.traceCodes:(batch&&batch.traceCode?[batch.traceCode]:[]));return r.length?r:[{code:'',variety:null}];})()); var traceCodes=strace[0]; var setTraceCodes=strace[1];
  var sdec=useState(batch?batch.decision:''); var decision=sdec[0]; var setDecision=sdec[1];
  /* A board decision (SA / SR) and a pending escalation survive an inspector edit — only an A or R
     the inspector picks changes the status (was: anything but R saved as 'Accepted'). */
  function decisionStatus(){if(decision==='SA')return 'Special Accept';if(decision==='SR')return 'Special Reject';if(decision==='R'&&batch&&batch.status==='Escalated')return 'Escalated';return decision==='R'?'Rejected':'Accepted';}
  function decisionText(){return decision==='SA'?'Special Accept':decision==='SR'?'Special Reject':decision==='A'?'Accepted':decision==='R'?'Rejected':'\u2014';}
  /* Potatoes: extra SINGLE varieties (whole bags of another variety in the same lot) + lot outcome */
  var sXV=useState(batch&&batch.extraVarieties?batch.extraVarieties:(_d.extraVarieties||[])); var extraVarieties=sXV[0]; var setExtraVarieties=sXV[1];
  var sOut=useState(batch?(batch.outcome||''):(_d.outcome||'')); var outcome=sOut[0]; var setOutcome=sOut[1];
  /* potatoes: last removed bag, so the inspector can undo a mis-tap ({pIdx,idx,row}) */
  var sPtUndo=useState(null); var ptUndo=sPtUndo[0]; var setPtUndo=sPtUndo[1];
  var ptUndoTimerRef=React.useRef(null);
  React.useEffect(function(){return function(){if(ptUndoTimerRef.current)clearTimeout(ptUndoTimerRef.current);};},[]);
  var sHL=useState(isEdit); var hdrLocked=sHL[0]; var setHdrLocked=sHL[1];
  /* The locked header uses pointerEvents:none, so clicks and typing are swallowed
     with no feedback — the fields still look editable. Inspectors (and I, twice
     while testing) type into a locked header, hit Save, and believe the change
     landed. This flag drives a transient "header is locked" hint when someone
     interacts with the locked block. */
  var sLockHint=useState(false); var lockHint=sLockHint[0]; var setLockHint=sLockHint[1];
  var lockHintTimerRef=React.useRef(null);
  function flashLockHint(){
    setLockHint(true);
    if(lockHintTimerRef.current) clearTimeout(lockHintTimerRef.current);
    lockHintTimerRef.current=setTimeout(function(){setLockHint(false);},6000);
  }
  React.useEffect(function(){return function(){if(lockHintTimerRef.current) clearTimeout(lockHintTimerRef.current);};},[]);
  var sGGN=useState(batch?batch.ggn||'':''); var ggn=sGGN[0]; var setGGN=sGGN[1];
  var sCC=useState(batch?batch.cartonColor||'':''); var cartonColor=sCC[0]; var setCartonColor=sCC[1];
  var sCCo=useState(batch?batch.cartonCompany||'':''); var cartonCompany=sCCo[0]; var setCartonCompany=sCCo[1];
  var sCCo2=useState(batch?batch.cartonCompany2||'':''); var cartonCompany2=sCCo2[0]; var setCartonCompany2=sCCo2[1];
  var sPHC=useState(batch?batch.phCode||'40.01.20.02/CIP':''); var phCode=sPHC[0]; var setPHCode=sPHC[1];
  var sFC=useState(batch?batch.farmCode||'':''); var farmCode=sFC[0]; var setFarmCode=sFC[1];
  var sNW=useState(batch?batch.netWt||'':''); var netWt=sNW[0]; var setNetWt=sNW[1];
  var sCT=useState(batch?batch.cartonType||'':''); var cartonType=sCT[0]; var setCartonType=sCT[1];
  var sImp=useState(batch?batch.importer||'':''); var importer=sImp[0]; var setImporter=sImp[1];
  var sIA=useState(batch?batch.importerAddr||'':''); var importerAddr=sIA[0]; var setImporterAddr=sIA[1];
  var sSI=useState(batch?batch.stickerImg||'':''); var stickerImg=sSI[0]; var setStickerImg=sSI[1];
  var sSIU=useState(false); var stickerUploading=sSIU[0]; var setStickerUploading=sSIU[1];
  /* Upload a sticker image file to Supabase Storage and return the public URL */
  function uploadStickerToStorage(file, inspectionId, callback) {
    setStickerUploading(true);
    var ext = (file.type||'').split('/')[1]||'jpg';
    ext = ext.replace('jpeg','jpg');
    /* Use inspectionId if available, otherwise a timestamp-based name */
    var name = (inspectionId||('sticker-'+Date.now())) + '.' + ext;
    supabase.storage.from('sticker-images').upload(name, file, {contentType:file.type, upsert:true})
      .then(function(res){
        setStickerUploading(false);
        if(res.error){ console.error('[DalOS] Sticker upload error:',res.error.message); return; }
        /* Cache-bust: the storage path is deterministic ({id}.ext) and upsert overwrites it,
           so re-uploads return an identical URL — the DB value wouldn't change and the
           browser/CDN would keep serving the cached OLD image. A per-upload version token
           gives a distinct URL each time so the new sticker persists AND displays fresh. */
        var url = supabase.storage.from('sticker-images').getPublicUrl(name).data.publicUrl + '?v=' + Date.now();
        callback(url);
      });
  }
  var sSC=useState(batch&&batch.stickerChecks?batch.stickerChecks:{product:false,variety:false,cls:false,phName:false,phCode:false,farmCode:false,packDate:false,netWt:false,trace:false,ggn:false,lot:false,importer:false,origin:false});
  var stickerChecks=sSC[0]; var setStickerChecks=sSC[1];
  
  /* Lazy-load this inspection's label-sticker checklist on edit-open. Sticker checks are no
     longer bulk-loaded with the list (that was an 8-page fetch); we pull just this one
     inspection's rows here — a single uncapped .eq query, fast even on a weak connection.
     Skipped for new inspections and when a recovery draft is present (the draft's checklist
     takes priority and is applied by the recovery effect above). */
  React.useEffect(function(){
    if(!isEdit||!batch||!batch.id||props.recoveryDraft) return;
    supabase.from('inspection_sticker_checks').select('field_key,confirmed').eq('inspection_id',batch.id)
      .then(function(r){
        if(r.error||!r.data||!r.data.length) return;
        setStickerChecks(function(prev){
          var sc=Object.assign({},prev);
          r.data.forEach(function(c){sc[c.field_key]=c.confirmed;});
          return sc;
        });
      });
  },[]);
  var totalChecks=Object.keys(stickerChecks).length;
  var doneChecks=Object.values(stickerChecks).filter(Boolean).length;

  /* ── Unit identity confirmation (4 fields inspectors must review when pre-filling from LOT) ── */
  var sUC=useState({container:!batch,variety:!batch,cls:!batch,farm:!batch});
  var unitConfirmed=sUC[0]; var setUnitConfirmed=sUC[1];
  var sUCWarn=useState(false); var unitConfirmWarn=sUCWarn[0]; var setUnitConfirmWarn=sUCWarn[1];
  var sPreFilled=useState(false); var preFilled=sPreFilled[0]; var setPreFilled=sPreFilled[1];
  function allUnitConfirmed(){return unitConfirmed.container&&unitConfirmed.variety&&(true)&&unitConfirmed.farm;}
  function confirmUnit(k){setUnitConfirmed(function(prev){var n=Object.assign({},prev);n[k]=true;return n;});setUnitConfirmWarn(false);}
  function resetUnitConfirmed(){setUnitConfirmed({container:false,variety:false,cls:false,farm:false});setPreFilled(false);setUnitConfirmWarn(false);}

  /* Pre-fill all fields from most recent unit under same LOT */
  function prefillFromLot(lotVal){
    if(!lotVal||!lotVal.trim()||isEdit) return;
    var existing=allBatches.filter(function(b){return (b.lot||'').trim()===lotVal.trim()&&b.packhouse===packhouse.id&&(b.crop||b.cropId||'citrus')===cropId;});
    if(existing.length===0) return;
    /* Sort by savedAt desc, fallback to date */
    var sorted=existing.slice().sort(function(a,b){
      var ta=a.savedAt||a.date||'';
      var tb=b.savedAt||b.date||'';
      return tb>ta?1:tb<ta?-1:0;
    });
    /* Prefer latest unit added by current user, fallback to latest in system */
    var currentUserId=props.currentUser&&(props.currentUser.id||props.currentUser.userId);
    var userUnits=currentUserId?sorted.filter(function(b){return b.createdBy===currentUserId;}):[];
    var src=userUnits.length>0?userUnits[0]:sorted[0];
    setContainer(src.container||'');
    setVariety(src.variety||'');
    setCls(src.cls||'');
    setFarm(src.farm||'');
    setPlot(src.plot||'');
    setFarm2(src.farm2||'');
    setPlot2(src.plot2||'');
    setFarm3(src.farm3||'');
    setPlot3(src.plot3||'');
    setFarm4(src.farm4||'');
    setPlot4(src.plot4||'');
    setAdditionalFarms(src.additionalFarms||[]);
    setExtraVarieties(src.extraVarieties||[]);
    setClient(src.client||'');
    setCountry(src.country||'');
    setWax(src.wax||'CR');
    setPacking(src.packing||'Ok');
    setLabelling(src.labelling||'Ok');
    setCartonType(src.cartonType||'');
    setTraceCodes((function(){var r=normTC(src.traceCodes||(src.traceCode?[src.traceCode]:[]));return r.length?r:[{code:'',variety:null}];})());
    setCartonColor(src.cartonColor||'');
    setCartonCompany(src.cartonCompany||'');
    setCartonCompany2(src.cartonCompany2||'');
    setGGN(src.ggn||'');
    setPHCode(src.phCode||'40.01.20.02/CIP');
    setFarmCode(src.farmCode||'');
    setNetWt(src.netWt||'');
    setImporter(src.importer||'');
    setImporterAddr(src.importerAddr||'');
    resetUnitConfirmed();
    setPreFilled(true);
  }
  var sNP=useState(false); var showNP=sNP[0]; var setShowNP=sNP[1];
  var sNPWarn=useState(false); var npWarn=sNPWarn[0]; var setNPWarn=sNPWarn[1];
  /* Hard-coded per-crop thresholds are only a FALLBACK: a non-zero DB default_threshold (what Admin → Config edits)
     wins. 0 in the DB means 'not set' (new defects are inserted with 0). */
  var thresholds=(config.defectThresholds||{})[cropId]||INITIAL_CONFIG.defectThresholds.citrus||{};
  var defSections=(function(){
    var ds=config.defectSections;
    if(!ds) return [];
    /* If it's a map (from DB loader), get the array for this product */
    if(!Array.isArray(ds)) return ds[cropId]||[];
    /* If it's already an array (old localStorage format), only use for citrus */
    {}
    return [];
  })();
  function emptyDefects(){var d={};defSections.forEach(function(sec){sec.items.forEach(function(i){d[i.key]='0';});});return d;}
  function nowTime(){var n=new Date();return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');}
  function newRow(palletNo){return {id:Date.now()+Math.random(),palletNo:palletNo,time:nowTime(),opDate:date||new Date().toISOString().slice(0,10),sampleSize:'',size:'',cartonWt:'',brix:'',brixV2:'',defects:emptyDefects(),pass:null,notes:'',extraFields:{package_type:'',size_grade:'',peat_g:'',sewing:'Ok'},sampleVariety:variety||'',showExtraFields:false};return {id:Date.now()+Math.random(),palletNo:palletNo,time:nowTime(),opDate:new Date().toISOString().slice(0,10),sampleSize:'',size:'',cartonWt:'',brix:'',brixV2:'',defects:emptyDefects(),pass:null,notes:'',extraFields:{so2:'',jiffy_pad:'',punnet_type:'',package_type:'',grape_size:'',temp_log:'',worker_id:'',pkg_mtl_wt:'',packDate:new Date().toISOString().slice(0,10)},sampleVariety:'',showExtraFields:false};}
  function newPallet(num,lbl,cont){return {palletId:Date.now()+Math.random(),palletNo:num,palletLabel:lbl||'',palletContainer:cont||'',palletTraceCodes:[],actualTraceCode:'',showActualTrace:false,rows:[newRow(num)]};}

  /* pallets: [{palletId, palletNo, rows:[{id,palletNo,time,size,cartonWt,brix,defects,notes}]}] */
  /* ── Draft restore — recover unsaved data after crash or failed save ── */
  /* (restoredDraft is computed earlier, just above _d) */
  /* initPallets: recoveryDraft takes priority over batch in edit mode when explicitly restoring */
  var initPallets=(props.recoveryDraft&&restoredDraft&&restoredDraft.pallets&&restoredDraft.pallets.length>0)
    ?restoredDraft.pallets
    :batch
    ?[{palletId:1,palletNo:1,rows:batch.samples&&batch.samples.length
        ?batch.samples.map(function(s,i){return Object.assign({},s,{id:s.id||i+1,palletNo:s.palletNo||1});})
        :[{id:1,palletNo:1,time:batch.time||nowTime(),size:batch.size||'48',cartonWt:String(batch.cartonWt||''),brix:String(batch.brix||''),defects:batch.defects||emptyDefects(),notes:batch.notes||''}]
      }]
    :(restoredDraft&&restoredDraft.pallets&&restoredDraft.pallets.length>0?restoredDraft.pallets:[newPallet(1)]);
  var sPallets=useState(initPallets); var pallets=sPallets[0]; var setPallets=sPallets[1];
  /* Assigned HERE, after every useState above, not up beside the effect: these are
     `var`s, so at the effect's position they are still hoisted-undefined and the
     snapshot would capture nothing. */
  snapRef.current={lot:lot,date:date,variety:variety,category:category,varietyType:varietyType,variety2:variety2,category2:category2,client:client,country:country,farm:farm,farm2:farm2,farm3:farm3,farm4:farm4,additionalFarms:additionalFarms,plot:plot,plot2:plot2,plot3:plot3,plot4:plot4,container:container,cls:cls,wax:wax,packing:packing,labelling:labelling,cartonCompany:cartonCompany,cartonCompany2:cartonCompany2,cartonColor:cartonColor,pallets:pallets,decision:decision,
    traceCodes:traceCodes,ggn:ggn,phCode:phCode,farmCode:farmCode,netWt:netWt,
    importer:importer,importerAddr:importerAddr,stickerImg:stickerImg,
    extraLabels:extraLabels,hdrLocked:hdrLocked,stickerChecks:stickerChecks,
    cartonType:cartonType,grpSessionId:grpSessionId||null,extraVarieties:extraVarieties,outcome:outcome};
  var sDeletedPallets=useState([]); var deletedPalletIds=sDeletedPallets[0]; var setDeletedPalletIds=sDeletedPallets[1];
  var sActivePallet=useState(0); var activePalletIdx=sActivePallet[0]; var setActivePalletIdx=sActivePallet[1];
  var sExp=useState(null); var expandedRow=sExp[0]; var setExpandedRow=sExp[1];
  /* pfTried: tracks rows where P/F was clicked while fields were incomplete — triggers red highlights */
  var sPFT=useState({}); var pfTried=sPFT[0]; var setPFTried=sPFT[1];
  /* ── Grapes-specific state ── */
  var sGrpPopup=useState(null); var grpPopup=sGrpPopup[0]; var setGrpPopup=sGrpPopup[1];
  var sGrpMove=useState(null); var grpMoveModal=sGrpMove[0]; var setGrpMoveModal=sGrpMove[1];
  /* Animation state for pallet move swipe */
  var sAnimPallet=useState(null); var animatingPalletId=sAnimPallet[0]; var setAnimatingPalletId=sAnimPallet[1];
  var sArrivePallet=useState(null); var arrivingPalletId=sArrivePallet[0]; var setArrivingPalletId=sArrivePallet[1];
  /* Pallet labels for other sessions — loaded lazily when move modal opens */
  var sSessionPallets=useState({}); var sessionPallets=sSessionPallets[0]; var setSessionPallets=sSessionPallets[1];
  var sPalletsLoaded=useState(false); var palletsLoaded=sPalletsLoaded[0]; var setPalletsLoaded=sPalletsLoaded[1];
  
  var sGrpMoveSearch=useState(''); var grpMoveSearch=sGrpMoveSearch[0]; var setGrpMoveSearch=sGrpMoveSearch[1];
  /* Grapes session ID — stable for lifetime of this form instance */
  var sGrpSession=useState(null);
  var grpSessionId=(function(){
    if(sGrpSession[0]) return sGrpSession[0]; /* locked session id — all crops */
    if(batch&&batch.id) return batch.id; /* editing an existing inspection (any crop) — use its id (needed for citrus pallet move) */
    return '';
    var prod=(config.products||[]).find(function(p){return p.id==='grapes';})||{inspection_prefix:'GR'};
    var prefix=prod.inspection_prefix||'GR';
    var ph=(packhouse&&packhouse.initials)||'XX';
    var dt=new Date();
    var dateStr=dt.getFullYear()+String(dt.getMonth()+1).padStart(2,'0')+String(dt.getDate()).padStart(2,'0');
    var id=prefix+'-'+ph+'-'+dateStr+'-'+String(Math.floor(100+Math.random()*899)).padStart(3,'0');
    sGrpSession[1](id);
    return id;
  })();

  /* potatoes: outcome + extra single varieties are not in the listing view — read them from the inspection on edit-open */
  React.useEffect(function(){
    if((!isEdit)||!batch||!batch.id||props.recoveryDraft) return;
    supabase.from('inspections').select('outcome,extra_varieties').eq('id',batch.id).single().then(function(r){
      if(r.error||!r.data) return;
      if(r.data.outcome) setOutcome(r.data.outcome);
      if(Array.isArray(r.data.extra_varieties)&&r.data.extra_varieties.length) setExtraVarieties(r.data.extra_varieties);
    });
  },[]);
  /* Load sample rows + defect readings from DB when editing */
  React.useEffect(function(){
    if(!isEdit||!batch||!batch.id) return;
    supabase.from('pallets').select('*').eq('inspection_id',batch.id).order('pallet_number')
      .then(function(pr){
        if(pr.error||!pr.data||pr.data.length===0) return;
        var palletIds=pr.data.map(function(p){return p.id;});
        supabase.from('sample_rows').select('*,sample_defect_readings(value,defects(key))')
          .in('pallet_id',palletIds).order('sample_number')
          .then(function(sr){
            /* NOTE: do NOT early-return when sr.data is empty — a pallet with
               no sample rows yet is still a valid pallet that should be shown */
            if(sr.error) return;
            var srData=sr.data||[];
            var newPallets=pr.data.map(function(pal){
              var palRows=srData.filter(function(row){return row.pallet_id===pal.id;});
              var rows=palRows.map(function(row){
                var def=emptyDefects();
                (row.sample_defect_readings||[]).forEach(function(dr){
                  if(dr.defects&&dr.defects.key) def[dr.defects.key]=String(dr.value||0);
                });
                return {
                  id:row.id,palletNo:pal.pallet_number,
                  time:row.time||nowTime(),opDate:row.op_date||new Date().toISOString().slice(0,10),sampleSize:String(row.sample_size||''),size:String(row.size||''),
                  cartonWt:String(row.carton_weight||''),brix:String(row.brix||''),brixV2:String(row.brix_v2||''),
                  defects:def,notes:row.notes||'',
                  pass:row.sample_result===true?true:row.sample_result===false?false:null,
                  extraFields:row.extra_fields||{},
                  sampleVariety:row.sample_variety_text||(function(){var v1=(config.varietiesIdToName&&row.sample_variety_id&&config.varietiesIdToName[row.sample_variety_id])||'';var v2=(config.varietiesIdToName&&row.sample_variety2_id&&config.varietiesIdToName[row.sample_variety2_id])||'';return v2?v1+' / '+v2:v1;})()||(config.varietiesIdToName&&row.sample_variety_id&&config.varietiesIdToName[row.sample_variety_id])||''
                };
              });
              var isGrapes=(props.cropId||cropId||'').toLowerCase()==='grapes';
              var isMangoLd=(props.cropId||cropId||'').toLowerCase()==='mango';
              /* Citrus & pomegranate also use the per-pallet container + trace model —
                 they must restore those on edit-load, else edit-save clears them.
                 (palletLabel stays gated: citrus/pom use system pallet numbers via palletNo.) */
              var isTraceModelLd=(isGrapes||isMangoLd||(props.cropId||cropId||'').toLowerCase()==='citrus'||(props.cropId||cropId||'').toLowerCase()==='pomegranate');
              return {
                palletId:pal.id,
                palletNo:pal.pallet_number,
                palletLabel:(isGrapes||isMangoLd)?(pal.pallet_number||''):'',
                palletContainer:isTraceModelLd?(pal.container_number||''):'',
                palletTraceCodes:isTraceModelLd?(pal.trace_codes||[]):[],
                palletCartonCompany:pal.carton_company||'',
                actualTraceCode:pal.actual_trace_code||'',
                showActualTrace:false,
                rows:rows.length?rows:[newRow(pal.pallet_number)]
              };
            });
            if(newPallets.length>0){setPallets(newPallets);setActivePalletIdx(0);
              if((!props.recoveryDraft)){var _xv=[];newPallets.forEach(function(p){(p.rows||[]).forEach(function(r){var v=(r.sampleVariety||'').trim();if(v&&v!==batch.variety&&v!==batch.variety2&&_xv.indexOf(v)<0)_xv.push(v);});});if(_xv.length)setExtraVarieties(_xv);}
              /* Repair header/pallet trace-code desync: merge any trace code assigned to a
                 pallet but missing from the session (header) list, so the Trace Codes card
                 shows EVERY code actually in use (not just the header subset) and the next
                 save re-syncs the header. Prevents "codes on pallets the card doesn't show"
                 and "added codes not reflecting after reload". No-op for crops with no
                 pallet trace codes. */
              setTraceCodes(function(prev){
                var out=(prev||[]).slice(); var seen={};
                out.forEach(function(tc){var c=(typeof tc==='string'?tc:(tc&&tc.code)||'').trim();if(c)seen[c]=1;});
                newPallets.forEach(function(p){(p.palletTraceCodes||[]).forEach(function(c){
                  var code=(typeof c==='string'?c:(c&&c.code)||'').trim();
                  if(code&&!seen[code]){seen[code]=1;out.push({code:code,variety:null});}
                });});
                var real=out.filter(function(tc){return (typeof tc==='string'?tc:(tc&&tc.code)||'').trim();});
                return real.length?real:out;
              });
            }
            console.log('[DalOS] Loaded',newPallets.length,'pallets for edit');
          });
      })
      .catch(function(e){console.error('[DalOS] Load edit samples error:',e);});
  },[]);

  /* derived: all rows across all pallets (for averages, totals, save) */
  var allRows=pallets.reduce(function(acc,p){return acc.concat(p.rows);},[]);
  var sSaved=useState(false); var savedLot=sSaved[0]; var setSavedLot=sSaved[1];
  var sSavedId=useState(''); var savedInspId=sSavedId[0]; var setSavedInspId=sSavedId[1];
  /* Extra label stickers — each: {img:'', checks:{}} */
  var sExtraLabels=useState(batch&&batch.extraLabels?batch.extraLabels:[]);
  var extraLabels=sExtraLabels[0]; var setExtraLabels=sExtraLabels[1];
  
  function removeExtraLabel(idx){markDirty();setExtraLabels(function(prev){return prev.filter(function(_,i){return i!==idx;});});}
  function setExtraLabelImg(idx,v){markDirty();setExtraLabels(function(prev){return prev.map(function(l,i){return i!==idx?l:Object.assign({},l,{img:v});});});}
  function toggleExtraLabelCheck(idx,key){markDirty();setExtraLabels(function(prev){return prev.map(function(l,i){if(i!==idx)return l;var c=Object.assign({},l.checks);c[key]=!c[key];return Object.assign({},l,{checks:c});});});}
  var sSaving=useState(false); var isSaving=sSaving[0]; var setIsSaving=sSaving[1];
  var sSavePending=useState(false); var savePending=sSavePending[0]; var setSavePending=sSavePending[1];
  var sSaveFailed=useState(null); var saveFailed=sSaveFailed[0]; var setSaveFailed=sSaveFailed[1];
  var sValidErr=useState([]); var validErrs=sValidErr[0]; var setValidErrs=sValidErr[1];
  /* Connection status — online/offline/reconnecting */
  var sOnline=useState(typeof navigator!=='undefined'?navigator.onLine:true); var isOnline=sOnline[0]; var setIsOnline=sOnline[1];
  var sReconn=useState(false); var isReconnecting=sReconn[0]; var setIsReconnecting=sReconn[1];
  var reconnTimerRef=React.useRef(null);
  React.useEffect(function(){
    function handleOffline(){
      setIsOnline(false);
      setIsReconnecting(false);
      if(reconnTimerRef.current) clearTimeout(reconnTimerRef.current);
    }
    function handleOnline(){
      setIsReconnecting(true);
      /* Brief "reconnecting" state (1.5s) before showing green — confirms connection is stable */
      if(reconnTimerRef.current) clearTimeout(reconnTimerRef.current);
      reconnTimerRef.current=setTimeout(function(){setIsOnline(true);setIsReconnecting(false);},1500);
    }
    window.addEventListener('offline',handleOffline);
    window.addEventListener('online',handleOnline);
    return function(){
      window.removeEventListener('offline',handleOffline);
      window.removeEventListener('online',handleOnline);
      if(reconnTimerRef.current) clearTimeout(reconnTimerRef.current);
    };
  },[]);
  /* Save UX states: idle | saving | saved | error  */
  var sSaveStatus=useState('idle'); var saveStatus=sSaveStatus[0]; var setSaveStatus=sSaveStatus[1];
  var sSaveErr=useState(''); var saveErrMsg=sSaveErr[0]; var setSaveErrMsg=sSaveErr[1];
  var sSavedAt=useState(''); var savedAtTime=sSavedAt[0]; var setSavedAtTime=sSavedAt[1];
  var saveWatchdogRef=React.useRef(null);
  var pdfLibLoadedRef=React.useRef(false);
  /* Optimistic lock — store the updated_at timestamp when form was loaded.
     On save we assert this hasn't changed. If another device saved first,
     we get 0 rows updated and show a clear conflict error. */
  var loadedVersionRef=React.useRef(isEdit&&batch?batch.savedAt:null);

  function handleSave(){
    if(isSaving) return; /* prevent double-save */
    /* If pre-filled from LOT and inspector hasn't confirmed identity fields, warn once */
    if(preFilled&&!allUnitConfirmed()&&!unitConfirmWarn){setUnitConfirmWarn(true);return;}
    var errs=[];
    if((!lot.trim())) errs.push('LOT No');
    {}
    /* Citrus pallet numbers are system-assigned ({inspection_id}-{n}) on save —
       nothing to validate here (no typed label). */
    if(!variety.trim()) errs.push('Variety');
    if(!decision) errs.push('Decision \u2014 Accept or Reject must be selected');
    /* Line clearance must be answered explicitly — unanswered items used to be saved as 'Compliant'. */
    if((varietyType==='mixed')&&!variety2) errs.push('Variety 2');
    {
      var _F=ptHeaderFarms(),_T1=ptTraceOpts('v1'),_T2=ptTraceOpts('v2'),_bad=[],_what={};
      allRows.forEach(function(r,ri){var ef=r.extraFields||{},hit=false;
        function chk(v,list,lbl){if(v&&list.indexOf(v)<0){hit=true;_what[lbl]=1;}}
        chk(ef.sampleFarm,_F,'farm');if(ef.sampleFarm&&_F.indexOf(ef.sampleFarm)>=0)chk(ef.samplePlot,ptPivotsFor(ef.sampleFarm),'pivot');
        chk(ef.sampleTrace,_T1,'trace code');
        if(ptIsMixed){chk(ef.sampleFarm2,_F,'farm');if(ef.sampleFarm2&&_F.indexOf(ef.sampleFarm2)>=0)chk(ef.samplePlot2,ptPivotsFor(ef.sampleFarm2),'pivot');chk(ef.sampleTrace2,_T2,'trace code');}
        else chk(r.sampleVariety,ptVarietyOpts,'variety');
        if(hit)_bad.push('B'+(ri+1));});
      if(_bad.length) errs.push((_bad.length>1?'Bags ':'Bag ')+_bad.join(', ')+': '+Object.keys(_what).join(' / ')+' no longer in the header \u2014 pick again or add it back');
      var _pf=[];allRows.forEach(function(r,ri){if(r.pass!==true&&r.pass!==false)_pf.push('B'+(ri+1));});
      if(_pf.length) errs.push('Mark PASS or FAIL on '+(_pf.length>1?'bags ':'bag ')+_pf.join(', '));
    }
    {}
    /* ── DUPLICATE PALLET LABEL BLOCK (session-scoped, all products) ──────────
       Two pallets with the same number get merged by the (inspection_id,
       pallet_number) de-dup, silently dropping one pallet's samples. Hard-block
       the save until labels are unique. Only considers pallets that actually
       have a label (blank-label handling stays with the grapes label rule). */
    var _palletPfx=(packhouse&&(packhouse.palletPrefix||packhouse.pallet_prefix))||''; /* mapped key is palletPrefix (L16219); must compose exactly like buildMangoSavePayload */
    var _seen={}, _dupLabels=[], _dupFirstIdx=-1;
    pallets.forEach(function(p,idx){
      var raw=(p.palletLabel||'').trim();
      if(!raw) return;
      var composed=(_palletPfx&&!raw.startsWith(_palletPfx))?_palletPfx+raw:raw;
      if(_seen[composed]!==undefined){
        if(_dupLabels.indexOf(composed)<0) _dupLabels.push(composed);
        if(_dupFirstIdx<0) _dupFirstIdx=idx;
      } else {
        _seen[composed]=idx;
      }
    });
    if(_dupLabels.length>0){
      errs.push('Duplicate pallet number'+(_dupLabels.length>1?'s':'')+': '+_dupLabels.join(', ')+' \u2014 give each pallet its own number');
      window.__dupFirstIdx=_dupFirstIdx;
    } else { window.__dupFirstIdx=-1; }
    setValidErrs(errs);
    if(errs.length>0){
      /* Scroll to first invalid field + flash red ring */
      try {
        var fieldKeyMap={'Line clearance \u2014 mark every item Compliant or Non-Compliant':'clearance','LOT No':'lot','Variety':'variety','Decision \u2014 Accept or Reject must be selected':'decision','Pallet label required for all pallets (e.g. P-4471)':'__pallet__','All trace codes must be assigned V1, V2 or Both in a mixed variety session':'traceCodes'};
        var isDupErr=errs[0].indexOf('Duplicate pallet number')===0;
        var isStaleBag=/^Bags? B\d/.test(errs[0])||errs[0].indexOf('Mark PASS or FAIL')===0;
        var firstKey=isDupErr?'__dup__':isStaleBag?'__stale__':(fieldKeyMap[errs[0]]||'');
        if(firstKey){
          var el=null;
          if(firstKey==='__stale__'){
            el=[].slice.call(document.querySelectorAll(errs[0].indexOf('Mark PASS')===0?'[data-pf-missing="true"]':'select[aria-invalid="true"]')).filter(function(x){return x.offsetParent!==null;})[0]||null;
          } else if(firstKey==='__dup__'){
            /* Scroll to the first colliding pallet label */
            var di=(typeof window.__dupFirstIdx==='number')?window.__dupFirstIdx:-1;
            if(di>=0) el=document.querySelector('[data-field="palletLabel-'+di+'"]');
          } else if(firstKey==='__pallet__'){
            /* Scroll to the first pallet with an empty label specifically */
            var emptyIdx=pallets.findIndex(function(p){return !(p.palletLabel||'').trim();});
            if(emptyIdx>=0) el=document.querySelector('[data-field="palletLabel-'+emptyIdx+'"]');
          } else {
            el=document.querySelector('[data-field="'+firstKey+'"]');
          }
          if(el){
            el.scrollIntoView({behavior:'smooth',block:'center'});
            el.classList.add('dalos-field-error-wrap');
            setTimeout(function(){el.classList.remove('dalos-field-error-wrap');},3500);
          } else {
            /* Fall back to scrolling to the validation banner */
            var banner=document.querySelector('[data-validation-banner]');
            if(banner) banner.scrollIntoView({behavior:'smooth',block:'start'});
          }
        }
      } catch(e){ /* DOM access shouldn't block validation */ }
      return;
    }
    /* Season guard — saving into a season that isn't the current active one prompts once.
       (Saves follow the VIEWED season; this catches an accidental wrong-season save.) */
    var _vSeasonId=config.activeSeasonId,_aSeasonId=config.trueActiveSeasonId;
    if(_vSeasonId&&_aSeasonId&&_vSeasonId!==_aSeasonId&&!seasonConfirmedRef.current){
      var _vName=((config.seasons||[]).find(function(s){return s.id===_vSeasonId;})||{}).name||'';
      var _aName=((config.seasons||[]).find(function(s){return s.id===_aSeasonId;})||{}).name||'';
      setSeasonConfirm({viewed:_vName,active:_aName});
      return;
    }
    seasonConfirmedRef.current=false;
    var defSectionsForSave=(function(){var ds=config.defectSections;if(!ds)return [];if(!Array.isArray(ds))return ds[cropId]||[];return ds;})();
    var defectAvgs={};
    defSectionsForSave.forEach(function(sec){sec.items.forEach(function(d){defectAvgs[d.key]=avgDefect(d.key);});});
    var newBatch={
      id:batch?batch.id:(grpSessionId?grpSessionId:function(){var prod=(config.products||[]).find(function(p){return p.id===cropId;})||{prefix:'CT'};return (prod.inspection_prefix||prod.prefix||'CT')+'-'+new Date().getFullYear()+'-'+String(Math.floor(1000+Math.random()*8999)).padStart(4,'0');}()),
      loadedVersion:loadedVersionRef.current||null,
      date:date,lot:lot,container:container,variety:variety,variety2:variety2,varietyType:varietyType,category:category,category2:category2,cls:cls,
      season:config.activeSeason||'2025/26',
      client:client,
      country:country,
      farm:farm,
      plot:plot,
      farm2:farm2,
      plot2:plot2,
      farm3:farm3,
      plot3:plot3,
      farm4:farm4,
      plot4:plot4,
      additionalFarms:additionalFarms,
      packhouse:packhouse.id,crop:cropId,palletPrefix:packhouse.palletPrefix||'',
      brix:avgField('brix')||0,cartonWt:avgField('cartonWt')||0,wax:wax,
      packing:packing,labelling:labelling,traceCodes:traceCodes,traceCode:traceCodes.map(function(tc){return typeof tc==='string'?tc:(tc&&tc.code)||'';}).filter(Boolean).join(','),ggn:ggn,phCode:phCode,
      farmCode:farmCode,netWt:netWt,cartonType:cartonType,cartonColor:cartonColor,cartonCompany:cartonCompany,cartonCompany2:cartonCompany2,importer:importer,importerAddr:importerAddr,stickerImg:stickerImg,stickerChecks:stickerChecks,extraLabels:extraLabels,
      decision:decision,status:decisionStatus(),
      totalDefect:avgTotal,hasCrit:hasCrit,defects:defectAvgs,
      time:allRows[0]?allRows[0].time:'',size:allRows[0]?allRows[0].size:'',
      notes:allRows.map(function(r){return r.notes;}).filter(Boolean).join('; '),
      hasClientReport:0,clientTotal:null,clientDecision:'',claimedValue:0,gap:null,
      clearance:({}),
      extraVarieties:(extraVarieties||[]).filter(Boolean),
      outcome:(outcome||''),
      /* Explicit, user-confirmed pallet deletions (citrus/pomegranate atomic edit).
         The edit RPC deletes ONLY these ids — never by absence from the payload. */
      deletedPalletIds:deletedPalletIds||[],
      /* Audit timing — for draft_started_at + completion_minutes (only used on new inserts) */
      formOpenedAt:formOpenedAtRef.current,
      /* DB-ready structure: pallets with their sample rows */
      /* Pallet trace chips are limited to codes still in the header list (a renamed/removed header code
         used to linger on pallets — GR-DUMMY-0101 TS-7102). */
      pallets:pallets.map(function(p){var _hdr={};(traceCodes||[]).forEach(function(tc){var c=typeof tc==='string'?tc:(tc&&tc.code)||'';if(c.trim())_hdr[c.trim()]=1;});return {palletId:p.palletId,palletNo:p.palletNo,palletLabel:p.palletLabel||'',palletContainer:p.palletContainer||'',palletTraceCodes:(p.palletTraceCodes||[]).filter(function(c){var cc=typeof c==='string'?c:(c&&c.code)||'';return !!_hdr[cc.trim()];}),palletCartonCompany:p.palletCartonCompany||'',actualTraceCode:p.actualTraceCode||'',rows:p.rows.slice()};}),
      /* flat samples for backward compat (client QC matching) */
      samples:allRows.map(function(r){return Object.assign({},r);})
    };
    /* For new grapes inspections: switch to pending confirmation screen immediately
       so the user sees progress and can't navigate away mid-save. */
    if(!isEdit) setSavePending(true);
    setIsSaving(true);
    setSaveStatus('saving');
    setSaveErrMsg('');
    /* ── Pre-save token check ─────────────────────────────────────────────
       Use getUser() rather than getSession() — getUser() makes an actual
       server round-trip to validate the JWT, whereas getSession() only reads
       localStorage and can return a stale/expired token without refreshing.
       This prevents RLS violations caused by silent JWT expiry. */
    supabase.auth.getUser().then(function(userCheck){
      if(!userCheck.data||!userCheck.data.user){
        setSavePending(false);
        setSaveStatus('error');
        setSaveErrMsg('Your session has expired. Please sign in again.');
        setIsSaving(false);
        return;
      }
      _doSave(newBatch);
    });
  }
  function _doSave(newBatch){
    /* Watchdog — surface stuck saves so they don't fail silently. 15s should
       cover slow networks; production saves typically resolve in <2s. */
    if(saveWatchdogRef.current) clearTimeout(saveWatchdogRef.current);
    saveWatchdogRef.current=setTimeout(function(){
      setSaveStatus('error');
      setSaveErrMsg('Save is taking longer than expected. Open the console (F12) to check for errors, or try saving again.');
      setIsSaving(false);
    },15000);
    var saveCallback=function(err, realId){
      if(saveWatchdogRef.current){clearTimeout(saveWatchdogRef.current);saveWatchdogRef.current=null;}
      /* Recoverable integrity abort: return straight to the FILLED form (not the
         failure screen) with an inline banner so the inspector just taps Save
         again. Form state + autosave draft are intact — no data loss. */
      if(typeof err==='string'&&err.indexOf('RETRY:')===0){
        setSavePending(false);
        setSaveFailed(null);
        setSaveStatus('error');
        setSaveErrMsg(err.slice(6));
        setIsSaving(false);
        return;
      }
      if(err==='CONFLICT'){
        /* Optimistic lock conflict — another device saved this session first.
           AUTO-REFRESH the optimistic-lock version immediately: refetch the
           current updated_at into loadedVersionRef so the inspector's NEXT save
           validates against the live version instead of the stale one. Without
           this, a re-tap re-sends the same stale loaded_version and conflicts
           again — the runaway CONFLICT loop seen in prod. (Manual Refresh stays.) */
        try { if(typeof refreshBatchesById==='function') refreshBatchesById([realId]); } catch(e){}
        var _conflictId=(isEdit&&batch&&batch.id)?batch.id:realId;
        if(_conflictId){
          try{
            supabase.from('inspections').select('updated_at').eq('id',_conflictId).single().then(function(r){
              if(r&&r.data&&r.data.updated_at){ loadedVersionRef.current=r.data.updated_at; }
            }).catch(function(){});
          }catch(e){}
        }
        if(!isEdit){
          setSavePending(false);
          setSaveFailed('This session was updated on another device. We\u2019ve reloaded the latest version — review your entries, then save again.');
          setIsSaving(false);
          return;
        }
        setSaveStatus('error');
        setSaveErrMsg('This session was updated on another device. We\u2019ve reloaded the latest version — review your changes, then tap Save again.');
        setIsSaving(false);
        return;
      }
      if(err){
        if(!isEdit){
          setSavePending(false);
          setSaveFailed(typeof err==='string'?err:('Save failed: '+(err.message||'unknown error')));
          setIsSaving(false);
          return;
        }
        setSaveStatus('error');
        setSaveErrMsg(typeof err==='string'?err:('Save failed: '+(err.message||'unknown error')));
        setIsSaving(false);
        return;
      }
      /* Lock grpSessionId to the real DB ID so subsequent saves in the same
         grapes session correctly go through isEditMode=true instead of
         creating a duplicate inspection row. */
      if(!isEdit&&realId&&sGrpSession[0]!==realId){
        sGrpSession[1](realId);
      }
      /* Show the real DB-assigned session ID on the confirmation screen */
      if(!isEdit&&realId){
        setSavePending(false);
        setSavedInspId(realId);
        setSavedLot((newBatch.lot||realId));
      }
      var ts=new Date();
      setSavedAtTime(String(ts.getHours()).padStart(2,'0')+':'+String(ts.getMinutes()).padStart(2,'0'));
      setSaveStatus('saved');
      setIsDirty(false); /* stop autosave from re-creating the draft after cleanup */
      /* Broadcast to other tabs so their listing refreshes automatically */
      try{
        var bc=new BroadcastChannel('dalos_saves');
        bc.postMessage({type:'session_saved',id:realId,packhouse:packhouse.id,crop:cropId});
        bc.close();
      }catch(e){}
      /* Keep the STORED avg_* / has_critical in step with the saved rows (they went stale on edit and
         Tableau/exports read them). The atomic RPCs already do this server-side; this covers the legacy
         grapes path. Fire-and-forget — never blocks or fails a save. */
      try{ if(realId) supabase.rpc('refresh_inspection_stored_aggregates',{p_id:realId}).then(function(){},function(){}); }catch(e){}
      /* Delete the Supabase draft — real save succeeded, no recovery needed.
         Strategy: stamp save_confirmed_at FIRST (immediate, prevents banner re-appearing
         even if delete fails), then delete. If delete fails, retry once after 3s. */
      try{
        if(draftIdRef.current){
          var _did=draftIdRef.current;
          var _now=new Date().toISOString();
          /* Step 1: stamp confirmed — query excludes confirmed rows so banner won't reappear */
          supabase.from('save_drafts').update({save_confirmed_at:_now}).eq('id',_did).then(function(){
            /* Step 2: delete — retry once on failure */
            supabase.from('save_drafts').delete().eq('id',_did).then(function(r){
              if(r.error){
                console.warn('[DalOS] Draft delete failed, retrying in 3s:',r.error.message);
                setTimeout(function(){
                  supabase.from('save_drafts').delete().eq('id',_did).then(function(){});
                },3000);
              } else {
                console.log('[DalOS] Draft cleaned up after save');
              }
            });
          });
          /* Clear sessionStorage key so next form gets a fresh draftId */
          try{
            var suffix=isEdit&&batch?('_edit_'+batch.id):('_new_'+tabId);
            sessionStorage.removeItem('dalos_draftid_'+(packhouse.id||'')+'_'+(cropId||'grapes')+suffix);
          }catch(e){}
        }
        localStorage.removeItem(draftKey);
      }catch(e){}
      /* Update loadedVersionRef so if form is reopened immediately the timestamp is fresh */
      if(isEdit&&realId){
        supabase.from('inspections').select('updated_at').eq('id',realId).single().then(function(r){
          if(r.data&&r.data.updated_at) loadedVersionRef.current=r.data.updated_at;
        });
      }
      /* Edit mode: keep isSaving=true during 1.8s so user can't double-save */
      if(isEdit){
        /* citrus/pom: the atomic edit RPC already deleted these (deleted_pallet_ids) inside its transaction —
           don't run a second, non-atomic delete. Grapes (legacy) and mango still rely on this path. */
        if(deletedPalletIds&&deletedPalletIds.length>0){
          var toDelete=deletedPalletIds.slice();
          setDeletedPalletIds([]);
          supabase.from('sample_rows').delete().in('pallet_id',toDelete)
            .then(function(){return supabase.from('pallets').delete().in('id',toDelete);})
            .then(function(r){if(r&&r.error)console.error('[DalOS] pallet delete error:',r.error.message);
              else console.log('[DalOS] Deleted',toDelete.length,'pallet(s) from DB');
              /* refresh the stored aggregates AFTER the removed pallets' rows are gone (the post-save refresh
                 ran before this delete and kept the removed pallet's samples/critical — GR-DUMMY-0102) */
              try{ supabase.rpc('refresh_inspection_stored_aggregates',{p_id:realId}).then(function(){},function(){}); }catch(e){}});
        }
        {}
        setTimeout(function(){setIsSaving(false);setSaveStatus('idle');onClose();},1800);
      } else {
        setIsSaving(false);
      }
    };
    if(props.onAddBatch) props.onAddBatch(newBatch, saveCallback);
    /* Confirmation is shown from saveCallback for ALL crops once the server
       confirms — never before, so a failed save can no longer display
       "Unit saved". The pending screen covers the in-flight window. */
  }

  /* ── PDF Report Generation ── */
  function generatePDF(mode){
    var alreadyLoaded=!!(window.jspdf&&window.jspdf.jsPDF);
    function doBuild(){
      try{
        buildPDF(mode);
      }catch(e){
        console.error('[DalOS] PDF error:',e);
        alert('PDF generation failed:\n'+e.message+'\n\nPlease try again or contact support.');
        pdfLibLoadedRef.current='loaded'; /* reset so next click retries */
      }
    }
    if(alreadyLoaded){doBuild();return;}
    if(pdfLibLoadedRef.current==='loading') return;
    pdfLibLoadedRef.current='loading';
    var s1=document.createElement('script');
    s1.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s1.onerror=function(){
      pdfLibLoadedRef.current=false; /* reset so user can retry */
      alert('Could not load PDF library. Please check your internet connection and try again.');
    };
    s1.onload=function(){
      var s2=document.createElement('script');
      s2.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.6.0/jspdf.plugin.autotable.min.js';
      s2.onerror=function(){
        pdfLibLoadedRef.current=false;
        alert('Could not load PDF table library. Please check your internet connection and try again.');
      };
      s2.onload=function(){pdfLibLoadedRef.current='loaded';doBuild();};
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  }

  function buildPDF(mode){
    var jsPDF=window.jspdf.jsPDF;
    var isClient=(mode==='client');
    var doc=new jsPDF({orientation:isClient?'portrait':'landscape',unit:'mm',format:'a4'});
    var pw=doc.internal.pageSize.getWidth();
    var ph=doc.internal.pageSize.getHeight();
    var mg=14;
    var cw=pw-mg*2;
    var y=0;
    var GREEN=[43,92,63];var WHITE=[255,255,255];var LTGRAY=[248,250,248];var MDGRAY=[110,110,110];var DKGRAY=[30,30,30];var RED=[163,45,45];var LGRN=[59,109,17];
    var sessionId=isEdit&&batch?batch.id:(savedLot||grpSessionId||'Draft');
    var SLABELS={product:'Product',variety:'Variety',cls:'Class',phName:'Packhouse',phCode:'PH code',farmCode:'Farm code',packDate:'Packing date',netWt:'Net weight',trace:'Trace code',ggn:'GGN',lot:'LOT No',importer:'Imported by',origin:'Country of origin'};
    {}
    function addPageIfNeeded(needed){if(y+needed>ph-14){doc.addPage();drawHeader();}}
    function drawHeader(){
      doc.setFillColor(43,92,63);
      doc.rect(0,0,pw,18,'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(13);doc.setFont('helvetica','bold');
      doc.text(isClient?'Export Inspection Report':'Internal Inspection Record',mg,7);
      doc.setFontSize(8);doc.setFont('helvetica','normal');
      doc.text((packhouse.name||'KZ Packhouse')+'  ·  '+({'grapes':'Grapes','citrus':'Citrus','mango':'Mango','pomegranate':'Pomegranate','potatoes':'Potatoes'}[cropId]||cropId)+'  ·  '+(date||''),mg,12.5);
      doc.text(isClient?'Client Report':'Internal Record  —  CONFIDENTIAL',mg,16.5);
      doc.setFontSize(9);doc.setFont('helvetica','bold');
      doc.text(sessionId,pw-mg,8,{align:'right'});
      doc.setFontSize(7.5);doc.setFont('helvetica','normal');
      doc.text(isClient?'':'Inspector: '+((props.currentUser&&(props.currentUser.name||(typeof props.currentUser==='string'?props.currentUser:'')))||config.currentUser||'—'),pw-mg,13,{align:'right'});
      y=22;
    }
    function secHead(title){
      addPageIfNeeded(12);
      y+=2;
      doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(110,110,110);
      doc.text(title.toUpperCase(),mg,y);
      doc.setDrawColor(210,210,210);doc.line(mg+doc.getTextWidth(title.toUpperCase())+2,y,mg+cw,y);
      y+=5;
    }
    function kvRow(pairs){
      addPageIfNeeded(10);
      var colW=cw/pairs.length;var maxLines=1;
      pairs.forEach(function(p,i){
        var x=mg+i*colW;
        doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(110,110,110);doc.text(String(p[0]||''),x,y);
        /* wrap each value inside its own column (long values overlapped the next column / ran off the page) */
        doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(30,30,30);
        var lines=doc.splitTextToSize(String(p[1]||'—'),colW-3).slice(0,4);
        lines.forEach(function(ln,li){doc.text(ln,x,y+4.5+li*4);});
        if(lines.length>maxLines)maxLines=lines.length;
      });
      y+=10+(maxLines-1)*4;
    }
    
    
    function drawFooter(){
      doc.setFillColor(244,244,244);doc.rect(0,ph-10,pw,10,'F');
      doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(130,130,130);
      doc.text('DaltexCorp  ·  vision@daltexcorp.com',mg,ph-4.5);
      doc.text((isClient?'':'CONFIDENTIAL  ·  ')+'Generated by DalOS Vision  ·  '+new Date().toLocaleDateString('en-GB'),pw-mg,ph-4.5,{align:'right'});
    }

    drawHeader();

    /* ── POTATOES PDF (client + internal) — lot + sampled bags, no pallets ── */
    function ptPdfBody(){
      var vtxt=varietyType==='mixed'&&variety2?(variety+' + '+variety2+' (mixed)'):[variety].concat(extraVarieties||[]).filter(Boolean).join(', ');
      var farmsTxt=(function(){var o=[];[[farm,plot],[farm2,plot2],[farm3,plot3],[farm4,plot4]].forEach(function(fp){if(fp[0]&&fp[0]!=='__selecting__'&&fp[0]!=='__other__')o.push(fp[0]+(fp[1]?' '+fp[1]:''));});(additionalFarms||[]).forEach(function(af){if(af.farmName)o.push(af.farmName+(af.plot?' '+af.plot:''));});return o.join(', ');})();
      secHead('Lot details');
      kvRow([['LOT No',lot],['Container',container||'—'],['Client',client],['Destination',country]]);
      kvRow([['Varieties',vtxt],['Farms · pivots',farmsTxt||'—'],['Client sticker',labelling||'—'],['Date',date]]);
      if(!isClient) kvRow([['Trace codes',traceCodes.map(function(tc){return typeof tc==='string'?tc:(tc&&tc.code)||'';}).filter(Boolean).join(', ')||'—'],['Outcome',outcome||'—'],['Inspector',(props.currentUser&&props.currentUser.name)||'—'],['Completion',(batch&&batch.completionMinutes!=null&&batch.completionMinutes!=='')?(batch.completionMinutes+' min'):(isEdit?'—':Math.max(0,Math.round((Date.now()-formOpenedAtRef.current.getTime())/60000))+' min')]]);
      secHead('Quality summary');
      var cards=[['Total rots',ptRots.toFixed(2)+'%'],['Total skin',ptSkin.toFixed(2)+'%'],['Grand total',avgTotal.toFixed(2)+'%'],['Grade',ptLotGrade+(ptMoth?' · moth':'')],['Decision',decisionText()]];
      var sw=cw/cards.length;
      cards.forEach(function(c,i){var sx=mg+i*sw;doc.setFillColor(244,248,244);doc.roundedRect(sx,y,sw-2,14,2,2,'F');
        doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(110,110,110);doc.text(c[0],sx+3,y+5);
        doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor.apply(doc,i===4?(decision==='A'?LGRN:RED):(i===3&&ptLotGrade==='C'?RED:DKGRAY));doc.text(c[1],sx+3,y+12);});
      y+=18;
      secHead('Sampled bags ('+allRows.length+')');
      var head=isClient?['Bag','Variety','Farm','Pivot','Bag type','Size','Bag kg','Rots','Skin','Size%','Total%']
                       :['Bag','Date','Variety','Farm','Pivot','Trace','Bag type','Size','Bag kg','Peat g','Sewing','Rots','Skin','Size%','Total%','P/F'];
      var body=allRows.map(function(r,ri){var ef=r.extraFields||{};var R=ptRowSec(r,'Rots'),S=ptRowSec(r,'Skin'),Z=ptRowSec(r,'Size');
        var vv=ptIsMixed?(variety+' / '+variety2):(r.sampleVariety||variety||'');
        var fm=ptIsMixed?((ef.sampleFarm||'—')+' / '+(ef.sampleFarm2||'—')):(ef.sampleFarm||'');
        var pv=ptIsMixed?((ef.samplePlot||'—')+' / '+(ef.samplePlot2||'—')):(ef.samplePlot||'');
        var tr=ptIsMixed?((ef.sampleTrace||'—')+' / '+(ef.sampleTrace2||'—')):(ef.sampleTrace||'');
        var t=(R+S+Z).toFixed(2);
        return isClient?['B'+(ri+1),vv,fm,pv,ef.package_type||'',ef.size_grade||'',r.cartonWt||'',R.toFixed(2),S.toFixed(2),Z.toFixed(2),t]
                       :['B'+(ri+1),(r.opDate||'').slice(5),vv,fm,pv,tr,ef.package_type||'',ef.size_grade||'',r.cartonWt||'',ef.peat_g||'',ef.sewing||'',R.toFixed(2),S.toFixed(2),Z.toFixed(2),t,r.pass===true?'P':r.pass===false?'F':''];});
      doc.autoTable({startY:y,head:[head],body:body,margin:{left:mg,right:mg},headStyles:{fillColor:GREEN,textColor:WHITE,fontSize:7,fontStyle:'bold',cellPadding:2},bodyStyles:{fontSize:isClient?8:7,cellPadding:1.8},theme:'grid',tableLineColor:[220,220,220],tableLineWidth:0.1,columnStyles:(function(){var o={};o[head.length-(isClient?1:2)]={fontStyle:'bold'};return o;})()});
      y=doc.lastAutoTable.finalY+6;
      /* non-zero defects, lot average */
      var defRows=[];defSections.forEach(function(sec){sec.items.forEach(function(d){var v=avgDefectRaw(d.key);if(v>0)defRows.push([sec.section,d.en+(d.ar?'  '+d.ar:''),v.toFixed(2)+'%']);});});
      if(defRows.length){addPageIfNeeded(20);secHead('Defects found (lot average)');
        doc.autoTable({startY:y,head:[['Section','Defect','Lot avg']],body:defRows.map(function(r){return [r[0],r[1].split('  ')[0],r[2]];}),margin:{left:mg,right:mg},headStyles:{fillColor:GREEN,textColor:WHITE,fontSize:7},bodyStyles:{fontSize:8,cellPadding:1.8},theme:'grid'});
        y=doc.lastAutoTable.finalY+6;}
      if(!isClient){var nts=allRows.map(function(r,ri){return r.notes?('B'+(ri+1)+': '+r.notes):'';}).filter(Boolean);if(nts.length){addPageIfNeeded(14);secHead('Notes');kvRow([['Bag notes',nts.join('  ·  ')]]);}}
    }

    {
      ptPdfBody();
    }

    drawFooter();
    var fname=String(sessionId||'Draft').replace(/-/g,'_')+'_'+(isClient?'Client':'Internal')+'_'+(date||'').replace(/-/g,'')+'.pdf';
    doc.save(fname);
  }
  var initCl={c0:'',c1:'',c2:'',c3:''};
  if(batch&&batch.clearance) initCl=batch.clearance;
  var scl=useState(initCl); var clearance=scl[0]; var setClearance=scl[1];

  /* pallet + row helpers */
  function addRowToPallet(pIdx){setPallets(function(prev){return prev.map(function(p,i){if(i!==pIdx)return p;var nr=newRow(p.palletNo);
    /* potatoes: a new bag starts from the previous bag (usually the same bag type, size, variety, farm/pivot/trace) */
    {var last=p.rows[p.rows.length-1];if(last){var le=last.extraFields||{};nr.sampleVariety=last.sampleVariety||nr.sampleVariety;nr.opDate=last.opDate||nr.opDate;nr.extraFields=Object.assign({},nr.extraFields,{package_type:le.package_type||'',size_grade:le.size_grade||'',sampleFarm:le.sampleFarm||'',samplePlot:le.samplePlot||'',sampleFarm2:le.sampleFarm2||'',samplePlot2:le.samplePlot2||'',sampleTrace:le.sampleTrace||'',sampleTrace2:le.sampleTrace2||''});}}
    return Object.assign({},p,{rows:p.rows.concat([nr])});});});setIsDirty(true);}
  function updateRowField(pIdx,rId,field,val){setIsDirty(true);setPallets(function(prev){return prev.map(function(p,i){if(i!==pIdx)return p;return Object.assign({},p,{rows:p.rows.map(function(r){if(r.id!==rId)return r;var o=Object.assign({},r);o[field]=val;return o;})});});});}
  function updateRowDefect(pIdx,rId,key,val){setIsDirty(true);setPallets(function(prev){return prev.map(function(p,i){if(i!==pIdx)return p;return Object.assign({},p,{rows:p.rows.map(function(r){if(r.id!==rId)return r;return Object.assign({},r,{defects:Object.assign({},r.defects,function(){var o={};o[key]=val;return o;}())});})});});});}
  
  function ptUndoRemove(){var u=ptUndo;if(!u)return;setIsDirty(true);setPallets(function(prev){return prev.map(function(p,i){if(i!==u.pIdx)return p;var rows=p.rows.filter(function(r){return r.id!==u.placeholderId;});rows.splice(Math.min(u.idx,rows.length),0,u.row);return Object.assign({},p,{rows:rows});});});setPtUndo(null);if(ptUndoTimerRef.current)clearTimeout(ptUndoTimerRef.current);}
  function removeRow(pIdx,rId){
    {var _p=pallets[pIdx];var _i=_p?_p.rows.findIndex(function(r){return r.id===rId;}):-1;
      if(_i>=0){setIsDirty(true);setPtUndo({pIdx:pIdx,idx:_i,row:_p.rows[_i],label:'B'+(_i+1),placeholderId:_p.rows.length===1?'__ph__':null});
        if(ptUndoTimerRef.current)clearTimeout(ptUndoTimerRef.current);ptUndoTimerRef.current=setTimeout(function(){setPtUndo(null);},12000);}}
    setPallets(function(prev){return prev.map(function(p,i){if(i!==pIdx)return p;var nr=p.rows.filter(function(r){return r.id!==rId;});return Object.assign({},p,{rows:nr.length?nr:[newRow(p.palletNo)]});});});}
  /* ── Grapes pallet helpers ── */
  
  /* Keep pallet trace chips in step with the header list: renaming a header code renames it on every
     pallet that had it; removing it (newC='') drops it from pallets. */
  function renameTraceInPallets(oldC,newC){oldC=(oldC||'').trim();newC=(newC||'').trim();if(!oldC||oldC===newC)return;setPallets(function(prev){return prev.map(function(p){var tc=p.palletTraceCodes||[];if(!tc.some(function(c){return (typeof c==='string'?c:(c&&c.code)||'').trim()===oldC;}))return p;var out=[];tc.forEach(function(c){var cc=(typeof c==='string'?c:(c&&c.code)||'').trim();var v=cc===oldC?newC:cc;if(v&&out.indexOf(v)<0)out.push(v);});return Object.assign({},p,{palletTraceCodes:out});});});}
  
  function updatePalletContainer(pIdx,val){setIsDirty(true);setPallets(function(prev){return prev.map(function(p,i){return i!==pIdx?p:Object.assign({},p,{palletContainer:val});});});}
  
  
  function doMovePallet(pIdx,targetId){
    var pallet=pallets[pIdx];
    if(!pallet) return;
    var palletId=pallet.palletId;
    if(animatingPalletId===palletId) return; /* block double-clicks during animation */
    /* Resolve targetId from argument or from popup state */
    var resolvedTarget=targetId||null;
    if(!resolvedTarget&&grpPopup&&grpPopup.scenario==='existing'&&grpPopup.targetSession){
      resolvedTarget=grpPopup.targetSession.id;
    }
    /* DB update — move pallet to target inspection (atomic via RPC) */
    if(palletId&&typeof palletId==='string'&&resolvedTarget){
      console.log('[DalOS] moving pallet',palletId,'to',resolvedTarget,'(atomic RPC)');
      var sourceId=props&&props.batch?props.batch.id:null;
      var toRefresh=[resolvedTarget];
      if(sourceId&&sourceId!==resolvedTarget) toRefresh.push(sourceId);
      /* ── Close modal first, then animate slide-out, then fire RPC ── */
      /* Order: dismiss modal → 80ms (modal unmount) → slide-out (340ms) → RPC */
      setGrpPopup(null);
      setGrpMoveModal(null);
      setGrpMoveSearch('');
      setTimeout(function(){
        setAnimatingPalletId(palletId);
        setTimeout(function(){
          supabase.rpc('move_pallet_to_inspection',{p_pallet_id:palletId,p_target_inspection_id:resolvedTarget})
            .then(function(r){
              if(r.error){
                console.error('[DalOS] move_pallet_to_inspection RPC error:',r.error.message);
                /* Roll back: clear animation so pallet snaps back */
                setAnimatingPalletId(null);
                window.alert('Could not move pallet: '+r.error.message+'\nNothing was changed.');
                return;
              }
              console.log('[DalOS] pallet+samples moved to',resolvedTarget,'OK (atomic)');
              if(props&&props.onInvalidateSelB) props.onInvalidateSelB(toRefresh);
              /* Remove pallet from local state — animation already ran.
                 Filter by stable palletId, NOT positional pIdx: pIdx is captured when the
                 modal opens and can be stale after the array shifts. Removing by index here
                 (combined with the duplicate removal below) was dropping the pallet BELOW the
                 target from the UI while the DB only moved the real pallet. */
              setAnimatingPalletId(null);
              setPallets(function(prev){var next=prev.filter(function(p){return p.palletId!==palletId;});return next.length?next:[newPallet(1)];});
              /* Sync moved pallet's trace codes to target session, THEN refresh batches
                 so that onRefreshBatches fires AFTER the DB write — not before.
                 Both bugs (codes appearing only after refresh + not selected) share this root cause. */
              var movedCodes=pallet.palletTraceCodes||[];
              if(movedCodes.length&&resolvedTarget){
                supabase.from('inspections').select('trace_codes').eq('id',resolvedTarget).single()
                  .then(function(res){
                    if(res.error){
                      if(props&&props.onRefreshBatches) props.onRefreshBatches(toRefresh);
                      return;
                    }
                    var targetCodes=normTC(res.data&&res.data.trace_codes||[]);
                    var existingCodes=targetCodes.map(function(t){return t.code;});
                    var tcMap={};
                    traceCodes.forEach(function(tc){
                      var code=typeof tc==='string'?tc:(tc&&tc.code)||'';
                      var variety=typeof tc==='string'?null:(tc&&tc.variety)||null;
                      if(code) tcMap[code]=variety;
                    });
                    var toAdd=movedCodes.filter(function(c){return c&&existingCodes.indexOf(c)<0;}).map(function(c){return {code:c,variety:tcMap[c]||null};});
                    if(!toAdd.length){
                      if(props&&props.onRefreshBatches) props.onRefreshBatches(toRefresh);
                      return;
                    }
                    supabase.from('inspections').update({trace_codes:targetCodes.concat(toAdd)}).eq('id',resolvedTarget)
                      .then(function(r2){
                        if(r2.error) console.warn('[DalOS] trace_codes sync failed:',r2.error.message);
                        else console.log('[DalOS] trace_codes synced to',resolvedTarget);
                        if(props&&props.onRefreshBatches) props.onRefreshBatches(toRefresh);
                      });
                  });
              } else {
                /* No trace codes to sync — refresh immediately */
                if(props&&props.onRefreshBatches) props.onRefreshBatches(toRefresh);
              }
            });
        }, 340); /* wait for slide-out to complete before hitting DB */
      }, 80); /* wait for modal to unmount before starting slide */
    } else if(palletId&&typeof palletId!=='string'){
      /* Pallet exists in the form but still has a temporary (numeric) id — it was
         never saved to the DB, so there is no row to move. Refuse with a clear
         message and KEEP the pallet so the inspector's filled data is not silently
         discarded. (Mirrors the save-first guard on the new-session/split path.) */
      console.warn('[DalOS] doMovePallet — pallet not saved yet, refusing move. pIdx:',pIdx,'palletId:',palletId);
      window.alert('Save the inspection first, then move this pallet.\nNothing was moved or removed.');
      setGrpPopup(null);
      setGrpMoveModal(null);
      setGrpMoveSearch('');
    } else {
      console.warn('[DalOS] doMovePallet — no targetId or palletId. pIdx:',pIdx,'palletId:',palletId,'target:',resolvedTarget);
      setPallets(function(prev){var next=prev.filter(function(_,i){return i!==pIdx;});return next.length?next:[newPallet(1)];});
      setGrpPopup(null);
      setGrpMoveModal(null);
      setGrpMoveSearch('');
    }
  }
  /* ── GRAPES: Create new session and move a pallet to it ── */
  /* Used when an inspector overrides a pallet's container and no existing session matches.
     Creates a new inspection row with the override container, copies the current header (variety,
     farm, class, client, country, plot, packhouse, season, etc.), then re-points the pallet and
     its sample_rows to the new inspection_id. Aborts (without removing the pallet locally) if the
     parent session is unsaved or the pallet has no UUID yet. */
  function createSessionAndMovePallet(pIdx){
    var pallet=pallets[pIdx];
    if(!pallet){console.warn('[DalOS] createSessionAndMovePallet — no pallet at pIdx',pIdx);return;}
    var containerVal=(pallet.palletContainer||'').trim().toUpperCase();
    if(!containerVal){window.alert('Please enter a container number for this pallet first.');return;}
    /* Guard: parent inspection must be saved (have a real DB id), and the pallet must have a UUID */
    if(!props.batch||!props.batch.id){
      window.alert('Save this inspection first, then you can split a pallet to a new container.');
      return;
    }
    var palletId=pallet.palletId;
    if(!palletId||typeof palletId!=='string'){
      window.alert('This pallet has not been saved yet. Save the inspection first, then split.');
      return;
    }
    var sourceId=props.batch.id;
    /* Resolve product_id from cropId */
    var productId=(function(){
      var p=(config.products||[]).find(function(pr){return pr.id===cropId||(pr.name||'').toLowerCase()===(cropId||'').toLowerCase();});
      return p?p.id:cropId;
    })();
    /* Build the inheritable header snapshot from CURRENT React state — not from props.batch
       (the user may have edited the header before splitting; we copy whatever they see now) */
    function lookupId(map,name){return map&&name&&map[name]?map[name]:null;}
    var inheritedRow={
      packhouse_id:packhouse.id,
      product_id:productId,
      season_id:config.activeSeasonId||config.trueActiveSeasonId||null,
      date:date,
      container_number:containerVal,
      variety_id:lookupId(config.varietiesIdMap,variety),
      variety2_id:lookupId(config.varietiesIdMap,variety2),
      variety_type:varietyType||'single',
      class_id:lookupId(config.classesIdMap,cls),
      client_id:lookupId(config.clientsIdMap,client),
      sub_client_id:lookupId(config.subClientNameToId,client),
      country_id:lookupId(config.countriesIdMap,country),
      farm_id:lookupId(config.farmsIdMap,farm),
      farm2_id:lookupId(config.farmsIdMap,farm2),
      plot:plot||null,
      plot2:plot2||null,
      carton_type_id:lookupId(config.cartonTypesIdMap,cartonType),
      carton_color:cartonColor||null,
      carton_company:cartonCompany||null,
      wax:wax||null,
      packing:packing||null,
      labelling:labelling||null,
      ggn:ggn||null,
      ph_code:phCode||null,
      farm_code:farmCode||null,
      net_weight:netWt||null,
      importer:importer||null,
      importer_address:importerAddr||null,
      trace_codes:[],
      extra_labels:[],
      status:'Pending',
      decision:null,
      has_critical:false, /* NOT NULL with no default propagation through jsonb_populate_record */
      submitted_at:new Date().toISOString()
    };
    console.log('[DalOS] createSessionAndMovePallet — splitting pallet',palletId,'to new container',containerVal,'(atomic RPC)');
    /* The RPC bundles: generate_inspection_id → INSERT inspection → UPDATE pallet → UPDATE sample_rows
       all in one transaction. Either every step lands or nothing changes — no orphaned data on partial failure. */
    supabase.auth.getUser().then(function(userRes){
      var userId=userRes.data&&userRes.data.user?userRes.data.user.id:null;
      inheritedRow.created_by=userId;
      /* Update pallets.container_number happens via the RPC's UPDATE pallets, but the new container value
         needs to flow with the move. Pass it on the pallets row separately by updating once after. */
      return supabase.rpc('create_session_and_move_pallet',{p_pallet_id:palletId,p_inspection_payload:inheritedRow});
    }).then(function(rpcRes){
      if(rpcRes.error||!rpcRes.data){
        console.error('[DalOS] create_session_and_move_pallet RPC failed:',rpcRes.error);
        window.alert('Could not create the new session. The pallet was NOT moved. Error: '+(rpcRes.error&&rpcRes.error.message||'unknown'));
        throw new Error('rpc_failed');
      }
      var newId=rpcRes.data;
      console.log('[DalOS] atomic create+move complete, newId=',newId);
      /* The RPC repointed the pallet but did not update the pallet's container_number column.
         Update it now — non-critical (the pallet is already on the new session) so a failure
         here just leaves stale per-pallet container which the user can correct via Edit. */
      return supabase.from('pallets').update({container_number:containerVal}).eq('id',palletId)
        .then(function(r){
          if(r.error) console.warn('[DalOS] pallet container_number sync failed (non-critical):',r.error.message);
          return newId;
        });
    }).then(function(newId){
      if(!newId) return;
      /* Refresh both sessions in the parent listing (source + new) */
      var refreshIds=[sourceId,newId];
      if(props.onRefreshBatches) props.onRefreshBatches(refreshIds);
      if(props.onInvalidateSelB) props.onInvalidateSelB(refreshIds);
      /* Remove pallet locally + close popup. Filter by stable palletId, NOT positional pIdx. */
      setPallets(function(prev){var next=prev.filter(function(p){return p.palletId!==palletId;});return next.length?next:[newPallet(1)];});
      setGrpPopup(null);
      window.alert('Pallet moved to new session '+newId+'. The new session inherits this header — open it from the listing if you need to adjust anything.');
    }).catch(function(err){
      console.warn('[DalOS] createSessionAndMovePallet aborted:',err&&err.message);
    });
  }
  function avgField(field){var vals=allRows.map(function(r){return parseFloat(r[field])||0;}).filter(function(v){return v>0;});return vals.length?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length*10)/10:0;}
  function avgDefect(key){var vals=allRows.map(function(r){return parseFloat(r.defects[key])||0;});return vals.length?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length*100)/100:0;}
  /* Sum UNROUNDED per-defect means, round once (was round-then-sum: 5.45% vs true 5.43%, could flip the 10% auto-decision).
     Equals the DB live_avg_total_defect (mean over samples of each sample's total, nulls as zero). */
  function avgDefectRaw(key){var vals=allRows.map(function(r){return parseFloat(r.defects[key])||0;});return vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:0;}
  var avgTotal=0;defSections.forEach(function(sec){sec.items.forEach(function(d){avgTotal+=avgDefectRaw(d.key);});});avgTotal=Math.round(avgTotal*100)/100;
  var hasCrit=defSections.some(function(sec){return sec.items.some(function(d){return d.sev==='Critical'&&avgDefect(d.key)>0;});});
  /* ── POTATOES (Pivots): sampled-bag helpers ─────────────────────────────────────────
     Potatoes have no pallets: the form keeps ONE implicit pallet (so the save path, edit
     load and reports stay identical to orchards) and every sample row is a sampled bag.
     The header is the pre-selection (farms+pivots, trace codes, varieties); each bag picks
     from it — same model as the grapes sample row. */
  var ptIsMixed=(varietyType==='mixed')&&!!variety&&!!variety2;
  var ptVarietyOpts=(function(){var o=[];[variety].concat(extraVarieties||[]).forEach(function(v){if(v&&o.indexOf(v)<0)o.push(v);});return o;})();
  function ptHeaderFarms(){var f=[];[farm,farm2,farm3,farm4].forEach(function(x){if(x&&x!=='__selecting__'&&x!=='__other__'&&f.indexOf(x)<0)f.push(x);});(additionalFarms||[]).forEach(function(af){if(af.farmName&&f.indexOf(af.farmName)<0)f.push(af.farmName);});return f;}
  function ptPivotsFor(selFarm){var o=[];function add(fm,pl){if(pl&&(!selFarm||fm===selFarm)&&o.indexOf(pl)<0)o.push(pl);}add(farm,plot);add(farm2,plot2);add(farm3,plot3);add(farm4,plot4);(additionalFarms||[]).forEach(function(af){add(af.farmName,af.plot);});return o;}
  /* mixed: header codes tagged V1 / V2 / Both feed the matching bag column; untagged codes feed both */
  function ptTraceOpts(which){return (traceCodes||[]).map(function(tc){return typeof tc==='string'?{code:tc,variety:null}:(tc||{});}).filter(function(tc){if(!(tc.code||'').trim())return false;if(!ptIsMixed)return true;return !tc.variety||tc.variety==='both'||tc.variety===which;}).map(function(tc){return tc.code.trim();});}
  function ptPatchEF(pIdx,rId,patch){setIsDirty(true);setPallets(function(prev){return prev.map(function(p,i){if(i!==pIdx)return p;return Object.assign({},p,{rows:p.rows.map(function(r){return r.id!==rId?r:Object.assign({},r,{extraFields:Object.assign({},r.extraFields||{},patch)});})});});});}
  /* farm change keeps the pivot only if it belongs to the new farm (auto-picks the only one) — like Vision's header farm→plot */
  function ptFarmPatch(row,newFarm,which){var ef=row.extraFields||{};var fk=which==='v2'?'sampleFarm2':'sampleFarm',pk=which==='v2'?'samplePlot2':'samplePlot';var piv=ptPivotsFor(newFarm);var cur=ef[pk]||'';var o={};o[fk]=newFarm;o[pk]=(cur&&piv.indexOf(cur)>=0)?cur:(piv.length===1?piv[0]:'');return o;}
  var PT_CELL={padding:'4px 5px',border:'1px solid var(--border2)',borderRadius:4,fontSize:11,width:'100%',background:'var(--card)',minWidth:0};
  /* select that never blanks a saved value that is no longer in the header list */
  function ptSelect(value,opts,onChange,style,label,fmt,fromList){
    var o=(opts||[]).slice();var stale=value&&o.indexOf(value)<0;var src=fromList?'the list':'the header';
    /* a value no longer in the header (farm/pivot/trace/variety) is shown in red and blocks Save;
       fromList (bag type / size grade from the DB lists) is shown in red only — old bags keep their value */
    return ce('select',{style:Object.assign({},PT_CELL,style||{},stale?{borderColor:'var(--red)',background:'var(--red-bg)',color:'var(--red)'}:{}),value:value||'','aria-label':label||undefined,'aria-invalid':stale?'true':undefined,title:stale?(value+' is no longer in '+src+' \u2014 pick again or add it back'):undefined,onChange:function(e){onChange(e.target.value);}},
      ce('option',{value:''},'—'),
      stale&&ce('option',{key:'__stale',value:value},(fmt?fmt(value):value)+' (not in '+(fromList?'list':'header')+')'),
      o.map(function(x){return ce('option',{key:x,value:x},fmt?fmt(x):x);}));
  }
  
  function ptWeightWarn(row){var ef=row.extraFields||{};var n=ptBagKg(ef.package_type);var w=parseFloat(row.cartonWt);return !!(n&&w&&Math.abs(w-n)/n>0.15);}
  function ptRowSec(row,name){return ptSectionTotal(row.defects,name,defSections);}
  /* lot = plain mean of the bags (sum unrounded per-defect means, as orchards) */
  function ptLotSec(name){var sec=defSections.find(function(s){return s.section===name;});if(!sec)return 0;return sec.items.reduce(function(t,d){return t+avgDefectRaw(d.key);},0);}
  var ptRots=ptLotSec('Rots'), ptSkin=ptLotSec('Skin'), ptSizeTot=ptLotSec('Size');
  var ptMoth=(avgDefect('pt_tuber_moth')>0);
  /* tuber moth is zero tolerance: any reading makes the lot grade C, whatever rots/skin say */
  var ptLotGrade=(ptMoth?'C':ptGrade(ptRots,ptSkin));
  function ptVarCell(row,pIdx,mobile){
    if(ptIsMixed) return ce('div',{style:{display:'flex',flexDirection:'column',gap:2,fontSize:mobile?13:11}},
      ce('span',{style:{color:'#3b6d11',fontWeight:600}},variety),ce('span',{style:{color:'#185fa5',fontWeight:600}},variety2));
    return ptSelect(row.sampleVariety||'',ptVarietyOpts,function(v){updateRowField(pIdx,row.id,'sampleVariety',v);},mobile?{fontSize:14,padding:'8px 10px',minHeight:40}:null,'Variety');
  }
  function ptPair(v1,v2){ /* V1 green / V2 blue stack, grapes-style */
    return ce('div',{style:{display:'flex',flexDirection:'column',gap:2}},
      ce('div',null,ce('div',{style:{fontSize:7.5,fontWeight:700,color:'#3b6d11',lineHeight:1}},(variety||'V1').slice(0,8)),v1),
      ce('div',null,ce('div',{style:{fontSize:7.5,fontWeight:700,color:'#185fa5',lineHeight:1}},(variety2||'V2').slice(0,8)),v2));
  }
  function ptFarmCells(row,pIdx,mobile){
    var ef=row.extraFields||{};var big=mobile?{fontSize:14,padding:'8px 10px',minHeight:40}:null;
    var f1=ptSelect(ef.sampleFarm||'',ptHeaderFarms(),function(v){ptPatchEF(pIdx,row.id,ptFarmPatch(row,v,'v1'));},Object.assign({},big||{},ptIsMixed?{borderColor:'#97c459',background:'#f5fbf0'}:{}),'Farm');
    var p1=ptSelect(ef.samplePlot||'',ptPivotsFor(ef.sampleFarm||''),function(v){ptPatchEF(pIdx,row.id,{samplePlot:v});},Object.assign({fontFamily:'var(--font-mono)'},big||{},ptIsMixed?{borderColor:'#97c459',background:'#f5fbf0'}:{}),'Pivot');
    var t1=ptSelect(ef.sampleTrace||'',ptTraceOpts('v1'),function(v){ptPatchEF(pIdx,row.id,{sampleTrace:v});},Object.assign({fontFamily:'var(--font-mono)'},big||{},ptIsMixed?{borderColor:'#97c459',background:'#f5fbf0'}:{}),'Trace code',null);
    if(!ptIsMixed) return [f1,p1,t1];
    var f2=ptSelect(ef.sampleFarm2||'',ptHeaderFarms(),function(v){ptPatchEF(pIdx,row.id,ptFarmPatch(row,v,'v2'));},Object.assign({},big||{},{borderColor:'#85b7eb',background:'#f0f6fd'}),'Farm V2');
    var p2=ptSelect(ef.samplePlot2||'',ptPivotsFor(ef.sampleFarm2||''),function(v){ptPatchEF(pIdx,row.id,{samplePlot2:v});},Object.assign({fontFamily:'var(--font-mono)'},big||{},{borderColor:'#85b7eb',background:'#f0f6fd'}),'Pivot V2');
    var t2=ptSelect(ef.sampleTrace2||'',ptTraceOpts('v2'),function(v){ptPatchEF(pIdx,row.id,{sampleTrace2:v});},Object.assign({fontFamily:'var(--font-mono)'},big||{},{borderColor:'#85b7eb',background:'#f0f6fd'}),'Trace code V2',null);
    return [ptPair(f1,f2),ptPair(p1,p2),ptPair(t1,t2)];
  }
  function ptSewing(row,pIdx,mobile){
    var v=(row.extraFields||{}).sewing||'';
    var b=function(val,lbl,on,col){return ce('button',{type:'button',title:val==='Ok'?'Sewing OK':'Sewing not OK','aria-pressed':on,onClick:function(){ptPatchEF(pIdx,row.id,{sewing:val});},
      style:{padding:mobile?'6px 12px':'2px 7px',fontSize:mobile?13:10,fontWeight:700,borderRadius:4,cursor:'pointer',lineHeight:1.2,border:'1px solid '+(on?col:'var(--border2)'),background:on?col:'transparent',color:on?'#fff':'var(--text3)'}},lbl);};
    return ce('div',{style:{display:'flex',gap:3}},b('Ok','OK',v==='Ok','var(--green)'),b('Not Ok','✕',v==='Not Ok','var(--red)'));
  }
  function ptWeightInput(row,pIdx,mobile){
    var warn=ptWeightWarn(row);var n=ptBagKg((row.extraFields||{}).package_type);
    return ce('div',{style:{display:'flex',flexDirection:'column',gap:1}},
      ce('input',{type:'number',step:'0.01',min:'0',value:row.cartonWt||'',placeholder:'kg','aria-label':'Bag weight kg',onChange:function(e){updateRowField(pIdx,row.id,'cartonWt',e.target.value);},
        style:Object.assign({},PT_CELL,{fontSize:mobile?15:12,fontFamily:'var(--font-mono)',textAlign:'right'},mobile?{padding:'8px 10px',minHeight:40}:{},warn?{borderColor:'var(--red-border)',background:'var(--red-bg)',color:'var(--red)'}:{})}),
      warn&&ce('span',{style:{fontSize:9,color:'var(--red)',lineHeight:1.1}},'not '+n+' kg?'));
  }
  function ptDefectPanel(pIdx,row,ri){
    return ce('div',{style:{background:'#f8f4f0',borderBottom:'1px solid var(--border)',padding:'10px 14px'}},
      ce('div',{style:{fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}},'Bag B'+(ri+1)+' — all defects'+((row.extraFields||{}).size_grade?' · size measured against '+(row.extraFields||{}).size_grade:'')),
      ce('div',{className:'defect-expand-grid',style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}},
        defSections.map(function(sec){
          var secBg=secBgFor(sec),secText=secTextFor(sec);
          return ce('div',{key:sec.section,style:{background:'var(--card)',borderRadius:8,border:'1px solid var(--border)',overflow:'hidden'}},
            ce('div',{style:{background:secBg,color:secText,padding:'4px 10px',fontSize:10,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase'}},sec.section+' — '+(sec.sectionAr||'')+' · '+ptRowSec(row,sec.section).toFixed(2)),
            ce('div',{style:{padding:'6px 8px'}},
              sec.items.map(function(def){
                var v=parseFloat(row.defects[def.key])||0;
                var thresh=(Number(def.thresh)>0)?Number(def.thresh):(thresholds[def.key]!==undefined?thresholds[def.key]:0);
                var over=thresh===0?v>0:v>thresh;var isCrit=def.sev==='Critical';
                return ce('div',{key:def.key,className:'vf-def-row','data-zero':v>0?'0':'1',style:{display:'flex',alignItems:'center',gap:6,padding:'3px 0',borderBottom:'1px solid var(--border)'}},
                  ce('div',{className:'defect-name-cell',style:{flex:1,minWidth:0}},
                    ce('div',{className:'defect-en',style:{fontSize:11,color:over?(isCrit?'var(--red)':'var(--amber)'):'var(--text2)',fontWeight:over?600:400,lineHeight:1.3}},def.en,
                      def.ar&&ce('span',{style:{fontSize:9,color:'var(--text3)',fontWeight:400,marginLeft:5,direction:'rtl',display:'inline-block'}},def.ar)),
                    isCrit&&ce('div',{style:{fontSize:9,color:'var(--red)'}},'⚠ Zero tolerance')),
                  ce('button',{type:'button',className:'vstep','aria-label':('Decrease ')+def.en,onClick:function(){updateRowDefect(pIdx,row.id,def.key,visionStepVal(row.defects[def.key],-1));}},'\u2212'),ce('input',{className:'defect-row-input',style:{width:58,padding:'2px 5px',border:'1px solid '+(over?'var(--red)':'var(--border2)'),borderRadius:4,fontSize:12,fontFamily:'var(--font-mono)',textAlign:'right',background:over?'var(--red-bg)':'var(--card)',color:over?'var(--red)':'var(--text)',flexShrink:0},type:'number',step:'0.1',min:'0','aria-label':def.en+' bag '+(ri+1),value:row.defects[def.key],onChange:function(e){updateRowDefect(pIdx,row.id,def.key,e.target.value);}}),ce('button',{type:'button',className:'vstep','aria-label':('Increase ')+def.en,onClick:function(){updateRowDefect(pIdx,row.id,def.key,visionStepVal(row.defects[def.key],1));}},'+'));
              })));
        })));
  }
  function ptTiles(row,isExp,mobile){
    return defSections.map(function(sec){
      var secTotal=ptRowSec(row,sec.section);
      var secOver=sec.items.some(function(d){var thresh=(Number(d.thresh)>0)?Number(d.thresh):(thresholds[d.key]!==undefined?thresholds[d.key]:0);var v=parseFloat(row.defects[d.key])||0;return thresh===0?v>0:v>thresh;});
      var secBg=secBgFor(sec),secText=secTextFor(sec);
      return ce('div',{key:sec.section,role:'button',tabIndex:0,onClick:function(){setExpandedRow(isExp?null:row.id);},onKeyDown:function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();setExpandedRow(isExp?null:row.id);}},
        title:isExp?'Hide defects':'Enter '+sec.section+' defects',
        style:{textAlign:'center',padding:mobile?'6px 4px':'3px 2px',borderRadius:mobile?6:4,cursor:'pointer',minHeight:mobile?40:undefined,outline:isExp?'2px solid var(--accent)':'none',outlineOffset:-2,background:secOver?'var(--red-bg)':secBg,border:'1px solid '+(secOver?'var(--red-border)':'transparent')}},
        mobile&&ce('div',{style:{fontSize:9,color:secOver?'var(--red)':secText,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:2}},sec.section),
        ce('div',{style:{fontFamily:'var(--font-mono)',fontSize:mobile?15:12,fontWeight:600,color:secOver?'var(--red)':secText}},secTotal>0?secTotal.toFixed(2):'—'),
        !mobile&&ce('div',{style:{fontSize:8,color:secOver?'var(--red)':secText,opacity:.7}},sec.items.length+' items'));
    });
  }
  function ptBagsDesktop(pIdx,pallet,pRows){
    var secCols=defSections.map(function(){return '62px';}).join(' ')||'62px';
    var pair=ptIsMixed;
    var gridTpl='30px '+(pair?'92px ':'110px ')+(pair?'118px 82px 160px ':'118px 76px 160px ')+'108px 104px 76px 74px 64px 66px '+secCols+' 64px 120px 50px 20px';
    var hdr=['','Variety','Farm','Pivot','Trace code','Date','Bag type','Size','Bag kg','Peat g','Sewing'].concat(defSections.map(function(s){return s.section;})).concat(['Total','Notes','P/F','']);
    return ce('div',{style:{minWidth:'max-content'}},
      ce('div',{style:{display:'grid',gridTemplateColumns:gridTpl,gap:4,padding:'5px 14px',background:'var(--bg2)',borderBottom:'1px solid var(--border2)'}},
        hdr.map(function(h,i){return ce('div',{key:i,style:{fontSize:10,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em',textAlign:i>=11?'center':'left'}},h);})),
      pRows.map(function(row,ri){
        var isExp=expandedRow===row.id;var ef=row.extraFields||{};
        var rowCrit=(parseFloat(row.defects.pt_tuber_moth)||0)>0;
        var tot=defSections.reduce(function(t,sec){return t+ptRowSec(row,sec.section);},0);
        var fc=ptFarmCells(row,pIdx,false);
        return ce('div',{key:row.id},
          ce('div',{style:{display:'grid',gridTemplateColumns:gridTpl,gap:4,padding:'5px 14px',borderBottom:isExp?'none':'1px solid var(--border)',background:rowCrit?'#fff8f8':ri%2===0?'transparent':'rgba(0,0,0,.015)',alignItems:'center'}},
            ce('div',{role:'button',tabIndex:0,onClick:function(){setExpandedRow(isExp?null:row.id);},onKeyDown:function(e){if(e.key==='Enter'){setExpandedRow(isExp?null:row.id);}},title:isExp?'Hide defects':'Open defect entry (B'+(ri+1)+')',style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',userSelect:'none'}},
              ce('span',{style:{fontSize:9,fontWeight:700,color:'var(--text3)',lineHeight:1}},'B'+(ri+1)),
              ce('div',{style:{width:20,height:20,borderRadius:4,background:isExp?'var(--accent)':'transparent',border:'1px solid '+(isExp?'var(--accent)':'var(--border2)'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,lineHeight:1,color:isExp?'#fff':'var(--text3)'}},isExp?'−':'+')),
            ptVarCell(row,pIdx,false),
            fc[0],fc[1],fc[2],
            ce('input',{type:'date',value:row.opDate||'',onChange:function(e){updateRowField(pIdx,row.id,'opDate',e.target.value);},'aria-label':'Bag date',style:Object.assign({},PT_CELL,{fontSize:11,fontFamily:'var(--font-mono)'})}),
            ptSelect(ef.package_type||'',PT_BAG_TYPES.map(function(b){return b.name;}),function(v){ptPatchEF(pIdx,row.id,{package_type:v});},null,'Bag type',null,true),
            ptSelect(ef.size_grade||'',PT_SIZE_GRADES,function(v){ptPatchEF(pIdx,row.id,{size_grade:v});},{fontFamily:'var(--font-mono)'},'Size grade',null,true),
            ptWeightInput(row,pIdx,false),
            ce('input',{type:'number',step:'1',min:'0',value:ef.peat_g||'',placeholder:'g','aria-label':'Peat grams',onChange:function(e){ptPatchEF(pIdx,row.id,{peat_g:e.target.value});},style:Object.assign({},PT_CELL,{fontSize:12,fontFamily:'var(--font-mono)',textAlign:'right'})}),
            ptSewing(row,pIdx,false),
            ptTiles(row,isExp,false),
            ce('div',{style:{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,textAlign:'right',color:rowCrit?'var(--red)':'var(--text)'}},tot.toFixed(2)+'%'),
            ce('input',{style:Object.assign({},PT_CELL,{fontSize:11}),placeholder:'Notes…',value:row.notes||'','aria-label':'Bag notes',onChange:function(e){updateRowField(pIdx,row.id,'notes',e.target.value);}}),
            ce('div',{'data-pf-missing':(row.pass!==true&&row.pass!==false&&validErrs.some(function(e){return e.indexOf('Mark PASS')===0;}))?'true':undefined,style:Object.assign({display:'flex',flexDirection:'column',gap:2,borderRadius:4},(row.pass!==true&&row.pass!==false&&validErrs.some(function(e){return e.indexOf('Mark PASS')===0;}))?{outline:'2px solid var(--red)',outlineOffset:1}:{})},
              ce('button',{style:{padding:'2px 4px',fontSize:9,fontWeight:700,borderRadius:3,border:'1px solid '+(row.pass===true?'var(--green)':'var(--border2)'),background:row.pass===true?'var(--green)':'transparent',color:row.pass===true?'#fff':'var(--text3)',cursor:'pointer',lineHeight:1.2},onClick:function(){updateRowField(pIdx,row.id,'pass',true);}},'PASS'),
              ce('button',{style:{padding:'2px 4px',fontSize:9,fontWeight:700,borderRadius:3,border:'1px solid '+(row.pass===false?'var(--red)':'var(--border2)'),background:row.pass===false?'var(--red)':'transparent',color:row.pass===false?'#fff':'var(--text3)',cursor:'pointer',lineHeight:1.2},onClick:function(){updateRowField(pIdx,row.id,'pass',false);}},'FAIL')),
            ce('button',{style:{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,padding:0,lineHeight:1},title:'Remove bag','aria-label':'Remove bag B'+(ri+1),onClick:function(){removeRow(pIdx,row.id);}},pRows.length>1?'×':'')),
          isExp&&ptDefectPanel(pIdx,row,ri));
      }),
      ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:14,padding:'8px 14px',background:'var(--bg2)',borderTop:'2px solid var(--border2)',flexWrap:'wrap'}},
        ce('span',{style:{fontSize:11,color:'var(--text3)'}},pRows.length+' bag'+(pRows.length!==1?'s':'')+' · lot average (plain mean of the bags)'),
        ce('span',{style:{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text2)'}},'Rots '+ptRots.toFixed(2)+' · Skin '+ptSkin.toFixed(2)+' · Size '+ptSizeTot.toFixed(2)),
        ce('span',{style:{fontSize:12,fontWeight:700,fontFamily:'var(--font-mono)',color:avgTotal>10?'var(--red)':avgTotal>5?'var(--amber)':'var(--green)'}},'Lot total: '+avgTotal.toFixed(2)+'%'),
        ptMoth&&ce('span',{className:'badge badge-fail',style:{fontSize:10}},'Tuber moth')));
  }
  function ptBagCardBody(pIdx,row){
    var ef=row.extraFields||{};var fc=ptFarmCells(row,pIdx,true);
    var lab=function(t){return ce('div',{style:{fontSize:10,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',marginBottom:4}},t);};
    var big={width:'100%',padding:'8px 10px',border:'1px solid var(--border2)',borderRadius:6,fontSize:15,fontFamily:'var(--font-mono)',background:'var(--card)',minHeight:40};
    return ce('div',{className:'sample-card-grid',style:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:8, /* equal columns: the date input no longer squeezes Bag type */padding:'10px 12px',borderBottom:'1px solid var(--border)'}},
      ce('div',{style:{gridColumn:'span 2'}},lab('Variety'),ptVarCell(row,pIdx,true)),
      ce('div',null,lab('Farm'),fc[0]),
      ce('div',null,lab('Pivot'),fc[1]),
      ce('div',{style:{gridColumn:'span 2'}},lab('Trace code'),fc[2]),
      ce('div',{style:{gridColumn:'span 2'}},lab('Date'),ce('input',{style:big,type:'date',value:row.opDate||'',onChange:function(e){updateRowField(pIdx,row.id,'opDate',e.target.value);}})),
      ce('div',null,lab('Bag type'),ptSelect(ef.package_type||'',PT_BAG_TYPES.map(function(b){return b.name;}),function(v){ptPatchEF(pIdx,row.id,{package_type:v});},{fontSize:14,padding:'8px 10px',minHeight:40},'Bag type',null,true)),
      ce('div',null,lab('Size'),ptSelect(ef.size_grade||'',PT_SIZE_GRADES,function(v){ptPatchEF(pIdx,row.id,{size_grade:v});},{fontSize:14,padding:'8px 10px',minHeight:40,fontFamily:'var(--font-mono)'},'Size grade',null,true)),
      ce('div',null,lab('Bag kg'),ptWeightInput(row,pIdx,true)),
      ce('div',null,lab('Peat g'),ce('input',{style:Object.assign({},big,{textAlign:'right'}),type:'number',step:'1',min:'0',placeholder:'g',value:ef.peat_g||'',onChange:function(e){ptPatchEF(pIdx,row.id,{peat_g:e.target.value});}})),
      ce('div',null,lab('Sewing'),ptSewing(row,pIdx,true)),
      ce('div',{style:{gridColumn:'span 2'}},lab('Notes'),ce('input',{style:Object.assign({},big,{fontFamily:'var(--font-body)',fontSize:14}),placeholder:'Notes…',value:row.notes||'',onChange:function(e){updateRowField(pIdx,row.id,'notes',e.target.value);}})));
  }
  function ptLotSummaryCard(){
    var bands=[['A','Rots < 0.5% and skin < 3%'],['B','Rots ≤ 1% and skin ≤ 10%'],['C','Above B']];
    var tile=function(l,v,s,col){return ce('div',{style:{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r2)',padding:'10px 12px',minWidth:0}},
      ce('div',{style:{fontSize:11,color:'var(--text3)'}},l),ce('div',{style:{fontFamily:'var(--font-mono)',fontSize:20,fontWeight:700,color:col||'var(--text)'}},v),ce('div',{style:{fontSize:10,color:'var(--text3)'}},s));};
    return ce('div',{className:'card',style:{marginBottom:12}},
      ce('div',{className:'section-title'},ce('div',{className:'section-title-bar',style:{background:'#8a6a2e'}}),'Lot summary — ملخص اللوط'),
      ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}},
        tile('Total rots (lot avg)',ptRots.toFixed(2)+'%','grade A below 0.5%',ptRots>=0.5?'var(--red)':'var(--green)'),
        tile('Total skin (lot avg)',ptSkin.toFixed(2)+'%','grade A below 3%',ptSkin>=3?'var(--red)':'var(--green)'),
        tile('Over + under size',ptSizeTot.toFixed(2)+'%','in the grand total'),
        tile('Grand total',avgTotal.toFixed(2)+'%',allRows.length+' bag'+(allRows.length!==1?'s':'')+' · plain mean'),
        ce('div',{style:{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r2)',padding:'10px 12px'}},
          ce('div',{style:{fontSize:11,color:'var(--text3)',marginBottom:4}},'Grade (الشحن bands)'),
          ce('div',{style:{display:'flex',gap:4,flexWrap:'wrap'}},bands.map(function(b){var on=ptLotGrade===b[0];var col=b[0]==='A'?'var(--green)':b[0]==='B'?'var(--amber)':'var(--red)';
            return ce('span',{key:b[0],title:b[1],style:{fontSize:11,fontWeight:on?700:500,borderRadius:6,padding:'3px 8px',border:'1px solid '+(on?col:'var(--border2)'),background:on?col:'transparent',color:on?'#fff':'var(--text3)'}},b[0]);})),
          ptMoth&&ce('div',{style:{fontSize:10,color:'var(--red)',fontWeight:600,marginTop:4}},'C because tuber moth was found — zero tolerance'))));
  }
  /* ── POTATOES: header in four groups (Lot · Variety · Origin · Client) ─────────────────────
     Its own layout so no orchards-only gaps (class/carton/wax/packing are hidden for potatoes).
     Same state + setters as the orchards header; farm/pivot pairs are a list view over
     farm..farm4 + additionalFarms so removing a middle pair shifts the rest up. */
  function ptTick(k){return preFilled&&ce('button',{type:'button','aria-label':'Confirm '+k,onClick:function(){confirmUnit(k);},style:{background:unitConfirmed[k]?'var(--green)':'transparent',border:'1.5px solid '+(unitConfirmed[k]?'var(--green)':'var(--amber)'),borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,padding:0}},ce('span',{style:{fontSize:10,color:unitConfirmed[k]?'#fff':'var(--amber)',lineHeight:1}},'✓'));}
  function ptAmber(k){return preFilled&&!unitConfirmed[k]?{borderColor:'var(--amber)',boxShadow:'0 0 0 2px #e8c87a44'}:{};}
  function ptLbl(text,k,extra){return ce('label',{className:'form-label',style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}},ce('span',null,text,extra||null),k?ptTick(k):null);}
  function ptPairs(){
    var nm=function(v){return (v==='__selecting__')?'':(v||'');};
    var L=[{name:nm(farm),plot:plot||''}];
    if(farm2) L.push({name:nm(farm2),plot:plot2||''});
    if(farm2&&farm3) L.push({name:nm(farm3),plot:plot3||''});
    if(farm2&&farm3&&farm4){L.push({name:nm(farm4),plot:plot4||''});(additionalFarms||[]).forEach(function(af){L.push({name:af.farmName||'',plot:af.plot||''});});}
    return L;
  }
  function ptSetPairs(L){
    markDirty();
    var g=function(i,k){return L[i]?(L[i][k]||''):'';};
    setFarm(g(0,'name'));setPlot(g(0,'plot'));
    setFarm2(L[1]?(L[1].name||'__selecting__'):'');setPlot2(g(1,'plot'));
    setFarm3(L[2]?(L[2].name||'__selecting__'):'');setPlot3(g(2,'plot'));
    setFarm4(L[3]?(L[3].name||'__selecting__'):'');setPlot4(g(3,'plot'));
    setAdditionalFarms(L.slice(4).map(function(x){return {farmId:(config.farmsIdMap&&config.farmsIdMap[x.name])||'',farmName:x.name||'',plot:x.plot||''};}));
  }
  function ptHeaderBody(){
    var pairs=ptPairs();
    var farmOpts=function(cur){var o=farms.slice();if(cur&&o.indexOf(cur)<0)o.push(cur);return o;};
    var varOpts=((config.varietiesFull||{})[cropId]||[]).map(function(v){return v.name;});
    return ce(React.Fragment,null,
      /* LOT */
      ce('div',{className:'hdr-grp',style:{borderTop:0,paddingTop:0}},'Lot — اللوط'),
      ce('div',{className:'grid4',style:{marginBottom:6}},
        ce('div',{className:'form-field'},ce('label',{className:'form-label'},'Date'),ce('input',{className:'form-input',type:'date',value:date,onChange:function(e){setDate(e.target.value);}})),
        ce('div',{className:'form-field','data-field':'lot'},ce('label',{className:'form-label'},'LOT No',ce('span',{style:{color:'var(--red)',marginLeft:3}},'*')),ce('input',{className:'form-input',value:lot,inputMode:'numeric',required:true,'aria-required':'true',onChange:function(e){setLot(e.target.value);},onBlur:function(e){prefillFromLot(e.target.value);},placeholder:'e.g. 10001'})),
        ce('div',{className:'form-field pt-s2'},ptLbl('Container No','container',ce('span',{style:{fontWeight:400,color:'var(--text3)',textTransform:'none',letterSpacing:0}},' — optional, set at loading')),
          ce('input',{className:'form-input',value:container,onChange:function(e){markDirty();setContainer(e.target.value);if(preFilled)confirmUnit('container');},placeholder:'e.g. AMCU 9327595',style:ptAmber('container')}))
      ),
      /* VARIETY */
      ce('div',{className:'hdr-grp'},'Variety — الصنف'),
      ce('div',{className:'grid4',style:{marginBottom:6}},
        ce('div',{className:'form-field','data-field':'variety'},ptLbl(varietyType==='mixed'?'Variety 1':'Variety','variety',ce('span',{style:{color:'var(--red)',marginLeft:3}},'*')),
          ce('select',{className:'form-select',value:variety,style:ptAmber('variety'),onChange:function(e){var nv=e.target.value;var oldV=variety;
            setPallets(function(prev){return prev.map(function(p){return Object.assign({},p,{rows:p.rows.map(function(r){return (!r.sampleVariety||r.sampleVariety===oldV)?Object.assign({},r,{sampleVariety:nv}):r;})});});});
            markDirty();setVariety(nv);if(preFilled)confirmUnit('variety');}},
            ce('option',{value:''},'— Select —'),
            varOpts.filter(function(n){return varietyType!=='mixed'||n!==variety2;}).map(function(n){return ce('option',{key:n,value:n},n);}),
            variety&&varOpts.indexOf(variety)<0&&ce('option',{value:variety},variety+' (inactive)'))),
        ce('div',{className:'form-field'},ce('label',{className:'form-label'},'Variety type'),
          ce('div',{className:'pt-seg',role:'group','aria-label':'Variety type'},['single','mixed'].map(function(t){var on=varietyType===t;
            return ce('button',{key:t,type:'button','aria-pressed':on,className:on?'on':'',onClick:function(){markDirty();setVarietyType(t);if(t==='single'){setVariety2('');setCategory2('');}}},t==='single'?'Single':'Mixed');}))),
        varietyType==='mixed'
        ?ce('div',{className:'form-field pt-s2'},ce('label',{className:'form-label'},'Variety 2',ce('span',{style:{color:'var(--red)',marginLeft:3}},'*')),
            ce('select',{className:'form-select',value:variety2,onChange:function(e){markDirty();setVariety2(e.target.value);}},
              ce('option',{value:''},'— Select —'),
              varOpts.filter(function(n){return n!==variety;}).map(function(n){return ce('option',{key:n,value:n},n);})),
            ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:3}},'Mixed = both varieties inside the same bag. Each bag gets a Variety 1 and a Variety 2 farm / pivot.'))
        :ce('div',{className:'form-field pt-s2'},ce('label',{className:'form-label'},'Extra varieties',ce('span',{style:{fontWeight:400,color:'var(--text3)',textTransform:'none',letterSpacing:0}},' — whole bags of another variety in this lot')),
            ce('div',{className:'pt-chips'},
              extraVarieties.map(function(xv,xi){
                return ce('span',{key:xi,className:'pt-chip'},
                  ce('select',{value:xv,'aria-label':'Extra variety '+(xi+1),onChange:function(e){var nv=e.target.value;var old=xv;markDirty();setExtraVarieties(function(prev){return prev.map(function(v,i){return i===xi?nv:v;});});
                    if(old)setPallets(function(prev){return prev.map(function(p){return Object.assign({},p,{rows:p.rows.map(function(r){return r.sampleVariety===old?Object.assign({},r,{sampleVariety:nv}):r;})});});});}},
                    ce('option',{value:''},'— Select —'),
                    varOpts.filter(function(n){return n===xv||(n!==variety&&extraVarieties.indexOf(n)<0);}).map(function(n){return ce('option',{key:n,value:n},n);})),
                  ce('button',{type:'button','aria-label':'Remove '+(xv||'variety'),title:'Remove',onClick:function(){var gone=xv;markDirty();setExtraVarieties(function(prev){return prev.filter(function(_,i){return i!==xi;});});
                    if(gone)setPallets(function(prev){return prev.map(function(p){return Object.assign({},p,{rows:p.rows.map(function(r){return r.sampleVariety===gone?Object.assign({},r,{sampleVariety:variety}):r;})});});});}},'×'));
              }),
              ce('button',{type:'button',className:'pt-add',onClick:function(){markDirty();setExtraVarieties(function(prev){return prev.concat(['']);});}},'+ Add variety')))
      ),
      /* ORIGIN */
      ce('div',{className:'hdr-grp'},'Origin — farms & pivots'),
      ce('div',{className:'grid4',style:{marginBottom:6}},
        pairs.map(function(pr,i){
          var n=pairs.length>1?' '+(i+1):'';
          return ce('div',{key:i,className:'pt-s2 pt-pair'},
            ce('div',{className:'form-field'},
              ce('label',{className:'form-label',style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}},
                ce('span',null,'Farm'+n),
                ce('span',{style:{display:'inline-flex',gap:6,alignItems:'center'}},
                  i===0&&ptTick('farm'),
                  i>0&&ce('button',{type:'button',className:'pt-rm','aria-label':'Remove farm'+n,onClick:function(){var L=ptPairs();L.splice(i,1);ptSetPairs(L);}},'× Remove'))),
              ce('select',{className:'form-select',value:pr.name,style:i===0?ptAmber('farm'):{},onChange:function(e){var L=ptPairs();var nv=e.target.value;if(L[i].name!==nv)L[i]={name:nv,plot:''};ptSetPairs(L);if(i===0&&preFilled)confirmUnit('farm');}},
                ce('option',{value:''},'— Select farm —'),
                farmOpts(pr.name).map(function(f){return ce('option',{key:f,value:f},f);}))),
            ce('div',{className:'form-field'},ce('label',{className:'form-label'},'Pivot'+n),
              ce('input',{className:'form-input',value:pr.plot,placeholder:'e.g. 11/1',style:{fontFamily:'var(--font-mono)'},onChange:function(e){var L=ptPairs();L[i]=Object.assign({},L[i],{plot:e.target.value});ptSetPairs(L);}})));
        }),
        !hdrLocked&&ce('div',{className:'pt-s2 pt-addtile-wrap'},
          ce('button',{type:'button',className:'pt-addtile',onClick:function(){var L=ptPairs();L.push({name:'',plot:''});ptSetPairs(L);}},'+ Add farm / pivot'))
      ),
      /* CLIENT */
      ce('div',{className:'hdr-grp'},'Client — العميل'),
      ce('div',{className:'grid4',style:{marginBottom:0}},
        ce('div',{className:'form-field pt-s2','data-field':'client'},ce('label',{className:'form-label'},'Client'),
          ce(Typeahead,{value:client,onChange:function(v){markDirty();setClient(v);},options:clients,placeholder:'Type to search client…',minChars:2})),
        ce('div',{className:'form-field'},ce('label',{className:'form-label'},'Country'),
          ce('select',{className:'form-select',value:country,onChange:function(e){markDirty();setCountry(e.target.value);}},
            ce('option',{value:''},'— Select country —'),
            countries.map(function(c){return ce('option',{key:c,value:c},c);}))),
        ce('div',{className:'form-field'},ce('label',{className:'form-label'},'Client sticker'),
          ce('div',{className:'pt-seg',role:'group','aria-label':'Client sticker'},[['Ok','OK'],['Not Ok','Not OK']].map(function(o){var on=labelling===o[0];
            return ce('button',{key:o[0],type:'button','aria-pressed':on,className:on?('on'+(o[0]==='Not Ok'?' bad':'')):'',onClick:function(){markDirty();setLabelling(o[0]);}},o[1]);})))
      )
    );
  }
  /* potatoes: when the header has exactly ONE farm (+ one pivot) or ONE trace code, empty bags take it
     automatically (bag 1 used to start blank). Only fills blanks — never overwrites a bag's pick. */
  React.useEffect(function(){
    {}
    var F=ptHeaderFarms(),T=ptTraceOpts('v1');
    setPallets(function(prev){var changed=false;var next=prev.map(function(p){return Object.assign({},p,{rows:p.rows.map(function(r){
      var ef=r.extraFields||{},patch={};
      if(F.length===1&&!ef.sampleFarm)patch.sampleFarm=F[0];
      var fm=patch.sampleFarm||ef.sampleFarm;if(fm&&!ef.samplePlot){var pv=ptPivotsFor(fm);if(pv.length===1)patch.samplePlot=pv[0];}
      if(T.length===1&&!ef.sampleTrace)patch.sampleTrace=T[0];
      if(!Object.keys(patch).length)return r;changed=true;return Object.assign({},r,{extraFields:Object.assign({},ef,patch)});})});});
      return changed?next:prev;});
  },[isPT,farm,plot,farm2,plot2,farm3,plot3,farm4,plot4,JSON.stringify(additionalFarms||[]),JSON.stringify(traceCodes||[]),varietyType,variety,variety2,pallets.length,allRows.length]);
  /* potatoes: suggest Reject on grade C or any tuber moth (الشحن bands); orchards unchanged */
  var autoDec=(ptLotGrade==='C'||ptMoth)?'R':'A';
  
  function startNewLOT(){
    /* Comprehensive reset — clears ALL form state when inspector chooses "New session/LOT".
       Previously called setTraceCode() (singular, undefined) which threw and aborted the rest of
       the reset; many fields also weren't included at all and silently leaked across sessions
       (plot/farm2/plot2/cartonColor/cartonCompany/stickerChecks/extraLabels/clearance/etc.) */
    /* Header text fields */
    setLot('');setContainer('');
    setDateRaw(new Date().toISOString().slice(0,10));
    /* Variety / category */
    setCategory('');setCategory2('');
    setVariety((config.varieties[cropId]||[''])[0]||'');setVarietyType('single');setVariety2('');
    setCls((config.classes||['Class 1'])[0]||'');
    /* Client / origin / farms */
    setClient('');setCountry('');setFarm('');setFarm2('');setFarm3('');setFarm4('');setAdditionalFarms([]);
    setPlot('');setPlot2('');setPlot3('');setPlot4('');
    /* Packing & labelling — wax only applies to citrus */
    setWax('');
    setPacking('');setLabelling('Ok');
    /* Trace codes — uses the correct plural setter (was setTraceCode, undefined) */
    setTraceCodes([{code:'',variety:null}]);
    /* Carton / sticker / GGN / codes */
    setGGN('');setCartonColor('');setCartonCompany('');setCartonCompany2('');setCartonType('');
    setPHCode('40.01.20.02/CIP');setFarmCode('');setNetWt('');
    setImporter('');setImporterAddr('');
    setStickerImg('');
    setStickerChecks({product:false,variety:false,cls:false,phName:false,phCode:false,farmCode:false,packDate:false,netWt:false,trace:false,ggn:false,lot:false,importer:false,origin:false});
    setExtraLabels([]);
    /* LOT pre-fill confirmation flags — fresh entry behaves like initial useState (no batch) */
    setUnitConfirmed({container:true,variety:true,cls:true,farm:true});
    setUnitConfirmWarn(false);setPreFilled(false);
    /* Pallets — start fresh with one empty pallet, no expanded row */
    setPallets([newPallet(1)]);setActivePalletIdx(0);
    setExpandedRow(null);
    /* Decision / clearance / lock */
    setDecision('');
    setExtraVarieties([]);setOutcome('');
    setClearance({c0:'',c1:'',c2:'',c3:''});
    setHdrLocked(false);
    /* Validation & dirty tracking */
    setValidErrs([]);setIsDirty(false);setShowDraftBanner(false);
    /* Reset audit timer — this becomes a brand-new draft so completion_minutes restarts here */
    if(formOpenedAtRef&&formOpenedAtRef.current!==undefined) formOpenedAtRef.current=new Date();
    /* Close the new-pallet/new-session modal */
    setShowNP(false);
  }
  var varieties=config.varieties[cropId]||CITRUS_VARIETIES;
  var classes=config.classes||CITRUS_CLASSES;
  var clients=(config.inspSubClients&&config.inspSubClients.length?config.inspSubClients:config.clients)||[];
  var countries=config.countries||[];
  var farms=config.farms||[];

  /* ── Post-save success screen ── */
  /* ── Post-save confirmation screen (pending / success / failed) ── */
  if(savePending || savedLot || saveFailed!==null){
    var isConfirmPending=savePending&&!savedLot&&saveFailed===null;
    var isConfirmFailed=saveFailed!==null&&!savedLot;
    var isConfirmSuccess=!!savedLot;
    return ce('div',{style:{background:'var(--bg)',minHeight:'100vh',display:'flex',flexDirection:'column'}},
      ce('div',{className:'form-topbar',style:{background:'var(--card)',borderBottom:'1px solid var(--border)',padding:'0 16px',height:50,display:'flex',alignItems:'center',gap:8}},
        isConfirmFailed&&ce('button',{className:'btn btn-secondary btn-sm',onClick:function(){
          setSaveFailed(null);
          setSaveStatus('error');
          setSaveErrMsg(saveFailed||'Save failed — please try again.');
        }},'← Back to form'),
        isConfirmSuccess&&ce('button',{className:'btn btn-secondary btn-sm',onClick:safeClose},'← Back to list'),
        ce('div',{style:{fontFamily:'var(--font-display)',fontSize:16}},
          isConfirmPending?'Saving\u2026':isConfirmFailed?'Save failed':'Inspection saved'
        )
      ),
      ce('div',{style:{maxWidth:480,margin:'60px auto',padding:'0 24px',textAlign:'center'}},
        ce('div',{style:{width:56,height:56,borderRadius:'50%',
          background:isConfirmFailed?'#fff0f0':isConfirmPending?'var(--bg2)':'var(--green-bg)',
          border:'2px solid '+(isConfirmFailed?'#f5c0c0':isConfirmPending?'var(--border)':'var(--green-border)'),
          display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:22}},
          isConfirmPending?ce('span',{className:'dalos-spinner',style:{width:22,height:22,borderWidth:3}}):
          isConfirmFailed?'\u2717':'\u2713'
        ),
        ce('div',{style:{fontFamily:'var(--font-display)',fontSize:22,color:'var(--text)',marginBottom:8}},
          isConfirmPending?'Saving inspection\u2026':isConfirmFailed?'Save failed':'Unit saved'
        ),
        ce('div',{style:{fontSize:14,color:'var(--text3)',marginBottom:32}},
          isConfirmPending
            ?ce('span',{style:{fontFamily:'var(--font-mono)',color:'var(--text3)',letterSpacing:'.05em'}},'Assigning ID\u2026')
            :isConfirmFailed
            ?ce('span',{style:{color:'var(--red)',fontSize:13}},saveFailed)
            :ce('span',null,
                'Inspection saved — ',
                ce('span',{style:{fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--text)'}},savedInspId||savedLot),
                savedLot?ce('span',{style:{color:'var(--text3)'}},' · LOT '+savedLot):null
              )
        ),
        ce('div',{style:{display:'flex',flexDirection:'column',gap:10}},
          isConfirmSuccess&&ce('button',{className:'btn btn-primary',style:{justifyContent:'center',padding:'12px 24px',fontSize:14},
            onClick:function(){
              prefillFromLot(savedLot);
              setLot(savedLot);
              sGrpSession[1](null); /* next unit = new inspection */
              setSaveStatus('idle'); /* clear stale "Saved at" banner from previous unit */
              setDecision('');
              setPallets([newPallet(1,'',container)]);
              setActivePalletIdx(0);
              setSavedLot(false);
            }
          },('+ Add another unit under LOT '+savedLot)),
          isConfirmFailed&&ce('button',{className:'btn btn-primary',style:{justifyContent:'center',padding:'12px 24px',fontSize:14},
            onClick:function(){
              setSaveFailed(null);
              setSaveStatus('error');
              setSaveErrMsg(saveFailed||'Save failed — please try again.');
            }
          },'\u2190 Back to form'),
          ce('button',{
            className:'btn btn-secondary',
            style:{justifyContent:'center',padding:'12px 24px',fontSize:14,
              opacity:(isConfirmPending||isConfirmFailed)?.35:1,
              pointerEvents:(isConfirmPending||isConfirmFailed)?'none':'auto',
              cursor:(isConfirmPending||isConfirmFailed)?'not-allowed':'pointer'
            },
            onClick:isConfirmSuccess?onClose:undefined,
            disabled:isConfirmPending||isConfirmFailed
          },isConfirmFailed?'Done — back to list (save first)':'Done — back to list')
        )
      )
    );
  }

  return ce('div',{style:{background:'var(--bg)',minHeight:'100vh'}},
    ce('div',{className:'form-topbar',style:{background:'var(--card)',borderBottom:'1px solid var(--border)',padding:'0 16px',height:50,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20,gap:8}},
      ce(VisionFormStrip,{hdrLocked:hdrLocked}),
      ce('div',{className:'form-topbar-left-group',style:{display:'flex',alignItems:'center',gap:8,minWidth:0,flex:1}},
        ce('button',{className:'btn btn-secondary btn-sm',onClick:safeClose,style:{flexShrink:0,padding:'6px 10px'}},'← Back'),
        ce('div',{className:'form-topbar-title',style:{fontFamily:'var(--font-display)',fontSize:16,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},isEdit?'Edit':'New inspection'),
        ce(VisionCrumb,{className:'vcr-form',cropId:cropId,ph:packhouse,crop:visionCropInfo(config,cropId)}),
        /* Season chip — where this inspection will be SAVED (the season currently open).
           Green when it's the active/current season, amber when it's a different one. */
        (function(){
          var vid=config.activeSeasonId,aid=config.trueActiveSeasonId;
          var sname=((config.seasons||[]).find(function(s){return s.id===vid;})||{}).name||'';
          if(!sname) return null;
          var onActive=vid===aid;
          return ce('div',{className:'topbar-badge',title:onActive?'Saving into the current season':'Saving into '+sname+' — not the current season',style:{display:'flex',alignItems:'center',gap:5,background:onActive?'var(--green-bg)':'var(--amber-bg)',border:'1px solid '+(onActive?'var(--green-border)':'var(--amber-border)'),borderRadius:6,padding:'3px 10px',flexShrink:0}},
            ce('span',{style:{fontSize:11,fontWeight:600,color:onActive?'var(--green)':'#8a5a10',fontFamily:'var(--font-mono)'}},'Season '+sname),
            !onActive&&ce('span',{style:{fontSize:10,color:'var(--amber)',whiteSpace:'nowrap'}},'· not current')
          );
        })(),
        (lot&&ce('div',{className:'topbar-badge',style:{background:'var(--bg2)',borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:500,color:'var(--text2)',flexShrink:0}},'LOT '+lot)),
        /* Presence pill — shown when others have this form open */
        isEdit&&otherUsers.length>0&&ce('div',{style:{display:'flex',alignItems:'center',gap:5,padding:'2px 8px',background:'#FFF2CC',border:'0.5px solid #e6c84a',borderRadius:4,flexShrink:0}},
          otherUsers.slice(0,2).map(function(u,i){
            var initials=u.user_name.split(' ').map(function(p){return p[0];}).join('').slice(0,2).toUpperCase();
            return ce('div',{key:u.user_id,style:{width:20,height:20,borderRadius:'50%',background:'#FAC775',color:'#633806',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:500,marginLeft:i>0?-6:0,border:'1.5px solid #FFF2CC',flexShrink:0,title:u.user_name}},initials);
          }),
          ce('span',{style:{fontSize:11,color:'#7F6000',fontWeight:500,marginLeft:2}},
            otherUsers.length===1?otherUsers[0].user_name.split(' ')[0]+' also has this open':otherUsers.length+' others viewing'
          )
        )
      ),
      ce('div',{className:'form-topbar-right',style:{display:'flex',alignItems:'center',gap:6,flexShrink:0}},
        ce('span',{className:'form-topbar-avg',style:{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:avgTotal>10?'var(--red)':avgTotal>5?'var(--amber)':'var(--green)',whiteSpace:'nowrap'}},avgTotal.toFixed(1)+'%'),
        hasCrit&&ce('span',{className:'badge badge-fail',style:{flexShrink:0,fontSize:10}},'Crit'),
        /* Draft indicator: synced / failed / pending */
        draftSyncFailed
          ?ce('span',{title:'Cloud backup failed - data safe locally. Will retry.',style:{fontSize:10,color:'#e09b2d',whiteSpace:'nowrap',flexShrink:0,display:'inline-flex',alignItems:'center',gap:3,cursor:'default'}},
              '\u26A0\uFE0F Draft not synced'
            )
          :draftSavedAt
          ?ce('span',{style:{fontSize:10,color:'var(--text3)',whiteSpace:'nowrap',flexShrink:0,display:'inline-flex',alignItems:'center',gap:3}},
              ce('span',{style:{fontSize:11}},'\uD83D\uDCBE'),
              'Autosaved '+draftSavedAt
            )
          :isDirty&&ce('span',{style:{fontSize:10,color:'var(--text3)',whiteSpace:'nowrap',flexShrink:0}},'⋯ Saving draft…'),
        /* PDF download buttons — show in edit mode or after save */
        (isEdit||savedLot)&&ce('button',{className:'btn btn-sm',title:'Download client-facing PDF report',style:{background:'var(--bg2)',border:'1px solid var(--border2)',color:'var(--text2)',fontSize:11,flexShrink:0,display:'inline-flex',alignItems:'center',gap:4},onClick:function(){generatePDF('client');}},'\u2193 Client PDF'),
        (isEdit||savedLot)&&ce('button',{className:'btn btn-sm',title:'Download internal inspection record PDF',style:{background:'var(--bg2)',border:'1px solid var(--border2)',color:'var(--text2)',fontSize:11,flexShrink:0,display:'inline-flex',alignItems:'center',gap:4},onClick:function(){generatePDF('internal');}},'\u2193 Internal PDF'),
        (ce('button',{className:'btn btn-sm form-topbar-newpallet',style:{background:'#eef4ff',border:'1px solid #a0b8e8',color:'#2a5aa0',fontWeight:500,flexShrink:0,whiteSpace:'nowrap'},onClick:function(){if(isEdit){addRowToPallet(0);}else{setShowNP(true);}}},isEdit?'+ Bag':'Bag / LOT')),
        ce('button',{className:'btn btn-primary btn-sm',style:{flexShrink:0,opacity:(isSaving||!isOnline&&!isReconnecting)?.7:1,display:'inline-flex',alignItems:'center',gap:6},
          onClick:function(){
            if(!isOnline||isReconnecting) return; /* offline banner already communicates this — no need for a second amber banner */
            handleSave();
          },
          disabled:isSaving},
          isSaving&&ce('span',{className:'dalos-spinner'}),
          isSaving?'Saving\u2026':'Save'
        ),
        /* Connection status pill */
        isReconnecting
          ?ce('span',{style:{fontSize:11,fontWeight:500,padding:'3px 8px',borderRadius:4,background:'#FAEEDA',border:'0.5px solid #FAC775',color:'#854F0B',flexShrink:0,display:'inline-flex',alignItems:'center',gap:4}},
              ce('span',{style:{width:6,height:6,borderRadius:'50%',background:'#BA7517',display:'inline-block'}}),
              'Reconnecting\u2026')
          :!isOnline
          ?ce('span',{style:{fontSize:11,fontWeight:500,padding:'3px 8px',borderRadius:4,background:'#FCEBEB',border:'0.5px solid #F7C1C1',color:'#A32D2D',flexShrink:0,display:'inline-flex',alignItems:'center',gap:4}},
              ce('span',{style:{width:6,height:6,borderRadius:'50%',background:'#E24B4A',display:'inline-block'}}),
              'Offline')
          :null
      )
    ),
    /* Validation errors — sticky just under the topbar (50px) so user always sees it while scrolling */
    validErrs.length>0&&ce('div',{'data-validation-banner':'true',style:{background:'var(--red-bg)',border:'1px solid var(--red-border)',borderRadius:6,padding:'10px 14px',margin:'8px 24px 0',display:'flex',alignItems:'flex-start',gap:10,position:'sticky',top:50,zIndex:19,boxShadow:'0 2px 8px rgba(176,48,48,.15)'}},
      ce('div',{style:{color:'var(--red)',fontSize:18,lineHeight:1,flexShrink:0}},'\u26a0'),
      ce('div',{style:{flex:1}},
        ce('div',{style:{fontWeight:600,fontSize:12,color:'var(--red)',marginBottom:4}},'Please fill in required fields before saving:'),
        ce('div',{style:{display:'flex',flexWrap:'wrap',gap:6}},
          validErrs.map(function(e){return ce('span',{key:e,style:{fontSize:11,background:'var(--red-bg)',color:'var(--red)',border:'1px solid var(--red-border)',borderRadius:10,padding:'2px 9px'}},e);})
        )
      ),
      ce('button',{onClick:function(){setValidErrs([]);},style:{background:'transparent',border:'none',color:'var(--red)',cursor:'pointer',fontSize:18,lineHeight:1,padding:'0 4px',flexShrink:0,opacity:.7},title:'Dismiss'},'\u00d7')
    ),
    /* Save status — fixed banner below topbar so user always sees saving/saved/error feedback */
    seasonConfirm&&ce('div',{style:{position:'fixed',inset:0,zIndex:60,background:'rgba(26,26,23,.42)',display:'flex',alignItems:'center',justifyContent:'center',padding:16},onClick:function(){setSeasonConfirm(null);}},
      ce('div',{onClick:function(e){e.stopPropagation();},style:{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--r2)',width:'100%',maxWidth:420,padding:'20px 22px',boxShadow:'0 12px 40px rgba(26,26,23,.28)'}},
        ce('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:12}},
          ce('span',{style:{fontSize:20,lineHeight:1}},'🗓️'),
          ce('div',{style:{fontFamily:'var(--font-display)',fontSize:19,color:'var(--text)'}},'Save into '+seasonConfirm.viewed+'?')
        ),
        ce('div',{style:{fontSize:13,color:'var(--text2)',lineHeight:1.55,marginBottom:16}},
          'You are viewing ',
          ce('b',{style:{color:'var(--text)'}},seasonConfirm.viewed),
          ', which is not the current active season (',
          ce('b',null,seasonConfirm.active),
          '). This inspection will be filed under ',
          ce('b',{style:{color:'var(--text)'}},seasonConfirm.viewed),
          ' and its ID will carry that season’s year.'
        ),
        ce('div',{style:{display:'flex',gap:8,justifyContent:'flex-end'}},
          ce('button',{onClick:function(){setSeasonConfirm(null);},style:{background:'var(--card)',border:'1px solid var(--border2)',color:'var(--text2)',borderRadius:'var(--r)',padding:'7px 14px',fontSize:13,fontWeight:500,cursor:'pointer'}},'Cancel'),
          ce('button',{onClick:function(){seasonConfirmedRef.current=true;setSeasonConfirm(null);handleSave();},style:{background:'var(--accent)',border:'1px solid var(--accent)',color:'#fff',borderRadius:'var(--r)',padding:'7px 14px',fontSize:13,fontWeight:500,cursor:'pointer'}},'Save to '+seasonConfirm.viewed)
        )
      )
    ),
    (saveStatus==='saving'||saveStatus==='saved'||saveStatus==='error')&&ce('div',{style:{position:'sticky',top:50,zIndex:21,margin:'8px 24px 0',padding:'9px 14px',borderRadius:6,display:'flex',alignItems:'center',gap:10,fontSize:12,fontWeight:600,
      background:saveStatus==='saving'?'#fff8e1':saveStatus==='saved'?'var(--green-bg)':'var(--red-bg)',
      border:'1px solid '+(saveStatus==='saving'?'#e8c97a':saveStatus==='saved'?'var(--green-border)':'var(--red-border)'),
      color:saveStatus==='saving'?'#8a6a1a':saveStatus==='saved'?'var(--green)':'var(--red)',
      boxShadow:'0 2px 10px rgba(0,0,0,.08)'}},
      saveStatus==='saving'?ce('span',{className:'dalos-spinner'}):ce('span',{style:{fontSize:16,lineHeight:1}},saveStatus==='saved'?'\u2713':'\u26a0'),
      ce('div',{style:{flex:1}},
        saveStatus==='saving'?'Saving inspection\u2026 please wait':
        saveStatus==='saved'?('Saved at '+savedAtTime+(isEdit?' \u2014 closing\u2026':'')):
        saveErrMsg
      ),
      saveStatus==='error'&&saveErrMsg.indexOf('another device')>=0
        ?ce('button',{onClick:function(){
            setSaveStatus('idle');setSaveErrMsg('');
            if(isEdit&&batch&&batch.id){
              supabase.from('inspections').select('updated_at').eq('id',batch.id).single().then(function(r){
                if(r.data&&r.data.updated_at){
                  loadedVersionRef.current=r.data.updated_at;
                  try{if(typeof refreshBatchesById==='function') refreshBatchesById([batch.id]);}catch(e){}
                }
              });
            }
          },style:{background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:11,padding:'4px 11px',borderRadius:4,fontWeight:600,flexShrink:0,whiteSpace:'nowrap'}},'\u21ba Refresh')
        :saveStatus==='error'&&ce('button',{onClick:function(){setSaveStatus('idle');setSaveErrMsg('');},style:{background:'transparent',border:'1px solid var(--red-border)',color:'var(--red)',cursor:'pointer',fontSize:11,padding:'3px 9px',borderRadius:4,fontWeight:600,flexShrink:0}},'Dismiss')
    ),
    /* Offline / reconnecting warning banner — sticky below topbar */
    (!isOnline||isReconnecting)&&ce('div',{style:{position:'sticky',top:50,zIndex:22,margin:'8px 24px 0',padding:'10px 14px',borderRadius:6,display:'flex',alignItems:'flex-start',gap:10,fontSize:12,fontWeight:500,
      background:isReconnecting?'#FAEEDA':'#FCEBEB',
      borderLeft:'3px solid '+(isReconnecting?'#BA7517':'#E24B4A'),
      color:isReconnecting?'#854F0B':'#A32D2D',
      boxShadow:'0 2px 8px rgba(0,0,0,.07)'}},
      ce('span',{style:{fontSize:15,lineHeight:1,marginTop:1,flexShrink:0}},isReconnecting?'\u26a0':'\u26d4'),
      ce('div',{style:{flex:1,lineHeight:1.5}},
        isReconnecting
          ?ce('span',null,ce('strong',null,'Reconnecting\u2026'),' your data is still here. Save will unlock once connection is restored.')
          :ce('span',null,ce('strong',null,'Connection lost'),' \u2014 your data is safe in this form. ',ce('strong',null,'Do not close this tab'),'. Reconnect to continue, then save.')
      )
    ),
    /* ── GRAPES: pallet-level container conflict popup ── */
    grpPopup&&ce('div',{style:{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:110}},
      ce('div',{style:{background:'var(--card)',borderRadius:'var(--r2)',width:500,maxWidth:'95vw',border:'1px solid var(--border)',boxShadow:'0 20px 60px rgba(0,0,0,.22)',overflow:'hidden'}},
        /* header */
        grpPopup.scenario==='existing'
        ?ce('div',{style:{padding:'13px 18px',borderBottom:'1px solid var(--border)',background:'\u0023fff3e0'}},
            ce('div',{style:{fontWeight:600,fontSize:14,color:'\u0023854d0e'}},'\u26a0 Container belongs to another session'),
            ce('div',{style:{fontSize:11,color:'\u002392400e',marginTop:2}},'This pallet will be moved out of the current session')
          )
        :ce('div',{style:{padding:'13px 18px',borderBottom:'1px solid var(--border)',background:'var(--green-bg)'}},
            ce('div',{style:{fontWeight:600,fontSize:14,color:'var(--green)'}},'\u2726 New container \u2014 create session?'),
            ce('div',{style:{fontSize:11,color:'var(--accent)',marginTop:2}},'No existing session found for this container number')
          ),
        /* body */
        ce('div',{style:{padding:'16px 18px'}},
          grpPopup.scenario==='existing'
          ?ce('div',null,
              ce('div',{style:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'11px 13px',marginBottom:12}},
                ce('div',{style:{fontSize:12,color:'var(--text)',fontWeight:600,marginBottom:6}},'Container ',ce('span',{style:{fontFamily:'var(--font-mono)'}},grpPopup.containerVal),' is on session:'),
                grpPopup.targetSession&&ce('div',{style:{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--accent)',fontWeight:600}},grpPopup.targetSession.id||'—'),
                grpPopup.targetSession&&ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:4}},grpPopup.targetSession.variety||'','\u00a0\u00b7\u00a0',grpPopup.targetSession.date||'')
              ),
              ce('div',{style:{fontSize:12,color:'var(--text2)',marginBottom:10}},'Pallet ',ce('strong',{style:{fontFamily:'var(--font-mono)'}},pallets[grpPopup.pIdx]?pallets[grpPopup.pIdx].palletLabel||('#'+pallets[grpPopup.pIdx].palletNo):''),' will disappear from this session once moved.'),
              ce('div',{style:{background:'var(--red-bg)',border:'1px solid var(--red-border)',borderRadius:5,padding:'7px 11px',fontSize:11,color:'var(--red)'}},'Action is logged in the audit trail. Reversible via \u201cMove to session\u2026\u201d.')
            )
          :ce('div',null,
              ce('div',{style:{background:'var(--green-bg)',border:'1px solid var(--green-border)',borderRadius:6,padding:'11px 13px',marginBottom:12}},
                ce('div',{style:{fontSize:12,color:'var(--green)',fontWeight:600,marginBottom:6}},'New session will be created for container ',ce('span',{style:{fontFamily:'var(--font-mono)'}},grpPopup.containerVal)),
                ce('div',{style:{fontSize:11,color:'var(--text2)',marginBottom:8}},'The new session will copy this session\u2019s header:'),
                ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 14px',fontSize:11}},
                  ce('div',null,ce('span',{style:{color:'var(--text3)'}},'Variety: '),ce('strong',null,variety||'\u2014')),
                  ce('div',null,ce('span',{style:{color:'var(--text3)'}},'Client: '),ce('strong',null,client||'\u2014')),
                  ce('div',null,ce('span',{style:{color:'var(--text3)'}},'Farm: '),ce('strong',null,farm||'\u2014')),
                  ce('div',null,ce('span',{style:{color:'var(--text3)'}},'Class: '),ce('strong',null,cls||'\u2014'))
                )
              ),
              ce('div',{style:{background:'var(--amber-bg)',border:'1px solid var(--amber-border)',borderRadius:5,padding:'7px 11px',fontSize:11,color:'var(--amber)'}},'💡 The new session header fields will be editable after creation if anything differs for this container.')
            )
        ),
        /* footer */
        ce('div',{style:{padding:'11px 18px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',gap:8,background:'var(--bg2)'}},
          ce('button',{className:'btn btn-secondary btn-sm',onClick:function(){
              /* Revert the pallet container back to the session container */
              updatePalletContainer(grpPopup.pIdx, container||'');
              setGrpPopup(null);
            }},'\u00d7 Cancel'),
          grpPopup.scenario==='existing'
          ?ce('button',{className:'btn btn-primary btn-sm',onClick:function(){
              var target=grpPopup.targetSession;
              var msg='Move pallet '+( grpPopup.palletLabel||'')+ ' to session '+(target?target.id:'new session')+'?\n\nThis will update both sessions\u2019 aggregates.';
              if(!window.confirm(msg)){
                updatePalletContainer(grpPopup.pIdx, container||'');
                setGrpPopup(null);
                return;
              }
              doMovePallet(grpPopup.pIdx,target?target.id:null);
            }},'Move pallet \u2192')
          :ce('button',{className:'btn btn-primary btn-sm',style:{background:'var(--green)',borderColor:'var(--green)'},onClick:function(){
              if(!window.confirm('Create a new session and move this pallet?')){
                updatePalletContainer(grpPopup.pIdx, container||'');
                setGrpPopup(null);
                return;
              }
              createSessionAndMovePallet(grpPopup.pIdx);
            }},'Create session & move \u2192')
        )
      )
    ),
    /* ── GRAPES: move-to-session modal ── */
    grpMoveModal&&ce('div',{style:{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:110}},
      ce('div',{style:{background:'var(--card)',borderRadius:'var(--r2)',width:560,maxWidth:'95vw',border:'1px solid var(--border)',boxShadow:'0 20px 60px rgba(0,0,0,.22)',overflow:'hidden',display:'flex',flexDirection:'column',maxHeight:'85vh'}},
        ce('div',{style:{padding:'13px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}},
          ce('div',null,
            ce('div',{style:{fontWeight:600,fontSize:14,color:'var(--text)'}},'Move pallet to another session'),
            ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:2}},'The pallet and all its sample rows will move.')
          ),
          ce('button',{style:{fontSize:18,color:'var(--text3)',lineHeight:1,background:'none',border:'none',cursor:'pointer'},onClick:function(){setGrpMoveModal(null);setGrpMoveSearch('');}},'\u00d7')
        ),
        ce('div',{style:{padding:'13px 18px',borderBottom:'1px solid var(--border)'}},
          ce('div',{style:{display:'inline-flex',alignItems:'center',gap:6,background:'#f5eeff',border:'1px solid #d8b8f0',borderRadius:5,padding:'5px 10px',fontSize:12,marginBottom:10}},
            ce('span',{style:{color:'var(--text3)',fontSize:11}},'Moving:'),
            ce('span',{style:{fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--accent)'}},grpMoveModal.palletLabel),
            ce('span',{style:{color:'#d8b8f0'}},' · '),
            ce('span',{style:{fontSize:11,color:'var(--text2)'}},'from ',ce('span',{style:{fontFamily:'var(--font-mono)',fontSize:11}},grpSessionId))
          ),
          ce('input',{className:'form-input',value:grpMoveSearch,onChange:function(e){setGrpMoveSearch(e.target.value);},placeholder:'Search by session ID, container, client, variety, pallet\u2026',style:{marginBottom:0}})
        ),
        ce('div',{style:{flex:1,overflowY:'auto',padding:'12px 18px',display:'flex',flexDirection:'column',gap:8}},
          /* Filter and render other grapes sessions */
          (function(){
            var q=grpMoveSearch.toLowerCase();
            var others=allBatches.filter(function(b){
              return (b.crop||b.cropId||'')===cropId&&b.id!==grpSessionId;
            }).filter(function(b){
              if(!q) return true;
              var palletNums=(b.pallets||[]).map(function(p){return (p.palletLabel||p.palletNo||'').toString().toLowerCase();}).join(' ');
              var containerStr=(b.container||'').toLowerCase();
              /* also check live pallets for container */
              var livePalletsContainers=(sessionPallets[b.id]||[]).map(function(p){return (p.container||'').toLowerCase();}).join(' ');
              return palletNums.indexOf(q)>=0
                ||(b.variety||'').toLowerCase().indexOf(q)>=0
                ||(b.variety2||'').toLowerCase().indexOf(q)>=0
                ||(b.date||'').indexOf(q)>=0
                ||(b.id||'').toLowerCase().indexOf(q)>=0
                ||containerStr.indexOf(q)>=0
                ||livePalletsContainers.indexOf(q)>=0
                ||(b.client||'').toLowerCase().indexOf(q)>=0;
            });
            if(others.length===0) return ce('div',{style:{fontSize:12,color:'var(--text3)',textAlign:'center',padding:'20px 0'}},'No other '+cropId+' sessions in this packhouse.');
            return others.map(function(b){
              var livePallets=sessionPallets[b.id]||[];
              /* get container from live pallets or from batch */
              var liveContainer=(livePallets.length>0&&livePallets[0].container)||b.container||'';
              return ce('div',{key:b.id,style:{border:'1px solid var(--border)',borderRadius:6,padding:'10px 13px',cursor:'pointer',transition:'border-color .12s,background .12s'},
                onMouseEnter:function(e){e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--bg)';},
                onMouseLeave:function(e){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='transparent';},
                onClick:function(bid,pidx,blabel,plabel){return function(){if(!window.confirm('Move pallet '+plabel+' to session '+blabel+'?\nThis will update both sessions\u2019 aggregates.')) return;doMovePallet(pidx,bid);};}(b.id,grpMoveModal.pIdx,b.id,grpMoveModal.palletLabel)
              },
                ce('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:4}},
                  ce('span',{style:{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:'var(--accent)'}},b.id),
                  ce('span',{style:{fontSize:11,color:'var(--text3)'}},(b.variety||''),' · ',(b.date||'')),
                  ce('span',{style:{marginLeft:'auto',fontSize:11,color:'var(--text3)'}},(b.packhouse||''))
                ),
                ce('div',{style:{display:'flex',flexWrap:'wrap',gap:6,marginBottom:livePallets.length>0?6:0,alignItems:'center'}},
                  liveContainer
                    ?ce('span',{style:{fontFamily:'var(--font-mono)',fontSize:10,background:'var(--green-bg)',border:'1px solid var(--green-border)',borderRadius:3,padding:'2px 7px',color:'var(--green)',fontWeight:600}},liveContainer)
                    :ce('span',{style:{fontSize:10,color:'var(--text3)',fontStyle:'italic'}},'No container yet'),
                  b.client&&ce('span',{style:{fontSize:10,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:3,padding:'2px 7px',color:'var(--text2)'}},b.client)
                ),
                livePallets.length>0&&ce('div',{style:{display:'flex',flexWrap:'wrap',gap:4}},
                  livePallets.map(function(p,pi){return ce('span',{key:pi,style:{fontFamily:'var(--font-mono)',fontSize:10,background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:3,padding:'2px 6px',color:'var(--text2)'}},p.palletLabel||'—');})
                ),
                livePallets.length===0&&ce('div',{style:{fontSize:10,color:'var(--text3)',fontStyle:'italic'}},palletsLoaded?'No pallets yet':'Loading pallets...')
              );
            });
          })(),
          /* New empty session option */
          ce('div',{style:{border:'1.5px dashed var(--border2)',borderRadius:6,padding:'10px 13px',cursor:'pointer',textAlign:'center',fontSize:12,color:'var(--text3)',transition:'border-color .12s'},
            onMouseEnter:function(e){e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)';},
            onMouseLeave:function(e){e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.color='var(--text3)';},
            onClick:function(){if(!window.confirm('Move pallet '+grpMoveModal.palletLabel+' to a new empty session?')) return;doMovePallet(grpMoveModal.pIdx,null);}
          },'＋ Move to a new empty session instead')
        ),
        ce('div',{style:{padding:'10px 18px',borderTop:'1px solid var(--border)',background:'var(--bg2)',fontSize:11,color:'var(--text3)'}},'⚠ This action is logged in the audit trail.')
      )
    ),
    showNP&&ce('div',{style:{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:100}},
      ce('div',{className:'new-pallet-modal',style:{background:'var(--card)',borderRadius:'var(--r2)',padding:'24px 28px',width:340,border:'1px solid var(--border)'}},
        ce('div',{style:{fontFamily:'var(--font-display)',fontSize:20,marginBottom:6}},'New pallet'),
        ce('div',{style:{fontSize:13,color:'var(--text3)',marginBottom:20}},'Same LOT or completely new LOT?'),
        ce('div',{style:{display:'flex',flexDirection:'column',gap:10}},
          ce('button',{className:'btn btn-primary',style:{justifyContent:'flex-start',padding:'14px 16px',flexDirection:'column',alignItems:'flex-start',height:'auto'},onClick:function(){addRowToPallet(0);setShowNP(false);}},
            ce('div',{style:{fontWeight:600,marginBottom:2}},'Add bag B'+(allRows.length+1)+' — same LOT'+(lot?' '+lot:'')),
            ce('div',{style:{fontSize:11,opacity:.8,fontWeight:400}},'Adds another sampled bag to this lot. Header stays the same.')),
          npWarn
          ?ce('div',{style:{border:'1.5px solid #e8a0a0',background:'#fdf3f2',borderRadius:10,padding:'14px 16px'}},
              ce('div',{style:{fontWeight:600,fontSize:13,color:'#a03030',marginBottom:4}},'⚠ This '+('unit')+' is NOT saved yet'),
              ce('div',{style:{fontSize:12,color:'#7a4040',lineHeight:1.5,marginBottom:12}},'Starting a new '+('LOT')+' now will permanently discard everything entered in this form.'),
              ce('button',{className:'btn btn-primary',style:{width:'100%',justifyContent:'center',marginBottom:8},onClick:function(){setNPWarn(false);setShowNP(false);handleSave();}},'Save this '+('unit')+' first'),
              ce('button',{className:'btn btn-secondary',style:{width:'100%',justifyContent:'center',color:'#a03030',borderColor:'#e8a0a0'},onClick:function(){setNPWarn(false);startNewLOT();}},'Discard and start fresh')
            )
          :ce('button',{className:'btn btn-secondary',style:{justifyContent:'flex-start',padding:'14px 16px',flexDirection:'column',alignItems:'flex-start',height:'auto'},onClick:function(){if(isDirty){setNPWarn(true);}else{startNewLOT();}}},
            ce('div',{style:{fontWeight:600,marginBottom:2}},'New LOT'),
            ce('div',{style:{fontSize:11,color:'var(--text3)',fontWeight:400}},'Clears everything. Fresh header.')
          ),
          ce('button',{className:'btn btn-secondary btn-sm',onClick:function(){setNPWarn(false);setShowNP(false);}},'✕ Cancel')
        )
      )
    ),
    ce('div',{className:'inspection-page',style:{padding:'18px 24px',maxWidth:1200,margin:'0 auto'}},
      /* potatoes: undo a removed bag */
      ptUndo&&ce('div',{role:'status',style:{position:'fixed',left:'50%',bottom:24,transform:'translateX(-50%)',zIndex:70,display:'flex',alignItems:'center',gap:14,background:'#1e2d22',color:'#fff',borderRadius:10,padding:'10px 12px 10px 16px',boxShadow:'0 8px 28px rgba(0,0,0,.25)',fontSize:13}},
        ce('span',null,'Bag '+ptUndo.label+' removed'),
        ce('button',{type:'button',onClick:ptUndoRemove,style:{background:'#fff',color:'#1e2d22',border:0,borderRadius:6,padding:'8px 14px',fontWeight:700,fontSize:13,cursor:'pointer',minHeight:36}},'Undo'),
        ce('button',{type:'button','aria-label':'Dismiss',onClick:function(){setPtUndo(null);},style:{background:'transparent',color:'#c8d4c0',border:0,fontSize:16,cursor:'pointer',padding:'4px 6px'}},'\u00d7')),
      /* Draft recovery banner */
      restoredDraft&&showDraftBanner&&ce('div',{style:{marginBottom:10,padding:'10px 14px',background:'#FFF8E1',border:'1px solid #F9A825',borderRadius:8,display:'flex',alignItems:'center',gap:10,fontSize:12,color:'#6D4C00'}},
        ce('span',{style:{fontSize:16,flexShrink:0}},'⚠️'),
        ce('span',null,ce('strong',null,'Draft recovered. '),'Your previous unsaved data has been restored. Review and save when ready.'),
        ce('button',{onClick:function(){try{localStorage.removeItem(draftKey);}catch(e){}setPallets([newPallet(1)]);setShowDraftBanner(false);},style:{marginLeft:'auto',padding:'3px 10px',fontSize:11,border:'1px solid #F9A825',borderRadius:4,background:'transparent',color:'#6D4C00',cursor:'pointer',flexShrink:0}},'Discard draft')
      ),
      /* GRAPES session banner */
      false,
      /* HEADER CARD */
      ce('div',{className:'card',style:{marginBottom:12}},
        ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}},
          ce('div',{className:'section-title',style:{marginBottom:0}},
            ce('div',{className:'section-title-bar',style:{background:'#2b5c3f'}}),'Inspection header',
            hdrLocked&&ce('span',{style:{fontSize:10,background:'var(--green-bg)',color:'var(--green)',border:'1px solid var(--green-border)',borderRadius:10,padding:'1px 8px',marginLeft:6}},'Locked')
          ),
          hdrLocked?ce('button',{className:'btn btn-secondary btn-sm',
            style:lockHint?{borderColor:'var(--amber)',boxShadow:'0 0 0 3px #e8c87a55',color:'var(--amber)'}:null,
            onClick:function(){setHdrLocked(false);setLockHint(false);}},'Unlock to edit')
            :ce('button',{className:'btn btn-primary btn-sm',onClick:function(){setHdrLocked(true);}},'Lock header')
        ),
        /* Shown when someone tries to edit while locked — otherwise the attempt is silent. */
        hdrLocked&&lockHint&&ce('div',{style:{marginBottom:10,padding:'8px 12px',background:'var(--amber-bg)',border:'1px solid var(--amber-border)',borderRadius:6,fontSize:12,color:'#7a4a10',display:'flex',alignItems:'center',gap:8}},
          ce('span',{style:{fontSize:14}},'🔒'),
          ce('span',null,ce('strong',null,'Header is locked. '),'Tap ',ce('strong',null,'Unlock to edit'),' above before changing these fields — otherwise your changes are not saved.')
        ),
        ce('div',{style:{display:'flex',alignItems:'center',gap:10,background:packhouse.color+'0e',border:'1px solid '+packhouse.color+'30',borderRadius:8,padding:'8px 12px',marginBottom:12}},
          ce('div',{style:{width:30,height:30,borderRadius:7,background:packhouse.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}},packhouse.initials||packhouse.id.slice(0,2)),
          ce('div',null,ce('div',{style:{fontWeight:600,fontSize:13,color:packhouse.color}},packhouse.name),ce('div',{style:{fontSize:11,color:'var(--text3)'}},'Check place: '+packhouse.id)),
          ce('div',{style:{marginLeft:'auto',fontSize:11,color:'var(--text3)',fontStyle:'italic'}},'Set at login')
        ),
        ce('div',{className:hdrLocked?'hdr-locked':null,
          onClick:hdrLocked?flashLockHint:null,
          title:hdrLocked?'Header is locked — tap "Unlock to edit" above':null,
          style:{opacity:hdrLocked?.6:1}},
          ptHeaderBody()
        )
      ),
      /* LABEL STICKER — not used for potatoes */
      false,
      /* EXTRA LABEL STICKERS */
      ([]).map(function(elabel,eli){
        var elChecks=elabel.checks||{};
        var elDone=Object.values(elChecks).filter(Boolean).length;
        var checkItems=(function(){
          var baseItems=[{key:'product',label:'Product'},{key:'variety',label:'Variety'},{key:'cls',label:'Class'},{key:'phName',label:'Packhouse'},{key:'phCode',label:'PH code'},{key:'farmCode',label:'Farm code'},{key:'packDate',label:'Packing date'},{key:'netWt',label:'Net weight'},{key:'trace',label:'Trace code'},{key:'ggn',label:'GGN'},{key:'lot',label:'LOT No'},{key:'importer',label:'Imported by'},{key:'origin',label:'Country of origin'}];
          return baseItems;
        })();
        return ce('div',{key:eli,className:'card',style:{marginBottom:12,border:'1px solid var(--green-border)'}},
          ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}},
            ce('div',{className:'section-title',style:{marginBottom:0}},
              ce('div',{className:'section-title-bar',style:{background:'#2e5d3a'}}),
              'Extra Label '+(eli+1)+' — لصقة إضافية',
              elDone===checkItems.length
                ?ce('span',{style:{fontSize:11,background:'var(--green-bg)',color:'var(--green)',border:'1px solid var(--green-border)',borderRadius:10,padding:'2px 10px',fontWeight:600,marginLeft:6}},'✓ All verified')
                :ce('span',{style:{fontSize:11,background:'var(--amber-bg)',color:'var(--amber)',border:'1px solid var(--amber-border)',borderRadius:10,padding:'2px 10px',fontWeight:500,marginLeft:6}},elDone+' / '+checkItems.length+' verified')
            ),
            ce('button',{className:'btn btn-sm',style:{background:'var(--red-bg)',color:'var(--red)',border:'1px solid var(--red-border)',fontSize:11},onClick:function(i){return function(){removeExtraLabel(i);};}(eli)},'Remove label')
          ),
          ce('div',{className:'sticker-grid',style:{display:'grid',gridTemplateColumns:elabel.img?'2fr 1fr':'1fr 1fr',gap:14}},
            ce('div',null,
              ce('div',{className:'form-field',style:{marginBottom:10}},
                ce('label',{className:'form-label'},'Sticker photo or Google Drive link'),
                ce('div',{style:{display:'flex',gap:6}},
                  ce('input',{className:'form-input',value:elabel.img,onChange:function(i){return function(e){setExtraLabelImg(i,e.target.value);};}(eli),placeholder:'Paste link...',style:{flex:1}}),
                  ce('label',{className:'btn btn-secondary btn-sm',style:{cursor:'pointer',display:'flex',alignItems:'center',gap:4}},
                    '↑ Upload',
                    ce('input',{type:'file',accept:'image/*',style:{display:'none'},onChange:function(i){return function(e){
                      var file=e.target.files&&e.target.files[0];if(!file)return;
                      uploadStickerToStorage(file, (batch&&batch.id?batch.id+'-extra'+i:'extra'+i), function(url){setExtraLabelImg(i,url);});
                    };}(eli)})
                  )
                )
              ),
              elabel.img&&ce('div',{style:{marginBottom:10,border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',background:'var(--bg2)',padding:4}},
                (elabel.img.startsWith('data:')||elabel.img.startsWith('http'))?ce('img',{src:elabel.img,style:{width:'100%',maxHeight:420,objectFit:'contain',display:'block',borderRadius:4}}):ce('div',{style:{padding:'8px',fontSize:11,color:'var(--accent)'}},'Drive link attached')
              )
            ),
            ce('div',null,
              ce('div',{style:{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}},'Tick each field confirmed on the physical label'),
              ce('div',{style:{border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}},
                checkItems.map(function(item){
                  var checked=elChecks[item.key];
                  return ce('div',{key:item.key,className:'vf-lab-row',style:{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderBottom:'1px solid var(--border)',background:checked?'var(--green-bg)':'transparent',cursor:'pointer'},onClick:function(i,k){return function(){toggleExtraLabelCheck(i,k);};}(eli,item.key)},
                    ce('div',{className:'vf-lab-box','data-on':checked?'1':'0',style:{width:16,height:16,borderRadius:3,border:'1.5px solid '+(checked?'var(--green)':'var(--border2)'),background:checked?'var(--green)':'var(--card)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},
                      checked&&ce('svg',{width:9,height:9,viewBox:'0 0 9 9'},ce('path',{d:'M1 4.5l2.5 2.5 4-4',stroke:'#fff',strokeWidth:1.5,fill:'none',strokeLinecap:'round',strokeLinejoin:'round'}))
                    ),
                    ce('div',{style:{fontSize:12,color:checked?'var(--green)':'var(--text2)',fontWeight:checked?600:400}},item.label)
                  );
                })
              ),
              ce('button',{style:{marginTop:6,width:'100%',padding:'5px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,fontSize:11,color:'var(--text2)',cursor:'pointer'},
                onClick:function(i,items){return function(){setExtraLabels(function(prev){return prev.map(function(l,li){if(li!==i)return l;var c=Object.assign({},l.checks);var anyOff=items.some(function(it){return !c[it.key];});items.forEach(function(it){c[it.key]=anyOff;});return Object.assign({},l,{checks:c});});});};}(eli,checkItems)
              },elDone===checkItems.length?'Uncheck all':'Mark all verified')
            )
          )
        );
      }),
      /* Add extra label button */
      false,
      /* TRACE CODES — grapes only: above pallets for per-pallet assignment */
      ce('div',{className:'card',style:{marginBottom:12},'data-field':'traceCodes'},
        ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}},
          ce('div',{className:'section-title',style:{marginBottom:0}},
            ce('div',{className:'section-title-bar',style:{background:'#5a7ab0'}}),
            'Trace Codes',
            false
          )
        ),
        traceCodes.map(function(tc,ti){
          var isMixed=varietyType==='mixed'&&variety&&variety2;
          var tcCode=typeof tc==='string'?tc:(tc&&tc.code)||'';
          var tcVar=typeof tc==='string'?null:(tc&&tc.variety)||null;
          var rowStyle={display:'flex',gap:6,marginBottom:6,alignItems:'center'};
          if(isMixed&&tcCode.trim()){
            if(tcVar==='v1') rowStyle=Object.assign({},rowStyle,{background:'#EEEDFE',border:'0.5px solid #AFA9EC',borderRadius:6,padding:'4px 8px'});
            else if(tcVar==='v2') rowStyle=Object.assign({},rowStyle,{background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:6,padding:'4px 8px'});
            else rowStyle=Object.assign({},rowStyle,{background:'var(--bg2)',border:'0.5px solid var(--amber-border)',borderRadius:6,padding:'4px 8px'});
          }
          /* Compute shared-farm flag and label info for the toggle buttons */
          var sameFarm=isMixed&&farm&&farm2&&farm.trim().toLowerCase()===farm2.trim().toLowerCase();
          var v1Label=variety||(isMixed?'V1':'');
          var v2Label=variety2||(isMixed?'V2':'');
          var v1Sub=sameFarm?(plot?'P. '+plot:''):(farm?(plot?farm+' · P. '+plot:farm):'');
          var v2Sub=sameFarm?(plot2?'P. '+plot2:''):(farm2?(plot2?farm2+' · P. '+plot2:farm2):'');
          return ce('div',{key:ti,style:rowStyle},
            isMixed&&ce('div',{style:{width:7,height:7,borderRadius:'50%',background:tcVar==='v1'?'#534AB7':tcVar==='v2'?'#BA7517':'var(--amber)',flexShrink:0}}),
            ce('input',{className:'form-input',value:tcCode,
              onChange:function(idx,oldC){return function(e){var nv=e.target.value;markDirty()||setTraceCodes(function(prev){var n=prev.slice();n[idx]={code:nv,variety:n[idx]?n[idx].variety:null};return n;});renameTraceInPallets(oldC,nv);};}(ti,tcCode),
              style:{fontFamily:'var(--font-mono)',fontSize:13,flex:1},
              placeholder:'e.g. 111031325042104'
            }),
            isMixed&&ce('div',{style:{display:'flex',alignItems:'center',gap:0,flexShrink:0}},
              /* Shared farm label — only when both varieties come from the same farm */
              sameFarm&&farm&&ce('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',paddingRight:7,marginRight:3,borderRight:'0.5px solid var(--border2)',flexShrink:0}},
                ce('span',{style:{fontSize:9,fontWeight:500,color:'var(--text3)',whiteSpace:'nowrap'}},farm)
              ),
              ce('div',{style:{display:'flex',borderRadius:5,overflow:'hidden',border:'0.5px solid var(--border2)',flexShrink:0}},
                ['v1','both','v2'].map(function(v){
                  var active=tcVar===v;
                  var bg=active?(v==='v1'?'#534AB7':v==='v2'?'#BA7517':'#888'):'transparent';
                  var col=active?'#fff':'var(--text3)';
                  if(v==='both') return ce('button',{key:v,
                    onClick:function(idx,vv){return function(e){e.stopPropagation();markDirty()||setTraceCodes(function(prev){var n=prev.slice();n[idx]={code:n[idx]?n[idx].code:'',variety:vv};return n;});};}(ti,v),
                    style:{padding:'3px 8px',fontSize:10,fontWeight:500,cursor:'pointer',border:'none',background:active?'#888':'transparent',color:active?'#fff':'var(--text3)',transition:'all .1s',whiteSpace:'nowrap',alignSelf:'stretch',display:'flex',alignItems:'center'}
                  },'Both');
                  var vLabel=v==='v1'?v1Label:v2Label;
                  var vSub=v==='v1'?v1Sub:v2Sub;
                  return ce('button',{key:v,
                    onClick:function(idx,vv){return function(e){e.stopPropagation();markDirty()||setTraceCodes(function(prev){var n=prev.slice();n[idx]={code:n[idx]?n[idx].code:'',variety:vv};return n;});};}(ti,v),
                    style:{padding:'3px 10px',cursor:'pointer',border:'none',background:bg,color:col,transition:'all .1s',display:'flex',flexDirection:'column',alignItems:'center',gap:1,lineHeight:1.2}
                  },
                    ce('span',{style:{fontSize:10,fontWeight:500,whiteSpace:'nowrap'}},vLabel),
                    vSub&&ce('span',{style:{fontSize:8,opacity:.85,whiteSpace:'nowrap'}},vSub)
                  );
                })
              )
            ),
            traceCodes.length>1&&ce('button',{
              onClick:function(idx,oldC){return function(){markDirty()||setTraceCodes(function(prev){return prev.filter(function(_,i){return i!==idx;});});renameTraceInPallets(oldC,'');};}(ti,tcCode),
              style:{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:18,lineHeight:1,padding:'0 6px',flexShrink:0}
            },'\u00d7')
          );
        }),
        ce('button',{className:'btn btn-secondary btn-sm',style:{marginTop:2},
          onClick:function(){markDirty()||setTraceCodes(function(prev){return prev.concat([{code:'',variety:null}]);});}
        },'\u002b Add trace code')
      ),
      /* SAMPLE ROWS — one card per pallet */
      pallets.map(function(pallet,pIdx){
        var pRows=pallet.rows;
        var isActive=activePalletIdx===pIdx;
        /* pallet-level averages */
        function pAvgDef(key){var vals=pRows.map(function(r){return parseFloat(r.defects[key])||0;});return vals.length?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length*100)/100:0;}
        
        
        function pAvgDefRaw(key){var vals=pRows.map(function(r){return parseFloat(r.defects[key])||0;});return vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:0;}
        var pTotal=0;defSections.forEach(function(sec){sec.items.forEach(function(d){pTotal+=pAvgDefRaw(d.key);});});pTotal=Math.round(pTotal*100)/100;
        var pCrit=defSections.some(function(sec){return sec.items.some(function(d){return d.sev==='Critical'&&pAvgDef(d.key)>0;});});
        var isMixed=varietyType==='mixed'&&variety&&variety2;
        return ce('div',{key:pallet.palletId},
          /* Pallet separator — clearly marks where each pallet starts */
          pIdx>0&&ce('div',{style:{display:'flex',alignItems:'center',gap:10,margin:'20px 0 8px',userSelect:'none'}},
            ce('div',{style:{height:2,flex:1,background:'linear-gradient(90deg,var(--accent) 0%,var(--border) 100%)',borderRadius:2}}),
            ce('div',{style:{fontSize:10,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'.12em',whiteSpace:'nowrap',padding:'3px 10px',border:'1.5px solid var(--accent)',borderRadius:20,background:'var(--green-bg)'}},'Pallet '+(pallet.palletLabel||((packhouse.palletPrefix||'')+(pallet.palletNo||pIdx+1)))),
            ce('div',{style:{height:2,flex:1,background:'linear-gradient(90deg,var(--border) 0%,transparent 100%)',borderRadius:2}})
          ),
          ce('div',{className:'card',style:{marginBottom:12,padding:0,overflow:'hidden',border:'2px solid '+(isActive?'var(--accent)':'var(--border)'),transition:'border-color .2s',animation:animatingPalletId===pallet.palletId?'dalos-pallet-slide-out 340ms cubic-bezier(0.4,0,0.6,1) forwards':undefined}},
          /* Potatoes: no pallet header — just the sampled bags */
          ce('div',{style:{padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,background:'var(--bg2)'}},
            ce('div',{style:{minWidth:0}},
              ce('div',{className:'section-title',style:{marginBottom:0}},ce('div',{className:'section-title-bar',style:{background:'#8a6a2e'}}),'Sampled bags — العينات',
                ce('span',{style:{fontSize:11,color:'var(--text3)',fontWeight:400,textTransform:'none',letterSpacing:0,marginLeft:6}},pRows.length+' bag'+(pRows.length!==1?'s':''))),
              ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:2}},'Each bag picks its variety, farm, pivot and trace code from the header. Tap a section tile to enter defects.')),
            ce('div',{style:{display:'flex',alignItems:'center',gap:8}},ce(LiveClock,null),
              ce('button',{className:'btn btn-primary btn-sm',onClick:function(){addRowToPallet(pIdx);}},'+ Bag'))),
          /* Pallet header */
          false,
          /* Trace codes row — grapes only, sits between header and sample table */
          false,
          /* Actual Traceability Code — collapsible, star icon, clean UX */
          false,
          /* Sample rows table — desktop */
          ce('div',{className:'sample-table-desktop',style:{overflowX:'auto',WebkitOverflowScrolling:'touch',position:'relative'}},
            ptBagsDesktop(pIdx,pallet,pRows)
          ),
          /* ── MOBILE SAMPLE CARDS ── */
          ce('div',{className:'sample-card-mobile',style:{padding:'8px 10px'}},
            ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}},
              ce('div',{style:{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em'}},
                (pRows.length+' sampled bag'+(pRows.length!==1?'s':''))
              )
              /* '+ Bag' lives once, in the Sampled bags header above (was shown twice on phones) */
            ),
            pRows.map(function(row,ri){
              var rowCrit=defSections.some(function(sec){return sec.items.some(function(d){return d.sev==='Critical'&&(parseFloat(row.defects[d.key])||0)>0;});});
              var isExp=expandedRow===row.id;
              return ce('div',{key:row.id,style:{background:rowCrit?'#fff8f8':'var(--card)',border:'1px solid '+(rowCrit?'var(--red-border)':'var(--border)'),borderRadius:10,marginBottom:8,overflow:'hidden'}},
                /* Sample card header */
                ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:rowCrit?'var(--red-bg)':'var(--bg2)',borderBottom:'1px solid '+(rowCrit?'var(--red-border)':'var(--border)')},onClick:function(){setExpandedRow(isExp?null:row.id);}},
                  ce('div',{style:{display:'flex',alignItems:'center',gap:8}},
                    ce('div',{style:{width:28,height:24,borderRadius:6,background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}},('B')+(ri+1)),
                    ce('span',{style:{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text3)'}},'@ '+row.time),
                    rowCrit&&ce('span',{className:'badge badge-fail',style:{fontSize:10}},'Critical')
                  ),
                  ce('div',{style:{display:'flex',alignItems:'center',gap:6}},
                    ce('span',{style:{fontSize:12,fontWeight:600,color:'var(--accent)'}},(function(){var t=0;defSections.forEach(function(sec){sec.items.forEach(function(d){t+=parseFloat(row.defects[d.key])||0;});});return t>0?t.toFixed(1)+'%':'0%';})()),
                    ce('span',{style:{fontSize:13,color:'var(--accent)'}},(isExp?'▲':'▼'))
                  )
                ),
                /* Sample card body — crop-aware measurements */
                ptBagCardBody(pIdx,row),
                /* Defect section tiles — same as the desktop row: one tile per section of THIS product's
                   defect list (DB-driven, no hard-coded keys; the old 5 fixed keys didn't exist for pomegranate).
                   Tap a tile to open every defect of the sample (the "All defects" panel below). */
                ce('div',{style:{padding:'8px 12px',borderBottom:'1px solid var(--border)'}},
                  ce('div',{style:{fontSize:10,color:'var(--text3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}},'Defects (%) — tap to enter'),
                  ce('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(92px,1fr))',gap:6}},
                    defSections.map(function(sec){
                      var secTotal=sec.items.reduce(function(sum,d){return sum+(parseFloat(row.defects[d.key])||0);},0);
                      var secOver=sec.items.some(function(d){var thresh=(Number(d.thresh)>0)?Number(d.thresh):(thresholds[d.key]!==undefined?thresholds[d.key]:0);return thresh===0?(parseFloat(row.defects[d.key])||0)>0:(parseFloat(row.defects[d.key])||0)>thresh;});
                      var secBg=secBgFor(sec);
                      var secText=secTextFor(sec);
                      return ce('div',{key:sec.section,onClick:function(){setExpandedRow(isExp?null:row.id);},
                        style:{textAlign:'center',padding:'6px 4px',borderRadius:6,cursor:'pointer',minHeight:40,outline:isExp?'2px solid var(--accent)':'none',outlineOffset:isExp?-2:0,background:secOver?'var(--red-bg)':secBg,border:'1px solid '+(secOver?'var(--red-border)':'transparent')}},
                        ce('div',{style:{fontSize:9,color:secOver?'var(--red)':secText,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:2,lineHeight:1.2}},sec.section),
                        ce('div',{style:{fontFamily:'var(--font-mono)',fontSize:15,fontWeight:600,color:secOver?'var(--red)':secText}},secTotal>0?secTotal.toFixed(1):'—'),
                        ce('div',{style:{fontSize:9,color:secOver?'var(--red)':secText,opacity:.7}},sec.items.length+' items')
                      );
                    })
                  )
                ),
                /* Expanded — all defects */
                isExp&&ce('div',{style:{padding:'10px 12px',background:'#f8f4f0'}},
                  ce('div',{style:{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}},'All defects'),
                  ce('div',{className:'defect-expand-grid',style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:6}},
                    defSections.map(function(sec){
                      var secBg=secBgFor(sec);
                      var secText=secTextFor(sec);
                      return ce('div',{key:sec.section,style:{background:'var(--card)',borderRadius:8,border:'1px solid var(--border)',overflow:'hidden'}},
                        ce('div',{style:{background:secBg,color:secText,padding:'5px 10px',fontSize:10,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase'}},sec.section),
                        ce('div',{style:{padding:'6px 8px'}},
                          (sec.items||[]).length===0
                            ? ce('div',{style:{fontSize:10,color:'var(--text3)',fontStyle:'italic',padding:'4px 0',textAlign:'center'}},'No defects defined yet')
                            : sec.items.map(function(def){
                            var v=parseFloat(row.defects[def.key])||0;
                            var thresh=(Number(def.thresh)>0)?Number(def.thresh):(thresholds[def.key]!==undefined?thresholds[def.key]:0);
                            var over=thresh===0?v>0:v>thresh;
                            var isCrit=def.sev==='Critical';
                            return ce('div',{key:def.key,className:'vf-def-row','data-zero':(parseFloat(row.defects[def.key])||0)>0?'0':'1',style:{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:'1px solid var(--border)'}},
                              ce('div',{className:'defect-name-cell',style:{flex:1,minWidth:0}},
                                ce('div',{className:'defect-en',style:{fontSize:12,color:over?(isCrit?'var(--red)':'var(--amber)'):'var(--text2)',fontWeight:over?600:400,lineHeight:1.3,wordBreak:'break-word'}},def.en),
                                isCrit&&ce('div',{style:{fontSize:9,color:'var(--red)'}},'⚠ Zero tolerance')
                              ),
                              ce('button',{type:'button',className:'vstep','aria-label':'Decrease '+def.en,onClick:function(i,id,key,cur){return function(){updateRowDefect(i,id,key,visionStepVal(cur,-1));};}(pIdx,row.id,def.key,row.defects[def.key])},'\u2212'),
                              ce('input',{className:'defect-row-input',style:{width:60,padding:'5px 6px',border:'1.5px solid '+(over?'var(--red)':'var(--border2)'),borderRadius:5,fontSize:15,fontFamily:'var(--font-mono)',textAlign:'right',background:over?'var(--red-bg)':'var(--card)',color:over?'var(--red)':'var(--text)',flexShrink:0,minHeight:38},type:'number',step:'0.1',min:'0',value:row.defects[def.key],onChange:function(i,id,key){return function(e){updateRowDefect(i,id,key,e.target.value);};}(pIdx,row.id,def.key)}),
                              ce('button',{type:'button',className:'vstep','aria-label':'Increase '+def.en,onClick:function(i,id,key,cur){return function(){updateRowDefect(i,id,key,visionStepVal(cur,1));};}(pIdx,row.id,def.key,row.defects[def.key])},'+'),
                              ce('span',{style:{fontSize:9,color:'var(--text3)',width:20,textAlign:'right',flexShrink:0}},thresh===0?'✕':thresh+'%')
                            );
                          })
                        )
                      );
                    })
                  )
                ),
                /* Sample card footer */
                ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',background:'var(--bg2)'}},
                  ce('button',{style:{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:13,padding:'4px 0',fontWeight:600},onClick:function(){setExpandedRow(isExp?null:row.id);}},isExp?'▲ Hide all defects':'▼ Show all defects'),
                  ce('div',{style:{display:'flex',alignItems:'center',gap:6}},
                    (function(){
                      var ef2m=row.extraFields||{};
                      var triedM=pfTried[row.id]||false;
                      var missingM=[];
                      if(!row.time||row.time==='00:00') missingM.push('Time');
                      if(!ef2m.sampleFarm) missingM.push('Farm');
                      if(!ef2m.samplePlot) missingM.push('Plot');
                      if(isMixed&&!ef2m.sampleFarm2) missingM.push('Farm V2');
                      if(isMixed&&!ef2m.samplePlot2) missingM.push('Plot V2');
                      if(!ef2m.netWeight) missingM.push('Net Weight');
                      if(!ef2m.bagsCount) missingM.push('Bags/Pun');
                      if(!ef2m.colourAccept) missingM.push('Colour');
                      if(!row.brix&&row.brix!=='0') missingM.push(isMixed?'Brix V1':'Brix');
                      if(isMixed&&(!row.brixV2&&row.brixV2!=='0')) missingM.push('Brix V2');
                      if(!ef2m.so2) missingM.push('SO2');
                      if(!ef2m.jiffy_pad) missingM.push('Jiffy Pad');
                      if(!ef2m.punnet_type) missingM.push('Punnet Type');
                      if(!ef2m.package_type) missingM.push('Package Type');
                      if(!ef2m.grape_size) missingM.push('Grape Size');
                      if(!ef2m.temp_log) missingM.push('Temp °C');
                      if(!ef2m.worker_id) missingM.push('Worker ID');
                      if(!ef2m.pkg_mtl_wt) missingM.push('Pkg Material Wt');
                      /* The list above is the GRAPES sample spec. Citrus/mango/pom don't render those
                         inputs, so on mobile their P/F could never be set. Match desktop: P/F
                         required-field validation is grapes-only. */
                      missingM=[];
                      var hasIssuesM=missingM.length>0;
                      var showErrM=triedM&&hasIssuesM;
                      var tipM=showErrM?('Fill required:\n• '+missingM.join('\n• ')):undefined;
                      function handlePFMobile(val){
                        if(hasIssuesM){
                          setPFTried(function(prev){var n=Object.assign({},prev);n[row.id]=true;return n;});
                        } else {
                          setPFTried(function(prev){var n=Object.assign({},prev);delete n[row.id];return n;});
                          updateRowField(pIdx,row.id,'pass',val);
                        }
                      }
                      return ce(React.Fragment,null,
                        ce('button',{title:tipM,style:{padding:'4px 10px',fontSize:12,fontWeight:700,borderRadius:4,
                          border:'1.5px solid '+(showErrM?'var(--red-border)':row.pass===true?'var(--green)':'var(--border2)'),
                          background:showErrM?'var(--red-bg)':row.pass===true?'var(--green)':'transparent',
                          color:showErrM?'var(--red)':row.pass===true?'#fff':'var(--text3)',
                          cursor:'pointer',minHeight:32},
                          onClick:function(){handlePFMobile(true);}},'PASS'),
                        ce('button',{title:tipM,style:{padding:'4px 10px',fontSize:12,fontWeight:700,borderRadius:4,
                          border:'1.5px solid '+(showErrM?'var(--red-border)':row.pass===false?'var(--red)':'var(--border2)'),
                          background:showErrM?'var(--red-bg)':row.pass===false?'var(--red)':'transparent',
                          color:showErrM?'var(--red)':row.pass===false?'#fff':'var(--text3)',
                          cursor:'pointer',minHeight:32},
                          onClick:function(){handlePFMobile(false);}},'FAIL')
                      );
                    })(),
                    pRows.length>1&&ce('button',{style:{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:12,padding:'4px 0'},onClick:function(i,id){return function(){removeRow(i,id);};}(pIdx,row.id)},'✕')
                  )
                )
              );
            }),
            /* Mobile pallet total */
            ce('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg2)',borderRadius:8,marginTop:4}},
              ce('div',{style:{fontSize:12,color:'var(--text3)'}},('Lot avg · '+pRows.length+' bag'+(pRows.length!==1?'s':'')+' · grade '+ptLotGrade)),
              ce('div',{style:{display:'flex',alignItems:'center',gap:6}},
                ce('span',{style:{fontSize:13,fontWeight:700,color:pTotal>10?'var(--red)':pTotal>5?'var(--amber)':'var(--green)',fontFamily:'var(--font-mono)'}},'Total: '+pTotal.toFixed(2)+'%'),
                pCrit&&ce('span',{className:'badge badge-fail',style:{fontSize:10}},'Crit')
              )
            )
          )
        ) /* end pallet card */
        ); /* end pallet wrapper div */
      }),
      /* Grand total across all pallets */
      pallets.length>1&&ce('div',{className:'card',style:{marginBottom:12,padding:'12px 16px',background:'var(--bg2)',display:'flex',alignItems:'center',justifyContent:'space-between'}},
        ce('div',{style:{fontSize:12,color:'var(--text3)'}},'All '+pallets.length+' pallets · '+allRows.length+' total samples'),
        ce('div',{style:{display:'flex',alignItems:'center',gap:12}},
          ce('span',{style:{fontSize:14,fontWeight:700,color:avgTotal>10?'var(--red)':avgTotal>5?'var(--amber)':'var(--green)',fontFamily:'var(--font-mono)'}},('LOT avg: ')+avgTotal.toFixed(2)+'%'),
          hasCrit&&ce('span',{className:'badge badge-fail'},'Critical defect found')
        )
      ),
      /* POTATOES: lot summary + grade */
      ptLotSummaryCard(),
      /* TRACE & CLEARANCE — no line clearance for potatoes */
      false,
      /* PASS/FAIL SUMMARY */
      (function(){
        var _rows=[];pallets.forEach(function(p){p.rows.forEach(function(r){_rows.push(r);});});
        var _pass=_rows.filter(function(r){return r.pass===true;}).length;
        var _fail=_rows.filter(function(r){return r.pass===false;}).length;
        var _none=_rows.filter(function(r){return r.pass===null||r.pass===undefined;}).length;
        if(_rows.length===0) return null;
        return ce('div',{className:'card',style:{marginBottom:12}},
          ce('div',{className:'section-title'},ce('div',{className:'section-title-bar',style:{background:'#3a7a4a'}}),'Sample results'),
          ce('div',{style:{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}},
            ce('div',{style:{display:'flex',alignItems:'center',gap:8,padding:'8px 18px',borderRadius:8,background:'var(--green-bg)',border:'1px solid var(--green-border)'}},
              ce('span',{style:{fontSize:24,fontWeight:700,color:'var(--green)',fontFamily:'var(--font-mono)'}},_pass),
              ce('span',{style:{fontSize:13,color:'var(--green)',fontWeight:600,marginLeft:4}},'Pass')
            ),
            ce('div',{style:{display:'flex',alignItems:'center',gap:8,padding:'8px 18px',borderRadius:8,background:'var(--red-bg)',border:'1px solid var(--red-border)'}},
              ce('span',{style:{fontSize:24,fontWeight:700,color:'var(--red)',fontFamily:'var(--font-mono)'}},_fail),
              ce('span',{style:{fontSize:13,color:'var(--red)',fontWeight:600,marginLeft:4}},'Fail')
            ),
            _none>0&&ce('span',{style:{fontSize:12,color:'var(--text3)'}},_none+' not marked')
          )
        );
      })(),
      /* DECISION */
      ce('div',{className:'card','data-field':'decision'},
        ce('div',{className:'section-title'},ce('div',{className:'section-title-bar',style:{background:'#1e2d22'}}),'Decision — القرار'),
        ce('div',{style:{fontSize:12,color:'var(--text3)',marginBottom:10}},'Auto-suggested: ',ce('strong',{style:{color:autoDec==='A'?'var(--green)':'var(--red)'}},autoDec==='A'?'Accept (A)':'Reject (R)')),
        (decision==='SA'||decision==='SR')&&ce('div',{style:{fontSize:12,margin:'0 0 10px',padding:'8px 10px',borderRadius:6,background:'var(--bg2)',color:decision==='SA'?'#6a10b0':'var(--red)'}},
          '\u2605 Board decision: '+decisionText()+' \u2014 kept when you save. Pick A or R only to override it.'),
        ce('div',{className:'decision-bar'},
          ce('button',{className:'decision-btn decision-a'+(decision==='A'?' sel':''),onClick:function(){setDecision('A');setIsDirty(true);}},
            'A — Accept',ce('div',{style:{fontSize:11,fontWeight:400,marginTop:2,opacity:.8}},'Grade A/B, no tuber moth')),
          ce('button',{className:'decision-btn decision-r'+(decision==='R'?' sel':''),onClick:function(){setDecision('R');setIsDirty(true);}},
            'R — Reject',ce('div',{style:{fontSize:11,fontWeight:400,marginTop:2,opacity:.8}},'Grade C or tuber moth found'))
        ),
        ce('div',{style:{marginTop:12}},
          ce('div',{style:{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}},'Outcome — ماذا حدث للوط'),
          ce('div',{style:{display:'flex',flexWrap:'wrap',gap:6}},PT_OUTCOMES.map(function(o){var on=outcome===o;
            return ce('button',{key:o,type:'button','aria-pressed':on,onClick:function(){markDirty();setOutcome(on?'':o);},style:{padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:on?600:500,cursor:'pointer',border:'1.5px solid '+(on?'var(--accent)':'var(--border2)'),background:on?'var(--accent)':'var(--card)',color:on?'#fff':'var(--text2)'}},o,ce('span',{style:{fontSize:10,opacity:.75,marginLeft:5}},PT_OUTCOME_AR[o]));})),
          outcome==='Exception'&&ce('div',{style:{fontSize:11,color:'var(--text3)',marginTop:6}},'Exceptions go through Escalate on the listing — the approver is recorded there (Special Accept).'))
      ),
      /* SECOND SAVE BUTTON */
      ce('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10,paddingBottom:24}},
        unitConfirmWarn&&ce('div',{style:{background:'var(--amber-bg)',border:'1px solid var(--amber-border)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'var(--amber)',display:'flex',alignItems:'center',gap:8,alignSelf:'stretch'}},
          ce('span',{style:{fontSize:16}},'⚠'),
          ce('div',null,
            ce('div',{style:{fontWeight:600,marginBottom:2}},'Please review the unit identity fields'),
            ce('div',{style:{fontSize:12,opacity:.85}},'Tick ✓ beside Container, Variety and Farm to confirm they are correct for this lot. Click Save again to proceed.')
          )
        ),
        ce('button',{className:'btn btn-primary',style:{minWidth:140,padding:'11px 28px',fontSize:15,opacity:isSaving?.7:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8},onClick:handleSave,disabled:isSaving},isSaving&&ce('span',{className:'dalos-spinner'}),isSaving?'Saving\u2026':'Save inspection')
      )
    )
  );
}

/* ── SAVE ─────────────────────────────────────────────────────────────────────────────────
   Potatoes ONLY go through their own product-guarded RPCs (save_/edit_potatoes_inspection_full,
   copies of the citrus/pom atomic pair). Never the legacy multi-call path.
   ctx (from App.addBatch): isEditMode, userId, seasonId, onDone, buildMangoSavePayload,
   mangoServerErrMsg, refreshBatchesById. */
function buildPotatoesSavePayload(ctx, newBatch, userId, seasonId, isEditFlag, editId){
  var pl=ctx.buildMangoSavePayload(newBatch, userId, seasonId, isEditFlag, editId, {systemNumbered:true});
  pl.inspection.outcome=newBatch.outcome||null;
  pl.inspection.extra_varieties=(newBatch.extraVarieties||[]).filter(Boolean);
  pl.inspection.variety_name=newBatch.variety||null;
  pl.inspection.variety2_name=newBatch.variety2||null;
  var srcRows=[];(newBatch.pallets||[]).forEach(function(p){(p.rows||[]).forEach(function(r){srcRows.push(r);});});
  var k=0;
  (pl.pallets||[]).forEach(function(pr){(pr.samples||[]).forEach(function(sm){var r=srcRows[k++]||{};sm.sample_variety_text=r.sampleVariety||null;});});
  pl.sticker_checks=[];
  pl.clearance=[];
  return pl;
}
function save(newBatch, ctx){
  var isEditMode=ctx.isEditMode, onDone=ctx.onDone;
  var _ptFn=isEditMode?'edit_potatoes_inspection_full':'save_potatoes_inspection_full';
  var ptp;
  try{ ptp=buildPotatoesSavePayload(ctx, newBatch, ctx.userId, ctx.seasonId, isEditMode, isEditMode?newBatch.id:undefined); }
  catch(e){
    console.error('[DalOS] Failed to build potatoes payload:',e&&e.message);
    if(onDone){onDone('RETRY:Could not prepare this inspection for saving — your data is still here. Please tell support.');onDone=null;}
    return;
  }
  return supabase.rpc(_ptFn,{payload:ptp}).then(function(res){
    if(res.error){
      var msg=res.error.message||'';
      if(res.error.code==='PGRST202'||/could not find the function|does not exist/i.test(msg)){
        console.warn('[DalOS] Potato save RPC not deployed yet:',msg);
        if(onDone){onDone('RETRY:Saving potato inspections isn’t switched on yet — the database part is waiting for approval. Nothing was saved; your form is kept.');onDone=null;}
        return {__handled:true};
      }
      if(isEditMode&&msg.indexOf('CONFLICT')>=0){
        dalosNoteConflict(newBatch.id);
        if(onDone){onDone('CONFLICT',newBatch.id);onDone=null;}
        return {__handled:true};
      }
      console.error('[DalOS] Atomic potatoes save failed:',msg);
      if(onDone){onDone(ctx.mangoServerErrMsg(msg,isEditMode));onDone=null;}
      return {__handled:true};
    }
    var ptId=(res.data&&res.data.id)||newBatch.id;
    delete ptOutcomeCache[ptId]; if(isEditMode) delete ptOutcomeCache[newBatch.id];
    console.log('[DalOS] Atomic potatoes '+(isEditMode?'edit':'save')+' OK:',ptId,res.data);
    if(isEditMode) dalosClearConflicts(ptId);
    if(onDone){onDone(null,ptId);onDone=null;}
    try{ if(typeof ctx.refreshBatchesById==='function'&&ptId) setTimeout(function(){ctx.refreshBatchesById([ptId]);},1200); }catch(e){}
    return {__handled:true};
  }).catch(function(e){
    console.error('[DalOS] Atomic potatoes save threw:',e&&e.message);
    if(onDone){onDone('RETRY:Save didn’t go through — your data is still here. Check your connection and tap Save again.');onDone=null;}
    return {__handled:true};
  });
}

/* ── LOT OUTCOME for the listing — inspections_with_aggregates has no outcome column, so the
   listing asks for it here: one batched query for all rows on screen, cached per inspection. */
var ptOutcomeCache={}, ptOutcomeWant={}, ptOutcomeSubs=[], ptOutcomeTimer=null;
function ptOutcomeLoad(id){
  if(!id||(id in ptOutcomeCache)||ptOutcomeWant[id]) return;
  ptOutcomeWant[id]=1; if(ptOutcomeTimer) return;
  ptOutcomeTimer=setTimeout(function(){
    var ids=Object.keys(ptOutcomeWant); ptOutcomeWant={}; ptOutcomeTimer=null;
    supabase.from('inspections').select('id,outcome').in('id',ids).then(function(r){
      if(r.error) return;
      (r.data||[]).forEach(function(x){ptOutcomeCache[x.id]=x.outcome||'';});
      ids.forEach(function(i){if(!(i in ptOutcomeCache))ptOutcomeCache[i]='';});
      ptOutcomeSubs.slice().forEach(function(f){f();});
    });
  },0);
}
function PtOutcome(props){
  var s=React.useState(0); var force=s[1];
  React.useEffect(function(){var f=function(){force(function(n){return n+1;});};ptOutcomeSubs.push(f);return function(){ptOutcomeSubs=ptOutcomeSubs.filter(function(x){return x!==f;});};},[]);
  var v=ptOutcomeCache[props.id];
  if(v===undefined){ptOutcomeLoad(props.id);return props.loading||null;}
  return v?v:(props.empty||null);
}

/* ── LISTING (FGView) — potato pieces of the inspections list + detail panel ─────────────── */
var listing={
  /* 3rd KPI tile: bags sampled instead of pallets */
  kpiTile:function(seasonBatches){
    return ce('div',{className:'kpi'},ce('div',{className:'kpi-label'},'Bags sampled'),ce('div',{className:'kpi-value',style:{color:'#185FA5'}},seasonBatches.reduce(function(s,b){return s+(b.sampleCount||0);},0)),ce('div',{className:'kpi-sub'},'This season'));
  },
  labels:{container:'LOT · Session',variety:'Varieties',brix:'Bags'},
  idCell:function(b,cont){
    return ce('div',null,
      ce('span',{style:{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text)',fontWeight:600}},'LOT '+(b.lot||'—')),
      ce('div',{style:{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text3)',marginTop:1}},b.id+(cont?' · '+cont:'')));
  },
  brixCell:function(b){return ce('div',null,(b.sampleCount||0)+' bag'+((b.sampleCount||0)===1?'':'s'),
    ce('div',{style:{fontFamily:'var(--font-body)',fontSize:10,color:'var(--text3)',marginTop:1}},ce(PtOutcome,{id:b.id})));},
  detailInfo:function(selB){return [['Client',selB.client],['Country',selB.country],['Farm',selB.farm],['Date',selB.date],['Bags',(selB.sampleCount||0)+' sampled'],['Client sticker',selB.labelling||'—'],['Outcome',ce(PtOutcome,{id:selB.id,empty:'Not recorded',loading:'\u2026'})]];},
  hidePacking:true,
  hideClearance:true,
  /* lot grade from the الشحن bands (rots / skin bag averages); tuber moth = C */
  detailExtra:function(selB,bd,defSections){
    bd=bd||{};if(bd.loading||bd.error) return null;
    var d=bd.defects||{};var R=ptSectionTotal(d,'Rots',defSections),S=ptSectionTotal(d,'Skin',defSections);var moth=(d.pt_tuber_moth||0)>0;var g=moth?'C':ptGrade(R,S);
    var col=g==='A'?'var(--green)':g==='B'?'var(--amber)':'var(--red)';
    return ce('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0 8px',fontSize:12}},
      ce('span',{style:{color:'var(--text3)'}},'Rots '+R.toFixed(2)+'% · Skin '+S.toFixed(2)+'%'),
      ce('span',{style:{display:'inline-flex',gap:6,alignItems:'center'}},
        moth&&ce('span',{className:'badge badge-fail',style:{fontSize:10}},'Tuber moth'),
        ce('span',{style:{fontFamily:'var(--font-mono)',fontWeight:700,color:'#fff',background:col,borderRadius:5,padding:'2px 8px'}},'Grade '+g)));
  }
};

/* ── ESCALATION REVIEW — the board sees the lot grade, bags and outcome instead of Brix ──── */
function EscalationSummary(props){
  var selB=props.batch;
  var s=React.useState(null); var pi=s[0]; var setPi=s[1];
  React.useEffect(function(){
    var id=selB.id, alive=true;
    setPi(null);
    Promise.all([
      supabase.from('inspections').select('outcome').eq('id',id).single(),
      supabase.from('sample_rows').select('id,sample_defect_readings(value,defects(key,defect_sections(name_en)))').eq('inspection_id',id)
    ]).then(function(res){
      var rows=(res[1]&&res[1].data)||[],n=rows.length||1,sec={},moth=false;
      rows.forEach(function(r){(r.sample_defect_readings||[]).forEach(function(dr){var d=dr.defects||{};var nm=(d.defect_sections&&d.defect_sections.name_en)||'';var v=parseFloat(dr.value)||0;sec[nm]=(sec[nm]||0)+v;if(d.key==='pt_tuber_moth'&&v>0)moth=true;});});
      var R=(sec.Rots||0)/n,S=(sec.Skin||0)/n;
      if(alive) setPi({R:R,S:S,moth:moth,grade:moth?'C':ptGrade(R,S),bags:rows.length,outcome:(res[0]&&res[0].data&&res[0].data.outcome)||''});
    }).catch(function(){if(alive) setPi({error:true});});
    return function(){alive=false;};
  },[selB.id]);
  var wait=!pi?'…':(pi.error?'—':null); pi=pi||{};
  var items=[['Total defect',selB.totalDefect.toFixed(1)+'%'],
    ['Grade',wait||((pi.grade||'—')+(pi.moth?' · tuber moth':'')),pi.grade==='A'?'var(--green)':pi.grade==='B'?'var(--amber)':'var(--red)'],
    ['Bags',wait||(pi.bags+' sampled'+(pi.bags?' · rots '+pi.R.toFixed(2)+'% · skin '+pi.S.toFixed(2)+'%':''))],
    ['Outcome',wait||(pi.outcome||'Not recorded')],
    ['Variety',selB.variety+(selB.variety2&&selB.varietyType==='mixed'?' + '+selB.variety2:'')],['Farm',selB.farm],['Client',selB.client],['Date',selB.date]];
  return ce('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}},
    items.map(function(item){
      return ce('div',{key:item[0],style:{background:'var(--bg2)',borderRadius:6,padding:'6px 9px'}},
        ce('div',{style:{fontSize:9,color:'var(--text3)',textTransform:'uppercase',marginBottom:1}},item[0]),
        ce('div',{style:{fontSize:12,fontWeight:item[2]?700:500,color:item[2]||undefined}},item[1]));
    }));
}

window.Pivots={
  version:'pivots.js 1',
  bootstrapConfig:ptApplyBootstrap,
  InspectionForm:PivotsInspectionForm,
  save:save,
  listing:listing,
  EscalationSummary:EscalationSummary,
  grade:ptGrade
};
}catch(e){console.error('[DalOS] pivots.js failed to load:',e&&e.message);}
})();
