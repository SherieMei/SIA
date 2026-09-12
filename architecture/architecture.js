/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — System Architecture (write-up for the project submission)
   ========================================================================== */
function pageArchitecture(){
  return `
    <div class="section-title">System architecture</div>

    <div class="card" style="padding:22px;margin-top:16px;">
      <h3 style="margin-top:0;">Layered Architecture</h3>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">Three layers, each with one job — every rule lives in exactly one place, so behavior never drifts between pages:</p>
      <ul style="color:var(--text-dim);font-size:13.5px;line-height:1.9;margin:8px 0 0;padding-left:20px;">
        <li><b>Presentation</b> — the pages themselves: navigation, forms, and views.</li>
        <li><b>Business logic</b> — one <span class="mono">Studio</span> object owns every rule: submissions, approvals, permissions, integrations.</li>
        <li><b>Data</b> — an in-memory <span class="mono">DB</span> store standing in for a production database (projects, assets, versions, comments, notifications, audit log).</li>
      </ul>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;margin-bottom:0;">On disk: each page has its own HTML/CSS/JS file (Dashboard, Projects, Assets, etc.); shared logic and data live in one file, <span class="mono">js/shared.js</span>, loaded by every page.</p>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">Event-Driven Integration</h3>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">An upload, an approval, a rejection — each one fires an event that other parts of the system can react to, without being wired directly to whatever triggered it. This is the primary integration pattern, visible in the Integration Hub's Event Stream. For sending data out, one API connection pushes approved-asset data to an external Production Dashboard, rather than every module talking to every other module directly.</p>
      <table class="arch-table" style="margin-top:14px;">
        <thead><tr><th>Pattern</th><th>Used here?</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Event-driven</td><td>✓ Primary pattern</td><td>Matches how production actually flows; stays auditable via the Event Stream and Audit Log</td></tr>
          <tr><td>Hub-and-spoke</td><td>✓ For the API sync</td><td>One integration point instead of many direct wires</td></tr>
          <tr><td>Point-to-point</td><td>Not used</td><td>Doesn't scale past a couple of systems</td></tr>
          <tr><td>Shared database</td><td>Not used</td><td>Data ownership gets blurry once multiple systems write to it</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">Implemented Integrations</h3>
      <table class="arch-table">
        <tbody>
          <tr><td style="width:220px;"><span class="check">✓</span> API Integration</td><td>Asset submission → Production Dashboard (Integration Hub → API console)</td></tr>
          <tr><td><span class="check">✓</span> ETL Integration</td><td>CSV of tasks/assets → cleaned and loaded as assets (Integration Hub → ETL import)</td></tr>
          <tr><td><span class="check">✓</span> Workflow Automation</td><td>Every upload auto-sets status to "For Review" — no manual step</td></tr>
          <tr><td><span class="check">✓</span> Webhook Simulation</td><td>Every approval fires a webhook to an external endpoint</td></tr>
          <tr><td><span class="check">✓</span> Messaging Simulation</td><td>Event Stream publishes Asset Uploaded, Revision Requested, Final Output Approved, etc.</td></tr>
          <tr><td><span class="check">✓</span> External Storage</td><td>Assets can carry a Drive/Dropbox/local link</td></tr>
          <tr><td><span class="check">✓</span> ERP / Resources</td><td>Resources &amp; Budget ties labor, equipment, and cost to each project</td></tr>
        </tbody>
      </table>
      <p style="color:var(--text-faint);font-size:12px;margin-top:14px;">Data lives in memory for this browser session — refreshing the page resets it to the seeded demo data.</p>
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
