/* ==========================================================================
   BEE PRODUCTION — Assets Module Controller & Page Renderer
   ========================================================================== */

// 1. Session & DB Rehydration Check
window.DB = window.DB || {};

// Load actual projects from localStorage
try {
  const storedProjects = localStorage.getItem('beeProjects') || localStorage.getItem('projects');
  if (storedProjects) {
    window.DB.projects = JSON.parse(storedProjects);
  }
} catch (e) {
  console.warn('Unable to load projects from localStorage:', e);
}

// Fallback if localStorage has no projects yet
if (!Array.isArray(window.DB.projects) || window.DB.projects.length === 0) {
  window.DB.projects = [
    { id: 'p1', name: 'anton' },
    { id: 'p2', name: 'zyka' },
    { id: 'p3', name: 'sherie' }
  ];
}

// Seed fallback assets data if DB.assets is empty
if (!Array.isArray(window.DB.assets)) {
  window.DB.assets = [];
}
if (!window.DB.currentUser) {
  try {
    const storedUser = localStorage.getItem('beeCurrentUser') || localStorage.getItem('currentUser');
    if (storedUser) {
      window.DB.currentUser = JSON.parse(storedUser);
    } else {
      // Default fallback user session to avoid login redirect loop during local testing
      window.DB.currentUser = { id: 'u1', name: 'Jordan Reyes', role: 'admin' };
    }
  } catch (e) {
    console.warn('Unable to rehydrate user session:', e);
  }
}

// Global permission helper fallback
if (typeof window.can !== 'function') {
  window.can = function() { return true; };
}

// Global runtime fallbacks
window.state = window.state || { page: 'assets', selectedAssetId: null, filter: { project: 'all', type: 'all', status: 'all', q: '' } };

if (typeof window.esc !== 'function') {
  window.esc = str => (str === null || str === undefined) ? '' : String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

if (typeof window.initials !== 'function') {
  window.initials = name => !name ? '?' : name.split(' ').map(p => p[0]).join('').toUpperCase().substring(0, 2);
}

if (typeof window.fmtDate !== 'function') {
  window.fmtDate = d => d || '—';
}

/* ==========================================================================
   STUDIO CONTROLLER METHODS
   ========================================================================== */
window.Studio = window.Studio || {
  toggleForm: function(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.classList.toggle('hidden');
    }
  },

  onSaExistingChange: function() {
    const select = document.getElementById('saExisting');
    const newFields = document.getElementById('saNewFields');
    if (select && newFields) {
      if (select.value === 'new') {
        newFields.style.display = 'block';
      } else {
        newFields.style.display = 'none';
      }
    }
  },

  submitAsset: async function() {
    const projId = document.getElementById('saProject')?.value;
    const existing = document.getElementById('saExisting')?.value;
    const title = document.getElementById('saTitle')?.value;
    const type = document.getElementById('saType')?.value;
    const link = document.getElementById('saLink')?.value;
    const notes = document.getElementById('saNotes')?.value;

    if (existing === 'new' && !title) {
      alert('Please enter an asset title.');
      return;
    }

    const payload = {
      action: 'submit',
      projectId: projId,
      existingAssetId: existing,
      title: title,
      type: type,
      link: link,
      notes: notes
    };

    try {
      const response = await fetch('../api/assets.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && (data.success || data.ok)) {
        Studio.toggleForm('newAssetForm');
        if (typeof render === 'function') render();
        else location.reload();
      } else {
        alert('Failed to save asset: ' + (data.message || data.error || 'Server error'));
      }
    } catch (err) {
      console.error('API Error:', err);
      alert('Failed to connect to ../api/assets.php');
    }
  },

  setFilter: function(key, val) {
    window.state.filter = window.state.filter || {};
    window.state.filter[key] = val;
    render();
  },

  goto: function(page, id) {
    window.state.page = page;
    if (id) {
      window.state.selectedAssetId = id;
    }
    render();
  },

  reviewAsset: function(assetId, action) {
    const asset = (window.DB.assets || []).find(a => String(a.id) === String(assetId));
    if (!asset || !asset.versions || asset.versions.length === 0) return;

    const latest = asset.versions[asset.versions.length - 1];
    const commentText = document.getElementById('reviewComment')?.value;
    const markFinal = document.getElementById('markFinal')?.checked;

    if (action === 'approve') {
      latest.status = markFinal ? 'Final' : 'Approved';
    } else if (action === 'revise') {
      latest.status = 'Revision Requested';
    } else if (action === 'reject') {
      latest.status = 'Rejected';
    }

    if (commentText && commentText.trim() !== '') {
      window.DB.comments = window.DB.comments || [];
      window.DB.comments.push({
        id: 'c_' + Date.now(),
        asset: assetId,
        by: window.DB.currentUser?.id || 'u1',
        text: commentText,
        date: new Date().toISOString().split('T')[0]
      });
    }

    render();
  },

  addComment: function(assetId) {
    const input = document.getElementById('newComment');
    if (!input || !input.value.trim()) return;

    window.DB.comments = window.DB.comments || [];
    window.DB.comments.push({
      id: 'c_' + Date.now(),
      asset: assetId,
      by: window.DB.currentUser?.id || 'u1',
      text: input.value.trim(),
      date: new Date().toISOString().split('T')[0]
    });

    render();
  }
};

/* ==========================================================================
   PAGE — Assets List + Detail Views
   ========================================================================== */
function pageAssets() {
  const f = window.state.filter || { project: 'all', type: 'all', status: 'all', q: '' };
  let list = Array.isArray(window.DB?.assets) ? window.DB.assets.slice() : [];

  if (f.project && f.project !== 'all') {
    list = list.filter(a => String(a.project || a.projectId) === String(f.project));
  }
  if (f.type && f.type !== 'all') {
    list = list.filter(a => a.type === f.type);
  }
  if (f.status && f.status !== 'all') {
    list = list.filter(a => {
      const v = typeof latestVersion === 'function' ? latestVersion(a) : (a.versions && a.versions[a.versions.length - 1]);
      return v && v.status === f.status;
    });
  }
  if (f.q && f.q.trim() !== '') {
    const q = f.q.toLowerCase().trim();
    list = list.filter(a => a.title && a.title.toLowerCase().includes(q));
  }

  const types = typeof TYPE_META !== 'undefined' ? Object.keys(TYPE_META) : ['Storyboard', 'Animatic', 'Character Sheet', 'Background Asset', 'Animation Scene', 'Render', 'Audio', 'Design Draft'];
  const statuses = ['For Review', 'Approved', 'Rejected', 'Revision Requested', 'Final'];

  return `
    <div class="panel-head">
      <div>
        <div class="section-title">Assets</div>
        <div class="section-sub">Storyboards, animatics, character sheets, backgrounds, scenes and renders — with full version history.</div>
      </div>
      ${typeof can === 'function' && can('submitAssets') ? `<button class="btn btn-primary" onclick="Studio.toggleForm('newAssetForm')">+ Submit asset</button>` : ''}
    </div>

    ${typeof can === 'function' && can('submitAssets') ? `
    <div id="newAssetForm" class="card hidden" style="padding:20px;margin-top:6px;">
      <h3 style="margin-top:0;font-size:15px;">Submit an asset</h3>
      <div class="field-row">
        <div class="field"><label>Project</label>
          <select id="saProject">${(window.DB.projects || []).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>This is</label>
          <select id="saExisting" onchange="Studio.onSaExistingChange()">
            <option value="new">A new asset</option>
            ${(window.DB.assets || []).map(a => `<option value="${a.id}">New version of: ${esc(a.title)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="saNewFields">
        <div class="field-row">
          <div class="field"><label>Title</label><input id="saTitle" placeholder="e.g. Scene 14 — Alley Confrontation Storyboard"></div>
          <div class="field"><label>Asset type</label>
            <select id="saType">${types.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
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
        ${(window.DB.projects || []).map(p => `<option value="${p.id}" ${f.project === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
      <select onchange="Studio.setFilter('type',this.value)">
        <option value="all">All types</option>
        ${types.map(t => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <select onchange="Studio.setFilter('status',this.value)">
        <option value="all">All statuses</option>
        ${statuses.map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <input placeholder="Search title…" value="${esc(f.q || '')}" oninput="Studio.setFilter('q',this.value)">
    </div>

    <div class="card">
      ${list.length ? list.map(a => {
        const v = typeof latestVersion === 'function' ? latestVersion(a) : (a.versions && a.versions[a.versions.length - 1]) || { n: 1, date: '', status: 'For Review' };
        const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[a.type]) ? TYPE_META[a.type] : { tag: 'AS', color: '#6b7280' };
        const proj = typeof projectById === 'function' ? projectById(a.project || a.projectId) : (window.DB.projects || []).find(p => String(p.id) === String(a.project || a.projectId));
        const statusClass = (typeof STATUS_CLASS !== 'undefined' && STATUS_CLASS[v.status]) ? STATUS_CLASS[v.status] : 'b-review';

        return `<div class="list-row" style="cursor:pointer;" onclick="Studio.goto('assetDetail','${a.id}')">
          <div class="type-tag" style="background:${meta.color}22;color:${meta.color};">${meta.tag}</div>
          <div style="flex:1;">
            <div class="row-title">${esc(a.title)}</div>
            <div class="row-sub">${proj ? esc(proj.name) : 'Unassigned'} · ${(a.versions || []).length} version(s) · updated ${fmtDate(v.date)}</div>
          </div>
          <span class="vtag">v${String(v.n || 1).padStart(2, '0')}</span>
          <span class="badge ${statusClass}">${v.status || 'For Review'}</span>
        </div>`;
      }).join('') : `<div class="empty">No assets match these filters.</div>`}
    </div>
  `;
}

function pageAssetDetail() {
  const selectedId = window.state.selectedAssetId;
  const a = typeof assetById === 'function' ? assetById(selectedId) : (window.DB.assets || []).find(item => String(item.id) === String(selectedId));
  if (!a) return `<div class="empty">Asset not found.</div>`;

  const proj = typeof projectById === 'function' ? projectById(a.project || a.projectId) : (window.DB.projects || []).find(p => String(p.id) === String(a.project || a.projectId));
  const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[a.type]) ? TYPE_META[a.type] : { tag: 'AS', color: '#6b7280' };
  const v = typeof latestVersion === 'function' ? latestVersion(a) : (a.versions && a.versions[a.versions.length - 1]) || { n: 1, date: '', status: 'For Review' };
  const comments = (window.DB.comments || []).filter(c => String(c.asset) === String(a.id));
  const canReviewNow = typeof can === 'function' && can('review') && ['For Review', 'Revision Requested'].includes(v.status);
  const isRender = a.type === 'Render';
  const statusClass = (typeof STATUS_CLASS !== 'undefined' && STATUS_CLASS[v.status]) ? STATUS_CLASS[v.status] : 'b-review';

  return `
    <button class="btn btn-ghost btn-sm" onclick="Studio.goto('assets')">← All assets</button>
    <div class="card" style="padding:22px;margin-top:14px;">
      <div style="display:flex;gap:14px;align-items:flex-start;">
        <div class="type-tag" style="background:${meta.color}22;color:${meta.color};width:46px;height:46px;font-size:13px;">${meta.tag}</div>
        <div style="flex:1;">
          <div class="eyebrow">${esc(proj ? proj.name : 'Unassigned')}</div>
          <h2 style="margin:2px 0 6px;font-family:var(--font-display);font-size:26px;letter-spacing:.02em;">${esc(a.title)}</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span class="chip">${a.type}</span>
            <span class="badge ${statusClass}">${v.status}</span>
            ${a.link ? `<span class="chip" title="External storage link">🔗 ${esc(a.link)}</span>` : ''}
          </div>
        </div>
        ${typeof can === 'function' && can('submitAssets') ? `<button class="btn btn-sm" onclick="Studio.goto('assets');Studio.toggleForm('newAssetForm');document.getElementById('saExisting').value='${a.id}';Studio.onSaExistingChange();">+ New version</button>` : ''}
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px;">
      <div>
        <h3 style="font-size:15px;">Version history</h3>
        ${(a.versions || []).slice().reverse().map(ver => {
          const author = typeof userById === 'function' ? userById(ver.by) : null;
          const verStatusClass = (typeof STATUS_CLASS !== 'undefined' && STATUS_CLASS[ver.status]) ? STATUS_CLASS[ver.status] : 'b-review';
          return `<div class="version-item ${ver.id === v.id ? 'latest' : ''}">
            <div class="vh-top">
              <span class="vtag">v${String(ver.n || 1).padStart(2, '0')}</span>
              <span class="badge ${verStatusClass}">${ver.status}</span>
              <span style="font-size:12px;color:var(--text-faint);margin-left:auto;">${fmtDate(ver.date)}</span>
            </div>
            <div style="font-size:13px;margin-top:8px;color:var(--text-dim);">${esc(ver.notes || '—')}</div>
            <div style="font-size:11px;color:var(--text-faint);margin-top:6px;" class="mono">Submitted by ${author ? esc(author.name) : '—'}</div>
          </div>`;
        }).join('')}

        ${canReviewNow ? `
        <div class="card" style="padding:18px;margin-top:6px;">
          <h3 style="margin-top:0;font-size:14px;">Review v${String(v.n || 1).padStart(2, '0')}</h3>
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
          ${comments.length ? comments.map(c => {
            const u = typeof userById === 'function' ? userById(c.by) : null;
            const roleLabel = (u && typeof ROLE_LABELS !== 'undefined') ? ROLE_LABELS[u.role] : '';
            return `<div class="comment">
              <div class="avatar" style="width:30px;height:30px;font-size:11px;">${initials(u ? u.name : '?')}</div>
              <div class="body">
                <div class="meta"><b>${u ? esc(u.name) : 'Unknown'}</b><span>${roleLabel}</span><span>${fmtDate(c.date)}</span></div>
                <div class="txt">${esc(c.text)}</div>
              </div>
            </div>`;
          }).join('') : `<div class="empty">No feedback yet. Notes from reviewers and clients will show up here.</div>`}
          ${typeof can === 'function' && can('comment') ? `
          <div class="divider"></div>
          <div class="field"><textarea id="newComment" placeholder="Add a comment..."></textarea></div>
          <button class="btn btn-sm" onclick="Studio.addComment('${a.id}')">Add comment</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   RENDER & ROUTING CONTROLLER
   ========================================================================== */
function render() {
  if (!window.DB?.currentUser) return;
  
  if (typeof renderSidebar === 'function') {
    renderSidebar();
  }

  // Renders into the inner page area to preserve topbar/sidebar structure
  const el = document.getElementById('pageContent') || document.getElementById('app');
  if (!el) return;

  const page = window.state?.page || 'assets';

  switch (page) {
    case 'dashboard': 
      el.innerHTML = typeof pageDashboard === 'function' ? pageDashboard() : ''; 
      break;
    case 'projects': 
      el.innerHTML = typeof pageProjects === 'function' ? pageProjects() : ''; 
      break;
    case 'projectDetail': 
      el.innerHTML = typeof pageProjectDetail === 'function' ? pageProjectDetail() : ''; 
      break;
    case 'assets': 
      el.innerHTML = pageAssets(); 
      break;
    case 'assetDetail': 
      el.innerHTML = pageAssetDetail(); 
      break;
    case 'review': 
      el.innerHTML = typeof pageReview === 'function' ? pageReview() : ''; 
      break;
    case 'notifications': 
      el.innerHTML = typeof pageNotifications === 'function' ? pageNotifications() : ''; 
      break;
    case 'integrations': 
      el.innerHTML = typeof pageIntegrations === 'function' ? pageIntegrations() : ''; 
      break;
    case 'resources': 
      el.innerHTML = typeof pageResources === 'function' ? pageResources() : ''; 
      break;
    case 'audit': 
      el.innerHTML = typeof pageAudit === 'function' ? pageAudit() : ''; 
      break;
    case 'users': 
      el.innerHTML = typeof pageUsers === 'function' ? pageUsers() : ''; 
      break;
    case 'architecture': 
      el.innerHTML = typeof pageArchitecture === 'function' ? pageArchitecture() : ''; 
      break;
    default: 
      el.innerHTML = pageAssets();
  }
}

// Global scope bindings
window.pageAssets = pageAssets;
window.pageAssetDetail = pageAssetDetail;
window.render = render;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Validate active login session
  if (!window.DB?.currentUser) { 
    window.location.assign('../login/login.html'); 
    return; 
  }

  const menu = document.getElementById('menuButton');
  if (menu) {
    menu.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });
  }

  // Initial render execution
  render();
});