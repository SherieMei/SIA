/* ==========================================================================
   PAGE — Review Queue
   ========================================================================== */
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
          ${can('review') ? `<button class="btn btn-cyan btn-sm" onclick="Studio.quickApprove('${a.id}')">Quick approve</button>
          <button class="btn btn-ghost btn-sm" onclick="Studio.goto('assetDetail','${a.id}')">Review →</button>` : `<button class="btn btn-ghost btn-sm" onclick="Studio.goto('assetDetail','${a.id}')">Open →</button>`}
        </div>`;
      }).join('') : `<div class="empty">Nothing pending. The queue is clear.</div>`}
    </div>
  `;
}
