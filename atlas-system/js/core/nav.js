/* Navigation shared by all authenticated pages. */
const PAGE_URLS={dashboard:'../dashboard/dashboard.html',projects:'../projects/projects.html',assets:'../assets/assets.html',review:'../review/review.html',notifications:'../notifications/notifications.html',integrations:'../integrations/integrations.html',resources:'../resources/resources.html',audit:'../audit/audit.html',users:'../users/users.html',architecture:'../architecture/architecture.html'};
const NAV=[
 {key:'dashboard',label:'Dashboard',icon:'◧'}, {key:'projects',label:'Projects',icon:'▤'}, {key:'assets',label:'Assets',icon:'▥'},
 {key:'review',label:'Review Queue',icon:'✓',badgeFn:()=>DB.assets.filter(a=>['For Review','Revision Requested'].includes(latestVersion(a).status)).length},
 {key:'notifications',label:'Notifications',icon:'●',badgeFn:()=>DB.notifications.filter(n=>!n.read).length},
 {key:'integrations',label:'Integration Hub',icon:'⇄',perm:'runIntegrations'}, {key:'resources',label:'Resources & Budget',icon:'$',perm:'manageResources'},
 {key:'audit',label:'Audit Log',icon:'≡',perm:'viewAudit'}, {key:'users',label:'Team & Roles',icon:'☺',perm:'manageUsers'}, {key:'architecture',label:'System Architecture',icon:'⌘'}
];
const Studio={
 completeLogin(u){DB.currentUser=u;persistDB();location.href='../dashboard/dashboard.html'},
 logout(){DB.currentUser=null;persistDB();location.href='../login/login.html'},
 goto(page,arg){
   const current=document.body.dataset.page;
   if(page==='projectDetail'){if(current==='projects'){state.page='projectDetail';state.selectedProjectId=arg;history.replaceState({},'',`projects.html?project=${encodeURIComponent(arg)}`);render()}else location.href=`../projects/projects.html?project=${encodeURIComponent(arg)}`;return}
   if(page==='assets'&&arg){const mode=String(arg);if(current==='assets'){state.page='assets';state.selectedAssetId=null;if(mode.startsWith('project:')){state.filter.project=mode.slice(8);history.replaceState({},'',`assets.html?project=${encodeURIComponent(state.filter.project)}`)}else{history.replaceState({},'',`assets.html?newVersion=${encodeURIComponent(mode.slice(6))}`)}render()}else if(mode.startsWith('project:')) location.href=`../assets/assets.html?project=${encodeURIComponent(mode.slice(8))}`;else if(mode.startsWith('asset:')) location.href=`../assets/assets.html?newVersion=${encodeURIComponent(mode.slice(6))}`;return}
   if(page==='assetDetail'){if(current==='assets'){state.page='assetDetail';state.selectedAssetId=arg;history.replaceState({},'',`assets.html?asset=${encodeURIComponent(arg)}`);render()}else location.href=`../assets/assets.html?asset=${encodeURIComponent(arg)}`;return}
   if(current===page){state.page=page;history.replaceState({},'',`${page}.html`);render();return}
   if(PAGE_URLS[page]) location.href=PAGE_URLS[page];
 },
 toggleForm(id){const el=document.getElementById(id);if(el)el.classList.toggle('hidden')},
 setFilter(key,val){state.filter[key]=val;render()}
};
function renderSidebar(){
 const list=NAV.filter(n=>!n.perm||can(n.perm));
 const navlist=document.getElementById('navlist');
 if(navlist)navlist.innerHTML=list.map(n=>{const badge=n.badgeFn?n.badgeFn():0;const active=state.page===n.key||(state.page==='projectDetail'&&n.key==='projects')||(state.page==='assetDetail'&&n.key==='assets');return `<div class="navitem ${active?'active':''}" onclick="Studio.goto('${n.key}')"><span class="ic">${n.icon}</span><span>${n.label}</span>${badge>0?`<span class="nb">${badge}</span>`:''}</div>`}).join('');
 if(DB.currentUser){const av=document.getElementById('sideAvatar');const nm=document.getElementById('sideName');const rl=document.getElementById('sideRole');if(av)av.textContent=initials(DB.currentUser.name);if(nm)nm.textContent=DB.currentUser.name;if(rl)rl.textContent=ROLE_LABELS[DB.currentUser.role]}
 const nav=list.find(n=>n.key===state.page)||{label:state.page==='projectDetail'?'Project Detail':state.page==='assetDetail'?'Asset Detail':'Overview'};
 const e=document.getElementById('topEyebrow'),t=document.getElementById('topTitle'),c=document.getElementById('clockChip');if(e)e.textContent=(nav.key||state.page).toUpperCase();if(t)t.textContent=nav.label;if(c)c.textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
