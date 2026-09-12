/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Completed Projects
   Shows only projects where every asset is Approved/Final (projectProgress === 100).
   A project moves here automatically the moment its last asset gets approved —
   there is no manual "mark as completed" step and nothing to keep in sync.
   ========================================================================== */
function pageCompletedProjects(){
  const completed = DB.projects.filter(p=>projectProgress(p.id)===100);
  return `
    <div class="panel-head">
      <div><div class="section-title">Completed projects</div></div>
    </div>
    <div class="proj-grid">
      ${completed.length ? completed.map(p=>{
        const assetCount = DB.assets.filter(a=>a.project===p.id).length;
        return `<div class="card proj-card" onclick="Studio.goto('projectDetail','${p.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <h3>${esc(p.name)}</h3>
            <span class="badge b-approved">✓ Completed</span>
          </div>
          <div class="client">${esc(p.client)}</div>
          <div class="progress-track"><div class="progress-fill" style="width:100%"></div></div>
          <div class="proj-meta"><span>${assetCount} asset(s)</span><span>Due ${fmtDate(p.deadline)}</span></div>
        </div>`;
      }).join('') : `<div class="empty">No completed projects yet — a project shows up here automatically once every one of its assets is approved or finalized.</div>`}
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
    case 'completedProjects': el.innerHTML=pageCompletedProjects(); break;
    case 'assets': el.innerHTML=pageAssets(); break;
    case 'assetDetail': el.innerHTML=pageAssetDetail(); break;
    case 'review': el.innerHTML=pageReview(); break;
    case 'notifications': el.innerHTML=pageNotifications(); break;
    case 'integrations': el.innerHTML=pageIntegrations(); break;
    case 'resources': el.innerHTML=pageResources(); break;
    case 'audit': el.innerHTML=pageAudit(); break;
    case 'users': el.innerHTML=pageUsers(); break;
    case 'architecture': el.innerHTML=pageArchitecture(); break;
    default: el.innerHTML=pageCompletedProjects();
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
