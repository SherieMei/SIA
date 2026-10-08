/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Dashboard / Reports
   ========================================================================== */

/*
 * DASHBOARD STATISTICS
 * --------------------------------------------------------------------------
 * All dashboard numbers are calculated from DB.
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


/*
 * DASHBOARD PROJECT FILTER
 * --------------------------------------------------------------------------
 * Keeps Completed Projects out of the Dashboard Production Progress.
 *
 * This does NOT depend on isProjectManuallyFinished(), because that helper
 * may only exist on the Projects page and can cause the Dashboard to go blank.
 *
 * It checks both:
 * 1. project.status
 * 2. beeManuallyFinishedProjects in localStorage
 */
function getDashboardActiveProjects(db = DB){

  let manuallyFinished = {};

  try{
    manuallyFinished = JSON.parse(
      localStorage.getItem('beeManuallyFinishedProjects') || '{}'
    );

    if(
      !manuallyFinished ||
      typeof manuallyFinished !== 'object' ||
      Array.isArray(manuallyFinished)
    ){
      manuallyFinished = {};
    }

  }catch(error){
    manuallyFinished = {};
  }

  return db.projects.filter(project => {

    const status = String(project.status || '')
      .trim()
      .toLowerCase();

    const completedByStatus =
      status === 'completed' ||
      status === 'complete' ||
      status === 'cancelled' ||
      status === 'canceled';

    const completedManually =
      Object.prototype.hasOwnProperty.call(
        manuallyFinished,
        String(project.id)
      ) ||
      Object.prototype.hasOwnProperty.call(
        manuallyFinished,
        project.id
      );

    return !completedByStatus && !completedManually;
  });
}


function getDashboardStats(db = DB, now = new Date()) {

  const activeProjects = getDashboardActiveProjects(db);

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

  const overdueDeadline = activeProjects.filter(project => {

    if (!project.deadline) return false;

    const deadline = new Date(project.deadline);

    if (Number.isNaN(deadline.getTime())) return false;

    const progress = projectProgress(project.id);

    return deadline < now && progress < 100;

  }).length;

  return {
    active: activeProjects.length,
    pending: pending,
    approvedAssets: approvedAssets,
    rejectedOutputs: rejectedOutputs,
    overdueDeadline: overdueDeadline
  };
}


function dashboardPageHeader(title){
  return `
    <div class="dashboard-subpage-header">
      <button type="button" class="klay-back-btn" onclick="openDashboardOverview()" aria-label="Back to dashboard overview" title="Go back">←</button>
      <div>
        <div class="dashboard-breadcrumb">Dashboard / ${esc(title)}</div>
        <h1 class="dashboard-subpage-title">${esc(title)}</h1>
      </div>
    </div>
  `;
}

function dashboardAssetsWithStatuses(statuses){
  return DB.assets
    .filter(asset => Array.isArray(asset.versions) && asset.versions.length > 0)
    .map(asset => ({asset, version:latestVersion(asset)}))
    .filter(item => statuses.includes(item.version.status))
    .sort((a, b) => {
      const aDate = new Date(a.version.date || 0).getTime();
      const bDate = new Date(b.version.date || 0).getTime();
      return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
    });
}

function dashboardAssetProject(asset){
  return projectById(asset.project ?? asset.project_id ?? asset.projectId);
}

function dashboardPreviewSource(asset, version){
  const candidates = [version, asset].flatMap(item => {
    if(!item) return [];
    const mediaType = String(
      item.mimeType || item.mime_type || item.contentType || item.content_type || ''
    ).toLowerCase();
    return [
      item.fileUrl,
      item.file_url,
      item.mediaUrl,
      item.media_url,
      item.previewUrl,
      item.preview_url,
      item.downloadUrl,
      item.download_url,
      item.externalLink,
      item.external_link,
      item.link,
      item.url
    ].filter(Boolean).map(url => ({url:String(url), mediaType}));
  });

  for(const candidate of candidates){
    try{
      const url = new URL(candidate.url, window.location.href);
      if(!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;

      const extension = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
      const imageType = candidate.mediaType.startsWith('image/')
        || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(extension);
      const videoType = candidate.mediaType.startsWith('video/')
        || ['mp4', 'webm', 'ogv', 'ogg', 'mov'].includes(extension);

      if(imageType || videoType){
        return {url:url.href, type:imageType ? 'image' : 'video'};
      }
    }catch(error){
      // Ignore malformed candidate URLs and continue checking valid media URLs.
    }
  }

  return null;
}

function dashboardPreviewMarkup(asset, version){
  const preview = asset ? dashboardPreviewSource(asset, version) : null;

  if(preview?.type === 'image'){
    return `<img class="dashboard-preview-media" src="${esc(preview.url)}" alt="${esc(asset.title || 'Latest submission')} preview">`;
  }

  if(preview?.type === 'video'){
    return `<video class="dashboard-preview-media" src="${esc(preview.url)}" controls preload="metadata" aria-label="${esc(asset.title || 'Latest submission')} preview"></video>`;
  }

  return `
    <div class="dashboard-preview-placeholder">
      <span class="dashboard-preview-icon" aria-hidden="true">▶</span>
      <strong>Preview unavailable</strong>
      <span>No direct image or video preview is available for this submission.</span>
    </div>
  `;
}

function pageDashboardActive(){
  const projects = getDashboardActiveProjects();

  return `
    ${dashboardPageHeader('Active Projects')}
    <div class="dashboard-project-list">
      ${projects.length ? projects.map(project => {
        const progress = projectProgress(project.id);
        return `
          <article
            class="card dashboard-project-card"
            onclick="Studio.goto('projectDetail','${esc(project.id)}')"
            role="button"
            tabindex="0"
            onkeydown="if(event.key==='Enter'){event.preventDefault();Studio.goto('projectDetail','${esc(project.id)}')}"
          >
            <div class="dashboard-list-main">
              <h2>${esc(project.name)}</h2>
              ${project.client ? `<div class="dashboard-list-meta">Client: ${esc(project.client)}</div>` : ''}
              <div class="dashboard-list-meta">Deadline: ${project.deadline ? fmtDate(project.deadline) : '—'}</div>
            </div>
            <div class="dashboard-project-status">
              <span class="badge b-role">${esc(project.status || 'Active')}</span>
              <span class="dashboard-progress-value">${progress}% complete</span>
              <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
            </div>
          </article>
        `;
      }).join('') : '<div class="empty">No active projects.</div>'}
    </div>
  `;
}

function getPendingDashboardAssets(){
  return dashboardAssetsWithStatuses(['For Review', 'Revision Requested']);
}

function getSelectedPendingAsset(assets = getPendingDashboardAssets()){
  let assetId = null;
  try{
    const params = new URLSearchParams(window.location.search);
    assetId = params.get('asset');
  }catch(error){
    return assets[0]?.asset || null;
  }
  return assets.find(item => String(item.asset.id) === String(assetId))?.asset
    || assets[0]?.asset
    || null;
}

function openPendingAsset(assetId){
  const url = new URL(window.location.href);
  url.searchParams.set('asset', assetId);
  window.location.href = url.href;
}

function renderPendingPreview(asset){
  if(!asset){
    return `
      <section class="card pending-preview">
        <div class="dashboard-preview-stage">
          <div class="dashboard-preview-placeholder">
            <span class="dashboard-preview-icon" aria-hidden="true">▶</span>
            <strong>Preview unavailable</strong>
            <span>No direct image or video preview is available for this submission.</span>
          </div>
        </div>
      </section>
    `;
  }

  const version = latestVersion(asset);
  const project = dashboardAssetProject(asset);
  const submitter = version.by ? userById(version.by) : null;
  const submitterName =
    version.submitted_by ||
    submitter?.name ||
    version.by ||
    'Unknown';
  return `
    <section class="card pending-preview">
      <div class="dashboard-preview-meta">
        <div>
          <div class="eyebrow">${project ? esc(project.name) : 'Project unavailable'}</div>
          <h2>${esc(asset.title || 'Untitled asset')}</h2>
          <div class="dashboard-preview-details">
            <span>v${String(version.n ?? '—').padStart(2, '0')}</span>
            <span class="dashboard-review-badge">${esc(version.status || 'Pending')}</span>
            <span>Submitted by ${esc(submitterName)}</span>
            <span>${version.date ? fmtDate(version.date) : 'Date unavailable'}</span>
          </div>
        </div>
      </div>
      <div class="dashboard-preview-stage">
        ${dashboardPreviewMarkup(asset, version)}
        <div class="dashboard-preview-controls" aria-hidden="true">
          <span>▶</span><span class="dashboard-preview-track"><i></i></span><span>REVIEW PLAYER</span>
        </div>
      </div>
    </section>
  `;
}

function renderPendingNotes(asset){
  if(!asset){
    return `
      <aside class="card pending-notes">
        <h2>Notes</h2>
        <div class="dashboard-notes-empty">No review notes yet.<br>Notes will appear here when feedback is added in the Review workspace.</div>
        <div class="dashboard-notes-sync">Notes sync with the review workspace.</div>
      </aside>
    `;
  }

  const version = latestVersion(asset);
  const comments = Array.isArray(DB.comments)
    ? DB.comments.filter(comment => String(comment.asset) === String(asset.id))
    : [];
  const notes = [];
  if(String(version.notes || '').trim()){
    const author = version.by ? userById(version.by) : null;
    notes.push({
      author:author?.name || (version.by ? String(version.by) : 'Unknown'),
      role:author ? ROLE_LABELS[author.role] : '',
      text:version.notes,
      date:version.date || ''
    });
  }
  comments.forEach(comment => {
    const author = comment.by ? userById(comment.by) : null;
    notes.push({
      author:author?.name || (comment.by ? String(comment.by) : 'Unknown'),
      role:author ? ROLE_LABELS[author.role] : '',
      text:comment.text || comment.comment || '',
      date:comment.date || comment.created_at || ''
    });
  });

  return `
    <aside class="card pending-notes">
      <h2>Notes</h2>
      <div class="dashboard-notes-list">
        ${notes.length ? notes.map(note => `
          <article class="pending-note">
            <div class="dashboard-note-meta">
              <strong>${esc(note.role || note.author)}</strong>
              ${note.role ? `<span>${esc(note.author)}</span>` : ''}
              ${note.date ? `<time>${fmtDate(note.date)}</time>` : ''}
            </div>
            <p>${esc(note.text)}</p>
          </article>
        `).join('') : `
          <div class="dashboard-notes-empty">
            No review notes yet.<br>
            Notes will appear here when feedback is added in the review workspace.
          </div>
        `}
      </div>
      <div class="dashboard-notes-sync">Notes sync with the review workspace.</div>
    </aside>
  `;
}

function renderPendingQueue(assets, selectedAsset){
  return `
    <section class="pending-queue">
      <h2 class="dashboard-list-heading">Pending Queue <span>${assets.length}</span></h2>
      ${assets.length ? assets.map(({asset, version}) => {
        const project = dashboardAssetProject(asset);
        const selected = selectedAsset && String(selectedAsset.id) === String(asset.id);
        return `
          <article
            class="card pending-queue-item${selected ? ' selected' : ''}"
            onclick="openPendingAsset('${esc(asset.id)}')"
            role="button"
            tabindex="0"
            aria-current="${selected ? 'true' : 'false'}"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPendingAsset('${esc(asset.id)}')}"
          >
            <div class="dashboard-list-main">
              <h3>${esc(asset.title || 'Untitled asset')}</h3>
              <div class="dashboard-list-meta">${project ? esc(project.name) : 'Project unavailable'} · v${String(version.n ?? '—').padStart(2, '0')}</div>
              ${version.date ? `<div class="dashboard-list-meta">Submitted ${fmtDate(version.date)}</div>` : ''}
            </div>
            <span class="dashboard-review-badge">${esc(version.status)}</span>
            <button type="button" class="btn btn-sm" onclick="event.stopPropagation();openPendingAsset('${esc(asset.id)}')">View</button>
          </article>
        `;
      }).join('') : '<div class="empty">No pending submissions.</div>'}
    </section>
  `;
}

function renderPendingGallery(){
  const assets = DB.assets
    .filter(asset => Array.isArray(asset.versions) && asset.versions.length > 0)
    .map(asset => ({asset, version:latestVersion(asset)}));
  const cards = assets.map(({asset, version}) => {
    const project = dashboardAssetProject(asset);
    const preview = dashboardPreviewSource(asset, version);
    const thumbnail = preview?.type === 'image'
      ? `<img src="${esc(preview.url)}" alt="" loading="lazy">`
      : `<span aria-hidden="true">${esc(initials(asset.title || project?.name || 'Asset'))}</span>`;
    return `
      <article class="gallery-card">
        <div class="gallery-thumbnail">${thumbnail}</div>
        <div class="gallery-card-info">
          <strong>${esc(project?.name || 'Project unavailable')}</strong>
          <span>${esc(asset.title || 'Untitled asset')} · v${String(version.n ?? '—').padStart(2, '0')}</span>
          <span class="dashboard-review-badge">${esc(version.status || 'Unknown')}</span>
        </div>
      </article>
    `;
  }).join('');

  return `
    <section class="gallery-section">
      <h2 class="dashboard-list-heading">Galeria</h2>
      ${cards ? `
        <div class="gallery-window">
          <div class="gallery-track">
            ${cards}
            <div class="gallery-duplicate" aria-hidden="true">${cards}</div>
          </div>
        </div>
      ` : '<div class="empty">No project assets are available for the gallery.</div>'}
    </section>
  `;
}

function renderPendingTeamRoles(){
  const roles = ['admin', 'project_manager', 'animator', 'editor'];
  return `
    <section class="team-section">
      <h2 class="dashboard-list-heading">Team Roles</h2>
      <div class="team-grid">
        ${roles.map(role => {
          const members = DB.users.filter(user => user.role === role);
          return `
            <article class="card team-card">
              <h3>${esc(ROLE_LABELS[role])}</h3>
              ${members.length ? members.map(user => `
                <div class="team-member">
                  <span class="team-avatar" aria-hidden="true">${esc(initials(user.name))}</span>
                  <span>${esc(user.name)}</span>
                </div>
              `).join('') : '<div class="team-member-empty">No team member listed.</div>'}
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function pageDashboardPending(){
  const pendingAssets = getPendingDashboardAssets();
  const selectedAsset = getSelectedPendingAsset(pendingAssets);

  return `
    ${dashboardPageHeader('Pending Submissions')}
    <div class="pending-review-layout">
      ${renderPendingPreview(selectedAsset)}
      ${renderPendingNotes(selectedAsset)}
    </div>
    ${renderPendingQueue(pendingAssets, selectedAsset)}
    ${renderPendingGallery()}
    ${renderPendingTeamRoles()}
  `;
}

function pageDashboardApproved(){
  const assets = dashboardAssetsWithStatuses(['Approved', 'Final']);
  const approvedCount = assets.length;
  return `
    ${dashboardPageHeader('Approved Assets')}
    <section class="approved-portfolio">
      <div class="approved-portfolio-heading">
        <div>
          <div class="eyebrow">COMPLETED WORK</div>
          <h2>Approved Portfolio</h2>
          <p>A gallery of approved assets from across your projects.</p>
        </div>
        <span class="approved-portfolio-count">${approvedCount} ${approvedCount === 1 ? 'asset' : 'assets'}</span>
      </div>
      <div class="approved-portfolio-grid">
      ${assets.length ? assets.map(({asset, version}, index) => {
        const project = dashboardAssetProject(asset);
        const preview = dashboardPreviewSource(asset, version);
        const previewMarkup = preview?.type === 'image'
          ? `<img src="${esc(preview.url)}" alt="${esc(asset.title || 'Approved asset')} preview" loading="lazy">`
          : preview?.type === 'video'
            ? `<video src="${esc(preview.url)}" controls preload="metadata" aria-label="${esc(asset.title || 'Approved asset')} preview" onclick="event.stopPropagation()"></video>`
            : `<div class="approved-portfolio-placeholder"><span>${esc(initials(asset.title || project?.name || 'Asset'))}</span><small>Preview unavailable</small></div>`;
        return `
          <article
            class="card approved-portfolio-card${index % 5 === 0 ? ' approved-portfolio-card-featured' : ''}"
            onclick="Studio.goto('assetDetail','${esc(asset.id)}')"
            role="button"
            tabindex="0"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();Studio.goto('assetDetail','${esc(asset.id)}')}"
          >
            <div class="approved-portfolio-image">${previewMarkup}</div>
            <div class="approved-portfolio-card-info">
              <div class="approved-portfolio-card-topline">
                <span>${esc(project ? project.name : 'Project unavailable')}</span>
                <span class="badge ${STATUS_CLASS[version.status] || 'b-role'}">${esc(version.status)}</span>
              </div>
              <h3>${esc(asset.title || 'Untitled asset')}</h3>
              <div class="approved-portfolio-card-meta">
                <span>Version ${String(version.n ?? '—').padStart(2, '0')}</span>
                ${version.date ? `<span>Approved ${fmtDate(version.date)}</span>` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('') : '<div class="empty approved-portfolio-empty">No approved assets.</div>'}
      </div>
    </section>
  `;
}

function pageDashboardRejected(){
  const assets = dashboardAssetsWithStatuses(['Rejected']);
  return `
    ${dashboardPageHeader('Rejected Outputs')}
    <section class="approved-portfolio">
      <div class="approved-portfolio-heading rejected-portfolio-heading">
        <div>
          <div class="eyebrow">REVIEW FEEDBACK</div>
          <h2>Rejected Outputs</h2>
          <p>Review returned assets and the latest feedback from your projects.</p>
        </div>
        <span class="approved-portfolio-count rejected-portfolio-count">${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}</span>
      </div>
      <div class="approved-portfolio-grid rejected-assets-grid">
      ${assets.length ? assets.map(({asset, version}) => {
        const project = dashboardAssetProject(asset);
        const preview = dashboardPreviewSource(asset, version);
        const previewMarkup = preview?.type === 'image'
          ? `<img src="${esc(preview.url)}" alt="${esc(asset.title || 'Rejected asset')} preview" loading="lazy">`
          : preview?.type === 'video'
            ? `<video src="${esc(preview.url)}" controls preload="metadata" aria-label="${esc(asset.title || 'Rejected asset')} preview" onclick="event.stopPropagation()"></video>`
            : `<div class="approved-portfolio-placeholder"><span>${esc(initials(asset.title || project?.name || 'Asset'))}</span><small>Preview unavailable</small></div>`;
        const comments = Array.isArray(DB.comments)
          ? DB.comments.filter(comment => String(comment.asset) === String(asset.id))
          : [];
        const latestComment = comments.reduce((latest, comment) => {
          if(!latest) return comment;
          const latestTime = new Date(latest.date || latest.created_at || 0).getTime() || 0;
          const commentTime = new Date(comment.date || comment.created_at || 0).getTime() || 0;
          return commentTime >= latestTime ? comment : latest;
        }, null);
        const feedback = String(version.notes || latestComment?.text || latestComment?.comment || '').trim();
        const assetType = asset.type || asset.asset_type || asset.category || 'Asset';
        return `
          <article
            class="card approved-portfolio-card rejected-asset-card"
            onclick="Studio.goto('assetDetail','${esc(asset.id)}')"
            role="button"
            tabindex="0"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();Studio.goto('assetDetail','${esc(asset.id)}')}"
          >
            <div class="approved-portfolio-image rejected-asset-preview">${previewMarkup}</div>
            <div class="approved-portfolio-card-info rejected-asset-content">
              <div class="rejected-asset-type">${esc(assetType)}</div>
              <h3 class="rejected-asset-title">${esc(asset.title || 'Untitled asset')}</h3>
              <div class="rejected-asset-meta">
                <span>${esc(project ? project.name : 'Project unavailable')}</span>
                <span>V${String(version.n ?? '—').padStart(2, '0')}</span>
                <span class="badge b-rejected">${esc(version.status)}</span>
              </div>
              <p class="rejected-asset-reason">${feedback ? `“${esc(feedback)}”` : 'No rejection note available.'}</p>
            </div>
          </article>
        `;
      }).join('') : '<div class="empty">No rejected outputs.</div>'}
      </div>
    </section>
  `;
}

function pageDashboardOverdue(){
  const now = new Date();
  const projects = getDashboardActiveProjects().filter(project => {
    if(!project.deadline) return false;
    const deadline = new Date(project.deadline);
    return !Number.isNaN(deadline.getTime())
      && deadline < now
      && projectProgress(project.id) < 100;
  });

  return `
    ${dashboardPageHeader('Overdue Projects')}
    <div class="dashboard-project-list">
      ${projects.length ? projects.map(project => {
        const progress = projectProgress(project.id);
        return `
          <article
            class="card dashboard-project-card"
            onclick="Studio.goto('projectDetail','${esc(project.id)}')"
            role="button"
            tabindex="0"
            onkeydown="if(event.key==='Enter'){event.preventDefault();Studio.goto('projectDetail','${esc(project.id)}')}"
          >
            <div class="dashboard-list-main">
              <h2>${esc(project.name)}</h2>
              <div class="dashboard-list-meta">Deadline: ${fmtDate(project.deadline)}</div>
            </div>
            <div class="dashboard-project-status">
              <span class="dashboard-progress-value">${progress}% complete</span>
              <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
              <button type="button" class="btn btn-sm" onclick="event.stopPropagation();Studio.goto('projectDetail','${esc(project.id)}')">View project</button>
            </div>
          </article>
        `;
      }).join('') : '<div class="empty">No overdue active projects.</div>'}
    </div>
  `;
}

/*
 * DASHBOARD
 */
const editorDashboardData={
  loading:false,
  loaded:false,
  error:'',
  projects:[],
  library:[],
  sequences:[]
};

async function loadEditorDashboardData(){
  if(DB.currentUser?.role!=='editor'||editorDashboardData.loading||editorDashboardData.loaded)return;
  editorDashboardData.loading=true;
  editorDashboardData.error='';
  try{
    const response=await window.beeFetch(window.BEE_API_BASE+'editor_sequences.php',{credentials:'include'});
    const data=await parseApiResponse(response);
    if(
      !response.ok||
      !data.success||
      !Array.isArray(data.projects)||
      !Array.isArray(data.library)||
      !Array.isArray(data.sequences)
    ){
      throw new Error(data.error||'Could not load your editing queue.');
    }
    editorDashboardData.projects=data.projects;
    editorDashboardData.library=data.library;
    editorDashboardData.sequences=data.sequences;
    editorDashboardData.loaded=true;
  }catch(error){
    console.error('Editor dashboard load error:',error);
    editorDashboardData.error=error.message||'Could not load your editing queue.';
  }finally{
    editorDashboardData.loading=false;
    if(document.body?.dataset.page==='dashboard'&&state.page==='dashboard')render();
  }
}

function pageAnimatorDashboard(){
  const shots=Array.isArray(DB.animationShots)?DB.animationShots:[];
  const groups=[
    {label:'TO DO',status:'Not Started',color:'var(--gold)'},
    {label:'IN PROGRESS',status:'In Progress',color:'var(--cyan)'},
    {label:'REVISION NEEDED',status:'Revision Required',color:'var(--violet)'},
    {label:'FOR REVIEW',status:'For Review',color:'var(--coral)'},
    {label:'COMPLETED',status:'Completed',color:'var(--cyan)'}
  ].map(group=>({
    ...group,
    items:shots.filter(shot=>(shot.workflow_status||'Not Started')===group.status)
  }));
  const activeCount=shots.filter(shot=>['Not Started','In Progress','Revision Required'].includes(shot.workflow_status||'Not Started')).length;
  const visibleGroups=groups.filter(group=>group.items.length>0);
  return `
    <div class="section-title">Welcome back, ${esc(DB.currentUser.name.split(' ')[0])}</div>
    <div class="section-sub">Your assigned animation scenes, next steps, and review feedback.</div>
    ${DB.animationShotsError?`<div class="empty role-dashboard-error" role="alert">${esc(DB.animationShotsError)}</div>`:''}
    <section class="role-dashboard">
      <div class="role-dashboard-header">
        <div>
          <span class="eyebrow">ANIMATION WORKSPACE</span>
          <h2>Tasks by Status</h2>
          <p>${activeCount?`${activeCount} scene${activeCount===1?'':'s'} need your work or attention.`:`${shots.length} assigned scene${shots.length===1?'':'s'} in your queue.`}</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="Studio.goto('shotTracker')">Open Studio Galeria →</button>
      </div>
      ${DB.animationShots===null?'<div class="empty">Loading your assigned scenes…</div>':shots.length?`
        <div class="role-dashboard-status-cards" aria-label="Tasks by status">
          ${groups.map(group=>`
            <div class="role-dashboard-status-card">
              <span><i style="--task-accent:${group.color}"></i>${group.label}</span>
              <strong>${group.items.length}</strong>
            </div>
          `).join('')}
        </div>
        ${activeCount===0?`
          <div class="role-dashboard-caught-up">
            <strong>You're all caught up</strong>
            <span>No scenes need action right now. We'll show new assignments and requested revisions here.</span>
          </div>
        `:''}
        ${visibleGroups.length?`<div class="role-dashboard-groups">
          ${visibleGroups.map(group=>`
            <section class="role-dashboard-group">
              <div class="role-dashboard-group-heading">
                <span><i style="--task-accent:${group.color}"></i>${group.label}</span>
              </div>
              ${group.items.map(shot=>`
                <article class="role-dashboard-shot">
                  <button type="button" class="role-dashboard-shot-main" onclick="Studio.goto('assetDetail','${esc(shot.asset_id)}')">
                    <span><strong>${esc(shot.title||'Untitled scene')}</strong><small>${esc(shot.project_name||'Assigned project')} · ${esc(shot.stage||'Blocking')}${shot.due_date?` · Due ${esc(fmtDate(shot.due_date))}`:''}</small></span>
                    <span class="badge ${STATUS_CLASS[shot.workflow_status]||'b-role'}">${esc(shot.workflow_status||'Not Started')}</span>
                  </button>
                  ${group.status==='Revision Required'&&shot.latest_feedback?`<p class="role-dashboard-feedback">“${esc(shot.latest_feedback)}”</p>`:''}
                  ${group.status==='In Progress'?`<div class="role-dashboard-progress"><span style="width:${Math.min(100,Math.max(0,Number(shot.progress)||0))}%"></span></div>`:''}
                </article>
              `).join('')}
            </section>
          `).join('')}
        </div>`:''}
      `:'<div class="empty">No animation scenes are assigned to you yet.</div>'}
    </section>
  `;
}

function pageEditorDashboard(){
  const library=editorDashboardData.library;
  const sequences=editorDashboardData.sequences;
  const needsEdit=sequences.filter(sequence=>!sequence.cut_asset_id||sequence.cut_status==='Revision Requested');
  const submitted=sequences.filter(sequence=>sequence.cut_asset_id&&sequence.cut_status!=='Revision Requested');
  const revisions=needsEdit.filter(sequence=>sequence.cut_status==='Revision Requested');
  const drafts=needsEdit.filter(sequence=>!sequence.cut_asset_id);
  const hasEditingTasks=revisions.length>0||drafts.length>0;
  const editorGroups=[
    {
      label:'CUTS TO REVISE',
      accent:'var(--violet)',
      items:revisions,
      empty:'No cuts need revisions.'
    },
    {
      label:'SEQUENCES TO BUILD',
      accent:'var(--gold)',
      items:drafts,
      empty:'No sequence drafts waiting to be built.'
    },
    {
      label:'APPROVED MEDIA READY',
      accent:'var(--cyan)',
      items:library,
      empty:'Approved animation and audio will appear here.'
    },
    {
      label:'SUBMITTED CUTS',
      accent:'var(--coral)',
      items:submitted,
      empty:'No final cuts submitted yet.'
    }
  ].filter(group=>group.items.length>0);
  const editorStatusCards=[
    {label:'TO BUILD',count:drafts.length,color:'var(--gold)'},
    {label:'REVISION REQUESTED',count:revisions.length,color:'var(--violet)'},
    {label:'APPROVED MEDIA',count:library.length,color:'var(--cyan)'},
    {label:'SUBMITTED CUTS',count:submitted.length,color:'var(--coral)'}
  ];
  return `
    <div class="section-title">Welcome back, ${esc(DB.currentUser.name.split(' ')[0])}</div>
    <div class="section-sub">Your edit queue, approved media, and submitted final cuts.</div>
    <section class="role-dashboard">
      <div class="role-dashboard-header">
        <div>
          <span class="eyebrow">EDITOR WORKSPACE</span>
          <h2>Tasks by Status</h2>
          <p>Build sequences from approved animation and audio, then submit or revise final cuts.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="Studio.goto('editorSequences')">Open Sequence Editor →</button>
      </div>
      ${editorDashboardData.error?`<div class="empty role-dashboard-error" role="alert">${esc(editorDashboardData.error)} <button type="button" class="btn btn-sm" onclick="loadEditorDashboardData()">Retry</button></div>`:''}
      ${editorDashboardData.loading?'<div class="empty">Loading your editing queue…</div>':editorDashboardData.loaded?`
        <div class="role-dashboard-status-cards role-dashboard-status-cards--editor" aria-label="Editing tasks by status">
          ${editorStatusCards.map(card=>`
            <div class="role-dashboard-status-card">
              <span><i style="--task-accent:${card.color}"></i>${card.label}</span>
              <strong>${card.count}</strong>
            </div>
          `).join('')}
        </div>
        ${!hasEditingTasks?`
          <div class="role-dashboard-caught-up">
            <strong>You're caught up on edits</strong>
            <span>New sequences and requested revisions will show up here when they need your attention.</span>
          </div>
        `:''}
        ${editorGroups.length?`<div class="role-dashboard-groups role-dashboard-editor-groups">
          ${editorGroups.map(group=>`
            <section class="role-dashboard-group">
              <div class="role-dashboard-group-heading"><span><i style="--task-accent:${group.accent}"></i>${group.label}</span></div>
              ${group.label==='CUTS TO REVISE'||group.label==='SEQUENCES TO BUILD'?group.items.map(sequence=>`
                <button type="button" class="role-dashboard-sequence" onclick="Studio.goto('editorSequences')">
                  <div><strong>${esc(sequence.title)}</strong><small>${esc(sequence.project_name)} · ${sequence.items?.length||0} approved item${sequence.items?.length===1?'':'s'}</small></div>
                  <span class="badge ${group.label==='CUTS TO REVISE'?'b-revision':'b-role'}">${group.label==='CUTS TO REVISE'?'Revision Requested':'Draft'}</span>
                </button>
              `).join(''):group.label==='APPROVED MEDIA READY'?group.items.slice(0,5).map(asset=>`
                <button type="button" class="role-dashboard-media" onclick="Studio.goto('assetDetail','${esc(asset.asset_id)}')">
                  <span><strong>${esc(asset.title)}</strong><small>${esc(projectById(asset.project_id)?.name||'Assigned project')} · ${esc(asset.type)}</small></span>
                  <span class="badge b-approved">${esc(asset.status)}</span>
                </button>
              `).join(''):group.items.map(sequence=>`
                <button type="button" class="role-dashboard-media" onclick="Studio.goto('assetDetail','${esc(sequence.cut_asset_id)}')">
                  <span><strong>${esc(sequence.cut_title||sequence.title)}</strong><small>${esc(sequence.project_name)} · ${esc(sequence.title)}</small></span>
                  <span class="badge ${STATUS_CLASS[sequence.cut_status]||'b-role'}">${esc(sequence.cut_status||'For Review')}</span>
                </button>
              `).join('')}
              ${group.label==='APPROVED MEDIA READY'&&group.items.length>5?`<button type="button" class="role-dashboard-link" onclick="Studio.goto('assets','Approved')">Browse all ${group.items.length} approved assets →</button>`:''}
            </section>
          `).join('')}
        </div>`:''}
      `:''}
    </section>
  `;
}

function pageDashboard(){
  if(DB.currentUser?.role==='animator')return pageAnimatorDashboard();
  if(DB.currentUser?.role==='editor')return pageEditorDashboard();

  const dashboardStats = getDashboardStats();

  /*
   * Same project list used by the Active card.
   * Completed/manual-finished projects are excluded here.
   */
  const dashboardProjects = getDashboardActiveProjects();

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
    <div class="section-title">Welcome back, ${esc(DB.currentUser.name.split(' ')[0])}</div>
    <div class="section-sub">
      Signed in as ${ROLE_LABELS[DB.currentUser.role]} · here's where production stands today.
    </div>

    <div class="stat-grid">
      ${stats.map(s=>`
        <div
          class="card stat dashboard-stat-card"
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
          ${
            dashboardProjects.length
              ? dashboardProjects.map(p=>{

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
                }).join('')
              : '<div class="empty">No active projects.</div>'
          }
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


document.addEventListener('DOMContentLoaded',async () => {
  await window.BEE_SERVER_READY;

  if(!DB.currentUser){
    window.location.assign('../login/login.html');
    return;
  }

  const url = new URL(window.location.href);
  if(url.searchParams.has('view')){
    url.searchParams.delete('view');
    url.searchParams.delete('asset');
    window.history.replaceState({}, '', url);
  }

  // Render the actual page after the separated HTML document loads.
  render();
  if(DB.currentUser?.role==='editor')loadEditorDashboardData();

});
