/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Team & Roles (User Management)
   ========================================================================== */
function pageUsers(){
  return `
      <div style="display:flex;align-items:center;gap:10px;"><button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button><div class="section-title">Team & Roles</div></div>
    <div class="card" style="padding:20px;margin-top:16px;">
      <h3 style="margin-top:0;font-size:15px;">Invite team member</h3>
      <p class="team-invite-help">We’ll email a verification link and a password setup link. The member chooses their own password.</p>
      <div class="field-row">
        <div class="field"><label>Name</label><input id="umName" placeholder="e.g. Sam Rivera"></div>
        <div class="field"><label>Role</label>
          <select id="umRole">${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Email</label><input id="umEmail" type="email" autocomplete="off" placeholder="e.g. sam@beeproduction.studio"></div>

      </div>
      <button id="umAddButton" class="btn btn-primary btn-sm" onclick="Studio.addUser()">Send invitation</button>
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
            <td><div class="team-user-name"><div class="avatar" style="width:26px;height:26px;font-size:10.5px;">${initials(u.name)}</div><span>${esc(u.name)}<small class="team-user-email">${esc(u.email||'')}</small>${u.verification_required?`<small class="team-invite-state ${u.invitation_status==='failed'?'failed':''}">${esc(({sending:'Sending email…',sent:'Email sent · awaiting verification',failed:'Email failed · resend invitation',verified:'Email verified · awaiting sign-in',accepted:'Verified · account active'})[u.invitation_status]||'Invitation pending')}</small>`:''}</span></div></td>
            <td><span class="badge b-role b-role-${u.role}">${ROLE_LABELS[u.role]}</span></td>
            <td>
              <select onchange="Studio.changeRole('${u.id}', this.value)">
                ${Object.entries(ROLE_LABELS).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </td>
            <td>
              ${u.verification_required&&!u.accepted_at?`<button type="button" class="btn btn-sm team-resend-btn" onclick="Studio.resendInvitation('${u.id}')">Resend invitation</button>`:''}
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
  const draft=state.page==='users'?Object.fromEntries(['umName','umEmail','umRole'].map(id=>[id,document.getElementById(id)?.value])):null;
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
  if(draft)for(const [id,value] of Object.entries(draft)){if(value!==undefined&&document.getElementById(id))document.getElementById(id).value=value;}
}

document.addEventListener('DOMContentLoaded',async () => {
  await window.BEE_SERVER_READY;
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
  Studio.refreshInvitations();
  const refresh=setInterval(()=>{if(!document.hidden)Studio.refreshInvitations();},30000);
  window.addEventListener('pagehide',()=>clearInterval(refresh),{once:true});
});
