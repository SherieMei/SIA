/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */


/* ==========================================================================
   LOAD AUDIT LOGS FROM FIRESTORE
   ========================================================================== */

async function loadAuditLogs(){

  try {

    const response = await window.beeFetch(
      '../api/audit.php',
      {
        method: 'GET',
        credentials: 'include'
      }
    );


    const data =
      await response.json();


    if(
      !response.ok
      ||
      !data.success
    ){

      throw new Error(
        data.error ||
        'Unable to load audit logs.'
      );

    }


    DB.auditLog =
      Array.isArray(data.auditLogs)
        ? data.auditLogs
        : [];


  } catch(error){

    console.error(
      'Audit log error:',
      error
    );


    DB.auditLog = [];

  }

}



/* ==========================================================================
   PAGE — AUDIT LOG
   ========================================================================== */

const auditFilters = { search: '', project: '', action: '' };
Studio.filterAudit = function(field, value){
  auditFilters[field] = value;
  const active = document.activeElement?.id;
  const cursor = document.activeElement?.selectionStart;
  render();
  const input = document.getElementById(active);
  if(input){ input.focus(); if(cursor != null && input.type === 'search') input.setSelectionRange(cursor,cursor); }
};
function pageAudit(){

  const allLogs = Array.isArray(DB.auditLog) ? DB.auditLog : [];
  const logs = allLogs.filter(log =>
    (!auditFilters.project || String(log.project_id) === auditFilters.project) &&
    (!auditFilters.action || log.action === auditFilters.action) &&
    [log.by,log.action,log.entity,log.detail].join(' ').toLowerCase().includes(auditFilters.search.toLowerCase())
  ).sort((a,b) => String(b.date).localeCompare(String(a.date)));


  return `

    <div
      style="
        display:flex;
        align-items:center;
        gap:10px;
      "
    >

      <button
        type="button"
        class="klay-back-btn"
        title="Back"
        aria-label="Go back"
        onclick="Studio.goBackSidebar('dashboard')"
      >
        &larr;
      </button>


      <div class="section-title">
        Audit log
      </div>

    </div>


    <div
      class="card"
      style="margin-top:16px;"
    >

      <div style="padding:16px;display:flex;gap:12px;flex-wrap:wrap;">
        <input id="auditSearch" type="search" aria-label="Search audit logs" placeholder="Search activities" value="${esc(auditFilters.search)}" oninput="Studio.filterAudit('search',this.value)">
        <select aria-label="Filter by project" onchange="Studio.filterAudit('project',this.value)"><option value="">All allowed projects</option>${DB.projects.map(p => `<option value="${esc(String(p.id))}" ${auditFilters.project === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select aria-label="Filter by action" onchange="Studio.filterAudit('action',this.value)"><option value="">All actions</option>${[...new Set(allLogs.map(l => l.action))].filter(Boolean).sort().map(a => `<option ${auditFilters.action === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
      </div>
      <table>

        <thead>

          <tr>

            <th>Time</th>

            <th>User</th>

            <th>Action</th>

            <th>Entity</th>

            <th>Detail</th>

          </tr>

        </thead>


        <tbody>

          ${
            logs.length

            ? logs.map(a => `

                <tr>

                  <td
                    class="mono"
                    style="color:var(--text-faint);"
                  >
                    ${fmtDateTime(a.date)}
                  </td>


                  <td>
                    ${esc(a.by || 'System')}
                  </td>


                  <td>

                    <span class="chip">
                      ${esc(a.action || '')}
                    </span>

                  </td>


                  <td>
                    ${esc(a.entity || '')}
                  </td>


                  <td
                    style="color:var(--text-dim);"
                  >
                    ${esc(a.detail || '')}
                  </td>

                </tr>

              `).join('')

            : `

              <tr>

                <td
                  colspan="5"
                  class="empty"
                  style="
                    text-align:center;
                    padding:30px;
                  "
                >
                  No audit records found.
                </td>

              </tr>

            `
          }

        </tbody>

      </table>

    </div>

  `;

}



/* ==========================================================================
   RENDER
   ========================================================================== */

function render(){

  if(!DB.currentUser) return;


  renderSidebar();


  const el =
    document.getElementById(
      'pageContent'
    );


  if(!el) return;


  switch(state.page){

    case 'audit':

      el.innerHTML =
        pageAudit();

      break;


    default:

      el.innerHTML =
        pageAudit();

  }

}



/* ==========================================================================
   PAGE LOAD
   ========================================================================== */

document.addEventListener(
  'DOMContentLoaded',
  async () => {
  await window.BEE_SERVER_READY;


    if(!DB.currentUser){

      window.location.assign(
        '../login/login.html'
      );

      return;

    }


    if(!can('viewAudit')){

      window.location.assign(
        '../dashboard/dashboard.html'
      );

      return;

    }


    document.addEventListener(
      'click',
      e => {

        if(
          e.target.closest(
            '#menuButton'
          )
        ){

          document
            .getElementById(
              'sidebar'
            )
            ?.classList.toggle(
              'open'
            );

        }

      }
    );


    await loadAuditLogs();


    render();

  }
);