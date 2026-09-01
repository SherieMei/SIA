/* ==========================================================================
   PAGE — System Architecture (write-up for the project submission)
   ========================================================================== */
function pageArchitecture(){
  return `
    <div class="section-title">System architecture</div>
    <div class="section-sub">How ATLAS is put together, and why — for the project write-up.</div>

    <div class="card" style="padding:22px;margin-top:16px;">
      <h3 style="margin-top:0;">Architecture style: Layered Architecture</h3>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">ATLAS is organized in three layers. The <b>presentation layer</b> is this interface — navigation, forms, and views that render the current state. The <b>business logic layer</b> is the <span class="mono">Studio</span> object: it owns the rules for submissions, review decisions, workflow automation, and integrations, and it's the only place those rules live. The <b>data layer</b> is the in-memory <span class="mono">DB</span> store that stands in for a production database (projects, assets, versions, comments, notifications, audit log, events).</p>
      <p style="color:var(--text-dim);font-size:13.5px;line-height:1.6;">This separation was chosen because the studio's real need is clear ownership of rules — status changes, approvals, and permissions must behave the same way everywhere they're triggered from. Keeping logic out of the view layer means the dashboard, review queue, and asset detail page all call the same approval function instead of duplicating the rule. The file layout mirrors this on disk: <span class="mono">js/data</span>, <span class="mono">js/core</span>, <span class="mono">js/actions</span>, and <span class="mono">js/pages</span> map directly to the layers above.</p>
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
