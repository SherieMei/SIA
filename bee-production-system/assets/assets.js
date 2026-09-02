/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Assets (list + submission form) + Asset Detail
   ========================================================================== */
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
            <button class="btn btn-cyan" onclick="Studio.reviewAsset('${a.id}','approve')">✓ Approve</button>
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
