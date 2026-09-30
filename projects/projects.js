function getManuallyFinishedProjects(){
  try{
    const saved = JSON.parse(
      localStorage.getItem('beeManuallyFinishedProjects') || '[]'
    );

    return Array.isArray(saved)
      ? saved
      : [];

  }catch(e){
    return [];
  }
}

function isProjectManuallyFinished(projectId){

  return getManuallyFinishedProjects()
    .includes(String(projectId));

}

function markProjectManuallyFinished(projectId){

  const list =
    getManuallyFinishedProjects();

  const id =
    String(projectId);

  if(!list.includes(id)){
    list.push(id);
  }

  localStorage.setItem(
    'beeManuallyFinishedProjects',
    JSON.stringify(list)
  );

}

let registeredClients = [];


/* ==========================================================================
   LOAD REGISTERED CLIENT ACCOUNTS
   ========================================================================== */

async function loadClientsFromDB(){

  try{

    const response = await fetch(
      '../api/auth.php?action=users',
      {
        credentials:'include'
      }
    );

    const data = await parseApiResponse(response);

    if(!data.success || !Array.isArray(data.users)){
      throw new Error('Unable to load users.');
    }

    registeredClients = data.users.filter(
      user => user.role === 'client'
    );

    console.log(
      'CLIENT ACCOUNTS:',
      registeredClients
    );

  }catch(error){

    console.error(
      'Error loading clients:',
      error
    );

    registeredClients = [];
  }

}


/* ==========================================================================
   LOAD PROJECTS
   ========================================================================== */

async function loadProjectsFromDB(){

  try {

    const response = await fetch(
      'http://localhost/SIA/api/projects.php',
      {
        credentials: 'include'
      }
    );

    const data = await parseApiResponse(response);

if(data.success && Array.isArray(data.projects)){

  DB.projects = data.projects;

  console.log(
    'PROJECTS FROM DATABASE:',
    DB.projects
  );

  render();

} else {

      console.error(
        'Invalid projects response:',
        data
      );

      render();
    }

  } catch(error){

    console.error(
      'Error loading projects:',
      error
    );

    render();
  }

}


/* ==========================================================================
   PAGE — Projects
   ========================================================================== */

function pageProjects(){

  const activeProjects =
    Array.isArray(DB.projects)
      ? DB.projects.filter(
          p => p.status !== 'Completed'
        )
      : [];

  return `

    <div class="panel-head">

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
          ←
        </button>

        <div class="section-title">
          Projects
        </div>

      </div>

      ${
        can('manageProjects')
          ? `
            <button
              class="btn btn-primary"
              onclick="Studio.toggleForm('newProjectForm')"
            >
              + Create project
            </button>
          `
          : ''
      }

    </div>


    ${
      can('manageProjects')
        ? `
          <div
            id="newProjectForm"
            class="card hidden"
            style="
              padding:20px;
              margin-top:14px;
            "
          >

            <h3
              style="
                margin-top:0;
                font-size:15px;
              "
            >
              New project
            </h3>


            <div class="field-row">

              <div class="field">
                <label>
                  Project name
                </label>

                <input
                  id="npName"
                  placeholder="e.g. Skybound Chronicles — Ep. 5"
                >
              </div>


              <div class="field">
                <label>
                  Client
                </label>

                <select id="npClient">

                  <option value="">
                    Select client
                  </option>

                  ${
                    registeredClients.map(client => `
                      <option
                        value="${esc(client.id)}"
                        data-name="${esc(client.full_name)}"
                      >
                        ${esc(client.full_name)}
                      </option>
                    `).join('')
                  }

                </select>

                ${
                  registeredClients.length === 0
                    ? `
                      <small
                        style="
                          color:var(--text-faint);
                          margin-top:5px;
                        "
                      >
                        No client accounts registered yet.
                      </small>
                    `
                    : ''
                }

              </div>

            </div>


            <div class="field-row">

              <div class="field">
                <label>
                  Deadline
                </label>

                <input
                  id="npDeadline"
                  type="date"
                  value="2026-12-01"
                  min="${new Date().toISOString().slice(0,10)}"
                >
              </div>


              <div class="field">
                <label>
                  Budget (PHP)
                </label>

                <input
                  id="npBudget"
                  type="number"
                  step="500"
                  min="0"
                  placeholder="30000"
                >
              </div>

            </div>


            <button
              class="btn btn-primary"
              onclick="Studio.createProject()"
            >
              Create project
            </button>

          </div>
        `
        : ''
    }


    <div class="proj-grid">

      ${
        activeProjects.length

          ? activeProjects.map(p => {

              const pct =
                projectProgress(p.id);

              const projectAssets =
                DB.assets.filter(
                  a =>
                    a.project === p.id ||
                    a.project_id === p.id
                );

              const assetCount =
                projectAssets.length;

              const hasPendingAsset =
                projectAssets.some(a => {

                  const latest =
                    latestVersion(a);

                  const status =
                    latest?.status || '';

                  return (
                    status === 'For Review' ||
                    status === 'Revision Requested'
                  );

                });

             const projectResources =
  Array.isArray(DB.resources)
    ? DB.resources.filter(
        r =>
          r.project === p.id ||
          r.project_id === p.id
      )
    : [];

const hasResourceEntry =
  projectResources.length > 0;

const canFinishProject =
  assetCount > 0 &&
  !hasPendingAsset &&
  hasResourceEntry;


              return `

                <div class="card proj-card">

                  <div
                    style="
                      display:flex;
                      justify-content:space-between;
                      align-items:flex-start;
                      gap:10px;
                    "
                  >

                    <h3
                      onclick="Studio.goto('projectDetail','${p.id}')"
                      style="cursor:pointer;"
                    >
                      ${esc(p.name)}
                    </h3>

                    <span class="chip">
                      ${esc(p.status)}
                    </span>

                  </div>


                  <div
                    class="client"
                    onclick="Studio.goto('projectDetail','${p.id}')"
                    style="cursor:pointer;"
                  >
                    ${esc(p.client)}
                  </div>


                  <div
                    class="progress-track"
                    onclick="Studio.goto('projectDetail','${p.id}')"
                    style="cursor:pointer;"
                  >

                    <div
                      class="progress-fill"
                      style="width:${pct}%"
                    ></div>

                  </div>


                  <div
                    class="proj-meta"
                    onclick="Studio.goto('projectDetail','${p.id}')"
                    style="cursor:pointer;"
                  >

                    <span>
                      ${assetCount} asset(s)
                    </span>

                    <span>
                      Due ${fmtDate(p.deadline)}
                    </span>

                  </div>

${
  can('manageProjects') && assetCount > 0
    ? `
      <div
        style="
          margin-top:12px;
          display:flex;
          justify-content:flex-end;
        "
      >
        <button
          type="button"
          class="btn btn-primary btn-sm"
          ${canFinishProject ? '' : 'disabled'}
          onclick="
            event.stopPropagation();
            finishProject('${p.id}');
          "
          title="${
            hasPendingAsset
              ? 'Resolve all asset reviews or revision requests first.'
              : !hasResourceEntry
                ? 'Add a resource or cost entry first.'
                : 'Finish project'
          }"
        >
          Finish project
        </button>
      </div>
    `
    : ''
}
                </div>

              `;

            }).join('')

          : `
            <div class="empty">
              No active projects found.
            </div>
          `
      }

    </div>

  `;

}
/* ==========================================================================
   PAGE — PROJECT DETAILS
   ========================================================================== */

function pageProjectDetail(){

  const p =
    projectById(state.selectedProjectId);

  if(!p){

    return `
      <div class="empty">
        Project not found.
      </div>
    `;

  }


  const assets =
    DB.assets.filter(
      a =>
        a.project === p.id ||
        a.project_id === p.id
    );


  const pct =
    projectProgress(p.id);


  const pm =
    userById(
      p.pm ??
      p.project_manager_id
    );


  return `

    <div
      style="
        display:flex;
        align-items:center;
        gap:10px;
        margin-bottom:14px;
      "
    >

      <button
        type="button"
        class="simple-arrow-btn"
        title="Back to Projects"
        aria-label="Back to Projects"
        onclick="window.location.href='projects.html'"
      >
        ←
      </button>


      <div class="section-title">
        Project Details
      </div>

    </div>


    <div
      class="card"
      style="overflow:hidden;"
    >

      <div
        class="slate-top"
        style="
          padding:20px 24px;
        "
      >

        <h1
          style="
            font-size:30px;
            margin:0;
          "
        >
          ${esc(p.name)}
        </h1>


        <div class="tag">
          ${esc(p.client)}
        </div>

      </div>


      <div
        style="
          padding:20px 24px;
        "
      >

        <div
          class="slate-fields"
          style="
            grid-template-columns:repeat(4,1fr);
          "
        >

          <div>
            <b>Status</b>
            ${esc(p.status)}
          </div>


          <div>
            <b>Deadline</b>
            ${fmtDate(p.deadline)}
          </div>


          <div>
            <b>Producer</b>
            ${
              pm
                ? esc(pm.name ?? pm.full_name ?? '')
                : esc(p.producer || '—')
            }
          </div>


          <div>
            <b>Budget</b>
            ₱${Number(p.budget || 0).toLocaleString()}
          </div>

        </div>


        <div class="progress-track">

          <div
            class="progress-fill"
            style="width:${pct}%"
          ></div>

        </div>


        <div
          class="mono"
          style="
            font-size:11.5px;
            color:var(--text-faint);
            margin-top:6px;
          "
        >
          ${pct}% project progress
        </div>

      </div>

    </div>


    <div
      class="panel-head"
      style="margin-top:24px;"
    >

      <h3
        style="
          margin:0;
          font-size:16px;
        "
      >
        Assets & scenes
      </h3>


      ${
        can('submitAssets') &&
        p.status !== 'Completed'

          ? `
            <button
              class="btn btn-primary btn-sm"
              onclick="
                window.location.href =
                '../assets/assets.html?submit=1&project=${p.id}';
              "
            >
              + Submit asset
            </button>
          `

          : ''
      }

    </div>


    <div
      class="card"
      style="margin-top:10px;"
    >

      ${
        assets.length

          ? assets.map(a => {

              const v =
                latestVersion(a);

              const meta =
                TYPE_META[a.type] || {
                  color: 'var(--text-dim)',
                  tag: 'AS'
                };


              return `

                <div
                  class="list-row"
                  style="cursor:pointer;"
                  onclick="
                    Studio.goto(
                      'assetDetail',
                      '${a.id}'
                    )
                  "
                >

                  <div
                    class="type-tag"
                    style="
                      background:${meta.color}22;
                      color:${meta.color};
                    "
                  >
                    ${meta.tag}
                  </div>


                  <div style="flex:1;">

                    <div class="row-title">
                      ${esc(a.title)}
                    </div>


                    <div class="row-sub">

                      ${esc(a.type || '')}

                      ·

                      ${(a.versions || []).length}
                      version(s)

                      ·

                      updated ${
                        v?.date
                          ? fmtDate(v.date)
                          : '—'
                      }

                    </div>

                  </div>


                  ${
                    v
                      ? `
                        <span class="vtag">
                          v${String(v.n).padStart(2,'0')}
                        </span>

                        <span
                          class="badge ${STATUS_CLASS[v.status] || ''}"
                        >
                          ${esc(v.status)}
                        </span>
                      `
                      : ''
                  }

                </div>

              `;

            }).join('')

          : `
            <div class="empty">
              No assets yet. Submit the first storyboard, animatic, or render to get this scene moving.
            </div>
          `
      }

    </div>


    <div
      class="panel-head"
      style="margin-top:24px;"
    >

      <h3
        style="
          margin:0;
          font-size:16px;
        "
      >
        Team
      </h3>

    </div>


    <div class="pill-row">

      ${
        (p.team || []).map(uid => {

          const u =
            userById(uid);


          return u
            ? `
              <span class="chip">

                ${esc(u.name)}

                ·

                <b
                  style="
                    color:
                    var(--${ROLE_COLOR_VAR[u.role] || 'text-dim'});
                  "
                >
                  ${ROLE_LABELS[u.role]}
                </b>

              </span>
            `
            : '';

        }).join('')
      }

    </div>

  `;

}


/* ==========================================================================
   FINISH PROJECT
   ========================================================================== */

function finishProject(projectId){

  const project =
    projectById(projectId);

  if(!project){
    return;
  }

  const projectAssets =
    DB.assets.filter(
      a => a.project === projectId
    );

  if(projectAssets.length === 0){

    toast(
      'This project needs at least one asset before it can be finished.',
      'error'
    );

    return;
  }

  const hasPendingAsset =
    projectAssets.some(a => {

      const status =
        latestVersion(a).status;

      return (
        status === 'For Review' ||
        status === 'Revision Requested'
      );

    });

  if(hasPendingAsset){

    toast(
      'This project still has asset(s) for review or revision.',
      'error'
    );

    return;
  }

  Studio.openConfirm({

    title:
      'Finish this project?',

    body:
      `Are you sure you want to mark “${esc(project.name)}” as Finished? All submitted assets have already been reviewed. This will move the project to Completed Projects.`,

    confirmLabel:
      'Finish project',

    onConfirm: async () => {

      try{

        const response = await fetch(
          'http://localhost/SIA/api/projects.php',
          {
            method:'PUT',
            credentials:'include',
            headers:{
              'Content-Type':'application/json'
            },
            body:JSON.stringify({
              id:projectId,
              status:'Completed'
            })
          }
        );

        const data =
          await parseApiResponse(response);

      if(data.success){

  markProjectManuallyFinished(projectId);

  project.status =
    'Completed';

  toast(
    'Project marked as Completed.',
    'success'
  );

  Studio.goto('completedProjects');
}else{

          toast(
            data.error ||
            data.message ||
            'Failed to complete project.',
            'error'
          );

        }

      }catch(error){

        console.error(
          'Error finishing project:',
          error
        );

        toast(
          'An error occurred while completing this project.',
          'error'
        );

      }

    }

  });

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
        pageDashboard();

  }

}


/* ==========================================================================
   PAGE START
   ========================================================================== */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    if(!DB.currentUser){

      window.location.assign(
        '../login/login.html'
      );

      return;
    }

    document.addEventListener(
      'click',
      (e) => {

        if(
          e.target.closest('#menuButton')
        ){

          document
            .getElementById('sidebar')
            ?.classList.toggle('open');

        }

      }
    );

    /*
      Load clients FIRST.

      This makes sure the Client dropdown already has
      the registered client accounts before the project
      page is rendered.
    */

    await loadClientsFromDB();

    await loadProjectsFromDB();

  }
);