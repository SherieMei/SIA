/* ==========================================================================
   PAGE — Assets (Pure UI Update preserving original DB logic)
   ========================================================================== */

// Global State
window.DB = window.DB || {
  currentUser: { id: 'u1', name: 'Jordan Reyes', role: 'ADMINISTRATOR' },
  projects: [],
  assets: [],
  comments: [],
  users: []
};

window.state = window.state || {
  page: 'assets',
  selectedAssetId: null,
  filter: { project: 'all', type: 'all', status: 'all', q: '' }
};

window.Studio = window.Studio || {};

// Metadata Mappings (Dashboard Theme)
window.TYPE_META = window.TYPE_META || {
  'Storyboard': { tag: 'STB', color: '#6366f1' },
  'Animatic': { tag: 'ANM', color: '#8b5cf6' },
  'Character Sheet': { tag: 'CHR', color: '#ec4899' },
  'Background': { tag: 'BG', color: '#10b981' },
  'Scene': { tag: 'SCN', color: '#f59e0b' },
  'Render': { tag: 'RND', color: '#06b6d4' }
};

window.STATUS_CLASS = window.STATUS_CLASS || {
  'For Review': 'background:#fff7ed; color:#c2410c; border:1px solid #ffedd5;',
  'Approved': 'background:#f0fdf4; color:#15803d; border:1px solid #dcfce7;',
  'Rejected': 'background:#fef2f2; color:#b91c1c; border:1px solid #fee2e2;',
  'Revision Requested': 'background:#faf5ff; color:#6b21a8; border:1px solid #f3e8ff;',
  'Final': 'background:#f0f9ff; color:#0369a1; border:1px solid #e0f2fe;'
};

// Database Helpers (Original)
function assetById(id) {
  return (window.DB.assets || []).find(a => String(a.id) === String(id));
}

function projectById(id) {
  return (window.DB.projects || []).find(p => String(p.id) === String(id));
}

function latestVersion(asset) {
  if (!asset || !asset.versions || !asset.versions.length) {
    return { n: 1, status: asset?.status || 'Approved', notes: '' };
  }
  return asset.versions[asset.versions.length - 1];
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.Studio.goto = function(page, assetId = null) {
  window.state.page = page;
  if (assetId) window.state.selectedAssetId = assetId;
  render();
};

window.Studio.toggleForm = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
};

window.Studio.setFilter = function(key, val) {
  window.state.filter[key] = val;
  render();
};

window.Studio.onSaExistingChange = function() {
  const val = document.getElementById('saExisting')?.value;
  const newFields = document.getElementById('saNewFields');
  if (newFields) {
    newFields.style.display = (val === 'new') ? 'block' : 'none';
  }
};

/* ==========================================================================
   ORIGINAL DATABASE FETCH & POST HANDLERS (UNTOUCHED)
   ========================================================================== */

async function loadData() {
  try {
    const res = await fetch('../api/assets.php');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        if (data.assets) window.DB.assets = data.assets;
        if (data.projects) window.DB.projects = data.projects;
      }
    }
  } catch (e) {
    console.warn('API sync fallback active:', e);
  }
  render();
}

window.Studio.submitAsset = async function() {
  const projectId = document.getElementById('saProject')?.value;
  const existingId = document.getElementById('saExisting')?.value;
  const title = document.getElementById('saTitle')?.value;
  const type = document.getElementById('saType')?.value;
  const link = document.getElementById('saLink')?.value;
  const notes = document.getElementById('saNotes')?.value;

  const isVersion = existingId && existingId !== 'new';
  const payload = isVersion ? {
    action: 'version',
    asset_id: existingId,
    notes: notes
  } : {
    action: 'create',
    project_id: projectId,
    title: title,
    type: type,
    external_link: link,
    notes: notes
  };

  try {
    const response = await fetch('../api/assets.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (data.success) {
      await loadData();
    } else {
      alert('Error: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    console.error('Failed to submit asset:', err);
    alert('Network error connecting to backend.');
  }
};

/* ==========================================================================
   UI RENDERING — DASHBOARD MATCHING LAYOUT
   ========================================================================== */

function pageAssets() {
  const f = window.state.filter;
  let list = (window.DB.assets || []).slice();

  if (f.project !== 'all') list = list.filter(a => String(a.project || a.project_id) === String(f.project));
  if (f.type !== 'all') list = list.filter(a => a.type === f.type);
  if (f.status !== 'all') list = list.filter(a => latestVersion(a).status === f.status);
  if (f.q) list = list.filter(a => (a.title || '').toLowerCase().includes(f.q.toLowerCase()));

  const types = Object.keys(window.TYPE_META);
  const statuses = ['For Review', 'Approved', 'Rejected', 'Revision Requested', 'Final'];

  const totalAssets = list.length;
  const pendingCount = list.filter(a => latestVersion(a).status === 'For Review').length;
  const approvedCount = list.filter(a => latestVersion(a).status === 'Approved').length;
  const rejectedCount = list.filter(a => latestVersion(a).status === 'Rejected').length;

  return `
    <div style="max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
      
      <!-- Top Title Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #cbd5e1; letter-spacing: 0.08em; text-transform: uppercase;">// WORKSPACE</div>
          <h1 style="margin:2px 0 0 0; font-size:22px; font-weight:800; color:#0f172a; letter-spacing:-0.01em;">ASSETS</h1>
        </div>
        <button style="background:#f43f5e; color:#ffffff; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;" onclick="Studio.toggleForm('newAssetForm')">+ Submit Asset</button>
      </div>

      <!-- Overview Stat Cards -->
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:24px;">
        <div style="background:#ffffff; border-radius:8px; padding:16px 20px; border-left:4px solid #8b5cf6; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size:26px; font-weight:800; color:#0f172a; line-height:1;">${pendingCount}</div>
          <div style="font-size:11px; font-weight:600; color:#94a3b8; margin-top:6px;">Pending Review</div>
        </div>
        <div style="background:#ffffff; border-radius:8px; padding:16px 20px; border-left:4px solid #10b981; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size:26px; font-weight:800; color:#0f172a; line-height:1;">${approvedCount}</div>
          <div style="font-size:11px; font-weight:600; color:#94a3b8; margin-top:6px;">Approved Assets</div>
        </div>
        <div style="background:#ffffff; border-radius:8px; padding:16px 20px; border-left:4px solid #f43f5e; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size:26px; font-weight:800; color:#0f172a; line-height:1;">${rejectedCount}</div>
          <div style="font-size:11px; font-weight:600; color:#94a3b8; margin-top:6px;">Rejected Outputs</div>
        </div>
        <div style="background:#ffffff; border-radius:8px; padding:16px 20px; border-left:4px solid #f59e0b; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size:26px; font-weight:800; color:#0f172a; line-height:1;">${totalAssets}</div>
          <div style="font-size:11px; font-weight:600; color:#94a3b8; margin-top:6px;">Total Registered</div>
        </div>
      </div>

      <!-- Asset Upload Collapsible Form -->
      <div id="newAssetForm" class="hidden" style="background:#ffffff; padding:20px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
        <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700; color:#0f172a;">Upload Asset Entry</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Project</label>
            <select id="saProject" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; background:#ffffff;">
              ${(window.DB.projects || []).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Asset Mode</label>
            <select id="saExisting" onchange="Studio.onSaExistingChange()" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; background:#ffffff;">
              <option value="new">New Asset Entry</option>
              ${(window.DB.assets || []).map(a=>`<option value="${a.id}">New Revision for: ${esc(a.title)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="saNewFields">
          <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Title</label>
              <input id="saTitle" placeholder="e.g. Episode 4 — Bathroom BG Set" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
            </div>
            <div>
              <label style="display:block; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Asset Type</label>
              <select id="saType" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; background:#ffffff;">
                ${types.map(t=>`<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Drive / File Link</label>
          <input id="saLink" placeholder="https://drive.google.com/..." style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Notes</label>
          <textarea id="saNotes" placeholder="Provide notes for the team..." style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; height:60px;"></textarea>
        </div>
        <button style="background:#f43f5e; color:#ffffff; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;" onclick="Studio.submitAsset()">Save Asset</button>
      </div>

      <!-- Filters Toolbar -->
      <div style="display:flex; gap:10px; margin-bottom:16px; background:#ffffff; padding:8px 12px; border-radius:8px; border:1px solid #f1f5f9;">
        <select onchange="Studio.setFilter('project',this.value)" style="padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px; color:#475569; background:#ffffff;">
          <option value="all">All Projects</option>
          ${(window.DB.projects || []).map(p=>`<option value="${p.id}" ${f.project===String(p.id)?'selected':''}>${esc(p.name)}</option>`).join('')}
        </select>
        <select onchange="Studio.setFilter('type',this.value)" style="padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px; color:#475569; background:#ffffff;">
          <option value="all">All Types</option>
          ${types.map(t=>`<option value="${t}" ${f.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <select onchange="Studio.setFilter('status',this.value)" style="padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px; color:#475569; background:#ffffff;">
          <option value="all">All Statuses</option>
          ${statuses.map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <input placeholder="Search assets..." value="${esc(f.q)}" oninput="Studio.setFilter('q',this.value)" style="padding:6px 12px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px; flex:1; background:#ffffff;">
      </div>

      <!-- Assets Table Container -->
      <div style="background:#ffffff; border-radius:8px; border:1px solid #f1f5f9; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        ${list.length ? list.map(a => {
          const v = latestVersion(a);
          const meta = window.TYPE_META[a.type] || { color: '#64748b', tag: 'FILE' };
          const proj = projectById(a.project || a.project_id);
          const statusBadgeStyle = window.STATUS_CLASS[v.status] || 'background:#f1f5f9; color:#475569;';

          return `
            <div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid #f8fafc; cursor:pointer; transition:background 0.15s ease;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background='#ffffff'" onclick="Studio.goto('assetDetail','${a.id}')">
              <div style="background:${meta.color}15; color:${meta.color}; width:36px; height:36px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; margin-right:12px; flex-shrink:0;">
                ${meta.tag}
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:13px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(a.title)}</div>
                <div style="font-size:11px; color:#94a3b8; margin-top:2px;">
                  ${proj ? esc(proj.name) : 'General Studio'} · ${a.versions ? a.versions.length : 1} revision(s)
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                <span style="font-size:11px; font-weight:600; color:#94a3b8;">v${String(v.n || 1).padStart(2,'0')}</span>
                <span style="padding:3px 8px; border-radius:12px; font-size:10px; font-weight:700; ${statusBadgeStyle}">${v.status || 'Approved'}</span>
              </div>
            </div>`;
        }).join('') : `
          <div style="padding:40px 20px; text-align:center; color:#94a3b8; font-size:13px;">
            No assets match the selected filters.
          </div>`}
      </div>
    </div>
  `;
}

function pageAssetDetail() {
  const a = assetById(window.state.selectedAssetId);
  if (!a) return `<div style="padding:40px; text-align:center; color:#94a3b8;">Asset not found.<br><br><button onclick="Studio.goto('assets')" style="background:#e2e8f0; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">← Back to Assets</button></div>`;

  const proj = projectById(a.project || a.project_id);
  const meta = window.TYPE_META[a.type] || { color: '#64748b', tag: 'FILE' };
  const v = latestVersion(a);

  return `
    <div style="max-width:1200px; margin:0 auto; font-family:sans-serif;">
      <button style="background:none; border:none; color:#f43f5e; font-size:12px; font-weight:600; cursor:pointer; margin-bottom:16px; padding:0;" onclick="Studio.goto('assets')">← Back to assets</button>
      <div style="padding:20px; background:#ffffff; border:1px solid #f1f5f9; border-radius:8px;">
        <div style="display:flex; gap:14px; align-items:center;">
          <div style="background:${meta.color}15; color:${meta.color}; width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px;">${meta.tag}</div>
          <div style="flex:1;">
            <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">${esc(proj ? proj.name : 'Production Unit')}</div>
            <h2 style="margin:2px 0 4px 0; font-size:18px; font-weight:800; color:#0f172a;">${esc(a.title)}</h2>
            <div style="display:flex; gap:6px;">
              <span style="background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">${a.type}</span>
              <span style="padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; ${window.STATUS_CLASS[v.status] || ''}">${v.status || 'Approved'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const topTitle = document.getElementById('topTitle');
  if (topTitle) topTitle.innerText = window.state.page === 'assetDetail' ? 'Asset Detail' : 'Assets';

  const mainContent = document.getElementById('pageContent') || document.querySelector('main');
  if (mainContent) {
    mainContent.innerHTML = window.state.page === 'assetDetail' ? pageAssetDetail() : pageAssets();
  }
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const assetParam = params.get('asset');

  if (assetParam) {
    window.state.page = 'assetDetail';
    window.state.selectedAssetId = assetParam;
  } else {
    window.state.page = 'assets';
  }

  loadData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}