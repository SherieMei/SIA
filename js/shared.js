// Each existing API operation is handled locally by the Firebase adapter.
const firebaseAdapterReady = import(new URL('./firebase-api.js', document.currentScript.src).href);
window.beeFetch = async (url, options) => (await firebaseAdapterReady).firebaseFetch(url, options);
/* BEE PRODUCTION SHARED RUNTIME */
const sharedScriptUrl = document.currentScript?.src;
if (!sharedScriptUrl) {
  throw new Error('Unable to determine the shared runtime URL.');
}
window.BEE_API_BASE = new URL('../api/', sharedScriptUrl).href;
window.BEE_UPLOADS_BASE = new URL('../uploads/', sharedScriptUrl).pathname;
/* ===== DATA CONSTANTS: js/data/constants.js ===== */
/* ==========================================================================
   CONSTANTS — roles, permissions, asset type styling, status labels.
   Edit permissions here to change who can do what.========================================================================== */
const ROLE_LABELS={
  admin:'Administrator',project_manager:'Project Manager',
  animator:'Animator',editor:'Editor',client:'Client'
};
/* Distinct, theme-safe accent color per role (used for badges and inline role tags) */
const ROLE_COLOR_VAR={
  admin:'crimson',project_manager:'violet',animator:'cyan',editor:'gold',client:'azure'
};
/* Letters (incl. accented), spaces, apostrophes, hyphens, and periods only — for name-type
   fields (person names, client names). Rejects digits and other symbols. Fields that
   legitimately need numbers/symbols (email, password, IDs) must not use this. */
const NAME_RE=/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/;
const PERMISSIONS={
  manageUsers:['admin'],
  manageProjects:['admin','project_manager'],
  viewCompletedProjects:['admin','project_manager','client'],
  viewProjects:['admin','project_manager','animator','editor','client'],
  viewAssets:['admin','project_manager','animator','editor','client'],
  uploadAsset:['admin','project_manager','animator','editor'],
  editAsset:['admin','project_manager','animator','editor'],
  commentAsset:['admin','project_manager','animator','editor','client'],
  approveAsset:['client'],
  requestRevision:['client'],
  rejectAsset:['client'],
  viewAudit:['admin','project_manager'],
  manageResources:['admin','project_manager'],
  runIntegrations:['admin','project_manager','editor'],
};
function can(action){return DB.currentUser&&PERMISSIONS[action]&&PERMISSIONS[action].includes(DB.currentUser.role);}
const TYPE_META={
  'Storyboard':{tag:'SB',color:'#ff6b4d'},
  'Animatic':{tag:'AN',color:'#9b8cfb'},
  'Character Sheet':{tag:'CS',color:'#2bd9c9'},
  'Background Asset':{tag:'BG',color:'#6ea8e0'},
  'Animation Scene':{tag:'AS',color:'#f0495a'},
  'Render':{tag:'RN',color:'#ffd479'},
  'Audio':{tag:'AU',color:'#e08ce0'},
  'Design Draft':{tag:'DD',color:'#9aa0ab'},
};
const STATUS_CLASS={
  'For Review':'b-review','Approved':'b-approved','Rejected':'b-rejected',
  'Revision Requested':'b-revision','Final':'b-final'
};
const NOTIF_ICON={submission:'▲',revision:'↺',deadline:'◷',approval:'✓',completed:'●'};
/* ===== SEED DATA: js/data/seed.js ===== */
/* ==========================================================================
   SEED DATA — demo team, projects, and assets the app boots with.
   Everything lives in memory for the session (see Architecture page)
   ========================================================================== */
let idCounters={p:3,a:0,v:0,c:0,n:0,e:0,au:0,w:0,api:0,r:0,u:8};
function nid(prefix){idCounters[prefix]++;return prefix+idCounters[prefix];}
const DB={
  currentUser:null,
  users:[],
  projects:[],
  assets:[],
  comments:[],
  notifications:[],
  auditLog:[],
  events:[],
  webhooks:[],
  apiLogs:[],
  resources:[],
  animationShots:null,
  animationShotsError:'',
};
function latestVersion(a){
  if(!a||typeof a!=='object'){
    return{status:'For Review',n:1,date:''};
  }
  if(Array.isArray(a.versions)&&a.versions.length>0){
    const last=a.versions[a.versions.length-1];
    return last||{status:'For Review',n:1,date:''};
  }
  return{status:'For Review',n:1,date:''};
}
async function loadAnimationShotsFromDB(){
  DB.animationShots=null;
  DB.animationShotsError='';
  if(DB.currentUser?.role!=='animator')return true;
  try{
    const response=await window.beeFetch(window.BEE_API_BASE+'animation_shots.php',{
      credentials:'include'
    });
    const data=await parseApiResponse(response);
    if(!response.ok||!data.success||!Array.isArray(data.shots)){
      throw new Error(data.error||'Unable to load assigned animation shots.');
    }
    DB.animationShots=data.shots;
    return true;
  }catch(error){
    DB.animationShots=[];
    DB.animationShotsError=error.message||'Unable to load assigned animation shots.';
    console.error('Animation shot tracker load error:',error);
    return false;
  }
}
/* The PHP backend (api/assets.php, api/bootstrap.php) doesn't nest asset_versions into
   its asset rows, so anything sourced from the server is missing `.versions`. Every asset
   entering DB.assets must go through this so the rest of the app's `a.versions.length`
   assumptions never crash. */
function withVersions(a){
  return Array.isArray(a&&a.versions)?a:{...a,versions:[]};
}
/* Demo asset seeding removed. Assets now come from the database API. */
function pushNotif(type,text,ref){
  DB.notifications.push({id:nid('n'),type,text,ref,read:false,date:new Date().toISOString()});
}
function pushAudit(action,entity,detail){
  DB.auditLog.push({id:nid('au'),by:DB.currentUser?DB.currentUser.name:'System',action,entity,detail,date:new Date().toISOString()});
}
function pushEvent(name,payload){
  DB.events.unshift({id:nid('e'),name,payload,date:new Date().toISOString()});
}
/* ===== PERSISTENCE ACROSS SEPARATE PAGES ===== */
const DB_PERSIST_KEY='beeDBFirebase';
const DB_PERSISTED_FIELDS=[
  'users',
  'assets',
  'comments',
  'auditLog',
  'events',
  'webhooks',
  'apiLogs',
  'resources'
];
(function restorePersistedDB(){
  try{
    const raw=sessionStorage.getItem(DB_PERSIST_KEY);
    if(!raw)return;
    const saved=JSON.parse(raw);
    if(!saved||typeof saved!=='object')return;
    DB_PERSISTED_FIELDS.forEach(key=>{
      if(Array.isArray(saved[key]))DB[key]=saved[key];
    });
    if(saved.idCounters&&typeof saved.idCounters==='object'){
      idCounters=Object.assign(idCounters,saved.idCounters);
    }
  }catch(e){
    sessionStorage.removeItem(DB_PERSIST_KEY);
  }
})();
// Project visibility is scoped by the authenticated server account; never restore a stale project list.
DB.projects=[];
/* ===== ROLE MIGRATION: clean up data persisted under roles removed in the 5-role reduction ===== */
(function migrateLegacyRoles(){
  const ROLE_MIGRATION={artist:'animator',reviewer:'project_manager'};
  const REMOVED_ROLES=['viewer'];
  let changed=false;
  DB.users=DB.users.filter(u=>{
    if(REMOVED_ROLES.includes(u.role)){changed=true;return false;}
    return true;
  });
  DB.users.forEach(u=>{
    if(ROLE_MIGRATION[u.role]){u.role=ROLE_MIGRATION[u.role];changed=true;}
  });
  [window.localStorage,window.sessionStorage].forEach(store=>{
    try{
      const raw=store.getItem('beeCurrentUser');
      if(!raw)return;
      const u=JSON.parse(raw);
      if(!u||typeof u!=='object')return;
      if(REMOVED_ROLES.includes(u.role)){store.removeItem('beeCurrentUser');changed=true;return;}
      if(ROLE_MIGRATION[u.role]){u.role=ROLE_MIGRATION[u.role];store.setItem('beeCurrentUser',JSON.stringify(u));changed=true;}
    }catch(e){}
  });
  if(changed){
    try{
      const raw=sessionStorage.getItem(DB_PERSIST_KEY);
      const saved=raw?JSON.parse(raw):{};
      saved.users=DB.users;
      sessionStorage.setItem(DB_PERSIST_KEY,JSON.stringify(saved));
    }catch(e){}
  }
})();
/* ===== STATE: js/core/state.js ===== */
/* ==========================================================================
   APP STATE + HELPERS
   ========================================================================== */
const state={page:'dashboard',selectedProjectId:null,selectedAssetId:null,
  filter:{project:'all',type:'all',status:'all',q:''}};
(function restorePageRoute(){
  const page=document.body&&document.body.dataset?document.body.dataset.page:'';
  if(page&&page!=='login')state.page=page;
  try{
    const params=new URLSearchParams(window.location.search);
    const project=params.get('project');
    const asset=params.get('asset');
    const status=params.get('status');
    const workspace=params.get('workspace');
    if(project){state.page='projectDetail';state.selectedProjectId=project;}
    if(asset){state.page='assetDetail';state.selectedAssetId=asset;}
    if(status&&STATUS_CLASS[status])state.filter.status=status;
    if(['tracker','schedule','feedback','shotTracker','editorSequences'].includes(workspace))state.page=workspace;
    if(workspace==='tasks')state.page='dashboard';
  }catch(e){}
})();
function fmtDate(d){
  if(!d)return'—';
  const dt=new Date(d);
  if(isNaN(dt))return d;
  return dt.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'});
}
function fmtDateTime(d){
  const dt=new Date(d);
  if(isNaN(dt))return d;
  return dt.toLocaleDateString('en-US',{month:'short',day:'2-digit'})+' · '+dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}
function userById(id){return DB.users.find(u=>String(u.id)===String(id));}
function projectById(id){return DB.projects.find(p=>String(p.id)===String(id));}
function assetById(id){return DB.assets.find(a=>String(a.id)===String(id));}
function initials(name){return name?name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase():'?';}
function esc(s){return(s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderFeedbackEntry({context='',title='',meta='',status='',text='',actionHtml=''}){
  return `<article class="card feedback-entry-card">
    <div class="feedback-entry-heading">
      <div class="feedback-entry-title">
        ${context?`<span class="feedback-entry-context">${esc(context)}</span>`:''}
        ${title?`<h3>${esc(title)}</h3>`:''}
      </div>
      ${status?`<span class="badge ${STATUS_CLASS[status]||'b-role'}">${esc(status)}</span>`:''}
    </div>
    ${meta?`<div class="feedback-entry-meta">${esc(meta)}</div>`:''}
    <p class="feedback-entry-text">${esc(text)}</p>
    ${actionHtml?`<div class="feedback-entry-action">${actionHtml}</div>`:''}
  </article>`;
}
function toast(msg,kind){
  const wrap=document.getElementById('toastWrap');
  if(!wrap)return;
  const el=document.createElement('div');
  el.className='toast'+(kind?' '+kind:'');
  el.textContent=msg;
  wrap.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='.25s';setTimeout(()=>el.remove(),260);},3200);
}
/* =========================================================
   PROJECT COMPLETION INFO
   ========================================================= */

function getProjectCompletionInfo(pid){

  const project =
    projectById(pid);

  const requiredTypes =
    Object.keys(TYPE_META);

  const assets =
    Array.isArray(DB.assets)
      ? DB.assets.filter(
          a =>
            String(a.project) === String(pid) ||
            String(a.project_id) === String(pid)
        )
      : [];

  const presentTypes =
    new Set(
      assets
        .map(a => String(a.type ?? a.asset_type ?? '').trim().toLocaleLowerCase())
        .filter(Boolean)
    );

  const missingTypes =
    requiredTypes.filter(
      type => !presentTypes.has(type.toLocaleLowerCase())
    );

  const pendingAssets =
    assets.filter(a => {

      const status =
        latestVersion(a)?.status || '';

      return (
        status === 'For Review' ||
        status === 'Revision Requested'
      );
    });

  const resolvedAssets =
    assets.filter(a => {

      const status =
        latestVersion(a)?.status || '';

      return (
        status === 'Approved' ||
        status === 'Final' ||
        status === 'Rejected'
      );
    });

  const resources =
    Array.isArray(DB.resources)
      ? DB.resources.filter(
          r =>
            String(r.project) === String(pid) ||
            String(r.project_id) === String(pid)
        )
      : [];

  const spent =
    resources.reduce(
      (sum, r) =>
        sum + Number(r.cost || 0),
      0
    );

  const budget =
    Number(project?.budget || 0);


  /* 60% = required asset types present */
  const assetTypeProgress =
    (
      (requiredTypes.length - missingTypes.length) /
      requiredTypes.length
    ) * 60;

  /* 40% = submitted assets reviewed */
  const reviewProgress =
    assets.length > 0
      ? (
          resolvedAssets.length /
          assets.length
        ) * 40
      : 0;


  let progress=Math.round(assetTypeProgress+reviewProgress);


  const canFinish =
    assets.length > 0 &&
    missingTypes.length === 0 &&
    pendingAssets.length === 0 &&
    resolvedAssets.length === assets.length;


  if(canFinish){
    progress = 100;
  }else{
    progress = Math.min(progress, 99);
  }


  return {
    progress,
    missingTypes,
    pendingAssets,
    resolvedAssets,
    unresolvedAssets:assets.length-resolvedAssets.length,
    spent,
    budget,
    canFinish
  };
}


function projectProgress(pid){
  return getProjectCompletionInfo(pid).progress;
}
/* ===== NAVIGATION: js/core/nav.js ===== */
/* ==========================================================================
   STUDIO CONTROLLER & ROUTING
   ========================================================================== */
const Studio={
  persist(){
    try{
      const snapshot={};
      DB_PERSISTED_FIELDS.forEach(key=>{snapshot[key]=DB[key];});
      snapshot.idCounters=idCounters;
      sessionStorage.setItem(DB_PERSIST_KEY,JSON.stringify(snapshot));

    }catch(e){}
  },
  login(username,password){
    toast('Use your registered email and password to sign in.','error');
  },
  async manualLogin(){
    const email=document.getElementById('loginEmail').value.trim();
    const password=document.getElementById('loginPassword').value;
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Enter a valid email to sign in.','error');return;}
    if(!password){toast('Enter a password to sign in.','error');return;}
    try{
      const res=await window.beeFetch(window.BEE_API_BASE+'auth.php',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email,password})});
      const data=await parseApiResponse(res);
      if(!res.ok||!data.success)throw new Error(data.error||'Sign in failed.');
      const u={id:String(data.user.id),name:data.user.full_name,email:data.user.email,role:data.user.role};
      const existing=DB.users.find(x=>x.id===u.id);if(existing)Object.assign(existing,u);else DB.users.push(u);
      Studio.completeLogin(u);
    }catch(e){toast(e.message||'Unable to sign in.','error');}
  },
  async createAccount(){
    const name=document.getElementById('signupName').value.trim();
    const email=document.getElementById('loginEmail').value.trim();
    const password=document.getElementById('loginPassword').value;
    if(!name){toast('Enter your full name to create an account.','error');return;}
    if(!NAME_RE.test(name)){toast('Name can only contain letters, spaces, hyphens, and apostrophes.','error');return;}
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Enter a valid email.','error');return;}
    try{
      const res=await window.beeFetch(window.BEE_API_BASE+'auth.php',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'register',name,email,password})});
      const data=await parseApiResponse(res);
      if(!res.ok||!data.success)throw new Error(data.error||'Account creation failed.');
      const u={id:String(data.user.id),name:data.user.full_name,email:data.user.email,role:data.user.role};
      DB.users.push(u);
      Studio.openConfirm({
        title:'Account created!',
        body:'Welcome, '+esc(u.name)+'. Sign in with your new account to continue.',
        confirmLabel:'Continue to sign in',
        hideCancel:true,
        onConfirm:async()=>{
          try{
            await window.beeFetch(window.BEE_API_BASE+'auth.php',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
          }catch(e){}
          const passwordInput=document.getElementById('loginPassword');
          if(passwordInput)passwordInput.value='';
          document.getElementById('authModeToggle')?.click();
          const emailInput=document.getElementById('loginEmail');
          if(emailInput){emailInput.value=email;emailInput.focus();}
        }
      });
    }catch(e){toast(e.message||'Unable to create account.','error');}
  },
  async quickLogin(id){
    const u=userById(id);
    if(!u)return;
    document.getElementById('loginEmail').value=u.email||'';
    const password=document.getElementById('loginPassword');
    if(password){
      password.value='';
      password.focus();
    }
  },
  completeLogin(u){
    if(!u)return;
    DB.currentUser=u;
    localStorage.setItem('beeCurrentUser',JSON.stringify(u));
    sessionStorage.setItem('beeCurrentUser',JSON.stringify(u));
    Studio.persist();
    if(document.body&&document.body.dataset.page==='login'){
      window.location.assign(new URL('../dashboard/dashboard.html',window.location.href).href);
      return;
    }
    const loginScreen=document.getElementById('loginScreen');
    const app=document.getElementById('app');
    if(loginScreen)loginScreen.hidden=true;
    if(app)app.hidden=false;
    state.page='dashboard';
    if(typeof render==='function')render();
    toast('Signed in as '+u.name+' ('+ROLE_LABELS[u.role]+').','success');
  },
  async logout(){
    try{
      await window.beeFetch(window.BEE_API_BASE+'auth.php',{
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
    window.location.assign(new URL('../login/login.html',window.location.href).href);
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
    const overlay=document.createElement('div');
    overlay.className='modal-overlay';
    overlay.id='confirmOverlay';
    overlay.innerHTML=
      '<div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle">'+
        '<div class="modal-head"><h3 id="confirmTitle">'+esc(opts.title||'Are you sure?')+'</h3></div>'+
        '<p class="confirm-body">'+(opts.body||'')+'</p>'+
        '<div class="confirm-actions">'+
          (opts.hideCancel?'':'<button type="button" class="btn" id="confirmCancelBtn">'+esc(opts.cancelLabel||'Cancel')+'</button>')+
          '<button type="button" class="btn '+(opts.danger?'btn-danger':'btn-primary')+'" id="confirmOkBtn">'+esc(opts.confirmLabel||'Yes')+'</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)Studio.closeConfirm();});
    const cancelBtn=document.getElementById('confirmCancelBtn');
    if(cancelBtn)cancelBtn.onclick=()=>Studio.closeConfirm();
    document.getElementById('confirmOkBtn').onclick=()=>{Studio.closeConfirm();if(opts.onConfirm)opts.onConfirm();};
    document.addEventListener('keydown',Studio._confirmEscHandler=e=>{if(e.key==='Escape')Studio.closeConfirm();});
    document.getElementById('confirmOkBtn').focus();
  },
  closeConfirm(){
    const overlay=document.getElementById('confirmOverlay');
    if(overlay)overlay.remove();
    if(Studio._confirmEscHandler){document.removeEventListener('keydown',Studio._confirmEscHandler);Studio._confirmEscHandler=null;}
  },
  /* ===== THEME (light/dark) ===== */
  applyTheme(){
    const theme=localStorage.getItem('beeTheme')==='dark'?'dark':'light';
    document.documentElement.setAttribute('data-theme',theme);
    document.querySelectorAll('.theme-toggle-btn').forEach(btn=>{
      btn.textContent=theme==='dark'?'☀️':'🌙';
      btn.title=theme==='dark'?'Switch to light mode':'Switch to dark mode';
      btn.setAttribute('aria-label',btn.title);
    });
  },
  toggleTheme(){
    const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    localStorage.setItem('beeTheme',next);
    Studio.applyTheme();
  },
  goBack(fallback){
    try{
      if(document.referrer&&new URL(document.referrer).origin===window.location.origin&&window.history.length>1){
        window.history.back();
        return;
      }
    }catch(e){}
    Studio.goto(fallback||'dashboard');
  },
  goBackSidebar(fallback){
    const previousPage=sessionStorage.getItem('beePreviousSidebarPage');
    if(previousPage&&previousPage!==state.page){
      Studio.goto(previousPage);
      return;
    }
    Studio.goto(fallback||'dashboard');
  },
  goto(page,arg){
    if(page==='tasks'&&DB.currentUser?.role==='editor'){
      page='dashboard';
    }
    const routes={
      dashboard:'../dashboard/dashboard.html',
      projects:'../projects/projects.html',
      projectDetail:'../projects/projects.html',
      completedProjects:'../completed-projects/completed-projects.html',
      assets:'../assets/assets.html',
      assetDetail:'../assets/assets.html',
      tracker:'../projects/projects.html',
      shotTracker:'../projects/projects.html',
      editorSequences:'../projects/projects.html',
      schedule:'../projects/projects.html',
      feedback:'../projects/projects.html',
      review:'../review/review.html',
      notifications:'../notifications/notifications.html',
      integrations:'../integrations/integrations.html',
      resources:'../resources/resources.html',
      audit:'../audit/audit.html',
      users:'../users/users.html',
      architecture:'../architecture/architecture.html'
    };
    const target=routes[page]||routes.dashboard;
    const url=new URL(target,window.location.href);
    if(page==='projectDetail'&&arg)url.searchParams.set('project',arg);
    if(page==='assetDetail'&&arg)url.searchParams.set('asset',arg);
    if(page==='assets'&&arg)url.searchParams.set('status',arg);
    if(['tracker','schedule','feedback','shotTracker','editorSequences'].includes(page)){
      url.searchParams.set('workspace',page);
    }
    const sidebarPages=[
      'dashboard',
      'projects',
      'completedProjects',
      'assets',
      'tracker',
      'shotTracker',
      'editorSequences',
      'schedule',
      'feedback',
      'review',
      'notifications',
      'integrations',
      'resources',
      'audit',
      'users',
      'architecture'
    ];
    if(
      sidebarPages.includes(page)&&
      sidebarPages.includes(state.page)&&
      page!==state.page
    ){
      sessionStorage.setItem(
        'beePreviousSidebarPage',
        state.page
      );
    }
    state.page=page;
    if(page==='projectDetail')state.selectedProjectId=arg||null;
    if(page==='assetDetail')state.selectedAssetId=arg||null;
    document.getElementById('sidebar')?.classList.remove('open');
    Studio.persist();
    window.location.href=url.href;
  },
  toggleForm(id){
    const el=document.getElementById(id);
    if(el)el.classList.toggle('hidden');
  },
  setFilter(key,val){
    state.filter[key]=val;
    if(document.body&&document.body.dataset.page==='assets')state.page='assets';
    if(typeof render==='function')render();
  },
};
window.addEventListener('beforeunload',()=>{try{Studio.persist();}catch(e){}});
/* Restore active user session across separate page views */
try{
  const saved=localStorage.getItem('beeCurrentUser')||sessionStorage.getItem('beeCurrentUser');
  if(saved){
    const parsed=JSON.parse(saved);
    const existing=DB.users.find(u=>u.id===parsed.id||u.email===parsed.email);
    if(existing)DB.currentUser=existing;
    else if(parsed.name&&parsed.role){
      DB.users.push(parsed);
      DB.currentUser=parsed;
    }
  }
}catch(e){
  sessionStorage.removeItem('beeCurrentUser');
}
async function loadServerState(){
  try{
    const res=await window.beeFetch(window.BEE_API_BASE+'bootstrap.php',{
      credentials:'include'
    });
    const data=await parseApiResponse(res);
    if(!data.success||!data.state){DB.currentUser=null;localStorage.removeItem('beeCurrentUser');sessionStorage.removeItem('beeCurrentUser');return false;}
    const server=data.state;
    DB.projects=Array.isArray(server.projects)?server.projects:[];
    DB_PERSISTED_FIELDS.forEach(key=>{
      if(!Array.isArray(server[key]))return;
      DB[key]=key==='assets'
        ?server[key].map(withVersions)
        :server[key];
    });
    if(server.currentUser){
      const su={
        id:String(server.currentUser.id),
        name:server.currentUser.full_name,
        email:server.currentUser.email,
        role:server.currentUser.role
      };
      DB.currentUser=su;
      localStorage.setItem(
        'beeCurrentUser',
        JSON.stringify(su)
      );
      sessionStorage.setItem(
        'beeCurrentUser',
        JSON.stringify(su)
      );
    }
    if(typeof render==='function'&&document.body?.dataset.page!=='login'){
      render();
    }
    return true;
  }catch(e){
    console.warn('Server sync unavailable:',e);
    return false;
  }
}
async function loadAssetsFromDB(){
  try{
    const res=await window.beeFetch(window.BEE_API_BASE+'assets.php',{
      credentials:'include'
    });
    const data=await parseApiResponse(res);
    if(!res.ok||!data.success||!data.state||!Array.isArray(data.state.assets)){
      return false;
    }
    DB.assets=data.state.assets.map(withVersions);
    const serverComments=DB.assets.flatMap(asset=>
      (asset.comments||[]).map(comment=>({
        ...comment,
        asset:String(asset.id)
      }))
    );
    if(DB.currentUser?.role==='client'){
      DB.comments=serverComments;
    }else{
      const serverCommentIds=new Set(serverComments.map(comment=>String(comment.id)));
      DB.comments=[
        ...DB.comments.filter(comment=>!serverCommentIds.has(String(comment.id))),
        ...serverComments
      ];
    }
    return true;
  }catch(e){
    console.warn('Assets sync unavailable:',e);
    return false;
  }
}
async function loadResourcesFromDB(){
  try{
    const res=await window.beeFetch(window.BEE_API_BASE+'assets/resources.php',{
      credentials:'include'
    });
    const data=await parseApiResponse(res);
    if(!data.success)return false;
    DB.resources=(data.resources||[]).map(r=>({
      id:r.id,
      project:r.project_id,
      category:r.category,
      desc:r.description,
      cost:parseFloat(r.cost)||0,
      hours:parseFloat(r.hours)||0
    }));
    return true;
  }catch(e){
    console.warn('Resources sync unavailable:',e);
    return false;
  }
}
async function loadNotificationsFromDB(){
  try{
    const response=await window.beeFetch(
      window.BEE_API_BASE+'notifications.php?action=list',
      {
        method:'GET',
        credentials:'include'
      }
    );
    const data=await parseApiResponse(response);
    if(
      !response.ok||
      !data.success||
      !Array.isArray(data.data)
    ){
      return false;
    }
    DB.notifications=data.data.map(n=>({
      ...n,
      text:n.text??n.message??n.title??'',
      date:n.date??n.created_at??'',
      read:n.read??Boolean(Number(n.is_read))
    }));
    return true;
  }catch(error){
    console.warn(
      'Notifications sync unavailable:',
      error
    );
    return false;
  }
}
async function loadProjectsFromDB(){
  try{
    const response=await window.beeFetch(
      window.BEE_API_BASE+'projects.php',
      {
        method:'GET',
        credentials:'include'
      }
    );
    const data=await parseApiResponse(response);
    if(
      !response.ok||
      !data.success||
      !Array.isArray(data.projects)
    ){
      console.warn('Projects unavailable for the current account; hiding cached project data.');
      return false;
    }
    DB.projects=data.projects;
    return true;
  }catch(error){
    console.warn(
      'Projects unavailable for the current account; hiding cached project data:',
      error
    );
    return false;
  }
}
window.BEE_SERVER_READY=loadServerState();
window.BEE_SERVER_READY.then(async()=>{
  await loadProjectsFromDB();
  await loadAssetsFromDB();
  await loadAnimationShotsFromDB();
  await loadResourcesFromDB();
  await loadNotificationsFromDB();
  if(typeof render==='function'&&document.body?.dataset.page!=='login'){
    render();
  }
});
/* ---- Sidebar navigation menu ---- */
const NAV=[
  {section:'Workspace'},
  {key:'dashboard',label:'Dashboard',icon:'⌂'},
  {key:'projects',label:'Projects',icon:'▤',perm:'viewProjects'},
  {key:'assets',label:'Assets',icon:'▥',perm:'viewAssets'},
  {section:'Review & Collaboration',hideFor:['admin','project_manager','animator','editor','client']},
  {key:'completedProjects',label:'Completed Projects',icon:'☑',perm:'viewCompletedProjects'},
  {section:'Management',hideFor:['client','animator']},
  {key:'integrations',label:'Integration Hub',icon:'⇄',perm:'runIntegrations'},
  {key:'resources',label:'Resources & Budget',icon:'₱',perm:'manageResources'},
  {key:'audit',label:'Audit Log',icon:'≡',perm:'viewAudit'},
  {key:'users',label:'Team & Roles',icon:'☺',perm:'manageUsers'},
];
const EDITOR_NAV=[
  {key:'dashboard',label:'Dashboard',icon:'⌂'},
  {key:'projects',label:'My Projects',icon:'▤',perm:'viewProjects'},
  {key:'tracker',label:'Tracker',icon:'◷',perm:'viewProjects'},
  {key:'editorSequences',label:'Sequence Editor',icon:'▤',perm:'viewProjects'},
  {key:'schedule',label:'Schedule',icon:'▦',perm:'viewProjects'},
  {key:'assets',label:'Assets',icon:'▥',perm:'viewAssets'},
  {key:'feedback',label:'Feedback',icon:'▱',perm:'viewProjects'},
];
const ANIMATOR_NAV=[
  {key:'dashboard',label:'Dashboard',icon:'⌂'},
  {key:'projects',label:'My Projects',icon:'▤',perm:'viewProjects'},
  {key:'tracker',label:'Tracker',icon:'◷',perm:'viewProjects'},
  {key:'schedule',label:'Schedule',icon:'▦',perm:'viewProjects'},
  {key:'assets',label:'Assets',icon:'▥',perm:'viewAssets'},
  {key:'feedback',label:'Feedback',icon:'▱',perm:'viewProjects'},
  {key:'shotTracker',label:'Studio Galeria',icon:'▧',perm:'viewProjects'},
];
function renderSidebar(){
  if(DB.currentUser?.role==='editor'&&state.page==='tasks'){
    state.page='dashboard';
  }
  const pagePermissions={
    projects:'viewProjects',
    projectDetail:'viewProjects',
    tracker:'viewProjects',
    schedule:'viewProjects',
    feedback:'viewProjects',
    shotTracker:'viewProjects',
    editorSequences:'viewProjects',
    completedProjects:'viewCompletedProjects',
    assets:'viewAssets',
    assetDetail:'viewAssets',
    users:'manageUsers',
    resources:'manageResources',
    audit:'viewAudit',
    integrations:'runIntegrations',
  };
  const requiredPermission=pagePermissions[state.page];
  if(requiredPermission&&!can(requiredPermission)){
    state.page='dashboard';
  }
  if(state.page==='shotTracker'&&DB.currentUser?.role!=='animator'){
    state.page='dashboard';
  }
  if(state.page==='editorSequences'&&DB.currentUser?.role!=='editor'){
    state.page='dashboard';
  }
  if(
    ['tracker','schedule','feedback'].includes(state.page)&&
    !['editor','animator'].includes(DB.currentUser?.role)
  ){
    state.page='dashboard';
  }
  const demoUsers=document.getElementById('demoUsers');
  if(demoUsers)demoUsers.innerHTML=DB.users.slice(0,8).map(u=>
    '<button class="demo-card" onclick="Studio.quickLogin(\''+u.id+'\')"><b>'+esc(u.name)+'</b><span style="color:var(--'+(ROLE_COLOR_VAR[u.role]||'text-faint')+');">'+ROLE_LABELS[u.role]+'</span></button>'
  ).join('');
  const navlist=document.getElementById('navlist');
  const navigation=DB.currentUser?.role==='editor'
    ?EDITOR_NAV
    :DB.currentUser?.role==='animator'
      ?ANIMATOR_NAV
      :NAV;
  if(navlist){
    const list=navigation.filter(n=>
      (!n.hideFor||!DB.currentUser||!n.hideFor.includes(DB.currentUser.role))&&
      (n.section||!n.perm||can(n.perm))
    );
    navlist.innerHTML=list.map(n=>{
      if(n.section)return'<div class="nav-section">'+n.section+'</div>';
      const badge=n.badgeFn?n.badgeFn():0;
      const active=state.page===n.key||(state.page==='projectDetail'&&n.key==='projects')||(state.page==='assetDetail'&&n.key==='assets');
      return'<button type="button" class="navitem'+(active?' active':'')+'" onclick="Studio.goto(\''+n.key+'\')">'+
        '<span class="ic">'+n.icon+'</span><span>'+n.label+'</span>'+(badge>0?'<span class="nb">'+badge+'</span>':'')+'</button>';
    }).join('');
  }
  if(DB.currentUser){
    const avatar=document.getElementById('sideAvatar');
    const name=document.getElementById('sideName');
    const role=document.getElementById('sideRole');
    if(avatar)avatar.textContent=initials(DB.currentUser.name);
    if(name)name.textContent=DB.currentUser.name;
    if(role)role.textContent=ROLE_LABELS[DB.currentUser.role]||DB.currentUser.role;
  }
  const TOPBAR_ONLY_TITLES={notifications:'Notifications',architecture:'System Architecture'};
  const current=navigation.find(n=>n.key===state.page)||
    navigation.find(n=>state.page==='projectDetail'&&n.key==='projects')||
    navigation.find(n=>state.page==='assetDetail'&&n.key==='assets')||
    (TOPBAR_ONLY_TITLES[state.page]?{key:state.page,label:TOPBAR_ONLY_TITLES[state.page]}:null)||
    NAV.find(n=>n.key==='dashboard')||{label:'Overview',key:'overview'};
  const topEyebrow=document.getElementById('topEyebrow');
  const topTitle=document.getElementById('topTitle');
  const clockChip=document.getElementById('clockChip');
  if(topEyebrow)topEyebrow.textContent=current.key?current.key.toUpperCase():'OVERVIEW';
  if(topTitle)topTitle.textContent=current.label||'Overview';
  if(clockChip)clockChip.textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  const notifBtn=document.getElementById('notifBtn');
  if(notifBtn){
    notifBtn.classList.toggle('active',state.page==='notifications');
    const unread=(DB.notifications||[]).filter(n=>!n.read).length;
    const badge=document.getElementById('notifBadge');
    if(badge){
      badge.textContent=unread;
      badge.style.display=unread>0?'inline-flex':'none';
    }
  }
  const archBtn=document.getElementById('archBtn');
  if(archBtn)archBtn.classList.toggle('active',state.page==='architecture');
  document.querySelectorAll('.theme-toggle-btn').forEach(btn=>{btn.onclick=()=>Studio.toggleTheme();});
  Studio.applyTheme();
}
async function parseApiResponse(response){
  const text=await response.text();
  let data=null;
  try{data=text?JSON.parse(text):null;}catch(_){
    throw new Error(`API returned invalid JSON (HTTP ${response.status}). ${text?text.slice(0,180):'The server returned an empty response.'}`);
  }
  if(!data)throw new Error(`API returned an empty response (HTTP ${response.status}).`);
  return data;
}
/* ===== PROJECT ACTIONS: js/actions/projects.js ===== */
Object.assign(Studio,{
  createProject(){
    if(!can('manageProjects'))return;
    const name=
      document
        .getElementById('npProjectName')
        .value
        .trim();
    const clientSelect=
      document.getElementById('npClient');
    const clientId=
      clientSelect.value;
    const client=
      clientSelect.options[
        clientSelect.selectedIndex
      ]?.dataset.name||'';
    const deadline=
      document
        .getElementById('npDeadline')
        .value;
    const budget=
      parseFloat(
        document
          .getElementById('npBudget')
          .value
      )||0;
    const projectManagerId=
      document.getElementById('npProjectManager')?.value||
      (DB.currentUser.role==='project_manager'?DB.currentUser.id:'');
    const editorId=
      document.getElementById('nEditor')?.value||'';
    const animatorId=
      document.getElementById('npAnimator')?.value||'';
    if(!name||!clientId||!client){
      toast(
        'Project name and client are required.',
        'error'
      );
      return;
    }
    if(!projectManagerId){
      toast('Select a project manager.','error');
      return;
    }
    const todayISO=
      new Date()
        .toISOString()
        .slice(0,10);
    if(deadline&&deadline<todayISO){
      toast(
        'Deadline cannot be in the past.',
        'error'
      );
      return;
    }
    Studio.openConfirm({
      title:
        'Create this project?',
      body:
        '“'+
        esc(name)+
        '” for '+
        esc(client)+
        ' will be added to the board.'+
        (
          budget
            ?' Budget: ₱'+
              budget.toLocaleString()+
              '.'
            :''
        ),
      confirmLabel:
        'Create project',
      onConfirm:()=>Studio._doCreateProject(
        name,
        client,
        clientId,
        deadline,
        budget,
        projectManagerId,
        editorId,
        animatorId
      )
    });
  },
  _doCreateProject(
    name,
    client,
    clientId,
    deadline,
    budget,
    projectManagerId,
    editorId,
    animatorId
  ){
    // existing code continues here
    const project={
      name:name,
      client:client,
      client_id:clientId,
      status:'Pre-Production',
      deadline:deadline||null,
      project_manager_id:projectManagerId,
      editor_id:editorId||null,
      animator_id:animatorId||null,
      budget:budget
    };
    window.beeFetch(window.BEE_API_BASE+'projects.php',{
      method:'POST',
      credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(project)
    })
    .then(response=>parseApiResponse(response))
    .then(data=>{
      if(data.success){
        pushAudit('Create','Project',name);
        pushEvent('Project Created',{project:name,by:DB.currentUser.name});
        const created=data.project;
        if(created){
          DB.projects.push(created);
          Studio.persist();
        }
        toast('Project created: '+name,'success');
        Studio.goto('projects');
      }else{
        console.error('Project API Error:',data);
        toast(data.error||data.message||'Failed to create project.','error');
      }
    })
    .catch(error=>{
      console.error('Error creating project:',error);
      toast('An error occurred while creating this project.','error');
    });
  },
  async updateProjectAssignments(projectId){
    if(!can('manageProjects'))return;
    const project=projectById(projectId);
    if(!project)return;
    const clientSelect=document.getElementById('projectClientAssignment');
    const payload={
      action:'assign_team',
      project_id:projectId,
      project_manager_id:
        document.getElementById('projectManagerAssignment')?.value||
        project.pm||
        project.project_manager_id,
      editor_id:document.getElementById('projectEditorAssignment')?.value||'',
      animator_id:document.getElementById('projectAnimatorAssignment')?.value||'',
      client_id:clientSelect?clientSelect.value:(project.client_id||'')
    };
    try{
      const response=await window.beeFetch('../api/projects.php',{
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success){
        toast(data.message||'Could not update project assignments.','error');
        return;
      }
      Object.assign(project,data.project);
      Studio.persist();
      render();
      toast('Project assignments updated.','success');
    }catch(error){
      console.error('Project assignment update error:',error);
      toast('Could not connect to the server.','error');
    }
  },
});
/* ===== ASSET ACTIONS: js/actions/assets.js ===== */
Object.assign(Studio,{
  async submitAsset(){
    if(!can('uploadAsset')){
      toast('Your role cannot submit assets.','error');
      return;
    }
    const project=document.getElementById('saProject').value;
    const existingId=document.getElementById('saExisting').value;
    const title=document.getElementById('saTitle').value.trim();
    const type=document.getElementById('saType').value;
    const notes=document.getElementById('saNotes').value.trim();
    const link=document.getElementById('saLink').value.trim();
    if(!/^https:\/\//i.test(link)){toast('Enter an HTTPS link to your media.','error');return;}
    const file=document.getElementById('saFile')?.files?.[0]||null;
    const dueDate=document.getElementById('saDueDate')?.value||'';
    const assignedEditor =
      document.getElementById('saAssignedEditor')?.value || '';

    const assignedAnimator =
      document.getElementById('saAssignedAnimator')?.value || '';
    const sequenceId =
      new URLSearchParams(window.location.search).get('sequence') || '';
    if(file&&link){
      toast('Use either an external link or an attached file, not both.','error');
      return;
    }
    if(existingId!=='new'){
      if(!existingId){
        toast('Please select an existing asset.','error');
        return;
      }
      const existingAsset=assetById(existingId);
      if(!existingAsset || String(existingAsset.project_id||existingAsset.project)!==String(project) || latestVersion(existingAsset).status!=='Revision Requested'){
        toast('Select an asset requesting revisions in this project.','error');return;
      }
      Studio.openConfirm({
        title:'Submit new version?',
        body:'A new version will be added to “'+esc(existingAsset?existingAsset.title:existingId)+'” and set to For Review.',
        confirmLabel:'Submit version',
        onConfirm:()=>Studio._doSubmitVersion(existingId,notes,link,file)
      });
      return;
    }
    if(!title || !project){
      toast('Title and project are required.','error');
      return;
    }
    if(dueDate&&dueDate<(document.getElementById('saDueDate')?.min||'')){
      toast('Due date cannot be in the past.','error');
      return;
    }
    Studio.openConfirm({
      title:'Submit this asset?',
      body:'“'+esc(title)+'” will be submitted and set to For Review.',
      confirmLabel:'Submit asset',
      onConfirm:()=>Studio._doSubmitNewAsset(
        project,
        title,
        type,
        link,
        notes,
        dueDate,
        file,
        assignedEditor,
        assignedAnimator,
        sequenceId
      )
    });
  },
  async _doSubmitVersion(existingId,notes,link='',file=null){
    try{
      const body=new FormData();
      body.append('action','version');
      body.append('asset_id',existingId);
      body.append('notes',notes);
      body.append('link',link);
      if(file)body.append('asset_file',file);
      const response=await window.beeFetch(window.BEE_API_BASE+'assets.php',{
        method:'POST',
        credentials:'include',
        body
      });
      const data=await response.json();
      if(!response.ok||!data.success){
        toast(data.error||'Failed to save new version.','error');
        return;
      }
      const asset=assetById(existingId);
      if(asset){
        asset.versions=asset.versions||[];
        asset.versions.push(data.version);
        if(data.link){
          asset.link=data.link;
          asset.external_link=data.link;
        }
      }
      const v=data.version;
      pushAudit('Upload',asset?asset.title:existingId,'Submitted v'+v.n+' (auto-status: For Review)');
      pushEvent('Asset Uploaded',{asset:asset?asset.title:existingId,version:'v'+v.n,by:DB.currentUser.name});
      pushNotif('submission','New version submitted: “'+(asset?asset.title:existingId)+'” v'+v.n+' is awaiting review.',existingId);
      toast('New version submitted — status set to For Review.','success');
      Studio.goto('assetDetail',existingId);
    }catch(error){
      console.error('submitAsset version error:',error);
      toast('Could not connect to the server.','error');
    }
  },
  async _doSubmitNewAsset(
    project,
    title,
    type,
    link,
    notes,
    dueDate,
    file,
    assignedEditor,
    assignedAnimator,
    sequenceId
  ){
    try{
      const body=new FormData();
      body.append('project_id',project);
      body.append('title',title);
      body.append('type',type);
      body.append('external_link',link);
      body.append('due_date',dueDate);
      body.append('notes',notes);
      body.append('assigned_editor',assignedEditor);
      body.append('assigned_animator',assignedAnimator);
      if(sequenceId)body.append('sequence_id',sequenceId);
      if(file)body.append('asset_file',file);
      const response=await window.beeFetch(window.BEE_API_BASE+'assets.php',{
        method:'POST',
        credentials:'include',
        body
      });
      const data=await response.json();
      if(!response.ok||!data.success){
        toast(data.error||'Failed to save asset.','error');
        return;
      }
      DB.assets.push(withVersions(data.asset));
      pushAudit('Upload',title,'Submitted v1 (auto-status: For Review)');
      pushEvent('Asset Uploaded',{asset:title,version:'v1',by:DB.currentUser.name});
      pushNotif('submission','New submission: “'+title+'” is awaiting review.',data.asset.id);
      toast('Asset submitted — workflow set status to “For Review”.','success');
      Studio.goto('assetDetail',data.asset.id);
    }catch(error){
      console.error('submitAsset error:',error);
      toast('Could not connect to the server.','error');
    }
  },
  onSaProjectChange(){
    const projectId=document.getElementById('saProject').value;
    const select=document.getElementById('saExisting');
    const user=DB.currentUser;
    const candidates=DB.assets.filter(asset=>String(asset.project_id||asset.project)===String(projectId)&&latestVersion(asset).status==='Revision Requested'&&
      (user.role!=='editor'||(asset.type==='Render'&&String(asset.assigned_editor||projectById(projectId)?.artist_id)===String(user.id))));
    select.innerHTML='<option value="new">A new asset</option>'+candidates.map(asset=>`<option value="${esc(String(asset.id))}">Revise: ${esc(asset.title)}</option>`).join('');
    Studio.onSaExistingChange();
  },
  onSaExistingChange(){
    const v=document.getElementById('saExisting').value;
    const wrap=document.getElementById('saNewFields');
    if(wrap)wrap.style.display=v==='new'?'block':'none';
  },
});
/* ===== REVIEW ACTIONS: js/actions/review.js ===== */
Object.assign(Studio,{
  reviewAsset(assetId,decision){
    const decisionPermission={
      approve:'approveAsset',
      revise:'requestRevision',
      reject:'rejectAsset',
    }[decision];
    if(DB.currentUser?.role!=='client'||!decisionPermission||!can(decisionPermission)){
      toast('Your role cannot perform this review decision.','error');
      return;
    }
    const asset=assetById(assetId);
    if(!asset){
      console.error('Asset not found for review:',assetId,DB.assets);
      toast('Asset could not be found. Please refresh the page.','error');
      return;
    }
    const v=latestVersion(asset);
    if(v.status!=='For Review'){
      toast('This asset is not currently awaiting a client decision.','error');
      return;
    }
    const currentStatus=v.status;
    const nextStatus=decision==='approve'
      ?'Approved'
      :decision==='revise'?'Revision Requested':'Rejected';
    window.beeFetch(window.BEE_API_BASE+'assets.php',{
      method:'PUT',
      credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        asset_id:asset.id,
        version:v.n,
        status:nextStatus,
        approved_by:DB.currentUser.name
      })
    })
    .then(response=>parseApiResponse(response).then(data=>({response,data})))
    .then(async ({response,data})=>{
      if(!response.ok||!data.success){
        throw new Error(data.error||'Unable to save your decision.');
      }
      v.status=nextStatus;
      if(typeof loadAssetsFromDB==='function'){
        await loadAssetsFromDB();
      }
      if(typeof render==='function')render();
      toast(decision==='approve'?'Output approved.':decision==='revise'?'Changes requested.':'Output rejected.',decision==='reject'?'error':'success');
    })
    .catch(error=>{
      console.error('Asset decision error:',error);
      toast(error.message||'Unable to save your decision.','error');
    });
  },
  quickApprove(assetId){
    state.selectedAssetId=assetId;
    Studio.reviewAsset(assetId,'approve');
    toast('Approved from Review Queue.','success');
  },
});
/* ===== FEEDBACK ACTIONS: js/actions/feedback.js ===== */
Object.assign(Studio,{
  addComment(assetId){
    if(!can('commentAsset')){
      toast('Your role cannot add feedback to this asset.','error');
      return;
    }
    const box=document.getElementById('newComment');
    const asset=assetById(assetId);
    const text=box?.value.trim()||'';
    if(!asset||!text){
      if(!asset)toast('Asset could not be found. Please refresh the page.','error');
      return;
    }
    window.beeFetch(window.BEE_API_BASE+'assets.php',{
      method:'POST',
      credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'comment',asset_id:asset.id,comment:text})
    })
    .then(response=>parseApiResponse(response).then(data=>({response,data})))
    .then(({response,data})=>{
      if(!response.ok||!data.success||!data.comment){
        throw new Error(data.error||'Failed to save feedback.');
      }
      const comment={...data.comment,asset:String(asset.id)};
      asset.comments=Array.isArray(asset.comments)?asset.comments:[];
      asset.comments.push(comment);
      DB.comments.push(comment);
      box.value='';
      if(typeof render==='function')render();
      toast('Feedback added.','success');
    })
    .catch(error=>{
      console.error('Asset feedback save error:',error);
      toast(error.message||'Unable to save feedback.','error');
    });
  },
  async markRead(notificationId){
    try{
      const notification=DB.notifications.find(
        item=>String(item.id)===String(notificationId)
      );
      if(!notification||notification.id==null){
        throw new Error('Notification is missing an ID.');
      }
      const response=await window.beeFetch(
        window.BEE_API_BASE+'notifications.php?action=mark_read',
        {
          method:'POST',
          credentials:'include',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({id:notification.id})
        }
      );
      const data=typeof parseApiResponse==='function'
        ? await parseApiResponse(response)
        : await response.json();
      if(!response.ok||!data||!data.success){
        throw new Error(data?.error||'Failed to mark notification as read.');
      }
      notification.read=true;
      notification.is_read=1;
      if(typeof render==='function')render();
    }catch(error){
      toast('Unable to mark notification as read.','error');
      throw error;
    }
  },
  async markAllRead(){
    try{
      const response=await window.beeFetch(
        window.BEE_API_BASE+'notifications.php?action=mark_all_read',
        {
          method:'POST',
          credentials:'include'
        }
      );
      const data=typeof parseApiResponse==='function'
        ? await parseApiResponse(response)
        : await response.json();
      if(!response.ok||!data||!data.success){
        throw new Error(data?.error||'Failed to mark all notifications as read.');
      }
      DB.notifications.forEach(notification=>{
        notification.read=true;
        notification.is_read=1;
      });
      if(typeof render==='function')render();
      toast('All notifications marked as read.','success');
    }catch(error){
      toast('Unable to mark notifications as read.','error');
      console.error('Unable to mark all notifications as read:',error);
    }
  },
});
/* ===== INTEGRATION ACTIONS: js/actions/integrations.js ===== */
Object.assign(Studio,{
  apiSend(){
    const sel=document.getElementById('apiAssetSelect');
    const assetId=sel.value;
    const asset=assetById(assetId);
    if(!asset)return;
    const v=latestVersion(asset);
    const reqPayload={asset:asset.title,version:'v'+v.n,status:v.status,project:projectById(asset.project).name};
    DB.apiLogs.push({id:nid('api'),dir:'REQUEST',method:'POST',endpoint:'/api/v1/production-dashboard/assets',body:JSON.stringify(reqPayload),date:new Date().toISOString()});
    if(typeof render==='function')render();
    Studio.persist();
    toast('Request sent…');
    setTimeout(()=>{
      DB.apiLogs.push({id:nid('api'),dir:'RESPONSE',method:'POST',endpoint:'/api/v1/production-dashboard/assets',status:201,body:JSON.stringify({received:true,id:'dash_'+asset.id,syncedAt:new Date().toISOString()}),date:new Date().toISOString()});
      pushAudit('Integration',asset.title,'Synced to Production Dashboard via API');
      pushEvent('Asset Synced to Dashboard',{asset:asset.title});
      toast('201 Created — synced to Production Dashboard.','success');
      if(typeof render==='function')render();
      Studio.persist();
    },650);
  },
  async runETL(){
    const raw=
      document
        .getElementById('etlInput')
        .value
        .trim();
    const log=
      document.getElementById('etlLog');
    if(!raw){
      toast(
        'Paste or keep the sample CSV first.',
        'error'
      );
      return;
    }
    const lines=
      raw
        .split('\n')
        .map(line=>line.trim())
        .filter(Boolean);
    if(lines.length<2){
      toast(
        'Add at least one CSV data row.',
        'error'
      );
      return;
    }
    const header=
      lines[0]
        .split(',')
        .map(h=>
          h.trim().toLowerCase()
        );
    const requiredHeaders=[
      'title',
      'project'
    ];
    const missingHeaders=
      requiredHeaders.filter(
        h=>!header.includes(h)
      );
    if(missingHeaders.length){
      toast(
        'CSV must include: title, project',
        'error'
      );
      return;
    }
    const rows=
      lines
        .slice(1)
        .map(line=>{
          const cells=
            line.match(/(".*?"|[^,]+)/g)
            ||[];
          const clean=
            cells.map(cell=>
              cell
                .replace(/^"|"$/g,'')
                .trim()
            );
          const record={};
          header.forEach(
            (name,index)=>{
              record[name]=
                clean[index]
                ||'';
            }
          );
          return record;
        });
    try{
      if(log){
        log.innerHTML=`
          <div class="log-line">
            <span class="t">›</span>
            <span>Running ETL import...</span>
          </div>
        `;
      }
      const response=
        await window.beeFetch(
          window.BEE_API_BASE+'integration_etl_logs.php',
          {
            method:'POST',
            credentials:'include',
            headers:{
              'Content-Type':
                'application/json'
            },
            body:JSON.stringify({
              rows:rows
            })
          }
        );
      const data=
        await parseApiResponse(
          response
        );
      if(
        !response.ok||
        !data.success
      ){
        throw new Error(
          data.error||
          'ETL import failed.'
        );
      }
      if(log){
        log.innerHTML=
          (data.details||[])
            .map(step=>`
              <div class="log-line">
                <span class="t">›</span>
                <span>${esc(step)}</span>
              </div>
            `)
            .join('');
      }
      await loadAssetsFromDB();
      pushEvent(
        'ETL Import Completed',
        {
          rows:
            data.total_rows,
          loaded:
            data.loaded_rows,
          skipped:
            data.skipped_rows
        }
      );
      toast(
        'ETL complete — '+
        data.loaded_rows+
        ' asset(s) saved to Firestore.',
        'success'
      );
      if(
        typeof render===
        'function'
      ){
        render();
      }
    }catch(error){
      console.error(
        'ETL import error:',
        error
      );
      if(log){
        log.innerHTML=`
          <div class="log-line">
            <span class="t">!</span>
            <span>${esc(error.message)}</span>
          </div>
        `;
      }
      toast(
        error.message||
        'ETL import failed.',
        'error'
      );
    }
  },
});
/* ===== RESOURCE ACTIONS: js/actions/resources.js ===== */
/* ===== USER ACTIONS: js/actions/users.js ===== */
Object.assign(Studio,{
  async addUser(){
    if(!can('manageUsers'))return;
    const name=document.getElementById('umName').value.trim();
    const role=document.getElementById('umRole').value;
    const email=document.getElementById('umEmail').value.trim();
    if(!name){toast('Enter a name.','error');return;}
    if(!NAME_RE.test(name)){toast('Name can only contain letters, spaces, hyphens, and apostrophes.','error');return;}
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Enter a valid email.','error');return;}
    const button=document.getElementById('umAddButton');
    if(button)button.disabled=true;
    try{
      const response=await window.beeFetch('../api/auth.php',{
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'create_team_member',name,email,role})
      });
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success)throw new Error(data.error||'Unable to add team member.');
      const u={...data.user,id:String(data.user.id),name:data.user.full_name,email:data.user.email,role:data.user.role};
      const existing=DB.users.find(user=>String(user.id)===u.id);
      if(existing)Object.assign(existing,u);
      else DB.users.push(u);
      pushAudit('User',name,'Added to team as '+ROLE_LABELS[role]);
      toast(data.message||'Invitation sent.',data.email_sent?'success':'error');
      document.getElementById('umName').value='';
      document.getElementById('umEmail').value='';
      if(typeof render==='function')render();
      Studio.persist();
    }catch(error){
      toast(error.message||'Unable to add team member.','error');
    }finally{
      if(button)button.disabled=false;
    }
  },
  async resendInvitation(uid){
    if(!can('manageUsers'))return;
    try{
      const response=await window.beeFetch('../api/auth.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend_invitation',uid})});
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success)throw new Error(data.error||'Unable to resend invitation.');
      toast(data.message,data.email_sent?'success':'error');
    }catch(error){toast(error.message,'error');}
  },
  async refreshInvitations(){
    if(!can('manageUsers'))return;
    try{await window.beeFetch('../api/auth.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh_invitations'})});}catch{}
  },
  async changeRole(uid,role){
    const u=userById(uid);if(!u)return;
    const response=await window.beeFetch('../api/sync.php',{method:'POST',body:JSON.stringify({action:'change_role',id:uid,role})});
    const saved=await response.json();
    if(!response.ok){toast(saved.error,'error');return;}
    u.role=role;
    pushAudit('User',u.name,'Role changed to '+ROLE_LABELS[role]);
    toast(u.name+' is now '+(ROLE_LABELS[role]||role)+'.');
    if(typeof render==='function')render();
    Studio.persist();
  },
  deleteUser(uid){
    if(can('manageUsers')) Studio.trashAction('delete','user',uid);
  },
});
let firebaseRefreshTimer;
window.addEventListener('bee-firebase-change',()=>{
  clearTimeout(firebaseRefreshTimer);
  firebaseRefreshTimer=setTimeout(async()=>{
    await loadServerState();
    await loadProjectsFromDB();
    await loadAssetsFromDB();
    await loadNotificationsFromDB();
    if(typeof render==='function'&&DB.currentUser&&document.body?.dataset.page!=='login')render();
  },300);
});

/* Firebase Trash: all authorization and archive operations run on the server. */
Studio.trashRequest = async function(input){
  const response=await window.beeFetch('../api/trash.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const data=await parseApiResponse(response);
  if(!response.ok||!data.success)throw new Error(data.error||'Unable to process Trash.');
  return data;
};
Studio.trashAction = function(action,type,id){
  const destructive=action==='purge';
  Studio.openConfirm({title:destructive?'Delete forever?':action==='recover'?'Recover item?':'Move to Trash?',
    body:destructive?'This permanently removes the archived item and cannot be undone.':action==='recover'?'This restores the item and its saved records.':'This removes the item from active pages. It can be recovered from Trash.',
    confirmLabel:destructive?'Delete forever':action==='recover'?'Recover':'Move to Trash',danger:action!=='recover',
    onConfirm:async()=>{try{const data=await Studio.trashRequest({action,type,...(action==='delete'?{id}:{trash_id:id})});toast(data.message,'success');await loadServerState();await loadProjectsFromDB();await loadAssetsFromDB();if(typeof render==='function')render();await Studio.loadTrashPanel();}catch(e){toast(e.message,'error');}}
  });
};
Studio.deleteProject = id=>Studio.trashAction('delete','project',id);
Studio.recoverUser = id=>Studio.trashAction('recover','user',id);
Studio.deleteTrashUser = id=>Studio.trashAction('purge','user',id);
Studio.loadTrashPanel = async function(){
  const page=document.body?.dataset.page;
  const type={users:'user',projects:'project',assets:'asset'}[page];
  if(!type||!DB.currentUser||!['admin','project_manager'].includes(DB.currentUser.role)||(type==='user'&&DB.currentUser.role!=='admin'))return;
  const content=document.getElementById('pageContent');if(!content)return;
  const previous=document.getElementById('firebaseTrashPanel');
  const panel=previous||document.createElement('section');panel.id='firebaseTrashPanel';panel.className='card';panel.style.cssText='padding:20px;margin-top:20px;';
  if(!previous){panel.innerHTML='<h3>Trash</h3><p>Loading deleted items…</p>';content.append(panel);}
  try{
    const data=await Studio.trashRequest({action:'list',type});if(!panel.isConnected)return;
    const active=type==='user'?[]:(type==='project'?DB.projects:DB.assets).filter(item=>DB.currentUser.role==='admin'||projectById(type==='project'?item.id:(item.project_id||item.project))?.pm===DB.currentUser.id);
    panel.innerHTML=`<h3>${type==='user'?'Deleted accounts':type==='project'?'Deleted projects':'Deleted assets'}</h3>
      ${active.length?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;"><select id="trashActiveItem" aria-label="Choose ${type} to move to Trash"><option value="">Select ${type}</option>${active.map(item=>`<option value="${esc(String(item.id))}">${esc(item.name||item.title||item.asset_title||String(item.id))}</option>`).join('')}</select><button type="button" class="btn btn-danger btn-sm" id="trashMoveButton">Move to Trash</button></div>`:''}
      <div>${data.items.length?data.items.map(item=>`<div style="padding:14px 0;border-top:1px solid var(--border);display:flex;gap:16px;align-items:center;flex-wrap:wrap;"><div style="flex:1;"><strong>${esc(item.name)}</strong><div>Deleted ${esc(fmtDateTime(item.deleted_at))}</div></div><button type="button" class="btn btn-sm" data-trash-action="recover" data-trash-id="${esc(item.id)}">Recover</button>${DB.currentUser.role==='admin'?`<button type="button" class="btn btn-danger btn-sm" data-trash-action="purge" data-trash-id="${esc(item.id)}">Delete Forever</button>`:''}</div>`).join(''):'<p>No deleted items.</p>'}</div>`;
    panel.querySelector('#trashMoveButton')?.addEventListener('click',()=>{const id=panel.querySelector('#trashActiveItem').value;if(id)Studio.trashAction('delete',type,id);});
    panel.querySelectorAll('[data-trash-action]').forEach(button=>button.addEventListener('click',()=>Studio.trashAction(button.dataset.trashAction,type,button.dataset.trashId)));
  }catch(e){panel.innerHTML=`<h3>Trash</h3><p>${esc(e.message)}</p>`;}
};
document.addEventListener('DOMContentLoaded',async()=>{
  await window.BEE_SERVER_READY;
  const content=document.getElementById('pageContent');if(!content)return;
  let pending;
  const observer=new MutationObserver(()=>{if(!document.getElementById('firebaseTrashPanel')){clearTimeout(pending);pending=setTimeout(()=>Studio.loadTrashPanel(),100);}});
  observer.observe(content,{childList:true});
  setTimeout(()=>Studio.loadTrashPanel(),200);
});
