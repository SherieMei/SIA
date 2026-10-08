const editorSequenceState={
  loaded:false,
  attempted:false,
  loading:false,
  error:'',
  projects:[],
  library:[],
  sequences:[],
  projectId:'',
  sequenceId:null,
  title:'',
  notes:'',
  items:[]
};

function syncEditorSequenceForm(){
  const projectId=document.getElementById('sequence-project')?.value;
  const title=document.getElementById('sequence-title')?.value;
  const notes=document.getElementById('sequence-notes')?.value;
  if(projectId!==undefined)editorSequenceState.projectId=projectId;
  if(title!==undefined)editorSequenceState.title=title;
  if(notes!==undefined)editorSequenceState.notes=notes;
}

function editorSequenceMediaUrl(value){
  if(typeof value!=='string'||!value.trim())return '';
  try{
    const url=new URL(value,window.location.href);
    if(!['http:','https:'].includes(url.protocol))return '';
    if(
      url.origin===window.location.origin&&
      !url.pathname.startsWith(window.BEE_UPLOADS_BASE+'assets/')
    )return '';
    return url.href;
  }catch(error){
    return '';
  }
}

function renderEditorSequencesPage(){
  if(DB.currentUser?.role!=='editor'){
    return '<div class="empty">Sequence editing is available to Editors.</div>';
  }
  if(!editorSequenceState.loaded&&!editorSequenceState.loading&&!editorSequenceState.attempted){
    Studio.loadEditorSequences();
  }
  const projectId=editorSequenceState.projectId;
  const library=editorSequenceState.library.filter(asset=>
    String(asset.project_id)===String(projectId)
  );
  const currentItems=editorSequenceState.items;
  const currentSequence=editorSequenceState.sequences.find(sequence=>
    String(sequence.id)===String(editorSequenceState.sequenceId)
  );
  return `
    <div class="panel-head">
      <div>
        <div class="section-title">Sequence Editor</div>
        <div class="section-sub">Put approved shots and audio in order. When ready, save and continue straight to uploading your final cut.</div>
      </div>
      <button type="button" class="btn btn-sm" onclick="Studio.newEditorSequence()">New sequence</button>
    </div>
    ${editorSequenceState.error?`<div class="empty animation-shot-error" role="alert">${esc(editorSequenceState.error)} <button type="button" class="btn btn-sm" onclick="Studio.retryEditorSequences()">Retry</button></div>`:''}
    ${editorSequenceState.loading?'<div class="empty">Loading assigned projects and approved media…</div>':''}
    ${editorSequenceState.loaded?`
      <div class="editor-sequence-layout">
        <section class="card editor-sequence-composer">
          <h2>${editorSequenceState.sequenceId?'Edit sequence':'Create a sequence'}</h2>
          <label class="field">
            <span>Assigned project</span>
            <select id="sequence-project" onchange="Studio.changeEditorSequenceProject(this.value)">
              <option value="">Choose project</option>
              ${editorSequenceState.projects.map(project=>`<option value="${esc(project.id)}" ${String(project.id)===String(projectId)?'selected':''}>${esc(project.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Sequence / episode name</span>
            <input id="sequence-title" maxlength="255" value="${esc(editorSequenceState.title)}" placeholder="e.g. Episode 4 — Final Cut">
          </label>
          <label class="field">
            <span>Editor notes</span>
            <textarea id="sequence-notes" maxlength="10000" placeholder="Cut notes, audio cues, or remaining edit tasks">${esc(editorSequenceState.notes)}</textarea>
          </label>
          <div class="editor-sequence-add-row">
            <label class="field">
              <span>Add approved shot or audio</span>
              <select id="sequence-library">
                <option value="">Choose approved project media</option>
                ${library.map(asset=>`<option value="${esc(asset.asset_id)}">${esc(asset.type)} · ${esc(asset.title)}</option>`).join('')}
              </select>
            </label>
            <button type="button" class="btn btn-sm" onclick="Studio.addEditorSequenceItem()">Add to sequence</button>
          </div>
          ${!library.length&&projectId?'<p class="editor-sequence-hint">No approved Animation Scene or Audio assets are available in this project yet.</p>':''}
          <div class="editor-sequence-timeline">
            <div class="editor-sequence-timeline-head"><strong>Sequence order</strong><span>${currentItems.length} item${currentItems.length===1?'':'s'}</span></div>
            ${currentItems.length?currentItems.map((asset,index)=>`
              <article class="editor-sequence-item">
                <span class="editor-sequence-order">${String(index+1).padStart(2,'0')}</span>
                <div class="editor-sequence-item-main">
                  <strong>${esc(asset.title)}</strong>
                  <small>${esc(asset.type)} · ${esc(asset.status)}</small>
                  ${editorSequenceMediaUrl(asset.external_link)?asset.type==='Audio'?`<audio controls preload="none" src="${esc(editorSequenceMediaUrl(asset.external_link))}"></audio>`:`<a href="${esc(editorSequenceMediaUrl(asset.external_link))}" target="_blank" rel="noopener noreferrer">Preview approved shot ↗</a>`:''}
                </div>
                <div class="editor-sequence-item-actions">
                  <button type="button" class="btn btn-ghost btn-sm" aria-label="Move item up" onclick="Studio.moveEditorSequenceItem(${index},-1)" ${index===0?'disabled':''}>↑</button>
                  <button type="button" class="btn btn-ghost btn-sm" aria-label="Move item down" onclick="Studio.moveEditorSequenceItem(${index},1)" ${index===currentItems.length-1?'disabled':''}>↓</button>
                  <button type="button" class="btn btn-ghost btn-sm" aria-label="Remove item" onclick="Studio.removeEditorSequenceItem(${index})">×</button>
                </div>
              </article>
            `).join(''):'<div class="editor-sequence-hint">Add approved shots and audio to build the sequence order.</div>'}
          </div>
          <div class="editor-sequence-form-actions">
            <button type="button" class="btn" onclick="Studio.saveEditorSequence()">Save draft</button>
            ${!currentSequence?.cut_asset_id||currentSequence.cut_status==='Revision Requested'?`<button type="button" class="btn btn-primary" onclick="Studio.saveEditorSequence(true)">${currentSequence?.cut_asset_id?'Save & continue to revised cut':'Save & continue to final cut'}</button>`:''}
            ${currentSequence&&currentSequence.cut_asset_id&&currentSequence.cut_status!=='Revision Requested'?`<span class="editor-sequence-hint">Final cut is ${esc(currentSequence.cut_status||'under review')}.</span>`:''}
          </div>
        </section>
        <section class="editor-sequence-saved">
          <h2>Saved sequences</h2>
          ${editorSequenceState.sequences.length?editorSequenceState.sequences.map(sequence=>`
            <article class="card editor-sequence-card">
              <div class="editor-sequence-card-heading">
                <div><span>${esc(sequence.project_name)}</span><h3>${esc(sequence.title)}</h3></div>
                <span class="chip">${(sequence.items||[]).length} items</span>
              </div>
              <p>${esc(sequence.notes||'No editor notes.')}</p>
              ${sequence.cut_asset_id?`<div class="editor-sequence-cut">Final cut: ${esc(sequence.cut_title||'Submitted')} · ${esc(sequence.cut_status||'For Review')}</div>`:'<div class="editor-sequence-cut">No final cut submitted yet.</div>'}
              <div class="editor-sequence-card-actions">
                <button type="button" class="btn btn-sm" onclick="Studio.editEditorSequence('${esc(sequence.id)}')">Edit</button>
                ${sequence.cut_asset_id?`<button type="button" class="btn btn-sm" onclick="Studio.goto('assetDetail','${esc(sequence.cut_asset_id)}')">View cut</button>`:''}
                ${sequence.cut_asset_id&&sequence.cut_status==='Revision Requested'?`<button type="button" class="btn btn-sm" onclick="Studio.reviseEditorCut('${esc(sequence.id)}')">Upload revised cut</button>`:''}
                <button type="button" class="btn btn-sm" onclick="Studio.deleteEditorSequence('${esc(sequence.id)}')">Delete sequence</button>
              </div>
            </article>
          `).join(''):'<div class="card editor-sequence-empty">No sequences saved yet.</div>'}
        </section>
      </div>
    `:''}
  `;
}

Object.assign(Studio,{
  async loadEditorSequences(){
    if(editorSequenceState.loading||DB.currentUser?.role!=='editor')return;
    editorSequenceState.loading=true;
    editorSequenceState.attempted=true;
    editorSequenceState.error='';
    if(typeof render==='function')render();
    try{
      const response=await window.beeFetch(window.BEE_API_BASE+'editor_sequences.php',{credentials:'include'});
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success||!Array.isArray(data.projects)||!Array.isArray(data.library)||!Array.isArray(data.sequences)){
        throw new Error(data.error||'Could not load the assigned project media.');
      }
      editorSequenceState.projects=data.projects;
      editorSequenceState.library=data.library;
      editorSequenceState.sequences=data.sequences;
      editorSequenceState.projectId=editorSequenceState.projectId||data.projects[0]?.id||'';
      editorSequenceState.loaded=true;
    }catch(error){
      editorSequenceState.error=error.message||'Could not load the assigned project media.';
      console.error('Editor sequence load error:',error);
    }finally{
      editorSequenceState.loading=false;
      if(typeof render==='function')render();
    }
  },
  newEditorSequence(){
    editorSequenceState.sequenceId=null;
    editorSequenceState.title='';
    editorSequenceState.notes='';
    editorSequenceState.items=[];
    editorSequenceState.projectId=editorSequenceState.projects[0]?.id||'';
    render();
  },
  changeEditorSequenceProject(projectId){
    editorSequenceState.projectId=projectId;
    editorSequenceState.sequenceId=null;
    editorSequenceState.title='';
    editorSequenceState.notes='';
    editorSequenceState.items=[];
    render();
  },
  addEditorSequenceItem(){
    syncEditorSequenceForm();
    const assetId=document.getElementById('sequence-library')?.value;
    const asset=editorSequenceState.library.find(item=>String(item.asset_id)===String(assetId));
    if(!asset){
      toast('Choose an approved shot or audio asset first.','error');
      return;
    }
    editorSequenceState.items.push(asset);
    render();
  },
  moveEditorSequenceItem(index,direction){
    syncEditorSequenceForm();
    const target=index+direction;
    if(target<0||target>=editorSequenceState.items.length)return;
    [editorSequenceState.items[index],editorSequenceState.items[target]]=[
      editorSequenceState.items[target],
      editorSequenceState.items[index]
    ];
    render();
  },
  removeEditorSequenceItem(index){
    syncEditorSequenceForm();
    editorSequenceState.items.splice(index,1);
    render();
  },
  editEditorSequence(sequenceId){
    const sequence=editorSequenceState.sequences.find(item=>String(item.id)===String(sequenceId));
    if(!sequence)return;
    editorSequenceState.sequenceId=sequence.id;
    editorSequenceState.projectId=sequence.project_id;
    editorSequenceState.title=sequence.title;
    editorSequenceState.notes=sequence.notes||'';
    editorSequenceState.items=(sequence.items||[]).map(item=>({
      ...item,
      asset_id:item.asset_id
    }));
    render();
  },
  async saveEditorSequence(continueToCut=false){
    if(DB.currentUser?.role!=='editor'){
      toast('Only Editors can manage sequences.','error');
      return;
    }
    const projectId=document.getElementById('sequence-project')?.value||'';
    const title=document.getElementById('sequence-title')?.value.trim()||'';
    const notes=document.getElementById('sequence-notes')?.value||'';
    if(!projectId||!title){
      toast('Choose a project and enter a sequence name.','error');
      return;
    }
    try{
      const response=await window.beeFetch(window.BEE_API_BASE+'editor_sequences.php',{
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          action:'save',
          sequence_id:editorSequenceState.sequenceId,
          project_id:projectId,
          title,
          notes,
          items:editorSequenceState.items.map(item=>item.asset_id)
        })
      });
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success){
        throw new Error(data.error||'Could not save the sequence.');
      }
      editorSequenceState.projectId=projectId;
      editorSequenceState.title=title;
      editorSequenceState.notes=notes;
      editorSequenceState.sequenceId=data.sequence_id;
      if(continueToCut){
        const existing=editorSequenceState.sequences.find(sequence=>
          String(sequence.id)===String(data.sequence_id)
        );
        const url=new URL('../assets/assets.html',window.location.href);
        url.searchParams.set('submit','1');
        url.searchParams.set('project',projectId);
        url.searchParams.set('sequence',data.sequence_id);
        url.searchParams.set('type','Render');
        url.searchParams.set('title',`${title} — Final Cut`);
        if(existing?.cut_asset_id){
          url.searchParams.set('existing',existing.cut_asset_id);
        }
        toast(existing?.cut_asset_id?'Sequence saved. Continue with your revised cut.':'Sequence saved. Continue by uploading your final cut.','success');
        window.location.href=url.href;
        return;
      }
      editorSequenceState.loaded=false;
      editorSequenceState.attempted=false;
      await Studio.loadEditorSequences();
      const saved=editorSequenceState.sequences.find(item=>String(item.id)===String(data.sequence_id));
      if(saved)Studio.editEditorSequence(saved.id);
      toast('Sequence saved.','success');
    }catch(error){
      console.error('Editor sequence save error:',error);
      toast(error.message||'Could not save the sequence.','error');
    }
  },
  async retryEditorSequences(){
    editorSequenceState.loaded=false;
    editorSequenceState.attempted=false;
    editorSequenceState.error='';
    await Studio.loadEditorSequences();
  },
  async deleteEditorSequence(sequenceId){
    if(!window.confirm('Delete this sequence draft? Submitted cuts will remain in Assets.'))return;
    try{
      const response=await window.beeFetch(window.BEE_API_BASE+'editor_sequences.php',{
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'delete',sequence_id:sequenceId})
      });
      const data=await parseApiResponse(response);
      if(!response.ok||!data.success)throw new Error(data.error||'Could not delete the sequence.');
      editorSequenceState.sequences=editorSequenceState.sequences.filter(item=>String(item.id)!==String(sequenceId));
      if(String(editorSequenceState.sequenceId)===String(sequenceId))Studio.newEditorSequence();
      render();
      toast('Sequence deleted.','success');
    }catch(error){
      console.error('Editor sequence delete error:',error);
      toast(error.message||'Could not delete the sequence.','error');
    }
  },
  submitEditorCut(sequenceId){
    const sequence=editorSequenceState.sequences.find(item=>String(item.id)===String(sequenceId));
    if(!sequence)return;
    const url=new URL('../assets/assets.html',window.location.href);
    url.searchParams.set('submit','1');
    url.searchParams.set('project',sequence.project_id);
    url.searchParams.set('sequence',sequence.id);
    url.searchParams.set('type','Render');
    url.searchParams.set('title',`${sequence.title} — Final Cut`);
    window.location.href=url.href;
  },
  reviseEditorCut(sequenceId){
    const sequence=editorSequenceState.sequences.find(item=>String(item.id)===String(sequenceId));
    if(!sequence||!sequence.cut_asset_id||sequence.cut_status!=='Revision Requested')return;
    const url=new URL('../assets/assets.html',window.location.href);
    url.searchParams.set('submit','1');
    url.searchParams.set('project',sequence.project_id);
    url.searchParams.set('sequence',sequence.id);
    url.searchParams.set('existing',sequence.cut_asset_id);
    window.location.href=url.href;
  }
});
