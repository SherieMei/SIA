/* ==========================================================================
   PAGE — Team & Roles (User Management)
   ========================================================================== */
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
