/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Dashboard / Reports
   ========================================================================== */

/*
 * DASHBOARD STATISTICS
 * --------------------------------------------------------------------------
 * All dashboard numbers are calculated from DB.
 *
 * This keeps the UI database-ready:
 * - DB.projects can later come from your database/API
 * - DB.assets can later come from your database/API
 * - The cards will calculate their values automatically
 *
 * Active:
 *   Projects that are currently active and not completed/cancelled.
 *
 * Pending:
 *   Assets whose latest version is waiting for review or revision.
 *
 * Approved Assets:
 *   Assets whose latest version is Approved or Final.
 *
 * Rejected Outputs:
 *   Assets whose latest version is Rejected.
 *
 * Overdue Deadline:
 *   Projects whose deadline has already passed and are not 100% complete.
 */
function getDashboardStats(db = DB, now = new Date()) {

  const activeProjects = db.projects.filter(project => {
    const status = String(project.status || '').toLowerCase();

    return (
      status !== 'completed' &&
      status !== 'complete' &&
      status !== 'cancelled' &&
      status !== 'canceled'
    );
  });

  const assetsWithLatestVersion = db.assets
    .map(asset => ({
      asset: asset,
      version: latestVersion(asset)
    }))
    .filter(item => item.version);

  const pending = assetsWithLatestVersion.filter(item =>
    item.version.status === 'For Review' ||
    item.version.status === 'Revision Requested'
  ).length;

  const approvedAssets = assetsWithLatestVersion.filter(item =>
    item.version.status === 'Approved' ||
    item.version.status === 'Final'
  ).length;

  const rejectedOutputs = assetsWithLatestVersion.filter(item =>
    item.version.status === 'Rejected'
  ).length;

  const overdueDeadline = db.projects.filter(project => {

    if (!project.deadline) return false;

    const deadline = new Date(project.deadline);

    if (Number.isNaN(deadline.getTime())) return false;

    const progress = projectProgress(project.id);

    const status = String(project.status || '').toLowerCase();

    const finished =
      progress >= 100 ||
      status === 'completed' ||
      status === 'complete' ||
      status === 'cancelled' ||
      status === 'canceled';

    return deadline < now && !finished;

  }).length;

  return {
    active: activeProjects.length,
    pending: pending,
    approvedAssets: approvedAssets,
    rejectedOutputs: rejectedOutputs,
    overdueDeadline: overdueDeadline
  };
}


/*
 * DASHBOARD
 */
function pageDashboard(){

  /*
   * Get all dashboard numbers from one function.
   * This makes it easier to connect the same dashboard
   * to your database/API later.
   */
  const dashboardStats = getDashboardStats();

  const stats = [
    {
      key: 'active',
      n: dashboardStats.active,
      l: 'Active',
      c: 'var(--coral)'
    },
    {
      key: 'pending',
      n: dashboardStats.pending,
      l: 'Pending',
      c: 'var(--violet)'
    },
    {
      key: 'approvedAssets',
      n: dashboardStats.approvedAssets,
      l: 'Approved Assets',
      c: 'var(--cyan)'
    },
    {
      key: 'rejectedOutputs',
      n: dashboardStats.rejectedOutputs,
      l: 'Rejected Outputs',
      c: 'var(--crimson)'
    },
    {
      key: 'overdueDeadline',
      n: dashboardStats.overdueDeadline,
      l: 'Overdue Deadline',
      c: 'var(--gold)'
    }
  ];

  return `
    <div class="section-title">
      Welcome back, ${esc(DB.currentUser.name.split(' ')[0])}
    </div>

    <div class="section-sub">
      Signed in as ${ROLE_LABELS[DB.currentUser.role]} · here's where production stands today.
    </div>

    <div class="stat-grid">
      ${stats.map(s=>`
        <div
          class="card stat dashboard-stat-card"
          data-stat="${s.key}"
        >
          <div class="bar" style="background:${s.c}"></div>
          <div class="n">${s.n}</div>
          <div class="l">${s.l}</div>
        </div>
      `).join('')}
    </div>

    <div class="grid-2">

      <div class="card" style="padding:20px;">
        <div class="panel-head">
          <h3 style="margin:0;font-size:15px;">Production progress</h3>
          <span
            class="chip"
            onclick="Studio.goto('projects')"
            style="cursor:pointer;"
          >
            View all →
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px;margin-top:14px;">
          ${DB.projects.map(p=>{
            const pct = projectProgress(p.id);

            return `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
                  <b
                    style="cursor:pointer;"
                    onclick="Studio.goto('projectDetail','${p.id}')"
                  >
                    ${esc(p.name)}
                  </b>

                  <span
                    class="mono"
                    style="color:var(--text-faint);"
                  >
                    ${pct}%
                  </span>
                </div>

                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style="width:${pct}%"
                  ></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>


      <div class="card" style="padding:20px;">
        <div class="panel-head">
          <h3 style="margin:0;font-size:15px;">Recent activity</h3>

          <span
            class="chip"
            onclick="Studio.goto('audit')"
            style="cursor:pointer;"
          >
            Full log →
          </span>
        </div>

        <div style="margin-top:8px;">
          ${DB.auditLog.slice(-6).reverse().map(a=>`
            <div class="log-line">
              <span class="t">${fmtDateTime(a.date)}</span>
              <span>
                <b>${esc(a.by)}</b> —
                ${esc(a.action)}:
                ${esc(a.entity)}
              </span>
            </div>
          `).join('') || '<div class="empty">No activity yet.</div>'}
        </div>
      </div>

    </div>
  `;
}


/*
 * RENDER
 */
function render(){
  if(!DB.currentUser) return;

  renderSidebar();

  const el=document.getElementById('pageContent');

  if(!el) return;

  switch(state.page){
    case 'dashboard':
      el.innerHTML=pageDashboard();
      break;

    case 'projects':
      el.innerHTML=pageProjects();
      break;

    case 'projectDetail':
      el.innerHTML=pageProjectDetail();
      break;

    case 'assets':
      el.innerHTML=pageAssets();
      break;

    case 'assetDetail':
      el.innerHTML=pageAssetDetail();
      break;

    case 'review':
      el.innerHTML=pageReview();
      break;

    case 'notifications':
      el.innerHTML=pageNotifications();
      break;

    case 'integrations':
      el.innerHTML=pageIntegrations();
      break;

    case 'resources':
      el.innerHTML=pageResources();
      break;

    case 'audit':
      el.innerHTML=pageAudit();
      break;

    case 'users':
      el.innerHTML=pageUsers();
      break;

    case 'architecture':
      el.innerHTML=pageArchitecture();
      break;

    default:
      el.innerHTML=pageDashboard();
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