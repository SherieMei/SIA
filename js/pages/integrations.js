/* ==========================================================================
   PAGE — Integration Hub (API console, ETL import, event stream, webhooks)
   ========================================================================== */
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
              <span style="color:${l.dir==='REQUEST'?'var(--coral)':'var(--cyan)'};font-weight:700;">${l.dir}${l.status?(' '+l.status):''}</span>
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
              <span style="color:var(--coral);font-weight:700;">${esc(e.name)}</span>
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
              <span style="color:var(--cyan);font-weight:700;">${w.status} OK</span>
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
