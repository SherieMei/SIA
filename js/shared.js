/* BEE PRODUCTION SHARED RUNTIME */

/* ===== DATA CONSTANTS: js/data/constants.js ===== */
/* ==========================================================================
   CONSTANTS — roles, permissions, asset type styling, status labels.
   Edit permissions here to change who can do what.
   ========================================================================== */
const ROLE_LABELS = {
  admin:'Administrator', project_manager:'Project Manager',
  animator:'Animator', editor:'Editor', client:'Client'
};

/* Distinct, theme-safe accent color per role (used for badges and inline role tags) */
const ROLE_COLOR_VAR = {
  admin:'crimson', project_manager:'violet', animator:'cyan', editor:'gold', client:'azure'
};

/* Letters (incl. accented), spaces, apostrophes, hyphens, and periods only — for name-type
   fields (person names, client names). Rejects digits and other symbols. Fields that
   legitimately need numbers/symbols (email, password, IDs) must not use this. */
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/;

const PERMISSIONS = {
  manageUsers:['admin'],
  manageProjects:['admin','project_manager'],
  submitAssets:['admin','animator','editor','project_manager'],
  review:['admin','project_manager','client'],
  comment:['admin','project_manager','animator','editor','client'],
  viewAudit:['admin','project_manager'],
  manageResources:['admin','project_manager'],
  runIntegrations:['admin','project_manager','editor'],
};
function can(action){ return DB.currentUser && PERMISSIONS[action] && PERMISSIONS[action].includes(DB.currentUser.role); }

const TYPE_META = {
  'Storyboard':{tag:'SB',color:'#ff6b4d'},
  'Animatic':{tag:'AN',color:'#9b8cfb'},
  'Character Sheet':{tag:'CS',color:'#2bd9c9'},
  'Background Asset':{tag:'BG',color:'#6ea8e0'},
  'Animation Scene':{tag:'AS',color:'#f0495a'},
  'Render':{tag:'RN',color:'#ffd479'},
  'Audio':{tag:'AU',color:'#e08ce0'},
  'Design Draft':{tag:'DD',color:'#9aa0ab'},
};
const STATUS_CLASS = {
  'For Review':'b-review', 'Approved':'b-approved', 'Rejected':'b-rejected',
  'Revision Requested':'b-revision', 'Final':'b-final'
};
const NOTIF_ICON = {submission:'▲', revision:'↺', deadline:'◷', approval:'✓', completed:'●'};


/* ===== SEED DATA: js/data/seed.js ===== */
/* ==========================================================================
   SEED DATA — demo team, projects, and assets the app boots with.
   Everything lives in memory for the session (see Architecture page).
   ========================================================================== */
let idCounters = {p:3,a:0,v:0,c:0,n:0,e:0,au:0,w:0,api:0,r:0,u:8};
function nid(prefix){ idCounters[prefix]++; return prefix+idCounters[prefix]; }

const DB = {
  currentUser:null,
  users:[
    {id:'u1',name:'Jordan Reyes',email:'jordan.reyes@beeproduction.studio',role:'admin'},
    {id:'u2',name:'Mika Santos',email:'mika.santos@beeproduction.studio',role:'project_manager'},
    {id:'u3',name:'Leo Cruz',email:'leo.cruz@beeproduction.studio',role:'animator'},
    {id:'u4',name:'Ava Domingo',email:'ava.domingo@beeproduction.studio',role:'animator'},
    {id:'u5',name:'Noah Bautista',email:'noah.bautista@beeproduction.studio',role:'editor'},
    {id:'u6',name:'Priya Fernandez',email:'priya.fernandez@beeproduction.studio',role:'project_manager'},
    {id:'u7',name:'Skyline Media (Client)',email:'client@skylinemedia.com',role:'client'},
  ],
  projects:[
    {id:'p1',name:"Skybound Chronicles — Ep.4 “The Hollow Reach”",client:'Meridian Animation Network',
     status:'In Production',deadline:'2026-10-15',pm:'u2',team:['u3','u4','u5','u6'],budget:48000},
    {id:'p2',name:"Lumen Oral Care — “Bright Mornings” Campaign",client:'Lumen Oral Care Co.',
     status:'Client Review',deadline:'2026-09-20',pm:'u2',team:['u3','u4','u6','u7'],budget:22000},
    {id:'p3',name:"Nightfall Games — Cinematic Trailer",client:'Nightfall Interactive',
     status:'Pre-Production',deadline:'2026-11-30',pm:'u2',team:['u3','u4'],budget:35000},
  ],
  assets:[],
  comments:[],
  notifications:[],
  auditLog:[],
  events:[],
  webhooks:[],
  apiLogs:[],
  resources:[
    {id:nid('r'),project:'p1',category:'Labor',desc:'Storyboard artist — 2 weeks',cost:3200,hours:80},
    {id:nid('r'),project:'p1',category:'Equipment',desc:'Render node lease',cost:900,hours:0},
    {id:nid('r'),project:'p2',category:'Labor',desc:'Animator — spot revisions',cost:1600,hours:40},
  ],
};

function latestVersion(a) {
  if (!a || typeof a !== 'object') {
    return { status: 'For Review', n: 1, date: '' };
  }
  if (Array.isArray(a.versions) && a.versions.length > 0) {
    const last = a.versions[a.versions.length - 1];
    return last || { status: 'For Review', n: 1, date: '' };
  }
  return { status: 'For Review', n: 1, date: '' };
}

/* The PHP backend (api/assets.php, api/bootstrap.php) doesn't nest asset_versions into
   its asset rows, so anything sourced from the server is missing `.versions`. Every asset
   entering DB.assets must go through this so the rest of the app's `a.versions.length`
   assumptions never crash. */
function withVersions(a){
  return Array.isArray(a && a.versions) ? a : { ...a, versions: [] };
}

/* Safely execute seed calls if helper function exists */
let seedA2 = null, seedA5 = null, seedA10 = null, seedA12 = null;
if (typeof seedAsset === 'function') {
  seedAsset('p1','Scene 12 — Rooftop Chase','Storyboard','drive://skybound/sb/scene12',[
    {status:'Approved',notes:'Initial pass, full 40 panels.',by:'u3',date:'2026-08-02'},
  ]);
  seedA2 = seedAsset('p1','Scene 12 — Rooftop Chase Animatic','Animatic','drive://skybound/an/scene12',[
    {status:'Revision Requested',notes:'Rough timing pass.',by:'u4',date:'2026-08-10'},
  ]);
  seedAsset('p1','Kael — Character Turnaround','Character Sheet','drive://skybound/cs/kael',[
    {status:'Approved',notes:'Front/side/back, 3 expressions.',by:'u3',date:'2026-07-28'},
  ]);
  seedAsset('p1','Undercity Market — Background Plate','Background Asset','dropbox://skybound/bg/market',[
    {status:'For Review',notes:'Painted matte, 4K.',by:'u4',date:'2026-08-18'},
  ]);
  seedA5 = seedAsset('p1','Scene 09 — Chase Resolution','Animation Scene','drive://skybound/anim/scene09',[
    {status:'Rejected',notes:'First blocking pass.',by:'u4',date:'2026-08-05'},
    {status:'For Review',notes:'Re-timed per notes, added overlap.',by:'u4',date:'2026-08-14'},
  ]);
  seedAsset('p1','Episode 4 — Final Render Reel','Render','local://skybound/render/ep4_final',[
    {status:'For Review',notes:'Full episode, color graded.',by:'u5',date:'2026-08-20'},
  ]);
  seedAsset('p2','Bright Mornings — 15s Storyboard','Storyboard','drive://lumen/sb/15s',[
    {status:'Approved',notes:'Client-approved concept.',by:'u3',date:'2026-08-01'},
  ]);
  seedAsset('p2','Bright Mornings — Bathroom BG Set','Background Asset','dropbox://lumen/bg/bathroom',[
    {status:'For Review',notes:'Morning light variant.',by:'u4',date:'2026-08-16'},
  ]);
  seedA10 = seedAsset('p2','Bright Mornings — Final Cut','Render','local://lumen/render/final_15s',[
    {status:'Approved',notes:'Master export, 1080p ProRes.',by:'u5',date:'2026-08-19',final:true},
  ]);
  seedAsset('p3','Trailer — Opening Boards','Storyboard','drive://nightfall/sb/opening',[
    {status:'For Review',notes:'Beat 1–5 of teaser.',by:'u3',date:'2026-08-22'},
  ]);
  seedA12 = seedAsset('p3','Trailer — Theme Sting','Audio','dropbox://nightfall/audio/sting',[
    {status:'Revision Requested',notes:'Rough mix, temp score.',by:'u5',date:'2026-08-17'},
  ]);
}

if (seedA2 && seedA5) {
  DB.comments.push(
    {id:nid('c'), asset:seedA2.id, by:'u6', text:'Timing on panel 14–18 reads too slow for the chase beat — tighten by ~6 frames.', date:'2026-08-11'},
    {id:nid('c'), asset:seedA2.id, by:'u4', text:'Got it, will re-time and re-submit by Friday.', date:'2026-08-11'},
    {id:nid('c'), asset:seedA5.id, by:'u6', text:'Blocking pass rejected — arc on the jump reads floaty, see reference note attached.', date:'2026-08-06'},
  );
}

function pushNotif(type,text,ref){
  DB.notifications.push({id:nid('n'), type, text, ref, read:false, date:new Date().toISOString()});
}
pushNotif('submission','New submission: “Undercity Market — Background Plate” is awaiting review.','a4');
if (seedA12) pushNotif('revision','Revision requested on “Trailer — Theme Sting”.',seedA12.id);
pushNotif('deadline','Skybound Chronicles Ep.4 deadline is in 6 weeks.','p1');
if (seedA10) pushNotif('approval','“Bright Mornings — Final Cut” was approved as Final Output.',seedA10.id);

function pushAudit(action,entity,detail){
  DB.auditLog.push({id:nid('au'), by:DB.currentUser?DB.currentUser.name:'System', action, entity, detail, date:new Date().toISOString()});
}
DB.auditLog.push(
  {id:nid('au'),by:'Leo Cruz',action:'Upload',entity:'Scene 12 — Rooftop Chase',detail:'Submitted v1',date:'2026-08-02T09:14:00'},
  {id:nid('au'),by:'Priya Fernandez',action:'Approval',entity:'Scene 12 — Rooftop Chase',detail:'Approved v1',date:'2026-08-03T11:02:00'},
  {id:nid('au'),by:'Priya Fernandez',action:'Revision',entity:'Trailer — Theme Sting',detail:'Requested revision on v1',date:'2026-08-17T14:40:00'},
  {id:nid('au'),by:'Priya Fernandez',action:'Approval',entity:'Bright Mornings — Final Cut',detail:'Approved v1 as FINAL',date:'2026-08-19T16:10:00'},
);

function pushEvent(name,payload){
  DB.events.unshift({id:nid('e'), name, payload, date:new Date().toISOString()});
}
pushEvent('Asset Uploaded',{asset:'Scene 12 — Rooftop Chase',version:'v1',by:'Leo Cruz'});
pushEvent('Asset Approved',{asset:'Scene 12 — Rooftop Chase',version:'v1',by:'Priya Fernandez'});
pushEvent('Revision Requested',{asset:'Trailer — Theme Sting',version:'v1',by:'Priya Fernandez'});
pushEvent('Final Output Approved',{asset:'Bright Mornings — Final Cut',version:'v1',by:'Priya Fernandez'});

DB.webhooks.push(
  {id:nid('w'), endpoint:'https://hooks.beeproduction.studio/asset-approved', status:200, payload:'{"asset":"Bright Mornings — Final Cut","event":"final_output_approved"}', date:'2026-08-19T16:10:02'}
);

/* ===== PERSISTENCE ACROSS SEPARATE PAGES ===== */
const DB_PERSIST_KEY = 'beeDB';
const DB_PERSISTED_FIELDS = ['users','projects','assets','comments','notifications','auditLog','events','webhooks','apiLogs','resources'];
(function restorePersistedDB(){
  try{
    const raw = sessionStorage.getItem(DB_PERSIST_KEY);
    if(!raw) return;
    const saved = JSON.parse(raw);
    if(!saved || typeof saved !== 'object') return;
    DB_PERSISTED_FIELDS.forEach(key=>{
      if(Array.isArray(saved[key])) DB[key] = saved[key];
    });
    if(saved.idCounters && typeof saved.idCounters === 'object'){
      idCounters = Object.assign(idCounters, saved.idCounters);
    }
  }catch(e){
    sessionStorage.removeItem(DB_PERSIST_KEY);
  }
})();

/* ===== ROLE MIGRATION: clean up data persisted under roles removed in the 5-role reduction ===== */
(function migrateLegacyRoles(){
  const ROLE_MIGRATION = { artist:'animator', reviewer:'project_manager' };
  const REMOVED_ROLES = ['viewer'];
  let changed = false;

  DB.users = DB.users.filter(u=>{
    if(REMOVED_ROLES.includes(u.role)){ changed = true; return false; }
    return true;
  });
  DB.users.forEach(u=>{
    if(ROLE_MIGRATION[u.role]){ u.role = ROLE_MIGRATION[u.role]; changed = true; }
  });

  [window.localStorage, window.sessionStorage].forEach(store=>{
    try{
      const raw = store.getItem('beeCurrentUser');
      if(!raw) return;
      const u = JSON.parse(raw);
      if(!u || typeof u !== 'object') return;
      if(REMOVED_ROLES.includes(u.role)){ store.removeItem('beeCurrentUser'); changed = true; return; }
      if(ROLE_MIGRATION[u.role]){ u.role = ROLE_MIGRATION[u.role]; store.setItem('beeCurrentUser', JSON.stringify(u)); changed = true; }
    }catch(e){}
  });

  if(changed){
    try{
      const raw = sessionStorage.getItem(DB_PERSIST_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      saved.users = DB.users;
      sessionStorage.setItem(DB_PERSIST_KEY, JSON.stringify(saved));
    }catch(e){}
  }
})();


/* ===== STATE: js/core/state.js ===== */
/* ==========================================================================
   APP STATE + HELPERS
   ========================================================================== */
const state = { page:'dashboard', selectedProjectId:null, selectedAssetId:null,
  filter:{project:'all',type:'all',status:'all',q:''} };

(function restorePageRoute(){
  const page = document.body && document.body.dataset ? document.body.dataset.page : '';
  if(page && page !== 'login') state.page = page;

  try {
    const params = new URLSearchParams(window.location.search);
    const project = params.get('project');
    const asset = params.get('asset');
    const status = params.get('status');
    if(project){ state.page='projectDetail'; state.selectedProjectId=project; }
    if(asset){ state.page='assetDetail'; state.selectedAssetId=asset; }
    if(status && STATUS_CLASS[status]) state.filter.status = status;
  } catch(e) {}
})();

function fmtDate(d){
  if(!d) return '—';
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'});
}
function fmtDateTime(d){
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US',{month:'short',day:'2-digit'})+' · '+dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}
function userById(id){ return DB.users.find(u=>u.id===id); }
function projectById(id){ return DB.projects.find(p=>p.id===id); }
function assetById(id){ return DB.assets.find(a=>a.id===id); }
function initials(name){ return name ? name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() : '?'; }
function esc(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toast(msg, kind){
  const wrap = document.getElementById('toastWrap');
  if(!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast'+(kind?' '+kind:'');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.25s'; setTimeout(()=>el.remove(),260); }, 3200);
}

function projectProgress(pid){
  const list = DB.assets.filter(a=>a.project===pid);
  if(!list.length) return 0;
  const done = list.filter(a=>{ const v=latestVersion(a); return v.status==='Approved'||v.status==='Final'; }).length;
  return Math.round(done/list.length*100);
}


/* ===== NAVIGATION: js/core/nav.js ===== */
/* ==========================================================================
   STUDIO CONTROLLER & ROUTING
   ========================================================================== */
const Studio = {

  persist(){
    try{
      const snapshot = {};
      DB_PERSISTED_FIELDS.forEach(key=>{ snapshot[key] = DB[key]; });
      snapshot.idCounters = idCounters;
      sessionStorage.setItem(DB_PERSIST_KEY, JSON.stringify(snapshot));
      const payload=JSON.stringify({state:snapshot});
      if(navigator.sendBeacon){
        const blob=new Blob([payload],{type:'application/json'});
        navigator.sendBeacon('../api/sync.php',blob);
      } else {
        fetch('../api/sync.php',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true}).catch(()=>{});
      }
    }catch(e){}
  },

  login(username, password) {
    const user = window.DB.users.find(u => u.username === username || u.email === username) || window.DB.users[0];
    if (user) {
      window.DB.currentUser = user;
      localStorage.setItem('beeCurrentUser', JSON.stringify(user));
      sessionStorage.setItem('beeCurrentUser', JSON.stringify(user));
      Studio.persist();
      window.location.assign('../dashboard/dashboard.html');
    } else {
      toast('Invalid credentials','error');
    }
  },

  async manualLogin(){
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Enter a valid email to sign in.','error'); return; }
    if(!password){ toast('Enter a password to sign in.','error'); return; }
    try {
      const res = await fetch('http://localhost/SIA/api/auth.php', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'login',email,password})});
      const data = await parseApiResponse(res);
      if(!res.ok || !data.success) throw new Error(data.error || 'Sign in failed.');
      const u = {id:String(data.user.id), name:data.user.full_name, email:data.user.email, role:data.user.role};
      const existing=DB.users.find(x=>x.id===u.id); if(existing) Object.assign(existing,u); else DB.users.push(u);
      Studio.completeLogin(u);
    } catch(e){ toast(e.message || 'Unable to sign in.','error'); }
  },

  async createAccount(){
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;
    if(!name){ toast('Enter your full name to create an account.','error'); return; }
    if(!NAME_RE.test(name)){ toast('Name can only contain letters, spaces, hyphens, and apostrophes.','error'); return; }
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Enter a valid email.','error'); return; }
    if(password.length < 6){ toast('Password must be at least 6 characters.','error'); return; }
    try {
      const res = await fetch('http://localhost/SIA/api/auth.php', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'register',name,email,password,role})});
      const data = await parseApiResponse(res);
      if(!res.ok || !data.success) throw new Error(data.error || 'Account creation failed.');
      const u={id:String(data.user.id),name:data.user.full_name,email:data.user.email,role:data.user.role};
      DB.users.push(u);
      Studio.openConfirm({
        title:'Account created!',
        body:'Welcome, '+esc(u.name)+'. Sign in with your new account to continue.',
        confirmLabel:'Continue to sign in',
        hideCancel:true,
        onConfirm: async ()=>{
          // The register call already authenticated a session server-side — end it so
          // signing in below is a real, deliberate login, not a leftover session.
          try{
            await fetch('/SIA/api/auth.php', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'logout'})});
          }catch(e){}
          const passwordInput = document.getElementById('loginPassword');
          if(passwordInput) passwordInput.value = '';
          document.getElementById('authModeToggle')?.click();
          const emailInput = document.getElementById('loginEmail');
          if(emailInput){ emailInput.value = email; emailInput.focus(); }
        }
      });
    } catch(e){ toast(e.message || 'Unable to create account.','error'); }
  },

  async quickLogin(id){
    const u = userById(id);
    if(!u) return;
    document.getElementById('loginEmail').value=u.email||'';
    document.getElementById('loginPassword').value='password123';
    await Studio.manualLogin(); 
  },

  completeLogin(u){
    if(!u) return;
    DB.currentUser = u;
    localStorage.setItem('beeCurrentUser', JSON.stringify(u));
    sessionStorage.setItem('beeCurrentUser', JSON.stringify(u));
    Studio.persist();

    if(document.body && document.body.dataset.page === 'login'){
      window.location.assign(new URL('../dashboard/dashboard.html', window.location.href).href);
      return;
    }

    const loginScreen=document.getElementById('loginScreen');
    const app=document.getElementById('app');
    if(loginScreen) loginScreen.hidden=true;
    if(app) app.hidden=false;
    state.page='dashboard';
    if(typeof render === 'function') render();
    toast('Signed in as '+u.name+' ('+ROLE_LABELS[u.role]+').','success');
  },

  async logout(){
    try{
      await fetch('/SIA/api/auth.php', {
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'logout'})
      });
    }catch(e){}
    DB.currentUser=null;
    localStorage.removeItem('beeCurrentUser');
    sessionStorage.removeItem('beeCurrentUser');
    sessionStorage.removeItem(DB_PERSIST_KEY);
    window.location.assign(new URL('../login/login.html', window.location.href).href);
  },

  confirmLogout(){
    Studio.openConfirm({
      title:'Sign out?',
      body:'You\'ll need to sign in again to get back to '+(DB.currentUser?esc(DB.currentUser.name)+'\u2019s':'your')+' workspace.',
      confirmLabel:'Yes, log out',
      cancelLabel:'No, stay signed in',
      danger:true,
      onConfirm:()=>Studio.logout()
    });
  },

  openConfirm(opts){
    Studio.closeConfirm();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'confirmOverlay';
    overlay.innerHTML =
      '<div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle">' +
        '<div class="modal-head"><h3 id="confirmTitle">'+esc(opts.title||'Are you sure?')+'</h3></div>' +
        '<p class="confirm-body">'+ (opts.body||'') +'</p>' +
        '<div class="confirm-actions">' +
          (opts.hideCancel ? '' : '<button type="button" class="btn" id="confirmCancelBtn">'+esc(opts.cancelLabel||'Cancel')+'</button>') +
          '<button type="button" class="btn '+(opts.danger?'btn-danger':'btn-primary')+'" id="confirmOkBtn">'+esc(opts.confirmLabel||'Yes')+'</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e=>{ if(e.target===overlay) Studio.closeConfirm(); });
    const cancelBtn = document.getElementById('confirmCancelBtn');
    if(cancelBtn) cancelBtn.onclick = ()=>Studio.closeConfirm();
    document.getElementById('confirmOkBtn').onclick = ()=>{ Studio.closeConfirm(); if(opts.onConfirm) opts.onConfirm(); };
    document.addEventListener('keydown', Studio._confirmEscHandler = e=>{ if(e.key==='Escape') Studio.closeConfirm(); });
    document.getElementById('confirmOkBtn').focus();
  },

  closeConfirm(){
    const overlay = document.getElementById('confirmOverlay');
    if(overlay) overlay.remove();
    if(Studio._confirmEscHandler){ document.removeEventListener('keydown', Studio._confirmEscHandler); Studio._confirmEscHandler = null; }
  },

  /* ===== THEME (light/dark) ===== */
  applyTheme(){
    const theme = localStorage.getItem('beeTheme') === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle-btn').forEach(btn=>{
      btn.textContent = theme==='dark' ? '☀️' : '🌙';
      btn.title = theme==='dark' ? 'Switch to light mode' : 'Switch to dark mode';
      btn.setAttribute('aria-label', btn.title);
    });
  },

  toggleTheme(){
    const next = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
    localStorage.setItem('beeTheme', next);
    Studio.applyTheme();
  },

  goBack(fallback){
    try{
      if(document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1){
        window.history.back();
        return;
      }
    }catch(e){}
    Studio.goto(fallback || 'dashboard');
  },

  goto(page, arg){
    const routes = {
      dashboard:'../dashboard/dashboard.html',
      projects:'../projects/projects.html',
      projectDetail:'../projects/projects.html',
      completedProjects:'../completed-projects/completed-projects.html',
      assets:'../assets/assets.html',
      assetDetail:'../assets/assets.html',
      review:'../review/review.html',
      notifications:'../notifications/notifications.html',
      integrations:'../integrations/integrations.html',
      resources:'../resources/resources.html',
      audit:'../audit/audit.html',
      users:'../users/users.html',
      architecture:'../architecture/architecture.html'
    };
    const target = routes[page] || routes.dashboard;
    const url = new URL(target, window.location.href);
    if(page==='projectDetail' && arg) url.searchParams.set('project', arg);
    if(page==='assetDetail' && arg) url.searchParams.set('asset', arg);
    if(page==='assets' && arg) url.searchParams.set('status', arg);

    state.page = page;
    if(page==='projectDetail') state.selectedProjectId = arg || null;
    if(page==='assetDetail') state.selectedAssetId = arg || null;
    document.getElementById('sidebar')?.classList.remove('open');
    Studio.persist();
    window.location.href = url.href;
  },

  toggleForm(id){
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hidden');
  },

  setFilter(key,val){ state.filter[key]=val; render(); },
};

window.addEventListener('beforeunload', ()=>{ try{ Studio.persist(); }catch(e){} });

/* Restore active user session across separate page views */
try{
  const saved = localStorage.getItem('beeCurrentUser') || sessionStorage.getItem('beeCurrentUser');
  if(saved){
    const parsed = JSON.parse(saved);
    const existing = DB.users.find(u=>u.id===parsed.id || u.email===parsed.email);
    if(existing) DB.currentUser = existing;
    else if(parsed.name && parsed.role){
      DB.users.push(parsed);
      DB.currentUser = parsed;
    }
  }
}catch(e){
  sessionStorage.removeItem('beeCurrentUser');
}

/* Fallback auto-assign session if opening assets or other pages directly in dev */
if(!DB.currentUser && DB.users.length > 0) {
  DB.currentUser = DB.users[0];
}

async function loadServerState(){
  try{
    const res = await fetch(`${window.location.origin}/SIA/api/bootstrap.php`, {
      credentials: 'include'
    });
    const data=await parseApiResponse(res);
    if(!data.success || !data.state) return false;
    const server=data.state;
    DB_PERSISTED_FIELDS.forEach(key=>{
      if(!Array.isArray(server[key])) return;
      DB[key] = key==='assets' ? server[key].map(withVersions) : server[key];
    });
    if(server.currentUser){
      const su={id:String(server.currentUser.id),name:server.currentUser.full_name,email:server.currentUser.email,role:server.currentUser.role};
      DB.currentUser=su; 
      localStorage.setItem('beeCurrentUser',JSON.stringify(su));
      sessionStorage.setItem('beeCurrentUser',JSON.stringify(su));
    }
    if(typeof render==='function' && document.body?.dataset.page!=='login') render();
    return true;
  }catch(e){ console.warn('Server sync unavailable:',e); return false; }
}
window.BEE_SERVER_READY=loadServerState();

/* ---- Sidebar navigation menu ---- */
const NAV = [
  {section:'Workspace'},
  {key:'dashboard', label:'Dashboard', icon:'⌂'},
  {key:'projects', label:'Projects', icon:'▤'},
  {key:'assets', label:'Assets', icon:'▥'},
  {section:'Review & Collaboration'},
  {key:'review', label:'Review Queue', icon:'✓', badgeFn:()=> (DB.assets || []).filter(a => a && latestVersion(a)?.status === 'For Review').length},
  {key:'completedProjects', label:'Completed Projects', icon:'☑'},
  {section:'Management'},
  {key:'integrations', label:'Integration Hub', icon:'⇄', perm:'runIntegrations'},
  {key:'resources', label:'Resources & Budget', icon:'₱', perm:'manageResources'},
  {key:'audit', label:'Audit Log', icon:'≡', perm:'viewAudit'},
  {key:'users', label:'Team & Roles', icon:'☺', perm:'manageUsers'},
];

function renderSidebar(){
  const demoUsers = document.getElementById('demoUsers');
  if(demoUsers) demoUsers.innerHTML = DB.users.slice(0,8).map(u=>
    '<button class="demo-card" onclick="Studio.quickLogin(\''+u.id+'\')"><b>'+esc(u.name)+'</b><span style="color:var(--'+(ROLE_COLOR_VAR[u.role]||'text-faint')+');">'+ROLE_LABELS[u.role]+'</span></button>'
  ).join('');

  const navlist = document.getElementById('navlist');
  if(navlist){
    const list = NAV.filter(n=> n.section || !n.perm || can(n.perm));
    navlist.innerHTML = list.map(n=>{
      if(n.section) return '<div class="nav-section">'+n.section+'</div>';
      const badge = n.badgeFn ? n.badgeFn() : 0;
      const active = state.page===n.key || (state.page==='projectDetail'&&n.key==='projects') || (state.page==='assetDetail'&&n.key==='assets');
      return '<button type="button" class="navitem'+(active?' active':'')+'" onclick="Studio.goto(\''+n.key+'\')">'+
        '<span class="ic">'+n.icon+'</span><span>'+n.label+'</span>'+ (badge>0?'<span class="nb">'+badge+'</span>':'') + '</button>';
    }).join('');
  }

  if(DB.currentUser){
    const avatar = document.getElementById('sideAvatar');
    const name = document.getElementById('sideName');
    const role = document.getElementById('sideRole');
    if(avatar) avatar.textContent = initials(DB.currentUser.name);
    if(name) name.textContent = DB.currentUser.name;
    if(role) role.textContent = ROLE_LABELS[DB.currentUser.role] || DB.currentUser.role;
  }

  const TOPBAR_ONLY_TITLES = { notifications:'Notifications', architecture:'System Architecture' };
  const current = NAV.find(n=>n.key===state.page) ||
    NAV.find(n=>state.page==='projectDetail' && n.key==='projects') ||
    NAV.find(n=>state.page==='assetDetail' && n.key==='assets') ||
    (TOPBAR_ONLY_TITLES[state.page] ? {key:state.page, label:TOPBAR_ONLY_TITLES[state.page]} : null) ||
    NAV.find(n=>n.key==='dashboard') || {label:'Overview',key:'overview'};
    
  const topEyebrow = document.getElementById('topEyebrow');
  const topTitle = document.getElementById('topTitle');
  const clockChip = document.getElementById('clockChip');
  if(topEyebrow) topEyebrow.textContent = current.key ? current.key.toUpperCase() : 'OVERVIEW';
  if(topTitle) topTitle.textContent = current.label || 'Overview';
  if(clockChip) clockChip.textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});

  const notifBtn = document.getElementById('notifBtn');
  if(notifBtn){
    notifBtn.classList.toggle('active', state.page==='notifications');
    const unread = (DB.notifications || []).filter(n=>!n.read).length;
    const badge = document.getElementById('notifBadge');
    if(badge){
      badge.textContent = unread;
      badge.style.display = unread>0 ? 'inline-flex' : 'none';
    }
  }
  const archBtn = document.getElementById('archBtn');
  if(archBtn) archBtn.classList.toggle('active', state.page==='architecture');

  document.querySelectorAll('.theme-toggle-btn').forEach(btn=>{ btn.onclick = ()=>Studio.toggleTheme(); });
  Studio.applyTheme();
}

async function parseApiResponse(response){
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {
    throw new Error(`API returned invalid JSON (HTTP ${response.status}). ${text ? text.slice(0,180) : 'The server returned an empty response.'}`);
  }
  if (!data) throw new Error(`API returned an empty response (HTTP ${response.status}).`);
  return data;
}

/* ===== PROJECT ACTIONS: js/actions/projects.js ===== */
Object.assign(Studio, {
  createProject(){
    if(!can('manageProjects')) return;

    const name = document.getElementById('npName').value.trim();
    const client = document.getElementById('npClient').value.trim();
    const deadline = document.getElementById('npDeadline').value;
    const budget = parseFloat(document.getElementById('npBudget').value) || 0;

    if(!name || !client){
      toast('Project name and client are required.','error');
      return;
    }
    if(!NAME_RE.test(client)){
      toast('Client name can only contain letters, spaces, hyphens, and apostrophes.','error');
      return;
    }
    const todayISO = new Date().toISOString().slice(0,10);
    if(deadline && deadline < todayISO){
      toast('Deadline cannot be in the past.','error');
      return;
    }

    Studio.openConfirm({
      title:'Create this project?',
      body:'“'+esc(name)+'” for '+esc(client)+' will be added to the board.'+(budget?' Budget: ₱'+budget.toLocaleString()+'.':''),
      confirmLabel:'Create project',
      onConfirm:()=>Studio._doCreateProject(name, client, deadline, budget)
    });
  },

  _doCreateProject(name, client, deadline, budget){
    const project = {
      name: name,
      client: client,
      status: 'Pre-Production',
      deadline: deadline || null,
      project_manager_id: null,
      budget: budget
    };

    fetch('/SIA/api/projects.php', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    })
    .then(response => parseApiResponse(response))
    .then(data => {
      if(data.success){
        pushAudit('Create','Project',name);
        pushEvent('Project Created',{ project:name, by:DB.currentUser.name });
        const created=data.project;
        if(created){
          DB.projects.push(created);
          Studio.persist();
        }
        toast('Project created: '+name,'success');
        Studio.goto('projects');
      } else {
        console.error('Project API Error:', data);
        toast(data.error || data.message || 'Failed to create project.','error');
      }
    })
    .catch(error => {
      console.error('Error creating project:', error);
      toast('An error occurred while creating this project.','error');
    });
  },
});

/* ===== ASSET ACTIONS: js/actions/assets.js ===== */
Object.assign(Studio, {
  async submitAsset(){
    if(!can('submitAssets')){
      toast('Your role cannot submit assets.','error');
      return;
    }

    const project = document.getElementById('saProject').value;
    const existingId = document.getElementById('saExisting').value;
    const title = document.getElementById('saTitle').value.trim();
    const type = document.getElementById('saType').value;
    const notes = document.getElementById('saNotes').value.trim();
    const link = document.getElementById('saLink').value.trim();

    if(existingId !== 'new'){
      if(!existingId){
        toast('Please select an existing asset.','error');
        return;
      }
      const existingAsset = assetById(existingId);
      Studio.openConfirm({
        title:'Submit new version?',
        body:'A new version will be added to “'+esc(existingAsset?existingAsset.title:existingId)+'” and set to For Review.',
        confirmLabel:'Submit version',
        onConfirm:()=>Studio._doSubmitVersion(existingId, notes)
      });
      return;
    }

    if(!title || !project){
      toast('Title and project are required.','error');
      return;
    }

    Studio.openConfirm({
      title:'Submit this asset?',
      body:'“'+esc(title)+'” will be submitted and set to For Review.',
      confirmLabel:'Submit asset',
      onConfirm:()=>Studio._doSubmitNewAsset(project, title, type, link, notes)
    });
  },

  async _doSubmitVersion(existingId, notes){
    try {
      const response = await fetch('/SIA/api/assets.php', {
        method:'POST',
        credentials:'include',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ action:'version', asset_id:existingId, notes:notes })
      });

      const data = await response.json();

      if(!response.ok || !data.success){
        toast(data.error || 'Failed to save new version.', 'error');
        return;
      }

      const asset = assetById(existingId);
      if(asset){
        asset.versions = asset.versions || [];
        asset.versions.push(data.version);
      }

      const v = data.version;
      pushAudit('Upload', asset ? asset.title : existingId, 'Submitted v'+v.n+' (auto-status: For Review)');
      pushEvent('Asset Uploaded', { asset:asset ? asset.title : existingId, version:'v'+v.n, by:DB.currentUser.name });
      pushNotif('submission', 'New version submitted: “'+(asset ? asset.title : existingId)+'” v'+v.n+' is awaiting review.', existingId);
      toast('New version submitted — status set to For Review.', 'success');
      Studio.goto('assetDetail', existingId);

    } catch(error) {
      console.error('submitAsset version error:', error);
      toast('Could not connect to the server.', 'error');
    }
  },

  async _doSubmitNewAsset(project, title, type, link, notes){
    try {
      const response = await fetch('/SIA/api/assets.php', {
        method:'POST',
        credentials:'include',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ project_id:project, title:title, type:type, external_link:link, notes:notes })
      });

      const data = await response.json();

      if(!response.ok || !data.success){
        toast(data.error || 'Failed to save asset.', 'error');
        return;
      }

      DB.assets.push(withVersions(data.asset));
      pushAudit('Upload', title, 'Submitted v1 (auto-status: For Review)');
      pushEvent('Asset Uploaded', { asset:title, version:'v1', by:DB.currentUser.name });
      pushNotif('submission', 'New submission: “'+title+'” is awaiting review.', data.asset.id);
      toast('Asset submitted — workflow set status to “For Review”.', 'success');
      Studio.goto('assetDetail', data.asset.id);

    } catch(error) {
      console.error('submitAsset error:', error);
      toast('Could not connect to the server.', 'error');
    }
  },

  onSaExistingChange(){
    const v = document.getElementById('saExisting').value;
    const wrap = document.getElementById('saNewFields');
    if(wrap) wrap.style.display = v==='new' ? 'block' : 'none';
  },
});

/* ===== REVIEW ACTIONS: js/actions/review.js ===== */
Object.assign(Studio, {
  reviewAsset(assetId, decision){
    if(!can('review')){ toast('Your role cannot review assets.','error'); return; }
    const asset = assetById(assetId);
    const v = latestVersion(asset);
    const commentBox = document.getElementById('reviewComment');
    const text = commentBox ? commentBox.value.trim() : '';
    const markFinal = document.getElementById('markFinal');
    const asFinal = markFinal ? markFinal.checked : false;

    if(decision==='approve'){
      v.status = asFinal ? 'Final' : 'Approved';
      pushAudit('Approval', asset.title, 'v'+v.n+(asFinal?' approved as FINAL':' approved'));
      pushEvent(asFinal?'Final Output Approved':'Asset Approved', {asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      DB.webhooks.push({id:nid('w'), endpoint:'https://hooks.beeproduction.studio/asset-approved', status:200, payload:JSON.stringify({asset:asset.title, version:'v'+v.n, final:asFinal}), date:new Date().toISOString()});
      pushNotif('approval', (asFinal?'“'+asset.title+'” was approved as Final Output.':'“'+asset.title+'” v'+v.n+' was approved.'), asset.id);
      toast(asFinal?'Marked as Final Output. Webhook fired.':'Approved. Webhook fired to production dashboard.','success');
    } else if(decision==='reject'){
      v.status = 'Rejected';
      pushAudit('Rejection', asset.title, 'v'+v.n+' rejected');
      pushEvent('Asset Rejected', {asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      pushNotif('revision', '“'+asset.title+'” v'+v.n+' was rejected.', asset.id);
      toast('Marked as rejected.','error');
    } else if(decision==='revise'){
      v.status = 'Revision Requested';
      pushAudit('Revision', asset.title, 'v'+v.n+' — revision requested');
      pushEvent('Revision Requested', {asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      pushNotif('revision', 'Revision requested on “'+asset.title+'” v'+v.n+'.', asset.id);
      toast('Revision requested.','success');
    }
    if(text){
      DB.comments.push({id:nid('c'), asset:asset.id, by:DB.currentUser.id, text, date:new Date().toISOString().slice(0,10)});
    }
    if(typeof render === 'function') render();
    Studio.persist();
  },

  quickApprove(assetId){
    state.selectedAssetId = assetId;
    Studio.reviewAsset(assetId,'approve');
    toast('Approved from Review Queue.','success');
  },
});

/* ===== FEEDBACK ACTIONS: js/actions/feedback.js ===== */
Object.assign(Studio, {
  addComment(assetId){
    if(!can('comment')) return;
    const box = document.getElementById('newComment');
    const text = box.value.trim();
    if(!text) return;
    DB.comments.push({id:nid('c'), asset:assetId, by:DB.currentUser.id, text, date:new Date().toISOString().slice(0,10)});
    box.value='';
    pushAudit('Comment', assetById(assetId).title, 'Feedback added');
    if(typeof render === 'function') render();
    Studio.persist();
  },

  markRead(id){ const n = DB.notifications.find(x=>x.id===id); if(n) n.read=true; if(typeof render === 'function') render(); Studio.persist(); },
  markAllRead(){ DB.notifications.forEach(n=>n.read=true); if(typeof render === 'function') render(); Studio.persist(); toast('All notifications marked as read.'); },
});

/* ===== INTEGRATION ACTIONS: js/actions/integrations.js ===== */
Object.assign(Studio, {
  apiSend(){
    const sel = document.getElementById('apiAssetSelect');
    const assetId = sel.value;
    const asset = assetById(assetId);
    if(!asset) return;
    const v = latestVersion(asset);
    const reqPayload = {asset:asset.title, version:'v'+v.n, status:v.status, project:projectById(asset.project).name};
    DB.apiLogs.push({id:nid('api'), dir:'REQUEST', method:'POST', endpoint:'/api/v1/production-dashboard/assets', body:JSON.stringify(reqPayload), date:new Date().toISOString()});
    if(typeof render === 'function') render();
    Studio.persist();
    toast('Request sent…');
    setTimeout(()=>{
      DB.apiLogs.push({id:nid('api'), dir:'RESPONSE', method:'POST', endpoint:'/api/v1/production-dashboard/assets', status:201, body:JSON.stringify({received:true, id:'dash_'+asset.id, syncedAt:new Date().toISOString()}), date:new Date().toISOString()});
      pushAudit('Integration', asset.title, 'Synced to Production Dashboard via API');
      pushEvent('Asset Synced to Dashboard', {asset:asset.title});
      toast('201 Created — synced to Production Dashboard.','success');
      if(typeof render === 'function') render();
      Studio.persist();
    }, 650);
  },

  runETL(){
    const raw = document.getElementById('etlInput').value.trim();
    const log = document.getElementById('etlLog');
    if(!raw){ toast('Paste or keep the sample CSV first.','error'); return; }
    const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
    const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const rows = lines.slice(1);
    let steps = [];
    steps.push('EXTRACT — read '+rows.length+' row(s) from source file.');
    let loaded = 0, skipped = 0;
    rows.forEach(line=>{
      const cells = line.match(/(".*?"|[^,]+)/g) || [];
      const clean = cells.map(c=>c.replace(/^"|"$/g,'').trim());
      const rec = {};
      header.forEach((h,i)=> rec[h] = clean[i] || '');
      if(!rec.title || !rec.project){ skipped++; return; }
      const proj = DB.projects.find(p=> p.name.toLowerCase().includes(rec.project.toLowerCase()) || rec.project.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()));
      const type = ['Storyboard','Animatic','Character Sheet','Background Asset','Animation Scene','Render','Audio','Design Draft'].includes(rec.type) ? rec.type : 'Design Draft';
      const asset = {id:nid('a'), project: proj?proj.id:DB.projects[0].id, title:rec.title, type, link:'', versions:[{id:nid('v'), n:1, status:'For Review', notes:'Imported via ETL — assignee: '+(rec.assignee||'unassigned')+(rec.duedate?(', due '+rec.duedate):''), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)}]};
      DB.assets.push(asset);
      loaded++;
    });
    steps.push('TRANSFORM — validated required fields, normalized asset type, mapped project names ('+skipped+' row(s) skipped for missing data).');
    steps.push('LOAD — inserted '+loaded+' new asset record(s), each auto-set to “For Review”.');
    log.innerHTML = steps.map(s=>'<div class="log-line"><span class="t">›</span><span>'+esc(s)+'</span></div>').join('');
    pushAudit('Integration','ETL Import', loaded+' asset(s) imported from CSV');
    pushEvent('ETL Import Completed', {rows:rows.length, loaded, skipped});
    toast('ETL run complete — '+loaded+' record(s) loaded.','success');
    if(typeof render === 'function') render();
    Studio.persist();
  },
});

/* ===== RESOURCE ACTIONS: js/actions/resources.js ===== */
Object.assign(Studio, {
  addResource(){
    if(!can('manageResources')) return;
    const project = document.getElementById('rsProject').value;
    const category = document.getElementById('rsCategory').value;
    const desc = document.getElementById('rsDesc').value.trim();
    const cost = parseFloat(document.getElementById('rsCost').value)||0;
    const hours = parseFloat(document.getElementById('rsHours').value)||0;
    if(!desc){ toast('Add a short description.','error'); return; }
    DB.resources.push({id:nid('r'), project, category, desc, cost, hours});
    pushAudit('Resource', projectById(project).name, category+' entry added: '+desc);
    toast('Resource entry logged.','success');
    if(typeof render === 'function') render();
    Studio.persist();
  },
});

/* ===== USER ACTIONS: js/actions/users.js ===== */
Object.assign(Studio, {
  addUser(){
    if(!can('manageUsers')) return;
    const name = document.getElementById('umName').value.trim();
    const role = document.getElementById('umRole').value;
    if(!name){ toast('Enter a name.','error'); return; }
    if(!NAME_RE.test(name)){ toast('Name can only contain letters, spaces, hyphens, and apostrophes.','error'); return; }
    const u = {id:nid('u'), name, role};
    DB.users.push(u);
    pushAudit('User', name, 'Added to team as '+ROLE_LABELS[role]);
    toast('Team member added.','success');
    document.getElementById('umName').value='';
    if(typeof render === 'function') render();
    Studio.persist();
  },

  changeRole(uid, role){
    const u = userById(uid); if(!u) return;
    u.role = role;
    pushAudit('User', u.name, 'Role changed to '+ROLE_LABELS[role]);
    toast(u.name+' is now '+(ROLE_LABELS[role]||role)+'.');
    if(typeof render === 'function') render();
    Studio.persist();
  },

  deleteUser(uid){
    if(!can('manageUsers')) return;
    if(DB.currentUser && DB.currentUser.id === uid){
      toast('You can’t remove your own account while signed in.','error');
      return;
    }
    const u = userById(uid);
    if(!u) return;
    Studio.openConfirm({
      title:'Remove team member?',
      body:'“'+esc(u.name)+'” ('+esc(ROLE_LABELS[u.role]||u.role)+') will lose access to the studio. Their past uploads, comments, and approvals stay on record.',
      confirmLabel:'Remove',
      danger:true,
      onConfirm:()=>{
        DB.users = DB.users.filter(x=>x.id!==uid);
        pushAudit('User', u.name, 'Removed from team');
        toast(u.name+' removed from the team.','success');
        if(typeof render === 'function') render();
        Studio.persist();
      }
    });
  },
});