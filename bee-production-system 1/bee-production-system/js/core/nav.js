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
    DB.currentUser = u;
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('app').style.display='block';
    state.page='dashboard';
    render();
    toast('Signed in as '+u.name+' ('+ROLE_LABELS[u.role]+').','success');
  },
  logout(){
    DB.currentUser=null;
    document.getElementById('app').style.display='none';
    document.getElementById('loginScreen').style.display='flex';
  },

  goto(page, arg){
    state.page = page;
    if(page==='projectDetail') state.selectedProjectId = arg;
    if(page==='assetDetail') state.selectedAssetId = arg;
    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo(0,0);
    render();
  },

  toggleForm(id){
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hidden');
  },

  setFilter(key,val){ state.filter[key]=val; render(); },
};

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
  document.getElementById('demoUsers').innerHTML = DB.users.slice(0,8).map(u=>
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
  const current = list.find(n=>n.key===state.page) || list.find(n=>n.key==='dashboard') || {label:'Overview',key:'overview'};
  document.getElementById('topEyebrow').textContent = current.key.toUpperCase();
  document.getElementById('topTitle').textContent = current.label || 'Overview';
  document.getElementById('clockChip').textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
