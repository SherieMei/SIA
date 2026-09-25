/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — System Information
   ========================================================================== */
function pageArchitecture(){
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <button
        type="button"
        class="simple-arrow-btn"
        title="Back"
        aria-label="Go back"
        onclick="Studio.goBack('dashboard')"
      >&larr;</button>

      <div class="section-title">System Information</div>
    </div>

    <div class="card" style="padding:22px;margin-top:16px;">
      <h3 style="margin-top:0;">About the System</h3>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.7;">
        This system is a centralized platform for managing production projects,
        assets, approvals, revisions, and project resources. It helps team members
        monitor work progress and keeps important project activities organized in one place.
      </p>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">How the System Works</h3>

      <div style="font-size:14px;font-weight:600;margin:14px 0;color:var(--text);">
        Project → Asset Submission → Review → Approval / Revision → Final Output
      </div>

      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.7;margin-bottom:0;">
        When an asset is uploaded, it is automatically marked as
        <b>For Review</b>. Authorized users can then approve the asset,
        reject it, or request revisions.
      </p>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">Main Features</h3>

      <ul style="color:var(--text-dim);font-size:13.5px;line-height:1.9;margin:8px 0 0;padding-left:20px;">
        <li><b>Project Management</b> – Create and manage production projects.</li>
        <li><b>Asset Management</b> – Upload, organize, review, and track project assets.</li>
        <li><b>Approval Workflow</b> – Approve, reject, or request revisions for submitted assets.</li>
        <li><b>Version Tracking</b> – Keep track of different versions of an asset.</li>
        <li><b>Comments</b> – Add feedback and communicate about project assets.</li>
        <li><b>Notifications</b> – Receive updates about important project activities.</li>
        <li><b>Audit Log</b> – Records important actions performed within the system.</li>
        <li><b>Integration Hub</b> – Provides tools for API, ETL, webhook, and event-based integrations.</li>
        <li><b>Resources &amp; Budget</b> – Monitor project resources, equipment, labor, and costs.</li>
        <li><b>External Storage Links</b> – Store links to files hosted on external storage services.</li>
      </ul>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">System Integrations</h3>

      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.7;">
        The system includes simulated integrations for:
      </p>

      <ul style="color:var(--text-dim);font-size:13.5px;line-height:1.9;margin:8px 0 0;padding-left:20px;">
        <li><b>API Integration</b> – Sends approved asset information to an external production dashboard.</li>
        <li><b>ETL Import</b> – Imports asset and task information from CSV files.</li>
        <li><b>Workflow Automation</b> – Automatically updates asset status after submission.</li>
        <li><b>Webhook Simulation</b> – Generates webhook events when important actions occur.</li>
        <li><b>Event Stream</b> – Records system events such as asset uploads, revisions, and approvals.</li>
      </ul>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">Data &amp; Security</h3>

      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.7;">
        The system organizes project information into separate areas such as projects,
        assets, asset versions, comments, notifications, and activity records.
      </p>

      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.7;margin-bottom:0;">
        <b>Demo Data Notice:</b> This system currently uses temporary browser-based data
        for demonstration. Data may reset when the browser session or page data is cleared
        or refreshed, depending on the current system configuration.
      </p>
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