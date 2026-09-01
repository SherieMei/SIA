/* ==========================================================================
   PAGE — Projects (list) + Project Detail
   ========================================================================== */
function pageProjects(){
  return `
    <div class="panel-head">
      <div><div class="section-title">Projects</div><div class="section-sub">Every production and campaign currently on the board.</div></div>
      ${can('manageProjects') ? `<button class="btn btn-primary" onclick="Studio.toggleForm('newProjectForm')">+ Create project</button>` : ''}
    </div>
    ${can('manageProjects') ? `
    <div id="newProjectForm" class="card hidden" style="padding:20px;margin-top:14px;">
      <h3 style="margin-top:0;font-size:15px;">New project</h3>
      <div class="field-row">
        <div class="field"><label>Project name</label><input id="npName" placeholder="e.g. Skybound Chronicles — Ep. 5"></div>
        <div class="field"><label>Client</label><input id="npClient" placeholder="e.g. Meridian Animation Network"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Deadline</label><input id="npDeadline" type="date" value="2026-12-01"></div>
        <div class="field"><label>Budget (USD)</label><input id="npBudget" type="number" placeholder="30000"></div>
      </div>
      <button class="btn btn-primary" onclick="Studio.createProject()">Create project</button>
    </div>` : ''}
    <div class="proj-grid">
      ${DB.projects.map(p=>{
        const pct = projectProgress(p.id);
        const assetCount = DB.assets.filter(a=>a.project===p.id).length;
        return `<div class="card proj-card" onclick="Studio.goto('projectDetail','${p.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <h3>${esc(p.name)}</h3>
            <span class="chip">${esc(p.status)}</span>
          </div>
          <div class="client">${esc(p.client)}</div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="proj-meta"><span>${assetCount} asset(s)</span><span>Due ${fmtDate(p.deadline)}</span></div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function pageProjectDetail(){
  const p = projectById(state.selectedProjectId);
  if(!p) return `<div class="empty">Project not found.</div>`;
  const assets = DB.assets.filter(a=>a.project===p.id);
  const pct = projectProgress(p.id);
  const pm = userById(p.pm);
  return `
    <button class="btn btn-ghost btn-sm" onclick="Studio.goto('projects')">← All projects</button>
    <div class="card" style="margin-top:14px;overflow:hidden;">
      <div class="slate-top" style="padding:20px 24px;">
        <h1 style="font-size:30px;">${esc(p.name)}</h1>
        <div class="tag">${esc(p.client)}</div>
      </div>
      <div style="padding:20px 24px;">
        <div class="slate-fields" style="grid-template-columns:repeat(4,1fr);">
          <div><b>Status</b>${esc(p.status)}</div>
          <div><b>Deadline</b>${fmtDate(p.deadline)}</div>
          <div><b>Producer</b>${pm?esc(pm.name):'—'}</div>
          <div><b>Budget</b>$${p.budget.toLocaleString()}</div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div style="font-size:11.5px;color:var(--text-faint);margin-top:6px;" class="mono">${pct}% of assets approved or final</div>
      </div>
    </div>

    <div class="panel-head" style="margin-top:24px;">
      <h3 style="margin:0;font-size:16px;">Assets &amp; scenes</h3>
      ${can('submitAssets') ? `<button class="btn btn-primary btn-sm" onclick="Studio.goto('assets','project:${p.id}');">+ Submit asset</button>`:''}
    </div>
    <div class="card" style="margin-top:10px;">
      ${assets.length? assets.map(a=>{
        const v = latestVersion(a);
        const meta = TYPE_META[a.type];
        return `<div class="list-row" style="cursor:pointer;" onclick="Studio.goto('assetDetail','${a.id}')">
          <div class="type-tag" style="background:${meta.color}22;color:${meta.color};">${meta.tag}</div>
          <div style="flex:1;">
            <div class="row-title">${esc(a.title)}</div>
            <div class="row-sub">${a.type} · ${a.versions.length} version(s) · updated ${fmtDate(v.date)}</div>
          </div>
          <span class="vtag">v${String(v.n).padStart(2,'0')}</span>
          <span class="badge ${STATUS_CLASS[v.status]}">${v.status}</span>
        </div>`;
      }).join('') : `<div class="empty">No assets yet. Submit the first storyboard, animatic, or render to get this scene moving.</div>`}
    </div>

    <div class="panel-head" style="margin-top:24px;">
      <h3 style="margin:0;font-size:16px;">Team</h3>
    </div>
    <div class="pill-row">
      ${p.team.map(uid=>{ const u=userById(uid); return u? `<span class="chip">${esc(u.name)} · ${ROLE_LABELS[u.role]}</span>`:''; }).join('')}
    </div>
  `;
}
