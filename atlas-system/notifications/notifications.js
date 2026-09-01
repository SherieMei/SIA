/* Page-specific ATLAS controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Notifications
   ========================================================================== */
function pageNotifications(){
  const list = DB.notifications.slice().reverse();
  return `
    <div class="panel-head">
      <div><div class="section-title">Notifications</div><div class="section-sub">Submissions, approvals, revisions, and deadlines across every project.</div></div>
      <button class="btn btn-sm" onclick="Studio.markAllRead()">Mark all as read</button>
    </div>
    <div class="card" style="margin-top:14px;">
      ${list.length? list.map(n=>`
        <div class="list-row" style="cursor:pointer;${n.read?'opacity:.55;':''}" onclick="Studio.markRead('${n.id}')">
          <div class="type-tag" style="background:var(--panel-3);color:var(--coral);font-size:14px;">${NOTIF_ICON[n.type]||'●'}</div>
          <div style="flex:1;">
            <div class="row-title">${esc(n.text)}</div>
            <div class="row-sub">${fmtDateTime(n.date)}</div>
          </div>
          ${!n.read? '<span class="badge b-review">New</span>' : ''}
        </div>
      `).join('') : `<div class="empty">You're all caught up.</div>`}
    </div>
  `;
}


function render(){
  if(!DB.currentUser) return;
  renderSidebar();
  const el=document.getElementById('pageContent');
  if(!el) return;
  switch(state.page){
    case 'dashboard': el.innerHTML=pageDashboard(); break;
    case 'projects': el.innerHTML=pageProjects(); break;
    case 'projectDetail': el.innerHTML=pageProjectDetail(); break;
    case 'assets': el.innerHTML=pageAssets(); break;
    case 'assetDetail': el.innerHTML=pageAssetDetail(); break;
    case 'review': el.innerHTML=pageReview(); break;
    case 'notifications': el.innerHTML=pageNotifications(); break;
    case 'integrations': el.innerHTML=pageIntegrations(); break;
    case 'resources': el.innerHTML=pageResources(); break;
    case 'audit': el.innerHTML=pageAudit(); break;
    case 'users': el.innerHTML=pageUsers(); break;
    case 'architecture': el.innerHTML=pageArchitecture(); break;
    default: el.innerHTML=pageDashboard();
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  if(!DB.currentUser){ 
    window.location.assign('../login/login.html'); 
    return; 
  }

  const menu=document.getElementById('menuButton');
  if(menu) {
    menu.addEventListener('click',()=>{
      document.getElementById('sidebar')?.classList.toggle('open');
    });
  }

  // Render the actual page after the separated HTML document loads.
  render();
});
