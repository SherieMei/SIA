/* ATLAS SHARED RUNTIME */

/* ===== DATA CONSTANTS: js/data/constants.js ===== */
/* ==========================================================================
   CONSTANTS — roles, permissions, asset type styling, status labels.
   Edit permissions here to change who can do what.
   ========================================================================== */
const ROLE_LABELS = {
  admin:'Administrator', project_manager:'Project Manager', artist:'Artist',
  animator:'Animator', editor:'Editor', reviewer:'Reviewer', client:'Client', viewer:'Viewer'
};

const PERMISSIONS = {
  manageUsers:['admin'],
  manageProjects:['admin','project_manager'],
  submitAssets:['admin','artist','animator','editor','project_manager'],
  review:['admin','reviewer','project_manager','client'],
  comment:['admin','project_manager','artist','animator','editor','reviewer','client'],
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
    {id:'u1',name:'Jordan Reyes',role:'admin'},
    {id:'u2',name:'Mika Santos',role:'project_manager'},
    {id:'u3',name:'Leo Cruz',role:'artist'},
    {id:'u4',name:'Ava Domingo',role:'animator'},
    {id:'u5',name:'Noah Bautista',role:'editor'},
    {id:'u6',name:'Priya Fernandez',role:'reviewer'},
    {id:'u7',name:'Skyline Media (Client)',role:'client'},
    {id:'u8',name:'Guest',role:'viewer'},
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

function latestVersion(asset){ return asset.versions[asset.versions.length-1]; }

function seedAsset(project,title,type,link,entries){
  const a = {id:nid('a'), project, title, type, link, versions:[]};
  entries.forEach((e,i)=>{
    a.versions.push({id:nid('v'), n:i+1, status:e.status, notes:e.notes, by:e.by, date:e.date, final:!!e.final});
  });
  DB.assets.push(a);
  return a;
}

seedAsset('p1','Scene 12 — Rooftop Chase','Storyboard','drive://skybound/sb/scene12',[
  {status:'Approved',notes:'Initial pass, full 40 panels.',by:'u3',date:'2026-08-02'},
]);
const seedA2 = seedAsset('p1','Scene 12 — Rooftop Chase Animatic','Animatic','drive://skybound/an/scene12',[
  {status:'Revision Requested',notes:'Rough timing pass.',by:'u4',date:'2026-08-10'},
]);
seedAsset('p1','Kael — Character Turnaround','Character Sheet','drive://skybound/cs/kael',[
  {status:'Approved',notes:'Front/side/back, 3 expressions.',by:'u3',date:'2026-07-28'},
]);
seedAsset('p1','Undercity Market — Background Plate','Background Asset','dropbox://skybound/bg/market',[
  {status:'For Review',notes:'Painted matte, 4K.',by:'u4',date:'2026-08-18'},
]);
const seedA5 = seedAsset('p1','Scene 09 — Chase Resolution','Animation Scene','drive://skybound/anim/scene09',[
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
const seedA10 = seedAsset('p2','Bright Mornings — Final Cut','Render','local://lumen/render/final_15s',[
  {status:'Approved',notes:'Master export, 1080p ProRes.',by:'u5',date:'2026-08-19',final:true},
]);
seedAsset('p3','Trailer — Opening Boards','Storyboard','drive://nightfall/sb/opening',[
  {status:'For Review',notes:'Beat 1–5 of teaser.',by:'u3',date:'2026-08-22'},
]);
const seedA12 = seedAsset('p3','Trailer — Theme Sting','Audio','dropbox://nightfall/audio/sting',[
  {status:'Revision Requested',notes:'Rough mix, temp score.',by:'u5',date:'2026-08-17'},
]);

DB.comments.push(
  {id:nid('c'), asset:seedA2.id, by:'u6', text:'Timing on panel 14–18 reads too slow for the chase beat — tighten by ~6 frames.', date:'2026-08-11'},
  {id:nid('c'), asset:seedA2.id, by:'u4', text:'Got it, will re-time and re-submit by Friday.', date:'2026-08-11'},
  {id:nid('c'), asset:seedA5.id, by:'u6', text:'Blocking pass rejected — arc on the jump reads floaty, see reference note attached.', date:'2026-08-06'},
);

function pushNotif(type,text,ref){
  DB.notifications.push({id:nid('n'), type, text, ref, read:false, date:new Date().toISOString()});
}
pushNotif('submission','New submission: “Undercity Market — Background Plate” is awaiting review.','a4');
pushNotif('revision','Revision requested on “Trailer — Theme Sting”.',seedA12.id);
pushNotif('deadline','Skybound Chronicles Ep.4 deadline is in 6 weeks.','p1');
pushNotif('approval','“Bright Mornings — Final Cut” was approved as Final Output.',seedA10.id);

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
  {id:nid('w'), endpoint:'https://hooks.atlas.studio/asset-approved', status:200, payload:'{"asset":"Bright Mornings — Final Cut","event":"final_output_approved"}', date:'2026-08-19T16:10:02'}
);


/* ===== STATE: js/core/state.js ===== */
/* ==========================================================================
   APP STATE + HELPERS — current page/filters, and small utility functions
   shared by every page file.
   ========================================================================== */
const state = { page:'dashboard', selectedProjectId:null, selectedAssetId:null,
  filter:{project:'all',type:'all',status:'all',q:''} };

// In the separated-page build, every HTML file has its own data-page value.
// Restore that value before the page-specific controller calls render().
// Without this, every page booted as `dashboard`, causing ReferenceErrors on
// pages that do not load dashboard.js and making the interface appear frozen.
(function restorePageRoute(){
  const page = document.body && document.body.dataset ? document.body.dataset.page : '';
  if(page && page !== 'login') state.page = page;

  try {
    const params = new URLSearchParams(window.location.search);
    const project = params.get('project');
    const asset = params.get('asset');
    if(project){ state.page='projectDetail'; state.selectedProjectId=project; }
    if(asset){ state.page='assetDetail'; state.selectedAssetId=asset; }
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
function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function esc(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toast(msg, kind){
  const wrap = document.getElementById('toastWrap');
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
   STUDIO (base) + NAVIGATION — creates the global Studio object that every
   js/actions/*.js file adds its own methods to via Object.assign, and
   handles login/logout/page navigation.
   ========================================================================== */
const Studio = {

  manualLogin(){
    const name = document.getElementById('loginName').value.trim();
    const role = document.getElementById('loginRole').value;
    if(!name){ toast('Enter a name to sign in.','error'); return; }
    let u = DB.users.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(!u){ u = {id:nid('u'), name, role}; DB.users.push(u); }
    else { u.role = role; }
    Studio.completeLogin(u);
  },
  quickLogin(id){
    const u = userById(id);
    Studio.completeLogin(u);
  },
  completeLogin(u){
    if(!u) return;
    DB.currentUser = u;
    sessionStorage.setItem('atlasCurrentUser', JSON.stringify(u));

    // Separate-page build: always move from login to the real dashboard page.
    // Using a URL relative to the current document keeps this working from
    // file://, Live Server, and a normal local web server.
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
  logout(){
    DB.currentUser=null;
    sessionStorage.removeItem('atlasCurrentUser');
    window.location.assign(new URL('../login/login.html', window.location.href).href);
  },

  goto(page, arg){
    const routes = {
      dashboard:'../dashboard/dashboard.html',
      projects:'../projects/projects.html',
      projectDetail:'../projects/projects.html',
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

    // Keep the route state in sync and close the mobile drawer before leaving.
    state.page = page;
    if(page==='projectDetail') state.selectedProjectId = arg || null;
    if(page==='assetDetail') state.selectedAssetId = arg || null;
    document.getElementById('sidebar')?.classList.remove('open');
    window.location.href = url.href;
  },

  toggleForm(id){
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hidden');
  },

  setFilter(key,val){ state.filter[key]=val; render(); },
};

/* Restore the signed-in demo user when moving between separated pages. */
try{
  const saved = sessionStorage.getItem('atlasCurrentUser');
  if(saved){
    const parsed = JSON.parse(saved);
    const existing = DB.users.find(u=>u.id===parsed.id || u.name===parsed.name);
    if(existing) DB.currentUser = existing;
    else if(parsed.name && parsed.role){
      DB.users.push(parsed);
      DB.currentUser = parsed;
    }
  }
}catch(e){
  sessionStorage.removeItem('atlasCurrentUser');
}

/* ---- Sidebar navigation menu ---- */
const NAV = [
  {section:'Workspace'},
  {key:'dashboard', label:'Dashboard', icon:'⌂'},
  {key:'projects', label:'Projects', icon:'▤'},
  {key:'assets', label:'Assets', icon:'▥'},
  {section:'Review & Collaboration'},
  {key:'review', label:'Review Queue', icon:'✓', badgeFn:()=>DB.assets.filter(a=>['For Review','Revision Requested'].includes(latestVersion(a).status)).length},
  {key:'notifications', label:'Notifications', icon:'●', badgeFn:()=>DB.notifications.filter(n=>!n.read).length},
  {section:'Management'},
  {key:'integrations', label:'Integration Hub', icon:'⇄', perm:'runIntegrations'},
  {key:'resources', label:'Resources & Budget', icon:'$', perm:'manageResources'},
  {key:'audit', label:'Audit Log', icon:'≡', perm:'viewAudit'},
  {key:'users', label:'Team & Roles', icon:'☺', perm:'manageUsers'},
  {section:'System'},
  {key:'architecture', label:'System Architecture', icon:'⌘'},
];

function renderSidebar(){
  const demoUsers = document.getElementById('demoUsers');
  if(demoUsers) demoUsers.innerHTML = DB.users.slice(0,8).map(u=>
    '<button class="demo-card" onclick="Studio.quickLogin(\''+u.id+'\')"><b>'+esc(u.name)+'</b><span>'+ROLE_LABELS[u.role]+'</span></button>'
  ).join('');

  const list = NAV.filter(n=> n.section || !n.perm || can(n.perm));
  document.getElementById('navlist').innerHTML = list.map(n=>{
    if(n.section) return '<div class="nav-section">'+n.section+'</div>';
    const badge = n.badgeFn ? n.badgeFn() : 0;
    const active = state.page===n.key || (state.page==='projectDetail'&&n.key==='projects') || (state.page==='assetDetail'&&n.key==='assets');
    return '<button type="button" class="navitem'+(active?' active':'')+'" onclick="Studio.goto(\''+n.key+'\')">'+
      '<span class="ic">'+n.icon+'</span><span>'+n.label+'</span>'+ (badge>0?'<span class="nb">'+badge+'</span>':'') + '</button>';
  }).join('');

  if(DB.currentUser){
    document.getElementById('sideAvatar').textContent = initials(DB.currentUser.name);
    document.getElementById('sideName').textContent = DB.currentUser.name;
    document.getElementById('sideRole').textContent = ROLE_LABELS[DB.currentUser.role];
  }
  const current = list.find(n=>n.key===state.page) ||
    list.find(n=>state.page==='projectDetail' && n.key==='projects') ||
    list.find(n=>state.page==='assetDetail' && n.key==='assets') ||
    list.find(n=>n.key==='dashboard') || {label:'Overview',key:'overview'};
  document.getElementById('topEyebrow').textContent = current.key.toUpperCase();
  document.getElementById('topTitle').textContent = current.label || 'Overview';
  document.getElementById('clockChip').textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}


/* ===== PROJECT ACTIONS: js/actions/projects.js ===== */
/* ==========================================================================
   PROJECT ACTIONS — create new productions/campaigns.
   ========================================================================== */
Object.assign(Studio, {

  createProject(){
    if(!can('manageProjects')) return;
    const name = document.getElementById('npName').value.trim();
    const client = document.getElementById('npClient').value.trim();
    const deadline = document.getElementById('npDeadline').value;
    const budget = parseFloat(document.getElementById('npBudget').value)||0;
    if(!name || !client){ toast('Project name and client are required.','error'); return; }
    const p = {id:nid('p'), name, client, status:'Pre-Production', deadline, pm:DB.currentUser.id, team:[DB.currentUser.id], budget};
    DB.projects.push(p);
    pushAudit('Create','Project', name);
    pushEvent('Project Created',{project:name,by:DB.currentUser.name});
    toast('Project created: '+name,'success');
    Studio.goto('projects');
  },

});


/* ===== ASSET ACTIONS: js/actions/assets.js ===== */
/* ==========================================================================
   ASSET / SUBMISSION ACTIONS — new assets, new versions of existing assets.
   Workflow automation lives here: every submission auto-sets "For Review".
   ========================================================================== */
Object.assign(Studio, {

  submitAsset(){
    if(!can('submitAssets')){ toast('Your role cannot submit assets.','error'); return; }
    const project = document.getElementById('saProject').value;
    const existingId = document.getElementById('saExisting').value;
    const title = document.getElementById('saTitle').value.trim();
    const type = document.getElementById('saType').value;
    const notes = document.getElementById('saNotes').value.trim();
    const link = document.getElementById('saLink').value.trim();
    const fileInput = document.getElementById('saFile');
    const fileName = fileInput && fileInput.files.length ? fileInput.files[0].name : '';

    if(existingId !== 'new'){
      const asset = assetById(existingId);
      const v = {id:nid('v'), n:asset.versions.length+1, status:'For Review', notes: notes||('Revised file: '+ (fileName||'no file attached')), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)};
      asset.versions.push(v);
      if(link) asset.link = link;
      pushAudit('Upload', asset.title, 'Submitted v'+v.n+' (auto-status: For Review)');
      pushEvent('Asset Uploaded',{asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      pushNotif('submission', 'New version submitted: “'+asset.title+'” v'+v.n+' is awaiting review.', asset.id);
      toast('New version submitted — status set to For Review.','success');
      Studio.goto('assetDetail', asset.id);
      return;
    }
    if(!title || !project){ toast('Title and project are required.','error'); return; }
    const a = {id:nid('a'), project, title, type, link, versions:[
      {id:nid('v'), n:1, status:'For Review', notes: notes||('File: '+(fileName||'no file attached')), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)}
    ]};
    DB.assets.push(a);
    pushAudit('Upload', title, 'Submitted v1 (auto-status: For Review)');
    pushEvent('Asset Uploaded',{asset:title, version:'v1', by:DB.currentUser.name});
    pushNotif('submission', 'New submission: “'+title+'” is awaiting review.', a.id);
    toast('Asset submitted — workflow set status to “For Review”.','success');
    Studio.goto('assetDetail', a.id);
  },

  onSaExistingChange(){
    const v = document.getElementById('saExisting').value;
    const wrap = document.getElementById('saNewFields');
    wrap.style.display = v==='new' ? 'block' : 'none';
  },

});


/* ===== REVIEW ACTIONS: js/actions/review.js ===== */
/* ==========================================================================
   REVIEW / APPROVAL ACTIONS — approve, reject, request revision.
   Also fires the webhook simulation on every approval.
   ========================================================================== */
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
      DB.webhooks.push({id:nid('w'), endpoint:'https://hooks.atlas.studio/asset-approved', status:200,
        payload:JSON.stringify({asset:asset.title, version:'v'+v.n, final:asFinal}), date:new Date().toISOString()});
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
    render();
  },

  quickApprove(assetId){
    state.selectedAssetId = assetId;
    Studio.reviewAsset(assetId,'approve');
    toast('Approved from Review Queue.','success');
  },

});


/* ===== FEEDBACK ACTIONS: js/actions/feedback.js ===== */
/* ==========================================================================
   COMMENTS + NOTIFICATIONS ACTIONS
   ========================================================================== */
Object.assign(Studio, {

  addComment(assetId){
    if(!can('comment')) return;
    const box = document.getElementById('newComment');
    const text = box.value.trim();
    if(!text) return;
    DB.comments.push({id:nid('c'), asset:assetId, by:DB.currentUser.id, text, date:new Date().toISOString().slice(0,10)});
    box.value='';
    pushAudit('Comment', assetById(assetId).title, 'Feedback added');
    render();
  },

  markRead(id){ const n = DB.notifications.find(x=>x.id===id); if(n) n.read=true; render(); },
  markAllRead(){ DB.notifications.forEach(n=>n.read=true); render(); toast('All notifications marked as read.'); },

});


/* ===== INTEGRATION ACTIONS: js/actions/integrations.js ===== */
/* ==========================================================================
   INTEGRATION ACTIONS — API sync simulation + CSV/ETL import.
   ========================================================================== */
Object.assign(Studio, {

  apiSend(){
    const sel = document.getElementById('apiAssetSelect');
    const assetId = sel.value;
    const asset = assetById(assetId);
    if(!asset) return;
    const v = latestVersion(asset);
    const reqPayload = {asset:asset.title, version:'v'+v.n, status:v.status, project:projectById(asset.project).name};
    DB.apiLogs.push({id:nid('api'), dir:'REQUEST', method:'POST', endpoint:'/api/v1/production-dashboard/assets', body:JSON.stringify(reqPayload), date:new Date().toISOString()});
    render();
    toast('Request sent…');
    setTimeout(()=>{
      DB.apiLogs.push({id:nid('api'), dir:'RESPONSE', method:'POST', endpoint:'/api/v1/production-dashboard/assets', status:201,
        body:JSON.stringify({received:true, id:'dash_'+asset.id, syncedAt:new Date().toISOString()}), date:new Date().toISOString()});
      pushAudit('Integration', asset.title, 'Synced to Production Dashboard via API');
      pushEvent('Asset Synced to Dashboard', {asset:asset.title});
      toast('201 Created — synced to Production Dashboard.','success');
      render();
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
      const asset = {id:nid('a'), project: proj?proj.id:DB.projects[0].id, title:rec.title, type,
        link:'', versions:[{id:nid('v'), n:1, status:'For Review', notes:'Imported via ETL — assignee: '+(rec.assignee||'unassigned')+(rec.duedate?(', due '+rec.duedate):''), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)}]};
      DB.assets.push(asset);
      loaded++;
    });
    steps.push('TRANSFORM — validated required fields, normalized asset type, mapped project names ('+skipped+' row(s) skipped for missing data).');
    steps.push('LOAD — inserted '+loaded+' new asset record(s), each auto-set to “For Review”.');
    log.innerHTML = steps.map(s=>'<div class="log-line"><span class="t">›</span><span>'+esc(s)+'</span></div>').join('');
    pushAudit('Integration','ETL Import', loaded+' asset(s) imported from CSV');
    pushEvent('ETL Import Completed', {rows:rows.length, loaded, skipped});
    toast('ETL run complete — '+loaded+' record(s) loaded.','success');
    render();
  },

});


/* ===== RESOURCE ACTIONS: js/actions/resources.js ===== */
/* ==========================================================================
   RESOURCE / ERP ACTIONS — log labor, equipment, and cost per project.
   ========================================================================== */
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
    render();
  },

});


/* ===== USER ACTIONS: js/actions/users.js ===== */
/* ==========================================================================
   USER MANAGEMENT ACTIONS — add teammates, change roles.
   ========================================================================== */
Object.assign(Studio, {

  addUser(){
    if(!can('manageUsers')) return;
    const name = document.getElementById('umName').value.trim();
    const role = document.getElementById('umRole').value;
    if(!name){ toast('Enter a name.','error'); return; }
    const u = {id:nid('u'), name, role};
    DB.users.push(u);
    pushAudit('User', name, 'Added to team as '+ROLE_LABELS[role]);
    toast('Team member added.','success');
    document.getElementById('umName').value='';
    render();
  },

  changeRole(uid, role){
    const u = userById(uid); if(!u) return;
    u.role = role;
    pushAudit('User', u.name, 'Role changed to '+ROLE_LABELS[role]);
    toast(u.name+' is now '+ROLE_LABELS[role]+'.');
    render();
  },

});


