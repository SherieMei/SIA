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
          <select id="umRole">${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="Studio.addUser()">Add to team</button>
    </div>

    <div class="card" style="margin-top:18px;">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Change role</th>
          </tr>
        </thead>

        <tbody>
          ${DB.users.map(u=>`<tr>
            <td style="display:flex;align-items:center;gap:9px;padding-top:10px;">
              <div class="avatar" style="width:26px;height:26px;font-size:10.5px;">
                ${initials(u.name)}
              </div>
              ${esc(u.name)}
            </td>

            <td>
              <span class="badge b-role">${ROLE_LABELS[u.role]}</span>
            </td>

            <td>
              <select onchange="Studio.changeRole('${u.id}', this.value)">
                ${Object.entries(ROLE_LABELS).map(([k,v])=>`
                  <option value="${k}" ${u.role===k?'selected':''}>${v}</option>
                `).join('')}
              </select>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- RECENTLY DELETED -->
    <div class="card" style="margin-top:18px;">

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:4px 0;
      ">
        <div>
          <div style="
            font-size:14px;
            font-weight:700;
            color:#24364d;
          ">
            🗑 Recently Deleted
          </div>

          <div style="
            font-size:12px;
            color:#8b98a8;
            margin-top:3px;
          ">
            Deleted accounts can be restored or permanently removed.
          </div>
        </div>

        <button
          class="btn btn-sm"
          onclick="document.getElementById('deletedUsersPanel').classList.toggle('hidden')"
        >
          Show
        </button>
      </div>

      <div id="deletedUsersPanel" class="hidden" style="margin-top:16px;">

        <div style="
          padding:18px;
          text-align:center;
          color:#8b98a8;
          font-size:13px;
        ">
          No deleted accounts to display.
        </div>

      </div>

    </div>
  `;
}