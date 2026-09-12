/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Team & Roles (User Management)
   ========================================================================== */
function pageUsers(){
  return `
    <div class="section-title">Team &amp; roles</div>

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
        <thead><tr><th>Name</th><th>Role</th><th>Change role</th><th></th></tr></thead>
        <tbody>
          ${DB.users.map(u=>`<tr>
            <td style="display:flex;align-items:center;gap:9px;padding-top:10px;"><div class="avatar" style="width:26px;height:26px;font-size:10.5px;">${initials(u.name)}</div>${esc(u.name)}</td>
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
