/* ---------------- Renderers ---------------- */
const NAV = [
  {key:'dashboard', label:'Dashboard', icon:'◧'},
  {key:'projects', label:'Projects', icon:'▤'},
  {key:'assets', label:'Assets', icon:'▥'},
  {key:'review', label:'Review Queue', icon:'✓', badgeFn:()=>DB.assets.filter(a=>['For Review','Revision Requested'].includes(latestVersion(a).status)).length},
  {key:'notifications', label:'Notifications', icon:'●', badgeFn:()=>DB.notifications.filter(n=>!n.read).length},
  {key:'integrations', label:'Integration Hub', icon:'⇄', perm:'runIntegrations'},
  {key:'resources', label:'Resources & Budget', icon:'$', perm:'manageResources'},
  {key:'audit', label:'Audit Log', icon:'≡', perm:'viewAudit'},
  {key:'users', label:'Team & Roles', icon:'☺', perm:'manageUsers'},
  {key:'architecture', label:'System Architecture', icon:'⌘'},
];

function renderSidebar(){
  document.getElementById('demoUsers').innerHTML = DB.users.slice(0,8).map(u=>
    '<button class="demo-card" onclick="Studio.quickLogin(\''+u.id+'\')"><b>'+esc(u.name)+'</b><span>'+ROLE_LABELS[u.role]+'</span></button>'
  ).join('');

  const list = NAV.filter(n=> !n.perm || can(n.perm));
  document.getElementById('navlist').innerHTML = list.map(n=>{
    const badge = n.badgeFn ? n.badgeFn() : 0;
    return '<div class="navitem'+(state.page===n.key||(state.page==='projectDetail'&&n.key==='projects')||(state.page==='assetDetail'&&n.key==='assets')?' active':'')+'" onclick="Studio.goto(\''+n.key+'\')">'+
      '<span class="ic">'+n.icon+'</span><span>'+n.label+'</span>'+
      (badge>0?'<span class="nb">'+badge+'</span>':'')+
      '</div>';
  }).join('');

  if(DB.currentUser){
    document.getElementById('sideAvatar').textContent = initials(DB.currentUser.name);
    document.getElementById('sideName').textContent = DB.currentUser.name;
    document.getElementById('sideRole').textContent = ROLE_LABELS[DB.currentUser.role];
  }
  const nav = list.find(n=>n.key===state.page) || {label:'Overview'};
  document.getElementById('topEyebrow').textContent = nav.key ? nav.key.toUpperCase() : state.page.toUpperCase();
  document.getElementById('topTitle').textContent = nav.label || 'Overview';
  document.getElementById('clockChip').textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}

function render(){
  if(!DB.currentUser) return;
  renderSidebar();
  const el = document.getElementById('pageContent');
  switch(state.page){
    case 'dashboard': el.innerHTML = pageDashboard(); break;
    case 'projects': el.innerHTML = pageProjects(); break;
    case 'projectDetail': el.innerHTML = pageProjectDetail(); break;
    case 'assets': el.innerHTML = pageAssets(); break;
    case 'assetDetail': el.innerHTML = pageAssetDetail(); break;
    case 'review': el.innerHTML = pageReview(); break;
    case 'notifications': el.innerHTML = pageNotifications(); break;
    case 'integrations': el.innerHTML = pageIntegrations(); break;
    case 'resources': el.innerHTML = pageResources(); break;
    case 'audit': el.innerHTML = pageAudit(); break;
    case 'users': el.innerHTML = pageUsers(); break;
    case 'architecture': el.innerHTML = pageArchitecture(); break;
    default: el.innerHTML = pageDashboard();
  }
}

/* ---- Dashboard ---- */
function pageDashboard(){
  const totalProjects = DB.projects.length;
  const allV = DB.assets.map(a=>({a, v:latestVersion(a)}));
  const pending = allV.filter(x=>['For Review','Revision Requested'].includes(x.v.status)).length;
  const approved = allV.filter(x=>x.v.status==='Approved'||x.v.status==='Final').length;
  const rejected = allV.filter(x=>x.v.status==='Rejected').length;
  const overdue = DB.projects.filter(p=> new Date(p.deadline) < new Date('2026-08-29') && projectProgress(p.id)<100).length;

  const stats = [
    {n:totalProjects, l:'Active Projects', c:'var(--amber)'},
    {n:pending, l:'Pending Review', c:'var(--violet)'},
    {n:approved, l:'Approved Assets', c:'var(--teal)'},
    {n:rejected, l:'Rejected Outputs', c:'var(--red)'},
    {n:overdue, l:'Overdue Deadlines', c:'var(--red)'},
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

/* ---- Projects list ---- */
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

/* ---- Project detail ---- */
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
      ${can('submitAssets') ? `<button class="btn btn-primary btn-sm" onclick="Studio.goto('assets');Studio.toggleForm('newAssetForm');document.getElementById('saProject').value='${p.id}';">+ Submit asset</button>`:''}
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

/* ---- Assets list + submission ---- */
function pageAssets(){
  const f = state.filter;
  let list = DB.assets.slice();
  if(f.project!=='all') list = list.filter(a=>a.project===f.project);
  if(f.type!=='all') list = list.filter(a=>a.type===f.type);
  if(f.status!=='all') list = list.filter(a=>latestVersion(a).status===f.status);
  if(f.q) list = list.filter(a=>a.title.toLowerCase().includes(f.q.toLowerCase()));

  const types = Object.keys(TYPE_META);
  const statuses = ['For Review','Approved','Rejected','Revision Requested','Final'];

  return `
    <div class="panel-head">
      <div><div class="section-title">Assets</div><div class="section-sub">Storyboards, animatics, character sheets, backgrounds, scenes and renders — with full version history.</div></div>
      ${can('submitAssets') ? `<button class="btn btn-primary" onclick="Studio.toggleForm('newAssetForm')">+ Submit asset</button>` : ''}
    </div>

    ${can('submitAssets') ? `
    <div id="newAssetForm" class="card hidden" style="padding:20px;margin-top:6px;">
      <h3 style="margin-top:0;font-size:15px;">Submit an asset</h3>
      <div class="field-row">
        <div class="field"><label>Project</label>
          <select id="saProject">${DB.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>This is</label>
          <select id="saExisting" onchange="Studio.onSaExistingChange()">
            <option value="new">A new asset</option>
            ${DB.assets.map(a=>`<option value="${a.id}">New version of: ${esc(a.title)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="saNewFields">
        <div class="field-row">
          <div class="field"><label>Title</label><input id="saTitle" placeholder="e.g. Scene 14 — Alley Confrontation Storyboard"></div>
          <div class="field"><label>Asset type</label>
            <select id="saType">${types.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
          </div>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>External storage link (optional)</label><input id="saLink" placeholder="drive:// or dropbox:// link"></div>
        <div class="field"><label>Attach file (simulated)</label><input id="saFile" type="file"></div>
      </div>
      <div class="field"><label>Notes for reviewers</label><textarea id="saNotes" placeholder="What changed, what to check..."></textarea></div>
      <button class="btn btn-primary" onclick="Studio.submitAsset()">Submit — sets status to “For Review”</button>
      <span style="font-size:11.5px;color:var(--text-faint);margin-left:10px;">Workflow automation will move this asset into the review queue automatically.</span>
    </div>` : ''}

    <div class="toolbar">
      <select onchange="Studio.setFilter('project',this.value)">
        <option value="all">All projects</option>
        ${DB.projects.map(p=>`<option value="${p.id}" ${f.project===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <select onchange="Studio.setFilter('type',this.value)">
        <option value="all">All types</option>
        ${types.map(t=>`<option value="${t}" ${f.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <select onchange="Studio.setFilter('status',this.value)">
        <option value="all">All statuses</option>
        ${statuses.map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <input placeholder="Search title…" value="${esc(f.q)}" oninput="Studio.setFilter('q',this.value)">
    </div>

    <div class="card">
      ${list.length? list.map(a=>{
        const v = latestVersion(a);
        const meta = TYPE_META[a.type];
        const proj = projectById(a.project);
        return `<div class="list-row" style="cursor:pointer;" onclick="Studio.goto('assetDetail','${a.id}')">
          <div class="type-tag" style="background:${meta.color}22;color:${meta.color};">${meta.tag}</div>
          <div style="flex:1;">
            <div class="row-title">${esc(a.title)}</div>
            <div class="row-sub">${proj?esc(proj.name):''} · ${a.versions.length} version(s) · updated ${fmtDate(v.date)}</div>
          </div>
          <span class="vtag">v${String(v.n).padStart(2,'0')}</span>
          <span class="badge ${STATUS_CLASS[v.status]}">${v.status}</span>
        </div>`;
      }).join('') : `<div class="empty">No assets match these filters.</div>`}
    </div>
  `;
}

/* ---- Asset detail ---- */
function pageAssetDetail(){
  const a = assetById(state.selectedAssetId);
  if(!a) return `<div class="empty">Asset not found.</div>`;
  const proj = projectById(a.project);
  const meta = TYPE_META[a.type];
  const v = latestVersion(a);
  const comments = DB.comments.filter(c=>c.asset===a.id);
  const canReviewNow = can('review') && ['For Review','Revision Requested'].includes(v.status);
  const isRender = a.type==='Render';

  return `
    <button class="btn btn-ghost btn-sm" onclick="Studio.goto('assets')">← All assets</button>
    <div class="card" style="padding:22px;margin-top:14px;">
      <div style="display:flex;gap:14px;align-items:flex-start;">
        <div class="type-tag" style="background:${meta.color}22;color:${meta.color};width:46px;height:46px;font-size:13px;">${meta.tag}</div>
        <div style="flex:1;">
          <div class="eyebrow">${esc(proj?proj.name:'')}</div>
          <h2 style="margin:2px 0 6px;font-family:var(--font-display);font-size:26px;letter-spacing:.02em;">${esc(a.title)}</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span class="chip">${a.type}</span>
            <span class="badge ${STATUS_CLASS[v.status]}">${v.status}</span>
            ${a.link? `<span class="chip" title="External storage link">🔗 ${esc(a.link)}</span>`:''}
          </div>
        </div>
        ${can('submitAssets') ? `<button class="btn btn-sm" onclick="Studio.goto('assets');Studio.toggleForm('newAssetForm');document.getElementById('saExisting').value='${a.id}';Studio.onSaExistingChange();">+ New version</button>`:''}
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px;">
      <div>
        <h3 style="font-size:15px;">Version history</h3>
        ${a.versions.slice().reverse().map(ver=>{
          const author = userById(ver.by);
          return `<div class="version-item ${ver.id===v.id?'latest':''}">
            <div class="vh-top">
              <span class="vtag">v${String(ver.n).padStart(2,'0')}</span>
              <span class="badge ${STATUS_CLASS[ver.status]}">${ver.status}</span>
              <span style="font-size:12px;color:var(--text-faint);margin-left:auto;">${fmtDate(ver.date)}</span>
            </div>
            <div style="font-size:13px;margin-top:8px;color:var(--text-dim);">${esc(ver.notes||'—')}</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:6px;" class="mono">Submitted by ${author?esc(author.name):'—'}</div>
          </div>`;
        }).join('')}

        ${canReviewNow ? `
        <div class="card" style="padding:18px;margin-top:6px;">
          <h3 style="margin-top:0;font-size:14px;">Review v${String(v.n).padStart(2,'0')}</h3>
          <div class="field"><label>Comment (optional)</label><textarea id="reviewComment" placeholder="Leave feedback for the team..."></textarea></div>
          ${isRender ? `<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">
            <input type="checkbox" id="markFinal"> Mark as Final Output on approval
          </label>` : '<input type="hidden" id="markFinal">'}
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-teal" onclick="Studio.reviewAsset('${a.id}','approve')">✓ Approve</button>
            <button class="btn" style="border-color:var(--violet);color:var(--violet);" onclick="Studio.reviewAsset('${a.id}','revise')">↺ Request revision</button>
            <button class="btn btn-danger" onclick="Studio.reviewAsset('${a.id}','reject')">✕ Reject</button>
          </div>
        </div>` : ''}
      </div>

      <div>
        <h3 style="font-size:15px;">Comments &amp; feedback</h3>
        <div class="card" style="padding:16px 18px;">
          ${comments.length? comments.map(c=>{
            const u = userById(c.by);
            return `<div class="comment">
              <div class="avatar" style="width:30px;height:30px;font-size:11px;">${initials(u?u.name:'?')}</div>
              <div class="body">
                <div class="meta"><b>${u?esc(u.name):'Unknown'}</b><span>${u?ROLE_LABELS[u.role]:''}</span><span>${fmtDate(c.date)}</span></div>
                <div class="txt">${esc(c.text)}</div>
              </div>
            </div>`;
          }).join('') : `<div class="empty">No feedback yet. Notes from reviewers and clients will show up here.</div>`}
          ${can('comment') ? `
          <div class="divider"></div>
          <div class="field"><textarea id="newComment" placeholder="Add a comment..."></textarea></div>
          <button class="btn btn-sm" onclick="Studio.addComment('${a.id}')">Add comment</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

/* ---- Review queue ---- */
function pageReview(){
  const items = DB.assets.filter(a=>['For Review','Revision Requested'].includes(latestVersion(a).status));
  return `
    <div class="section-title">Review queue</div>
    <div class="section-sub">Everything waiting on a decision, newest first.</div>
    <div class="card" style="margin-top:16px;">
      ${items.length? items.map(a=>{
        const v = latestVersion(a);
        const proj = projectById(a.project);
        const meta = TYPE_META[a.type];
        return `<div class="list-row">
          <div class="type-tag" style="background:${meta.color}22;color:${meta.color};">${meta.tag}</div>
          <div style="flex:1;cursor:pointer;" onclick="Studio.goto('assetDetail','${a.id}')">
            <div class="row-title">${esc(a.title)}</div>
            <div class="row-sub">${proj?esc(proj.name):''} · v${String(v.n).padStart(2,'0')} · submitted ${fmtDate(v.date)}</div>
          </div>
          <span class="badge ${STATUS_CLASS[v.status]}">${v.status}</span>
          ${can('review') ? `<button class="btn btn-teal btn-sm" onclick="Studio.quickApprove('${a.id}')">Quick approve</button>
          <button class="btn btn-ghost btn-sm" onclick="Studio.goto('assetDetail','${a.id}')">Review →</button>` : `<button class="btn btn-ghost btn-sm" onclick="Studio.goto('assetDetail','${a.id}')">Open →</button>`}
        </div>`;
      }).join('') : `<div class="empty">Nothing pending. The queue is clear.</div>`}
    </div>
  `;
}

/* ---- Notifications ---- */
const NOTIF_ICON = {submission:'▲', revision:'↺', deadline:'◷', approval:'✓', completed:'●'};
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
          <div class="type-tag" style="background:var(--panel-3);color:var(--amber);font-size:14px;">${NOTIF_ICON[n.type]||'●'}</div>
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

/* ---- Integration hub ---- */
function pageIntegrations(){
  const sampleCSV = `title,project,type,assignee,duedate
"Scene 21 - Market Chase Storyboard",Skybound,Storyboard,Leo Cruz,2026-09-10
"Bridge Establishing BG",Skybound,Background Asset,Ava Domingo,2026-09-12
"Hero Pose Turnaround",Nightfall,Character Sheet,Leo Cruz,2026-10-01`;
  return `
    <div class="section-title">Integration hub</div>
    <div class="section-sub" style="max-width:720px;">This is where ATLAS talks to the rest of the studio's systems: production data goes out through an API, spreadsheet handoffs come in through ETL, and every upload or approval fires an event other tools can react to.</div>

    <div class="grid-2" style="margin-top:22px;">
      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">API integration — Production Dashboard</h3>
        <div class="section-sub" style="margin-bottom:14px;">Send the latest version of an asset to the studio's external production dashboard.</div>
        <div class="field-row">
          <div class="field" style="grid-column:1/3;"><label>Asset</label>
            <select id="apiAssetSelect">${DB.assets.map(a=>`<option value="${a.id}">${esc(a.title)}</option>`).join('')}</select>
          </div>
        </div>
        ${can('runIntegrations') ? `<button class="btn btn-primary btn-sm" onclick="Studio.apiSend()">POST → Send to Dashboard API</button>` : `<div class="empty">Your role can view this log but not trigger a sync.</div>`}
        <div class="divider"></div>
        <div class="console">
          ${DB.apiLogs.slice().reverse().map(l=>`
            <div class="log-line">
              <span class="t">${fmtDateTime(l.date)}</span>
              <span style="color:${l.dir==='REQUEST'?'var(--amber)':'var(--teal)'};font-weight:700;">${l.dir}${l.status?(' '+l.status):''}</span>
              <span style="color:var(--text-faint);">${l.method} ${l.endpoint}</span>
              <span style="color:var(--text-dim);">${esc(l.body)}</span>
            </div>
          `).join('') || '<div class="empty">No API calls yet.</div>'}
        </div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">ETL integration — bulk import</h3>
        <div class="section-sub" style="margin-bottom:14px;">Paste a CSV of tasks or assets. ATLAS extracts the rows, validates and transforms them, then loads them as new assets.</div>
        <div class="field"><textarea id="etlInput" style="min-height:120px;font-family:var(--font-mono);font-size:12px;">${sampleCSV}</textarea></div>
        ${can('runIntegrations') ? `<button class="btn btn-primary btn-sm" onclick="Studio.runETL()">Run ETL import</button>` : `<div class="empty">Your role can't run imports.</div>`}
        <div class="divider"></div>
        <div id="etlLog" class="console"></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px;">
      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">Event stream — messaging simulation</h3>
        <div class="section-sub" style="margin-bottom:10px;">Every upload, approval, rejection and revision publishes an event that other services could subscribe to.</div>
        <div class="console">
          ${DB.events.slice(0,12).map(e=>`
            <div class="log-line">
              <span class="t">${fmtDateTime(e.date)}</span>
              <span style="color:var(--amber);font-weight:700;">${esc(e.name)}</span>
              <span style="color:var(--text-faint);">${esc(JSON.stringify(e.payload))}</span>
            </div>
          `).join('') || '<div class="empty">No events yet.</div>'}
        </div>
      </div>
      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">Webhook log — approval triggers</h3>
        <div class="section-sub" style="margin-bottom:10px;">Fires whenever a reviewer approves an asset, notifying the production dashboard endpoint.</div>
        <div class="console">
          ${DB.webhooks.slice().reverse().map(w=>`
            <div class="log-line">
              <span class="t">${fmtDateTime(w.date)}</span>
              <span style="color:var(--teal);font-weight:700;">${w.status} OK</span>
              <span style="color:var(--text-faint);">${esc(w.endpoint)}</span>
            </div>
          `).join('') || '<div class="empty">No webhook calls yet — approve an asset to trigger one.</div>'}
        </div>
      </div>
    </div>

    <div class="card" style="padding:20px;margin-top:20px;">
      <h3 style="margin-top:0;font-size:15px;">External storage links registered</h3>
      <table>
        <thead><tr><th>Asset</th><th>Project</th><th>Link</th></tr></thead>
        <tbody>
          ${DB.assets.filter(a=>a.link).map(a=>`<tr><td>${esc(a.title)}</td><td>${esc(projectById(a.project).name)}</td><td class="mono">${esc(a.link)}</td></tr>`).join('') || '<tr><td colspan="3" style="color:var(--text-faint);">None registered yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

/* ---- Resources / ERP ---- */
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
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${pct>90?'var(--red)':'linear-gradient(90deg,var(--amber),var(--teal))'};"></div></div>
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

/* ---- Audit log ---- */
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

/* ---- Users ---- */
function pageUsers(){
  return `
    <div class="section-title">Team &amp; roles</div>
    <div class="section-sub">Add teammates and set what they can do — role controls what shows up in their studio.</div>

    <div class="card" style="padding:20px;margin-top:16px;">
      <h3 style="margin-top:0;font-size:15px;">Add team member</h3>
      <div class="field-row">
        <div class="field"><label>Name</label><input id="umName" placeholder="e.g. Sam Rivera"></div>
        <div class="field"><label>Role</label>
          <select id="umRole">${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="Studio.addUser()">Add to team</button>
    </div>

    <div class="card" style="margin-top:18px;">
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Change role</th></tr></thead>
        <tbody>
          ${DB.users.map(u=>`<tr>
            <td style="display:flex;align-items:center;gap:9px;padding-top:10px;"><div class="avatar" style="width:26px;height:26px;font-size:10.5px;">${initials(u.name)}</div>${esc(u.name)}</td>
            <td><span class="badge b-role">${ROLE_LABELS[u.role]}</span></td>
            <td>
              <select onchange="Studio.changeRole('${u.id}', this.value)">
                ${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---- Architecture / documentation ---- */
function pageArchitecture(){
  return `
    <div class="section-title">System architecture</div>
    <div class="section-sub">How ATLAS is put together, and why — for the project write-up.</div>

    <div class="card" style="padding:22px;margin-top:16px;">
      <h3 style="margin-top:0;">Architecture style: Layered Architecture</h3>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">ATLAS is organized in three layers. The <b>presentation layer</b> is this interface — navigation, forms, and views that render the current state. The <b>business logic layer</b> is the <span class="mono">Studio</span> object: it owns the rules for submissions, review decisions, workflow automation, and integrations, and it's the only place those rules live. The <b>data layer</b> is the in-memory <span class="mono">DB</span> store that stands in for a production database (projects, assets, versions, comments, notifications, audit log, events).</p>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">This separation was chosen because the studio's real need is clear ownership of rules — status changes, approvals, and permissions must behave the same way everywhere they're triggered from. Keeping logic out of the view layer means the dashboard, review queue, and asset detail page all call the same approval function instead of duplicating the rule.</p>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">Integration pattern: Event-Driven, with API and ETL support</h3>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">Production work is naturally a sequence of triggers — a file is uploaded, a reviewer decides, a client signs off. <b>Event-driven integration</b> fits that shape directly: actions publish events (Asset Uploaded, Revision Requested, Final Output Approved) that other parts of the system, or other systems entirely, can react to without being hard-wired to the module that raised them. That's why it's the primary pattern here, backed by the Event Stream panel in the Integration Hub.</p>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">It's supplemented by a lightweight <b>hub-and-spoke</b> shape for outbound sync: the API integration sends approved-asset data to one external endpoint (the Production Dashboard) rather than every module talking to every other module directly.</p>
      <table class="arch-table" style="margin-top:14px;">
        <thead><tr><th>Pattern</th><th>How it fits here</th><th>Trade-off</th></tr></thead>
        <tbody>
          <tr><td>Point-to-point</td><td>Not used as the primary pattern</td><td>Simple for one connection, but each new module means another direct wire — doesn't scale past a couple of systems</td></tr>
          <tr><td>Hub-and-spoke</td><td>Used for the API sync to the Production Dashboard</td><td>Centralizes traffic through one integration point; the hub becomes a dependency</td></tr>
          <tr><td>Shared database</td><td>Not used</td><td>Simple, but ownership of data gets blurry once more than one system writes to it</td></tr>
          <tr><td>Event-driven</td><td>Primary pattern — every upload/approval/rejection publishes an event</td><td>Decoupled and matches how production actually flows; needs an event log to stay auditable, which the Event Stream and Audit Log provide</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="padding:22px;margin-top:18px;">
      <h3 style="margin-top:0;">Integration requirement — implemented in this build</h3>
      <table class="arch-table">
        <tbody>
          <tr><td style="width:220px;"><span class="check">✓</span> API Integration</td><td>Asset submission → Production Dashboard API (Integration Hub → API console)</td></tr>
          <tr><td><span class="check">✓</span> ETL Integration</td><td>CSV of tasks/assets → cleaned, transformed, and loaded as assets (Integration Hub → ETL import)</td></tr>
          <tr><td><span class="check">✓</span> Workflow Automation</td><td>Every upload auto-sets status to "For Review" with no manual step</td></tr>
          <tr><td><span class="check">✓</span> Webhook Simulation</td><td>Every approval fires a webhook entry to an external "hooks" endpoint</td></tr>
          <tr><td><span class="check">✓</span> Messaging Simulation</td><td>Event Stream publishes Asset Uploaded / Revision Requested / Final Output Approved, etc.</td></tr>
          <tr><td><span class="check">✓</span> External Storage Integration</td><td>Assets can carry a Drive/Dropbox/local link, listed in the Integration Hub</td></tr>
          <tr><td><span class="check">✓</span> ERP / Resource Integration</td><td>Resources &amp; Budget module ties labor, equipment, and cost to each project</td></tr>
        </tbody>
      </table>
      <p style="color:var(--text-faint);font-size:12px;margin-top:14px;">Note for grading/demo: data lives in memory for this browser session so the prototype runs anywhere with no server or database setup — refreshing the page resets it back to the seeded demo data.</p>
    </div>
  `;
}
