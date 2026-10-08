function pageUsers(){
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <button
        type="button"
        class="klay-back-btn"
        title="Go back"
        aria-label="Go back"
        onclick="Studio.goBack('dashboard')"
      >←</button>

      <div class="section-title">Team & Roles</div>
    </div>

    <div class="card" style="padding:20px;margin-top:16px;">
      <h3 style="margin-top:0;font-size:15px;">Add team member</h3>

      <div class="field-row">
        <div class="field">
          <label>Name</label>
          <input id="umName" placeholder="e.g. Sam Rivera">
        </div>

        <div class="field">
          <label>Role</label>
          <select id="umRole">
            ${Object.entries(ROLE_LABELS).map(([k,v]) =>
              `<option value="${k}">${v}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Email</label>
          <input
            id="umEmail"
            type="email"
            autocomplete="off"
            placeholder="e.g. sam@beeproduction.studio"
          >
        </div>

        <div class="field">
          <label>Password</label>
          <input
            id="umPassword"
            type="password"
            autocomplete="new-password"
            placeholder="At least 6 characters"
          >
        </div>
      </div>

      <button
        id="umAddButton"
        class="btn btn-primary btn-sm"
        onclick="Studio.addUser()"
      >
        Add to team
      </button>
    </div>

    <!-- ACTIVE TEAM MEMBERS -->
    <div class="card" style="margin-top:18px;">
      <table class="team-users-table">
        <colgroup>
          <col class="team-users-name-column">
          <col class="team-users-role-column">
          <col class="team-users-change-column">
          <col class="team-users-actions-column">
        </colgroup>

        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Change role</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${DB.users.map(u=>`<tr>
            <td>
              <div class="team-user-name">
                <div
                  class="avatar"
                  style="width:26px;height:26px;font-size:10.5px;"
                >
                  ${initials(u.name)}
                </div>

                <span>${esc(u.name)}</span>
              </div>
            </td>

            <td>
              <span class="badge b-role b-role-${u.role}">
                ${ROLE_LABELS[u.role]}
              </span>
            </td>

            <td>
              <select onchange="Studio.changeRole('${u.id}', this.value)">
                ${Object.entries(ROLE_LABELS).map(([k,v])=>`
                  <option value="${k}" ${u.role===k?'selected':''}>
                    ${v}
                  </option>
                `).join('')}
              </select>
            </td>

            <td>
              ${u.id===DB.currentUser.id
                ? `<span class="chip" title="You can’t remove your own account">You</span>`
                : `<button
                    class="btn btn-danger btn-sm"
                    title="Remove ${esc(u.name)} from the team"
                    onclick="Studio.deleteUser('${u.id}')"
                  >✕ Remove</button>`
              }
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- RECENTLY DELETED -->
<div class="card" style="margin-top:18px;padding:20px 24px;">

  <div style="
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:20px;
  ">

    <div style="
      display:flex;
      align-items:flex-start;
      gap:10px;
    ">

      <div style="
        width:34px;
        height:34px;
        border-radius:9px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#f3f5f7;
        color:#718096;
        font-size:15px;
        flex-shrink:0;
      ">
        🗑
      </div>

      <div>
        <div style="
          font-size:15px;
          font-weight:700;
          color:#24364d;
          line-height:1.3;
        ">
          Recently Deleted
        </div>

        <div style="
          font-size:12px;
          color:#8b98a8;
          margin-top:4px;
          line-height:1.4;
        ">
          Deleted accounts can be restored or permanently removed.
        </div>
      </div>

    </div>

    <button
      type="button"
      class="btn btn-sm"
      style="min-width:70px;"
      onclick="
        const panel = document.getElementById('deletedUsersPanel');
        panel.style.display =
          panel.style.display === 'none' ? 'block' : 'none';
      "
    >
      Show
    </button>

  </div>

  <div
    id="deletedUsersPanel"
    style="display:none;margin-top:18px;"
  >

    <div style="
      padding:18px;
      text-align:center;
      color:#8b98a8;
      font-size:13px;
      background:#f8fafb;
      border-radius:10px;
    ">
      No deleted accounts to display.
    </div>

  </div>

</div>
  `;
}

async function loadDeletedUsers(){
  const panel = document.getElementById('deletedUsersPanel');

  if(!panel) return;

  try {
    const response = await fetch(
      'http://localhost/SIA/api/auth.php?action=trash_users',
      {
        credentials: 'include'
      }
    );

    const data = await response.json();

    if(!data.success || !Array.isArray(data.users)){
      panel.innerHTML = `
        <div style="
          padding:18px;
          text-align:center;
          color:#8b98a8;
          font-size:13px;
          background:#f8fafb;
          border-radius:10px;
        ">
          No deleted accounts to display.
        </div>
      `;
      return;
    }

    if(data.users.length === 0){
      panel.innerHTML = `
        <div style="
          padding:18px;
          text-align:center;
          color:#8b98a8;
          font-size:13px;
          background:#f8fafb;
          border-radius:10px;
        ">
          No deleted accounts to display.
        </div>
      `;
      return;
    }

    panel.innerHTML = data.users.map(item => {
      const user = item.item_data || {};

      return `
        <div style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:20px;
          padding:14px 4px;
          border-bottom:1px solid #edf1f4;
        ">

          <div style="
            display:flex;
            align-items:center;
            gap:10px;
          ">

            <div
              class="avatar"
              style="
                width:34px;
                height:34px;
                font-size:11px;
              "
            >
              ${initials(user.full_name || 'User')}
            </div>

            <div>
              <div style="
                font-size:13px;
                font-weight:700;
                color:#24364d;
              ">
                ${esc(user.full_name || 'Unknown User')}
              </div>

              <div style="
                font-size:11px;
                color:#8b98a8;
                margin-top:3px;
              ">
                ${ROLE_LABELS[user.role] || user.role || 'Unknown Role'}
              </div>
            </div>

          </div>

          <div style="
            display:flex;
            align-items:center;
            gap:8px;
          ">
            <div style="
              font-size:11px;
              color:#9aa6b5;
              text-align:right;
            ">
              Deleted ${item.deleted_at || ''}
            </div>

            <button
              type="button"
              class="btn btn-sm"
              onclick="Studio.recoverUser('${item.id}')"
            >
              Recover
              </button>

              <button
              type="button"
              class="btn btn-danger btn-sm"
              onclick="Studio.deleteTrashUser('${item.id}')"
            >
              Delete Forever
            </button>
          </div>

        </div>
      `;
    }).join('');

  } catch(error) {
    console.error('Error loading deleted accounts:', error);

    panel.innerHTML = `
      <div style="
        padding:18px;
        text-align:center;
        color:#c45b5b;
        font-size:13px;
        background:#fff7f7;
        border-radius:10px;
      ">
        Unable to load deleted accounts.
      </div>
    `;
  }
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
    case 'users':
      el.innerHTML=pageUsers();
      loadDeletedUsers();
      break;
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
