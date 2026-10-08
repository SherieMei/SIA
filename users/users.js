/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Team & Roles (User Management)
   ========================================================================== */
function pageUsers(){
  return `
      <div style="display:flex;align-items:center;gap:10px;"><button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button><div class="section-title">Team & Roles</div></div>
    <div class="card" style="padding:20px;margin-top:16px;">
      <h3 style="margin-top:0;font-size:15px;">Add team member</h3>
      <div class="field-row">
        <div class="field"><label>Name</label><input id="umName" placeholder="e.g. Sam Rivera"></div>
        <div class="field"><label>Role</label>
          <select id="umRole">${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Email</label><input id="umEmail" type="email" autocomplete="off" placeholder="e.g. sam@beeproduction.studio"></div>
        <div class="field"><label>Password</label><input id="umPassword" type="password" autocomplete="new-password" placeholder="At least 6 characters"></div>
      </div>
      <button id="umAddButton" class="btn btn-primary btn-sm" onclick="Studio.addUser()">Add to team</button>
    </div>

    <div class="card" style="margin-top:18px;">
      <table class="team-users-table">
        <colgroup>
          <col class="team-users-name-column">
          <col class="team-users-role-column">
          <col class="team-users-change-column">
          <col class="team-users-actions-column">
        </colgroup>
        <thead><tr><th>Name</th><th>Role</th><th>Change role</th><th></th></tr></thead>
        <tbody>
          ${DB.users.map(u=>`<tr>
            <td><div class="team-user-name"><div class="avatar" style="width:26px;height:26px;font-size:10.5px;">${initials(u.name)}</div><span>${esc(u.name)}</span></div></td>
            <td><span class="badge b-role b-role-${u.role}">${ROLE_LABELS[u.role]}</span></td>
            <td>
              <select onchange="Studio.changeRole('${u.id}', this.value)">
                ${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </td>
            <td>
              ${u.id===DB.currentUser.id
                ? `<span class="chip" title="You can’t remove your own account">You</span>`
                : `<button class="btn btn-danger btn-sm" title="Remove ${esc(u.name)} from the team" onclick="Studio.deleteUser('${u.id}')">✕ Remove</button>`}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}


function render(){
  if(!DB.currentUser) return;
  renderSidebar();
  const el=document.getElementById('pageContent');
  if(!el) return;
  switch(state.page){
    case 'dashboard': el.innerHTML=pageDashboard(); break;
    case 'projects': el.innerHTML=pageProjects(); break;
    case 'projectDetail': el.innerHTML=pageProjectDetail(); break;
    case 'completedProjects': el.innerHTML=pageCompletedProjects(); break;
    case 'assets': el.innerHTML=pageAssets(); break;
    case 'assetDetail': el.innerHTML=pageAssetDetail(); break;
    case 'review': el.innerHTML=pageReview(); break;
    case 'notifications': el.innerHTML=pageNotifications(); break;
    case 'integrations': el.innerHTML=pageIntegrations(); break;
    case 'resources': el.innerHTML=pageResources(); break;
    case 'audit': el.innerHTML=pageAudit(); break;
    case 'users': el.innerHTML=pageUsers(); break;
    case 'architecture': el.innerHTML=pageArchitecture(); break;
    default: el.innerHTML=pageDashboard();
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  if(!DB.currentUser){
    window.location.assign('../login/login.html');
    return;
  }
  if(!can('manageUsers')){
    window.location.assign('../dashboard/dashboard.html');
    return;
  }

  const menu=document.getElementById('menuButton');
  if(menu) {
    menu.addEventListener('click',()=>{
      document.getElementById('sidebar')?.classList.toggle('open');
    });
  }

  // Render the actual page after the separated HTML document loads.
  render();
});
