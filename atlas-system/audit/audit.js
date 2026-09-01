/* ==========================================================================
   PAGE — Audit Log
   ========================================================================== */
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
