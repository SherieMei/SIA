/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Audit Log
   ========================================================================== */
function pageAudit(){
  return `
    <div class="section-title">Audit log</div>
    <div class="section-sub">Every upload, edit, approval, rejection, revision, and status change — who did it and when.</div>
    <div class="card" style="margin-top:16px;">
      <table>
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
        <tbody>
          ${DB.auditLog.slice().reverse().map(a=>`<tr>
            <td class="mono" style="color:var(--text-faint);">${fmtDateTime(a.date)}</td>
            <td>${esc(a.by)}</td>
            <td><span class="chip">${esc(a.action)}</span></td>
            <td>${esc(a.entity)}</td>
            <td style="color:var(--text-dim);">${esc(a.detail)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
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
