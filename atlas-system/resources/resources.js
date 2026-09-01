/* Page-specific ATLAS controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Resources & Budget (ERP-style tracking)
   ========================================================================== */
function pageResources(){
  return `
    <div class="section-title">Resources &amp; budget</div>
    <div class="section-sub">Links production work to cost, hours, equipment, and client billing per project.</div>

    <div class="proj-grid" style="margin-top:18px;">
      ${DB.projects.map(p=>{
        const items = DB.resources.filter(r=>r.project===p.id);
        const spent = items.reduce((s,r)=>s+r.cost,0);
        const hours = items.reduce((s,r)=>s+r.hours,0);
        const pct = Math.min(100, Math.round(spent/p.budget*100));
        return `<div class="card" style="padding:18px;">
          <h3 style="font-size:14.5px;margin:0 0 8px;">${esc(p.name)}</h3>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${pct>90?'var(--crimson)':'linear-gradient(90deg,var(--coral),var(--cyan))'};"></div></div>
          <div class="proj-meta" style="margin-top:8px;"><span>$${spent.toLocaleString()} of $${p.budget.toLocaleString()}</span><span>${hours}h logged</span></div>
        </div>`;
      }).join('')}
    </div>

    ${can('manageResources') ? `
    <div class="card" style="padding:20px;margin-top:20px;">
      <h3 style="margin-top:0;font-size:15px;">Log a resource / cost entry</h3>
      <div class="field-row">
        <div class="field"><label>Project</label>
          <select id="rsProject">${DB.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Category</label>
          <select id="rsCategory"><option>Labor</option><option>Equipment</option><option>Software</option><option>Procurement</option></select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Description</label><input id="rsDesc" placeholder="e.g. Freelance colorist — 3 days"></div>
        <div class="field"><label>Cost (USD)</label><input id="rsCost" type="number" placeholder="750"></div>
      </div>
      <div class="field"><label>Hours (optional)</label><input id="rsHours" type="number" placeholder="24"></div>
      <button class="btn btn-primary btn-sm" onclick="Studio.addResource()">Log entry</button>
    </div>` : ''}

    <div class="card" style="margin-top:20px;">
      <table>
        <thead><tr><th>Project</th><th>Category</th><th>Description</th><th>Cost</th><th>Hours</th></tr></thead>
        <tbody>
          ${DB.resources.slice().reverse().map(r=>`<tr>
            <td>${esc(projectById(r.project).name)}</td><td>${esc(r.category)}</td><td>${esc(r.desc)}</td>
            <td class="mono">$${r.cost.toLocaleString()}</td><td class="mono">${r.hours}h</td>
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
