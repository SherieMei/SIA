/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */


/* ==========================================================================
   LOAD AUDIT LOGS FROM MYSQL
   ========================================================================== */

async function loadAuditLogs(){

  try {

    const response = await fetch(
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

function pageAudit(){

  const logs =
    Array.isArray(DB.auditLog)
      ? DB.auditLog
      : [];


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
        class="simple-arrow-btn"
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
  async ()=>{


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