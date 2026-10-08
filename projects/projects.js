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
const animationShotPreviewUrls=new Map();

function clearAnimationShotPreviewUrls(){
  for(const previewUrl of animationShotPreviewUrls.values()){
    URL.revokeObjectURL(previewUrl);
  }
  animationShotPreviewUrls.clear();
}

function previewAnimationShotFile(input){
  const assetId=input.id.match(/^shot-file-(\d+)$/)?.[1];
  const preview=document.getElementById(`shot-preview-${assetId}`);
  if(!assetId||!preview)return;

  const previousUrl=animationShotPreviewUrls.get(assetId);
  if(previousUrl){
    URL.revokeObjectURL(previousUrl);
    animationShotPreviewUrls.delete(assetId);
  }
  preview.replaceChildren();
  preview.hidden=true;

  const file=input.files?.[0];
  if(!file)return;

  const fileUrl=URL.createObjectURL(file);
  animationShotPreviewUrls.set(assetId,fileUrl);
  const extension=file.name.split('.').pop()?.toLowerCase()||'';
  const isImage=file.type.startsWith('image/')||['png','jpg','jpeg'].includes(extension);
  const isVideo=file.type.startsWith('video/')||['mp4','mov','ogv','ogg','webm'].includes(extension);
  const isPdf=file.type==='application/pdf'||extension==='pdf';
  const title=document.createElement('div');
  title.className='animation-shot-upload-preview-title';
  title.textContent=`Selected file preview · ${file.name}`;
  preview.append(title);

  if(isImage){
    const image=document.createElement('img');
    image.src=fileUrl;
    image.alt=`Preview of ${file.name}`;
    preview.append(image);
  }else if(isVideo){
    const video=document.createElement('video');
    video.src=fileUrl;
    video.controls=true;
    video.preload='metadata';
    video.playsInline=true;
    video.setAttribute('aria-label',`Preview of ${file.name}`);
    preview.append(video);
  }else if(isPdf){
    const frame=document.createElement('iframe');
    frame.src=fileUrl;
    frame.title=`Preview of ${file.name}`;
    preview.append(frame);
  }else{
    const message=document.createElement('p');
    message.textContent='Preview is not available for this document type. Open or download the file to inspect it.';
    preview.append(message);
  }

  const openLink=document.createElement('a');
  openLink.href=fileUrl;
  openLink.target='_blank';
  openLink.rel='noopener noreferrer';
  openLink.textContent=isPdf?'Open PDF in a new tab':'Open selected file in a new tab';
  preview.append(openLink);
  preview.hidden=false;
}


/* ==========================================================================
   LOAD REGISTERED CLIENT ACCOUNTS
   ========================================================================== */

async function loadClientsFromDB(){

  try{

    const response = await window.beeFetch(
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

let registeredEditors = [];
let registeredAnimators = [];
let registeredProjectManagers = [];

const PROJECT_BUDGET_MAX_DIGITS = 6;

function formatDateInput(date){
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinimumProjectDeadline(){
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateInput(tomorrow);
}

function isFutureProjectDate(value){
  if(!value) return false;
  const parts = value.split('-').map(Number);
  if(parts.length !== 3 || parts.some(part => !Number.isInteger(part))) return false;
  const selected = new Date(parts[0], parts[1] - 1, parts[2]);
  selected.setHours(0, 0, 0, 0);
  if(
    selected.getFullYear() !== parts[0] ||
    selected.getMonth() !== parts[1] - 1 ||
    selected.getDate() !== parts[2]
  ) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected > today;
}

function sanitizeProjectBudget(input){
  input.value = input.value.replace(/\D/g, '').slice(0, PROJECT_BUDGET_MAX_DIGITS);
}

function updateProjectDeadlineError(input){
  const error = document.getElementById('npDeadlineError');
  if(error) error.hidden = !input.value || isFutureProjectDate(input.value);
}

function validateProjectForm(){
  const deadlineInput = document.getElementById('npDeadline');
  const budgetInput = document.getElementById('npBudget');
  if(!deadlineInput || !budgetInput) return false;

  deadlineInput.min = getMinimumProjectDeadline();
  if(deadlineInput.value && !isFutureProjectDate(deadlineInput.value)){
    const error = document.getElementById('npDeadlineError');
    if(error) error.hidden = false;
    deadlineInput.setAttribute('aria-invalid', 'true');
    deadlineInput.focus();
    return false;
  }
  deadlineInput.removeAttribute('aria-invalid');

  sanitizeProjectBudget(budgetInput);
  const rawBudget = budgetInput.value;
  if(rawBudget.length > 0 && rawBudget.length <= PROJECT_BUDGET_MAX_DIGITS){
    const budget = Number(rawBudget);
    if(budget < 5000){
      toast('Minimum project budget is ₱5,000.', 'error');
      budgetInput.focus();
      return false;
    }
  }
  return true;
}

const existingCreateProject = Studio.createProject;
Studio.createProject = function(){
  if(!validateProjectForm()) return;
  return existingCreateProject.apply(this, arguments);
};


/* ==========================================================================
   LOAD PROJECT ASSIGNEES
   ========================================================================== */

async function loadProjectAssignees(){

  try{

    const response = await window.beeFetch(
      '../api/auth.php?action=users',
      {
        credentials:'include'
      }
    );

    const data = await parseApiResponse(response);

    if(!data.success || !Array.isArray(data.users)){
      throw new Error('Unable to load users.');
    }

    registeredEditors = data.users.filter(
      user => user.role === 'editor'
    );

    registeredAnimators = data.users.filter(
      user => user.role === 'animator'
    );
    registeredProjectManagers = data.users.filter(
      user => user.role === 'project_manager'
    );
    populateProjectAssigneeSelects();

  }catch(error){

    console.error(
      'Error loading project assignees:',
      error
    );

    registeredEditors = [];
    registeredAnimators = [];
    registeredProjectManagers = [];

  }

  function populateProjectAssigneeSelects(){
    const selectDefinitions=[
      ['nEditor',registeredEditors,'Select editor'],
      ['npAnimator',registeredAnimators,'Select animator'],
      ['npProjectManager',registeredProjectManagers,'Select project manager'],
      ['projectEditorAssignment',registeredEditors,'Unassigned'],
      ['projectAnimatorAssignment',registeredAnimators,'Unassigned'],
      ['projectManagerAssignment',registeredProjectManagers,'Select project manager'],
      ['projectClientAssignment',registeredClients,'Unassigned']
    ];
    selectDefinitions.forEach(([id,users,placeholder])=>{
      const select=document.getElementById(id);
      if(!select)return;
      const selected=select.dataset.selected||select.value;
      select.innerHTML=`<option value="">${placeholder}</option>`+
        users.map(user=>`<option value="${esc(user.id)}">${esc(user.full_name)}</option>`).join('');
      select.value=selected;
      delete select.dataset.selected;
    });
  }

}

/* ==========================================================================
   LOAD PROJECTS
   ========================================================================== */

async function loadProjectsFromDB(){

  try {

    const response = await window.beeFetch(
      window.BEE_API_BASE+'projects.php',
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
  if(DB.currentUser?.role==='client'){
    return pageClientProjects();
  }

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
          class="klay-back-btn"
          title="Back"
          aria-label="Go back"
          onclick="Studio.goBackSidebar('dashboard')"
        >
          ←
        </button>

        <div class="section-title">
          ${DB.currentUser?.role==='editor'?'My Projects':'Projects'}
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
                  Project Name
                </label>

                <input
                  id="npProjectName"
                  placeholder="e.g. Meridian Animation Network"
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
              registeredClients.map(user => `
              <option value="${esc(user.id)}" data-name="${esc(user.full_name)}">
                ${esc(user.full_name)}
              </option>
              `).join('')
            }

          </select>
          </div>

            </div>

              <div class="field-row">

              <div class="field">
                <label>
                  Editor
                </label>

                <select id="nEditor">
                <option value="">
                  Select editor
                </option>

                ${
                  registeredEditors.map(user => `
                  <option value="${esc(user.id)}">
                  ${esc(user.full_name)}
                  </option>
                  `).join('')
            }

            </select>
              </div>

              <div class="field">
            <label>
              Animator
                </label>

                <select id="npAnimator">
                <option value="">
                  Select animator
                </option>

                ${
                  registeredAnimators.map(user => `
                <option value="${esc(user.id)}">
                  ${esc(user.full_name)}
                </option>
                `).join('')
                }

            </select>
              </div>

            </div>

            ${DB.currentUser.role === 'admin' ? `
              <div class="field">
                <label for="npProjectManager">Project Manager</label>
                <select id="npProjectManager">
                  <option value="">Select project manager</option>
                  ${registeredProjectManagers.map(user => `
                    <option value="${esc(user.id)}">${esc(user.full_name)}</option>
                  `).join('')}
                </select>
              </div>
            ` : ''}


            <div class="field-row">

              <div class="field">
                <label>
                  Deadline
                </label>

                <input
                  id="npDeadline"
                  type="date"
                  min="${getMinimumProjectDeadline()}"
                  onchange="updateProjectDeadlineError(this)"
                >
                <small
                  id="npDeadlineError"
                  hidden
                  style="color:var(--crimson);font-size:12px;"
                >Due date must be a future date.</small>
              </div>


              <div class="field">
                <label>
                  Budget (PHP)
                </label>

                <input
                  id="npBudget"
                  type="text"
                  inputmode="numeric"
                  maxlength="${PROJECT_BUDGET_MAX_DIGITS}"
                  placeholder="5000"
                  oninput="sanitizeProjectBudget(this)"
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

const completion =
  getProjectCompletionInfo(p.id);

const canFinishProject =
  completion.canFinish;


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
  can('manageProjects')
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
          onclick="
            event.stopPropagation();
            finishProject('${p.id}');
          "
          title="${
  completion.missingTypes.length
    ? 'Missing asset types: ' + completion.missingTypes.join(', ')
    : completion.pendingAssets.length
      ? 'Resolve all For Review or Revision Requested assets first.'
      : completion.unresolvedAssets>0
        ? 'Review all project assets before finishing.'
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
                  ${DB.currentUser?.role==='editor'?'No assigned projects found.':'No active projects found.'}
            </div>
          `
      }

    </div>

  `;

}

function pageClientProjects(){
  const projects=Array.isArray(DB.projects)?DB.projects:[];
  return `
    <div class="panel-head client-projects-head">
      <div class="client-projects-title-wrap">
        <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button>
        <div class="client-projects-title-copy">
          <div class="section-title">My Projects</div>
          <div class="section-sub">Projects and assets assigned to your account.</div>
        </div>
      </div>
    </div>
    <div class="proj-grid client-project-grid">
      ${projects.length?projects.map(project=>{
        const outputs=DB.assets.filter(asset=>
          String(asset.project??asset.project_id)===String(project.id)
        );
        return `
          <article class="card proj-card client-project-card">
            <h3>${esc(project.name)}</h3>
            <div class="client">Project assets</div>
            <div class="proj-meta">
              <span>${outputs.length} asset${outputs.length===1?'':'s'}</span>
              <span>${outputs.length?'Project assets available':'No assets added yet'}</span>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="Studio.goto('projectDetail','${esc(project.id)}')">View project</button>
          </article>
        `;
      }).join(''):'<div class="empty">No projects have been assigned to your account yet.</div>'}
    </div>
  `;
}

function workspaceAssignedProjects(){
  return Array.isArray(DB.projects)?DB.projects:[];
}

function workspaceAssignedAssets(){
  const projectIds=new Set(workspaceAssignedProjects().map(project=>String(project.id)));
  return DB.assets.filter(asset=>projectIds.has(String(asset.project??asset.project_id)));
}

function pageAnimatorShotTracker(){
  const shots=Array.isArray(DB.animationShots)?DB.animationShots:[];
  const projectName=shot=>shot.project_name||projectById(shot.project_id)?.name||'Assigned project';
  return `
    <div class="panel-head">
      <div class="animation-shot-heading">
        <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button>
        <div class="animation-shot-heading-copy">
          <div class="eyebrow">MADE IN THE STUDIO</div>
          <div class="section-title">Studio Galeria</div>
          <div class="section-sub">Animation scenes awaiting your response to a client revision request.</div>
        </div>
      </div>
    </div>
    ${DB.animationShotsError?`<div class="empty animation-shot-error" role="alert">${esc(DB.animationShotsError)}</div>`:''}
    <div class="animation-shot-gallery ${shots.length===1?'animation-shot-gallery--single':''}">
      ${DB.animationShots===null?'<div class="empty">Loading your assigned animation scenes…</div>':shots.length?shots.map(shot=>{
        const id=Number(shot.asset_id);
        const safeId=Number.isInteger(id)&&id>0?id:0;
        const progress=Math.min(100,Math.max(0,Number(shot.progress)||0));
        const stage=shot.stage||'Blocking';
        const playblast=String(shot.playblast_url||'');
        let previewUrl='';
        try{
          const candidate=new URL(String(shot.asset_media_url||playblast),window.location.href);
          if(
            ['http:','https:'].includes(candidate.protocol)&&
            (
              candidate.origin!==window.location.origin||
              candidate.pathname.startsWith(window.BEE_UPLOADS_BASE+'assets/')
            )
          )previewUrl=candidate.href;
        }catch(error){
          previewUrl='';
        }
        const previewPath=(()=>{try{return new URL(previewUrl).pathname.toLowerCase();}catch(error){return '';}})();
        const isImage=/\.(avif|gif|jpe?g|png|webp)$/.test(previewPath);
        const isVideo=/\.(mp4|webm|ogv|ogg|mov)$/.test(previewPath);
        const workflowStatus=shot.workflow_status||'Not Started';
        const isAwaitingReview=workflowStatus==='For Review';
        const isLocked=isAwaitingReview||workflowStatus==='Completed';
        const workflowLabel=workflowStatus==='For Review'?'For Client Review':workflowStatus;
        const reviewStatus=shot.review_status||'';
        return `
          <article class="card animation-shot-card animation-gallery-card ${shots.length===1?'animation-gallery-card--single':''}">
            <div class="animation-gallery-preview" data-preview-label="${esc(shot.title||'Animation Scene')}">
              ${isImage?`<img src="${esc(previewUrl)}" alt="${esc(shot.title||'Animation scene')} preview" loading="lazy">`:isVideo?`<video controls preload="metadata" src="${esc(previewUrl)}" aria-label="${esc(shot.title||'Animation scene')} preview"></video>`:`<span class="animation-gallery-placeholder">${esc(shot.type||'ANIMATION SCENE')}</span>`}
              <span class="animation-gallery-index">${String(safeId).padStart(2,'0')}</span>
              <span class="animation-gallery-type">${esc(stage)}</span>
            </div>
            <div class="animation-gallery-body">
              <div class="animation-gallery-caption">
                <div>
                  <span class="animation-shot-project">${esc(projectName(shot))}</span>
                  <h2>${esc(shot.title||'Untitled shot')}</h2>
                </div>
                <span class="chip">Due ${esc(fmtDate(shot.due_date)||'Not set')}</span>
              </div>
              <div class="animation-shot-status-row">
                <span class="badge ${workflowStatus==='Completed'?'b-approved':workflowStatus==='Revision Required'?'b-revision':workflowStatus==='For Review'?'b-review':'b-role'}">${esc(workflowLabel)}</span>
                ${reviewStatus?`<span class="chip">Asset review: ${esc(reviewStatus)}</span>`:''}
              </div>
              <div class="animation-gallery-progress">
                <div><span>${esc(stage)}</span><strong>${progress}%</strong></div>
                <div class="animation-gallery-progress-track"><span style="width:${progress}%"></span></div>
              </div>
              ${shot.latest_feedback?renderFeedbackEntry({
                context:projectName(shot),
                title:'Latest review feedback',
                meta:fmtDate(shot.feedback_at)||'',
                text:shot.latest_feedback
              }):''}
              <label class="field">
                <span>Upload animation version <small>For client approval</small></span>
                <input id="shot-link-${safeId}" type="url" placeholder="HTTPS link to your animation" ${isAwaitingReview?'disabled':''}>
              </label>
              <div id="shot-preview-${safeId}" class="animation-shot-upload-preview" aria-live="polite" hidden></div>
              <div class="animation-gallery-actions">
                <button type="button" class="btn btn-primary btn-sm" onclick="Studio.submitShotVersion(${safeId})" ${isAwaitingReview?'disabled':''}>Submit version</button>
                <button type="button" class="btn btn-sm" onclick="Studio.goto('assetDetail','${safeId}')">View feedback</button>
              </div>
              <details class="animation-shot-edit">
                <summary>Update shot progress &amp; notes</summary>
                <div class="animation-shot-edit-fields">
                  <label class="field">
                    <span>Animation stage</span>
                    <select id="shot-stage-${safeId}" ${isLocked?'disabled':''}>
                      ${['Blocking','Spline','Polish','Ready for Review'].map(option=>`<option value="${option}" ${stage===option?'selected':''}>${option}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field animation-shot-progress-field">
                    <span>Progress <output id="shot-progress-value-${safeId}">${progress}%</output></span>
                    <input id="shot-progress-${safeId}" type="range" min="0" max="100" step="5" value="${progress}" ${isLocked?'disabled':''} oninput="document.getElementById('shot-progress-value-${safeId}').value=this.value+'%'">
                  </label>
                  <label class="field">
                    <span>Production status</span>
                    <select id="shot-status-${safeId}" ${isLocked?'disabled':''}>
                      ${['Not Started','In Progress',...(workflowStatus==='Revision Required'?['Revision Required']:[])].map(option=>`<option value="${option}" ${workflowStatus===option?'selected':''}>${option}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field">
                    <span>Playblast URL (optional)</span>
                    <input id="shot-playblast-${safeId}" type="url" maxlength="2048" value="${esc(playblast)}" ${isLocked?'disabled':''} placeholder="Paste a video or review link">
                  </label>
                  <label class="field animation-shot-notes-field">
                    <span>Animation notes / instructions</span>
                    <textarea id="shot-notes-${safeId}" maxlength="10000" ${isLocked?'disabled':''} placeholder="Task notes, acting direction, timing, or revision details">${esc(shot.task_notes||'')}</textarea>
                  </label>
                  <div class="animation-shot-edit-footer">
                    <small>${shot.progress_updated_at?`Updated ${esc(fmtDate(shot.progress_updated_at))}`:'Not started yet'}</small>
                    <button type="button" class="btn btn-sm" onclick="Studio.saveAnimationShot(${safeId})" ${isLocked?'disabled':''}>Save progress</button>
                  </div>
                </div>
              </details>
              ${isLocked?`<p class="animation-shot-lock-note">${isAwaitingReview?'Submitted to the client and waiting for approval.':'Approved and completed. You can still upload a new version.'}</p>`:''}
            </div>
          </article>
        `;
      }).join(''):DB.animationShotsError?'':`<div class="card animation-shot-empty"><h2>No client revision requests</h2><p>Animation scenes will appear here when the client requests a revision. Approved, rejected, and awaiting-review submissions remain in the asset history.</p><button type="button" class="btn btn-sm" onclick="Studio.goto('assets')">View assets</button></div>`}
    </div>
  `;
}

Object.assign(Studio,{
  async saveAnimationShot(assetId){
    if(DB.currentUser?.role!=='animator'){
      toast('Only assigned animators can update shot progress.','error');
      return;
    }
    const stage=document.getElementById(`shot-stage-${assetId}`)?.value;
    const progress=Number(document.getElementById(`shot-progress-${assetId}`)?.value);
    const playblastUrl=document.getElementById(`shot-playblast-${assetId}`)?.value.trim()||'';
    const workflowStatus=document.getElementById(`shot-status-${assetId}`)?.value||'In Progress';
    const taskNotes=document.getElementById(`shot-notes-${assetId}`)?.value||'';
    try{
      const response=await window.beeFetch(window.BEE_API_BASE+'animation_shots.php',{
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          asset_id:assetId,
          stage,
          progress,
          playblast_url:playblastUrl,
          workflow_status:workflowStatus,
          task_notes:taskNotes
        })
      });
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success||!data.shot){
        throw new Error(data.error||'Could not save shot progress.');
      }
      DB.animationShots=(DB.animationShots||[]).map(shot=>
        Number(shot.asset_id)===Number(assetId)?{...shot,...data.shot}:shot
      );
      DB.animationShotsError='';
      toast('Shot progress saved.','success');
      render();
    }catch(error){
      console.error('Animation shot progress save error:',error);
      toast(error.message||'Could not save shot progress.','error');
    }
  },
  async submitShotVersion(assetId){
    if(DB.currentUser?.role!=='animator'){
      toast('Only the assigned animator can submit an animation version.','error');
      return;
    }
    const link=document.getElementById(`shot-link-${assetId}`)?.value.trim();
    if(!link){
      toast('Enter an animation or playblast link first.','error');
      return;
    }
    const shot=DB.animationShots?.find(item=>Number(item.asset_id)===Number(assetId));
    if(!shot){
      toast('The assigned animation shot could not be found. Refresh and try again.','error');
      return;
    }
    const body=new FormData();
    body.append('action','version');
    body.append('asset_id',String(assetId));
    body.append('notes',document.getElementById(`shot-notes-${assetId}`)?.value||'');
    body.append('link',link);
    try{
      const response=await window.beeFetch(window.BEE_API_BASE+'assets.php',{
        method:'POST',
        credentials:'include',
        body
      });
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success||!data.version){
        throw new Error(data.error||'Could not submit the animation version.');
      }
      shot.workflow_status='For Review';
      shot.review_status='For Review';
      shot.review_notes=data.version.notes||'';
      shot.version_number=data.version.n;
      shot.playblast_url=data.link||shot.playblast_url;
      toast(`Animation version ${data.version.n} submitted for review.`,'success');
      render();
    }catch(error){
      console.error('Animation version submit error:',error);
      toast(error.message||'Could not submit the animation version.','error');
    }
  }
});

function editorStatusBadge(status){
  return `<span class="badge ${STATUS_CLASS[status]||'b-role'}">${esc(status||'Not Started')}</span>`;
}

function pageEditorTracker(){
  const assets=workspaceAssignedAssets();
  const rows=assets.map(asset=>({
    asset,
    project:projectById(asset.project??asset.project_id),
    version:latestVersion(asset)
  }));
  return `
    <div class="panel-head">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button>
          <div class="section-title">Tracker</div>
        </div>
        <div class="section-sub">Track the latest status of assets in your assigned projects.</div>
      </div>
    </div>
    <div class="card editor-workspace-table-wrap">
      <table class="editor-workspace-table">
        <thead><tr><th>Asset</th><th>Project</th><th>Status</th><th>Version</th><th>Due Date</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.length?rows.map(({asset,project,version})=>`
            <tr>
              <td><strong>${esc(asset.title)}</strong><small>${esc(asset.type||'Asset')}</small></td>
              <td>${esc(project?.name||'—')}</td>
              <td>${editorStatusBadge(version.status)}</td>
              <td>V${String(version.n||1).padStart(2,'0')}</td>
              <td>${fmtDate(asset.due_date)}</td>
              <td><button type="button" class="btn btn-sm" onclick="Studio.goto('assetDetail','${esc(asset.id)}')">Open</button></td>
            </tr>
          `).join(''):'<tr><td colspan="6" class="editor-workspace-empty">No assigned assets yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function pageEditorSchedule(){
  const events=workspaceAssignedProjects().flatMap(project=>{
    const rows=[];
    if(project.deadline)rows.push({date:project.deadline,label:'Project deadline',title:project.name,projectId:project.id});
    workspaceAssignedAssets()
      .filter(asset=>String(asset.project??asset.project_id)===String(project.id)&&asset.due_date)
      .forEach(asset=>rows.push({date:asset.due_date,label:'Asset due date',title:asset.title,assetId:asset.id,projectId:project.id}));
    return rows;
  }).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const scheduleRows=events.map(item=>{
    const route=item.assetId?'assetDetail':'projectDetail';
    const targetId=item.assetId||item.projectId;
    const projectName=projectById(item.projectId)?.name||'';
    return `
      <button type="button" class="editor-schedule-row" onclick="Studio.goto('${route}','${esc(targetId)}')">
        <span class="editor-schedule-date">${fmtDate(item.date)}</span>
        <span class="editor-schedule-main"><strong>${esc(item.title)}</strong><small>${esc(item.label)} · ${esc(projectName)}</small></span>
        <span aria-hidden="true">→</span>
      </button>
    `;
  }).join('');
  return `
    <div class="panel-head">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button>
          <div class="section-title">Schedule</div>
        </div>
        <div class="section-sub">Upcoming project and asset dates from your assigned work.</div>
      </div>
    </div>
    <div class="card editor-schedule-list">
      ${scheduleRows||'<div class="editor-workspace-empty">No scheduled deadlines for assigned work.</div>'}
    </div>
  `;
}

function pageEditorFeedback(){
  const assets=new Map(workspaceAssignedAssets().map(asset=>[String(asset.id),asset]));
  const entries=(DB.comments||[])
    .filter(comment=>assets.has(String(comment.asset)))
    .map(comment=>({
      comment,
      asset:assets.get(String(comment.asset)),
      project:projectById(assets.get(String(comment.asset))?.project??assets.get(String(comment.asset))?.project_id),
      version:latestVersion(assets.get(String(comment.asset)))
    }))
    .sort((a,b)=>String(b.comment.date||'').localeCompare(String(a.comment.date||'')));
  return `
    <div class="panel-head">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button>
          <div class="section-title">Feedback</div>
        </div>
        <div class="section-sub">Comments attached to assets in your assigned projects.</div>
      </div>
    </div>
    <div class="editor-feedback-list">
      ${entries.length?entries.map(({comment,asset,project,version})=>{
        const author=userById(comment.by);
        return renderFeedbackEntry({
          context:project?.name||'',
          title:asset.title,
          meta:`V${String(comment.version||version.n||1).padStart(2,'0')} · ${author?.name||'Reviewer / Client'} · ${fmtDate(comment.date)}`,
          status:version.status,
          text:comment.text||comment.comment||'',
          actionHtml:`<button type="button" class="btn btn-sm" onclick="Studio.goto('assetDetail','${esc(asset.id)}')">View feedback</button>`
        });
      }).join(''):'<div class="empty">No feedback comments are available for your assigned assets.</div>'}
    </div>
  `;
}


/* ==========================================================================
   PAGE — PROJECT DETAILS
   ========================================================================== */

function pageProjectDetail(){
  if(DB.currentUser?.role==='client'){
    return pageClientProjectDetail();
  }

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

    const completion =
  getProjectCompletionInfo(p.id);


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
        class="klay-back-btn"
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
        ${!completion.canFinish ? `

  <div
    style="
      margin-top:14px;
      padding:14px 16px;
      border:1px solid rgba(240,73,90,.25);
      border-radius:12px;
      background:rgba(240,73,90,.04);
    "
  >

    <div
      style="
        font-weight:700;
        font-size:13px;
        margin-bottom:7px;
      "
    >
      Project requirements not yet complete
    </div>


    ${
      completion.missingTypes.length > 0
        ? `
          <div style="font-size:12.5px;margin-top:5px;">
            Missing asset types:
            <b>${completion.missingTypes.map(type => esc(type)).join(', ')}</b>
          </div>
        `
        : ''
    }

    ${
      completion.pendingAssets.length
        ? `
          <div
            style="
              font-size:12.5px;
              margin-top:5px;
            "
          >
            ${completion.pendingAssets.length}
            asset(s) still need review or revision.
          </div>
        `
        : ''
    }

    ${
      completion.unresolvedAssets > 0 &&
      completion.pendingAssets.length === 0
        ? `
          <div style="font-size:12.5px;margin-top:5px;">
            Review all project assets before finishing.
          </div>
        `
        : ''
    }

  </div>

` : `

  <div
    style="
      margin-top:14px;
      padding:14px 16px;
      border-radius:12px;
      background:rgba(43,217,201,.08);
      font-size:12.5px;
      font-weight:600;
    "
  >
    All project requirements are complete.
  </div>

`}

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
        can('uploadAsset')&&
        ['admin','project_manager'].includes(DB.currentUser?.role)&&
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
          :DB.currentUser?.role==='editor'&&p.status!=='Completed'
            ?"<button type=\"button\" class=\"btn btn-primary btn-sm\" onclick=\"Studio.goto('editorSequences')\">Open Sequence Editor</button>"
            :DB.currentUser?.role==='animator'&&p.status!=='Completed'
              ?"<button type=\"button\" class=\"btn btn-primary btn-sm\" onclick=\"Studio.goto('shotTracker')\">Open Studio Galeria</button>"
              :''
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

    ${can('manageProjects') ? `
      <section class="card" style="padding:18px;margin-top:16px;">
        <h3 style="margin:0 0 12px;font-size:15px;">Project assignments</h3>
        <div class="field-row">
          ${DB.currentUser.role === 'admin' ? `
            <div class="field">
              <label for="projectManagerAssignment">Project Manager</label>
              <select id="projectManagerAssignment" data-selected="${esc(p.pm??p.project_manager_id??'')}">
                <option value="">Select project manager</option>
                ${registeredProjectManagers.map(user=>`<option value="${esc(user.id)}">${esc(user.full_name)}</option>`).join('')}
              </select>
            </div>
          ` : ''}
          <div class="field">
            <label for="projectEditorAssignment">Editor</label>
            <select id="projectEditorAssignment" data-selected="${esc(p.editor_id??p.artist_id??'')}">
              <option value="">Unassigned</option>
              ${registeredEditors.map(user=>`<option value="${esc(user.id)}">${esc(user.full_name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="projectAnimatorAssignment">Animator</label>
            <select id="projectAnimatorAssignment" data-selected="${esc(p.animator_id??'')}">
              <option value="">Unassigned</option>
              ${registeredAnimators.map(user=>`<option value="${esc(user.id)}">${esc(user.full_name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="projectClientAssignment">Client</label>
            <select id="projectClientAssignment" data-selected="${esc(p.client_id??'')}">
              <option value="">Unassigned</option>
              ${registeredClients.map(user=>`<option value="${esc(user.id)}">${esc(user.full_name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Studio.updateProjectAssignments('${esc(p.id)}')">Save assignments</button>
      </section>
    ` : ''}

  `;

}


/* ==========================================================================
   CLIENT PROJECT DETAILS
   ========================================================================== */

function pageClientProjectDetail(){
  const project=projectById(state.selectedProjectId);
  if(!project){
    return `<section class="card asset-access-unavailable"><h2>Project unavailable</h2><p>This project is not assigned to your account.</p></section>`;
  }
  const outputs=DB.assets.filter(asset=>
    String(asset.project??asset.project_id)===String(project.id)
  );
  return `
    <div class="panel-head">
      <div style="display:flex;align-items:center;gap:10px;">
        <button type="button" class="klay-back-btn" title="Go back" aria-label="Back to projects" onclick="Studio.goto('projects')">←</button>
        <div>
          <div class="section-title">${esc(project.name)}</div>
          <div class="section-sub">Assets and outputs from your assigned project.</div>
        </div>
      </div>
    </div>
    <section class="card" style="padding:18px;margin-top:14px;">
      <h2 style="margin:0;font-size:16px;">Project assets</h2>
      <div class="client-project-outputs">
        ${outputs.length?outputs.map(asset=>{
          const version=latestVersion(asset);
          return `
            <button type="button" class="editor-task-row" onclick="Studio.goto('assetDetail','${esc(asset.id)}')">
              <span><strong>${esc(asset.title)}</strong><small>${esc(asset.type||'Asset')} · V${String(version.n||1).padStart(2,'0')}</small></span>
              ${editorStatusBadge(version.status)}
            </button>
          `;
        }).join(''):'<div class="editor-workspace-empty">No assets have been added to this project yet.</div>'}
      </div>
    </section>
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
  const completion =
  getProjectCompletionInfo(projectId);

if(!completion.canFinish){

  if(completion.missingTypes.length){
    toast(
      'Missing asset types: ' +
      completion.missingTypes.join(', '),
      'error'
    );
    return;
  }

  if(completion.pendingAssets.length){
    toast(
      'Resolve all For Review or Revision Requested assets first.',
      'error'
    );
    return;
  }

  if(completion.unresolvedAssets>0){
    toast(
      'Review all project assets before finishing.',
      'error'
    );
    return;
  }

  toast(
    'This project needs at least one asset before it can be finished.',
    'error'
  );
  return;
}

  const projectAssets =
    DB.assets.filter(
      a => String(a.project??a.project_id)===String(projectId)
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

        const response = await window.beeFetch(
          window.BEE_API_BASE+'projects.php',
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

  clearAnimationShotPreviewUrls();
  renderSidebar();

  const el =
    document.getElementById('pageContent');

  if(!el){
    return;
  }

  switch(state.page){

    case 'dashboard':
      el.innerHTML = typeof pageDashboard==='function'
        ?pageDashboard()
        :pageProjects();
      break;


    case 'projects':
      el.innerHTML =
        pageProjects();
      break;

    case 'tracker':
      el.innerHTML = ['editor','animator'].includes(DB.currentUser?.role)
        ?pageEditorTracker()
        :pageDashboard();
      break;

    case 'shotTracker':
      el.innerHTML = DB.currentUser?.role==='animator'
        ?pageAnimatorShotTracker()
        :pageDashboard();
      break;

    case 'editorSequences':
      el.innerHTML = DB.currentUser?.role==='editor'
        ?renderEditorSequencesPage()
        :pageDashboard();
      break;

    case 'schedule':
      el.innerHTML = pageEditorSchedule();
      break;

    case 'feedback':
      el.innerHTML = pageEditorFeedback();
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
  await window.BEE_SERVER_READY;

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

    document.addEventListener('change',event=>{
      const input=event.target;
      if(input instanceof HTMLInputElement&&input.matches('input[id^="shot-file-"]')){
        previewAnimationShotFile(input);
      }
    });

    /*
      Load clients FIRST.

      This makes sure the Client dropdown already has
      the registered client accounts before the project
      page is rendered.
    */

    await loadClientsFromDB();
await loadProjectsFromDB();

const clientSelect =
  document.getElementById('npClient');

if(clientSelect){

  clientSelect.innerHTML =
  '<option value="">Select client</option>' +
  registeredClients.map(user => `
    <option value="${esc(user.id)}" data-name="${esc(user.full_name)}">
      ${esc(user.full_name)}
    </option>
  `).join('');

}

await loadProjectAssignees();

  }
);