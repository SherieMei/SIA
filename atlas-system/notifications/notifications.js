/* ==========================================================================
   PAGE — Notifications
   ========================================================================== */
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
          <div class="type-tag" style="background:var(--panel-3);color:var(--coral);font-size:14px;">${NOTIF_ICON[n.type]||'●'}</div>
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
