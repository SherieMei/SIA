function resourceProjectIsFinished(p){

  if(!p) return false;

  // Actual database status
  if(String(p.status || '').toLowerCase() === 'completed'){
    return true;
  }

  // Manual finished record
  try{

    const saved = JSON.parse(
      localStorage.getItem('beeManuallyFinishedProjects') || '{}'
    );

    // Old array format
    if(Array.isArray(saved)){
      return saved.includes(String(p.id));
    }

    // Current format:
    // { projectId: projectName }
    if(saved && typeof saved === 'object'){
      return saved[String(p.id)] === p.name;
    }

  }catch(e){

    console.warn(
      'Unable to read finished projects:',
      e
    );

  }

  return false;
}


/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */

/* ==========================================================================
   PAGE — Resources & Budget (ERP-style tracking)
   ========================================================================== */

function isCompletedProject(p){

  return String(p?.status || '')
    .trim()
    .toLowerCase() === 'completed';

}


function pageResources(){

  return `

    <div style="display:flex;align-items:center;gap:10px;">
      <button
        type="button"
        class="klay-back-btn"
        title="Go back"
        aria-label="Go back"
        onclick="Studio.goBack('dashboard')"
      >←</button>

      <div class="section-title">
        Resources & Budget
      </div>
    </div>


    <div class="proj-grid" style="margin-top:18px;">

      ${DB.projects
        .filter(p => !resourceProjectIsFinished(p))
        .map(p => {

          const items =
            DB.resources.filter(
              r => r.project === p.id
            );

          const spent =
            items.reduce(
              (s,r) => s + Number(r.cost || 0),
              0
            );

          const hours =
            items.reduce(
              (s,r) => s + Number(r.hours || 0),
              0
            );

          const budget =
            Number(p.budget || 0);

          const remaining =
            Math.max(
              0,
              budget - spent
            );

          const pct =
            projectProgress(p.id);

          return `

            <div
              class="card"
              style="padding:18px;"
            >

              <h3
                style="font-size:14.5px;margin:0 0 8px;"
              >
                ${esc(p.name)}
              </h3>

              <div class="progress-track">

                <div
                  class="progress-fill"
                  style="
                    width:${pct}%;
                    background:${
                      pct > 90
                        ? 'var(--crimson)'
                        : 'linear-gradient(90deg,var(--coral),var(--cyan))'
                    };
                  "
                ></div>

              </div>

              <div
                class="proj-meta"
                style="margin-top:8px;"
              >

                <span>
                  ₱${spent.toLocaleString()}
                  of
                  ₱${budget.toLocaleString()}
                </span>

                <span>
                  ${hours}h logged
                </span>

              </div>

              <!-- REMAINING BALANCE -->

              <div
                style="
                  margin-top:10px;
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                "
              >

                <span>
                  Remaining Balance
                </span>

                <strong>
                  ₱${remaining.toLocaleString()}
                </strong>

              </div>

            </div>

          `;

        }).join('')}

    </div>


    ${can('manageResources') ? `

    <div
      class="card"
      style="padding:20px;margin-top:20px;"
    >

      <h3
        style="margin-top:0;font-size:15px;"
      >
        Log a resource / cost entry
      </h3>

      <div class="field-row">

        <div class="field">

          <label>
            Project
          </label>

          <select id="rsProject">

            ${DB.projects
              .filter(p => !isCompletedProject(p))
              .map(p => `

                <option value="${p.id}">
                  ${esc(p.name)}
                </option>

              `).join('')}

          </select>

        </div>


        <div class="field">

          <label>
            Category
          </label>

          <select id="rsCategory">

            <option>
              Labor
            </option>

            <option>
              Equipment
            </option>

            <option>
              Software
            </option>

            <option>
              Procurement
            </option>

          </select>

        </div>

      </div>


      <div class="field-row">

        <div class="field">

          <label>
            Description
          </label>

          <input
            id="rsDesc"
            placeholder="e.g. Freelance colorist — 3 days"
          >

        </div>


        <div class="field">

          <label>
            Cost (PHP)
          </label>

          <input
  id="rsCost"
  type="number"
  placeholder="750"
  min="750"
  max="999999"
  step="1"
  oninput="
    if(this.value.length > 6){
      this.value = this.value.slice(0,6);
    }
    if(Number(this.value) > 999999){
      this.value = 999999;
    }
  "
>

        </div>

      </div>


      <div class="field">

        <label>
          Hours (optional)
        </label>

        <input
          id="rsHours"
          type="number"
          placeholder="24"
          min="0"
          max="99"
          step="1"
          oninput="
            if(this.value.length > 2){
              this.value = this.value.slice(0,2);
            }

            if(Number(this.value) > 99){
              this.value = 99;
            }
          "
        >

      </div>


      <button
        class="btn btn-primary"
        onclick="Studio.addResource()"
      >
        Log entry
      </button>

    </div>

    ` : ''}


    <div
      class="card"
      style="margin-top:20px;"
    >

      <table>

        <thead>

          <tr>
            <th>Project</th>
            <th>Category</th>
            <th>Description</th>
            <th>Cost</th>
            <th>Hours</th>
          </tr>

        </thead>


        <tbody>

          ${DB.resources
            .slice()
            .reverse()
            .map(r => {

              const project =
                projectById(r.project);

              return `

                <tr>

                  <td>
                    ${esc(
                      project
                        ? project.name
                        : 'Unknown Project'
                    )}
                  </td>

                  <td>
                    ${esc(r.category)}
                  </td>

                  <td>
                    ${esc(r.desc)}
                  </td>

                  <td class="mono">
                    ₱${r.cost.toLocaleString()}
                  </td>

                  <td class="mono">
                    ${r.hours}h
                  </td>

                </tr>

              `;

            }).join('')}

        </tbody>

      </table>

    </div>

  `;

}


Studio.addResource = async function(){

  if(!can('manageResources')){

    toast(
      'You are not allowed to add resources.',
      'error'
    );

    return;
  }


  const projectId =
    document.getElementById('rsProject')?.value;


  const category =
    document.getElementById('rsCategory')?.value || '';


  const desc =
    document.getElementById('rsDesc')?.value.trim() || '';


  const cost =
    Number(
      document.getElementById('rsCost')?.value || 0
    );


  const hours =
    Number(
      document.getElementById('rsHours')?.value || 0
    );


  const project =
    DB.projects.find(
      p => p.id === projectId
    );


  if(!project){

    toast(
      'Please select a project.',
      'error'
    );

    return;
  }


  if(resourceProjectIsFinished(project)){

    toast(
      'Completed projects can no longer accept resource or cost entries.',
      'error'
    );

    return;
  }


  if(!desc){

    toast(
      'Description is required.',
      'error'
    );

    return;
  }


  if(cost < 750){

    toast(
      'Minimum cost is ₱750.',
      'error'
    );

    return;
  }


 if(cost > 999999){

  toast(
    'Maximum cost is ₱999,999.',
    'error'
  );

  return;
}


  if(hours < 0 || hours > 99){

    toast(
      'Hours must be between 0 and 99.',
      'error'
    );

    return;
  }


  const items =
    DB.resources.filter(
      r => r.project === projectId
    );


  const spent =
    items.reduce(
      (sum,r) => sum + Number(r.cost || 0),
      0
    );


  if(spent >= Number(project.budget || 0)){

    toast(
      'This project has already reached its budget limit.',
      'error'
    );

    return;
  }


  if(
    spent + cost >
    Number(project.budget || 0)
  ){

    toast(
      'This entry would exceed the project budget.',
      'error'
    );

    return;
  }


  try{

    const response =
      await fetch(
        '../api/assets/resources.php',
        {
          method:'POST',
          credentials:'include',
          headers:{
            'Content-Type':'application/json'
          },
          body:JSON.stringify({
            project_id:projectId,
            category:category,
            description:desc,
            cost:cost,
            hours:hours
          })
        }
      );


    const data =
      await parseApiResponse(response);


    if(!data.success){

      toast(
        data.error ||
        data.message ||
        'Failed to add resource.',
        'error'
      );

      return;
    }


    await loadResourcesFromDB();


    /* ----------------------------------------------------------
       NEW: CALCULATE REMAINING BALANCE AFTER ADDING COST
       ---------------------------------------------------------- */

    const updatedItems =
      DB.resources.filter(
        r => r.project === projectId
      );

    const updatedSpent =
      updatedItems.reduce(
        (sum,r) => sum + Number(r.cost || 0),
        0
      );

    const remainingBalance =
      Math.max(
        0,
        Number(project.budget || 0) - updatedSpent
      );


    toast(
      `Resource entry added. Remaining balance: ₱${remainingBalance.toLocaleString()}.`,
      'success'
    );


    render();


  }catch(error){

    console.error(
      'Error adding resource:',
      error
    );

    toast(
      'Unable to add resource.',
      'error'
    );

  }

};


function render(){

  if(!DB.currentUser) return;

  renderSidebar();

  const el =
    document.getElementById('pageContent');

  if(!el) return;

  switch(state.page){

    case 'dashboard':
      el.innerHTML=pageDashboard();
      break;

    case 'projects':
      el.innerHTML=pageProjects();
      break;

    case 'projectDetail':
      el.innerHTML=pageProjectDetail();
      break;

    case 'completedProjects':
      el.innerHTML=pageCompletedProjects();
      break;

    case 'assets':
      el.innerHTML=pageAssets();
      break;

    case 'assetDetail':
      el.innerHTML=pageAssetDetail();
      break;

    case 'review':
      el.innerHTML=pageReview();
      break;

    case 'notifications':
      el.innerHTML=pageNotifications();
      break;

    case 'integrations':
      el.innerHTML=pageIntegrations();
      break;

    case 'resources':
      el.innerHTML=pageResources();
      break;

    case 'audit':
      el.innerHTML=pageAudit();
      break;

    case 'users':
      el.innerHTML=pageUsers();
      break;

    case 'architecture':
      el.innerHTML=pageArchitecture();
      break;

    default:
      el.innerHTML=pageDashboard();

  }

}


document.addEventListener(
  'DOMContentLoaded',
  async () => {

    if(!DB.currentUser){

      window.location.assign(
        '../login/login.html'
      );

      return;
    }


    const menu =
      document.getElementById('menuButton');


    if(menu){

      menu.addEventListener(
        'click',
        () => {

          document
            .getElementById('sidebar')
            ?.classList.toggle('open');

        }
      );

    }


    // Load latest projects directly from database

    try{

      const response =
        await fetch(
          '../api/projects.php',
          {
            method:'GET',
            credentials:'include'
          }
        );


      const data =
        await parseApiResponse(response);


      if(
        response.ok &&
        data.success &&
        Array.isArray(data.projects)
      ){

        DB.projects =
          data.projects;

      }

    }catch(error){

      console.error(
        'Unable to load projects:',
        error
      );

    }


    // Load latest resource entries

    try{

      await loadResourcesFromDB();

    }catch(error){

      console.error(
        'Unable to load resources:',
        error
      );

    }


    render();

  }
);