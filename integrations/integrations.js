/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */

/* ==========================================================================
   PAGE — Integration Hub (API console, ETL import, event stream, webhooks)
   ========================================================================== */

function pageIntegrations(){
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <button
        type="button"
        class="klay-back-btn"
        title="Back"
        aria-label="Go back"
        onclick="history.back()"
      >&larr;</button>

      <div class="section-title">Integration hub</div>
    </div>

    <div class="grid-2" style="margin-top:22px;">
      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">API integration — Production Dashboard</h3>
        <div class="section-sub" style="margin-bottom:14px;">Sends the latest asset version to the external production dashboard.</div>

        <div class="field-row">
          <div class="field" style="grid-column:1/3;">
            <label>Asset</label>
            <select id="apiAssetSelect">
              ${DB.assets.map(a=>`<option value="${a.id}">${esc(a.title)}</option>`).join('')}
            </select>
          </div>
        </div>

        ${
          can('runIntegrations')
            ? `<button class="btn btn-primary btn-sm" onclick="Studio.apiSend()">POST → Send to Dashboard API</button>`
            : `<div class="empty">Your role can view this log but not trigger a sync.</div>`
        }

        <div class="divider"></div>

        <div class="console api-console">
          ${
            DB.apiLogs.slice().reverse().map(l=>`
              <div class="log-line api-log-entry">
                <span class="t">${fmtDateTime(l.date)}</span>
                <span style="color:${l.dir==='REQUEST'?'var(--coral)':'var(--cyan)'};font-weight:700;">
                  ${l.dir}${l.status ? (' ' + l.status) : ''}
                </span>
                <span style="color:var(--text-faint);">
                  ${l.method} ${l.endpoint}
                </span>
                <span class="api-log-body" style="color:var(--text-dim);">
                  ${esc(l.body)}
                </span>
              </div>
            `).join('') || '<div class="empty">No API calls yet.</div>'
          }
        </div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">ETL integration — bulk import</h3>

        <div class="section-sub" style="margin-bottom:14px;">
          Import one or more assets as CSV or JSON. Projects must already exist and be assigned to you.
        </div>

        <div class="field">
          <label for="etlInput">CSV or JSON data</label>
          <textarea
            id="etlInput"
            aria-describedby="etlHelp etlError"
            oninput="document.getElementById('etlError').textContent=''"
            style="min-height:120px;font-family:var(--font-mono);font-size:12px;"
            placeholder="CSV:&#10;title,project,type&#10;Example asset,Existing project name,Design Draft&#10;&#10;JSON:&#10;{&quot;asset&quot;:&quot;Example asset&quot;,&quot;project&quot;:&quot;Existing project name&quot;}"
          ></textarea>
          <small id="etlHelp" class="etl-help">JSON accepts “title” or “asset” plus “project”. Imported assets start at v1 with status For Review; supplied version/status values do not override the review workflow.</small>
          <div id="etlError" class="etl-error" role="alert" aria-live="polite"></div>
        </div>

        ${
          can('runIntegrations')
            ? `<button class="btn btn-primary btn-sm" onclick="Studio.runETL()">Run ETL import</button>`
            : `<div class="empty">Your role can't run imports.</div>`
        }

        <div class="divider"></div>

        <div id="etlLog" class="console"></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:20px;">
      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">Event stream — messaging simulation</h3>

        <div class="section-sub" style="margin-bottom:10px;">
          Every upload, approval, rejection, and revision publishes an event other services can subscribe to.
        </div>

        <div class="console">
          ${
            DB.events.slice(0,12).map(e=>`
              <div class="log-line">
                <span class="t">${fmtDateTime(e.date)}</span>
                <span style="color:var(--coral);font-weight:700;">
                  ${esc(e.name)}
                </span>
                <span style="color:var(--text-faint);">
                  ${esc(JSON.stringify(e.payload))}
                </span>
              </div>
            `).join('') || '<div class="empty">No events yet.</div>'
          }
        </div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="margin-top:0;font-size:15px;">Webhook log — approval triggers</h3>

        <div class="section-sub" style="margin-bottom:10px;">
          Fires on every approval, notifying the production dashboard endpoint.
        </div>

        <div class="console">
          ${
            DB.webhooks.slice().reverse().map(w=>`
              <div class="log-line">
                <span class="t">${fmtDateTime(w.date)}</span>
                <span style="color:var(--cyan);font-weight:700;">
                  ${w.status} OK
                </span>
                <span style="color:var(--text-faint);">
                  ${esc(w.endpoint)}
                </span>
              </div>
            `).join('') || '<div class="empty">No webhook calls yet — approve an asset to trigger one.</div>'
          }
        </div>
      </div>
    </div>

    <div class="card" style="padding:20px;margin-top:20px;">
      <h3 style="margin-top:0;font-size:15px;">External storage links registered</h3>

      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Project</th>
            <th>Link</th>
          </tr>
        </thead>

        <tbody>
          ${
            DB.assets.filter(a=>a.link).map(a=>`
              <tr>
                <td>${esc(a.title)}</td>
                <td>${esc(projectById(a.project).name)}</td>
                <td class="mono">${esc(a.link)}</td>
              </tr>
            `).join('') ||
            '<tr><td colspan="3" style="color:var(--text-faint);">None registered yet.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;
}


function render(){
  if(!DB.currentUser) return;

  renderSidebar();

  const el = document.getElementById('pageContent');
  if(!el) return;

  switch(state.page){
    case 'dashboard':
      el.innerHTML = pageDashboard();
      break;

    case 'projects':
      el.innerHTML = pageProjects();
      break;

    case 'projectDetail':
      el.innerHTML = pageProjectDetail();
      break;

    case 'completedProjects':
      el.innerHTML = pageCompletedProjects();
      break;

    case 'assets':
      el.innerHTML = pageAssets();
      break;

    case 'assetDetail':
      el.innerHTML = pageAssetDetail();
      break;

    case 'review':
      el.innerHTML = pageReview();
      break;

    case 'notifications':
      el.innerHTML = pageNotifications();
      break;

    case 'integrations':
      el.innerHTML = pageIntegrations();
      break;

    case 'resources':
      el.innerHTML = pageResources();
      break;

    case 'audit':
      el.innerHTML = pageAudit();
      break;

    case 'users':
      el.innerHTML = pageUsers();
      break;

    case 'architecture':
      el.innerHTML = pageArchitecture();
      break;

    default:
      el.innerHTML = pageDashboard();
  }
}


document.addEventListener('DOMContentLoaded',async () => {
  await window.BEE_SERVER_READY;
  if(!DB.currentUser){ 
    window.location.assign('../login/login.html'); 
    return; 
  }

  document.addEventListener('click', (e)=>{
    if(e.target.closest('#menuButton')){
      document.getElementById('sidebar')?.classList.toggle('open');
    }
  });

  // Render the actual page after the separated HTML document loads.
  render();
});