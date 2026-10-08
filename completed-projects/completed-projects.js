/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */


/* ==========================================================================
   PAGE — Completed Projects
   The server returns only projects assigned to the signed-in user.
   ========================================================================== */

function pageCompletedProjects(){

  const completed = DB.projects.filter(
    p => p.status === 'Completed'
  );

  return `
    <div class="panel-head">

      <div style="display:flex;align-items:center;gap:10px;">

        <button
          type="button"
          class="klay-back-btn"
          title="Back"
          aria-label="Go back"
          onclick="Studio.goBack('dashboard')"
        >
          &larr;
        </button>

        <div class="section-title">
          Completed Projects
        </div>

      </div>

    </div>


    <div class="proj-grid">

      ${
        completed.length

        ? completed.map(p=>{

            const assetCount =
              DB.assets.filter(
                a=>String(a.project??a.project_id)===String(p.id)
              ).length;

            return `
              <div
                class="card proj-card"
                onclick="Studio.goto('projectDetail','${p.id}')"
              >

                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:10px;
                  "
                >

                  <h3>
                    ${esc(p.name)}
                  </h3>

                  <span class="badge b-approved">
                    ✓ Completed
                  </span>

                </div>


                <div class="client">
                  ${esc(p.client)}
                </div>


                <div class="progress-track">

                  <div
                    class="progress-fill"
                    style="width:100%"
                  ></div>

                </div>


                <div class="proj-meta">

                  <span>
                    ${assetCount} asset(s)
                  </span>

                  <span>
                    Due ${fmtDate(p.deadline)}
                  </span>

                </div>

              </div>
            `;

          }).join('')

        : `
          <div class="empty">
            No completed projects yet.
          </div>
        `
      }

    </div>
  `;
}


/* ==========================================================================
   RENDER
   ========================================================================== */

function render(){

  if(!DB.currentUser){
    return;
  }

  renderSidebar();

  const el =
    document.getElementById('pageContent');

  if(!el){
    return;
  }

  switch(state.page){

    case 'dashboard':
      el.innerHTML =
        pageDashboard();
      break;


    case 'projects':
      el.innerHTML =
        pageProjects();
      break;


    case 'projectDetail':
      el.innerHTML =
        pageProjectDetail();
      break;


    case 'completedProjects':
      el.innerHTML =
        pageCompletedProjects();
      break;


    case 'assets':
      el.innerHTML =
        pageAssets();
      break;


    case 'assetDetail':
      el.innerHTML =
        pageAssetDetail();
      break;


    case 'review':
      el.innerHTML =
        pageReview();
      break;


    case 'notifications':
      el.innerHTML =
        pageNotifications();
      break;


    case 'integrations':
      el.innerHTML =
        pageIntegrations();
      break;


    case 'resources':
      el.innerHTML =
        pageResources();
      break;


    case 'audit':
      el.innerHTML =
        pageAudit();
      break;


    case 'users':
      el.innerHTML =
        pageUsers();
      break;


    case 'architecture':
      el.innerHTML =
        pageArchitecture();
      break;


    default:
      el.innerHTML =
        pageCompletedProjects();

  }

}


/* ==========================================================================
   PAGE START
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


    document.addEventListener(
      'click',
      (e)=>{

        if(
          e.target.closest('#menuButton')
        ){

          document
            .getElementById('sidebar')
            ?.classList.toggle('open');

        }

      }
    );


    render();

  }
);