/* Page-specific ATLAS controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Dashboard / Reports
   ========================================================================== */
function pageDashboard(){
  const totalProjects = DB.projects.length;
  const allV = DB.assets.map(a=>({a, v:latestVersion(a)}));
  const pending = allV.filter(x=>['For Review','Revision Requested'].includes(x.v.status)).length;
  const approved = allV.filter(x=>x.v.status==='Approved'||x.v.status==='Final').length;
  const rejected = allV.filter(x=>x.v.status==='Rejected').length;
  const overdue = DB.projects.filter(p=> new Date(p.deadline) < new Date('2026-08-29') && projectProgress(p.id)<100).length;

  const stats = [
    {n:totalProjects, l:'Active Projects', c:'var(--coral)'},
    {n:pending, l:'Pending Review', c:'var(--violet)'},
    {n:approved, l:'Approved Assets', c:'var(--cyan)'},
    {n:rejected, l:'Rejected Outputs', c:'var(--crimson)'},
    {n:overdue, l:'Overdue Deadlines', c:'var(--crimson)'},
  ];

  return `
    <div class="section-title">Welcome back, ${esc(DB.currentUser.name.split(' ')[0])}</div>
    <div class="section-sub">Signed in as ${ROLE_LABELS[DB.currentUser.role]} · here's where production stands today.</div>
    <div class="stat-grid">
      ${stats.map(s=>`<div class="card stat"><div class="bar" style="background:${s.c}"></div><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`).join('')}
    </div>
    <div class="grid-2">
      <div class="card" style="padding:20px;">
        <div class="panel-head"><h3 style="margin:0;font-size:15px;">Production progress</h3><span class="chip" onclick="Studio.goto('projects')" style="cursor:pointer;">View all →</span></div>
        <div style="display:flex;flex-direction:column;gap:16px;margin-top:14px;">
          ${DB.projects.map(p=>{
            const pct = projectProgress(p.id);
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                <b style="cursor:pointer;" onclick="Studio.goto('projectDetail','${p.id}')">${esc(p.name)}</b>
                <span class="mono" style="color:var(--text-faint);">${pct}%</span>
              </div>
              <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card" style="padding:20px;">
        <div class="panel-head"><h3 style="margin:0;font-size:15px;">Recent activity</h3><span class="chip" onclick="Studio.goto('audit')" style="cursor:pointer;">Full log →</span></div>
        <div style="margin-top:8px;">
          ${DB.auditLog.slice(-6).reverse().map(a=>`
            <div class="log-line"><span class="t">${fmtDateTime(a.date)}</span><span><b>${esc(a.by)}</b> — ${esc(a.action)}: ${esc(a.entity)}</span></div>
          `).join('') || '<div class="empty">No activity yet.</div>'}
        </div>
      </div>
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
