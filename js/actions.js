/* ---------------- Core actions ---------------- */
const Studio = {

  manualLogin(){
    const name = document.getElementById('loginName').value.trim();
    const role = document.getElementById('loginRole').value;
    if(!name){ toast('Enter a name to sign in.','error'); return; }
    let u = DB.users.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(!u){ u = {id:nid('u'), name, role}; DB.users.push(u); }
    else { u.role = role; }
    Studio.completeLogin(u);
  },
  quickLogin(id){
    const u = userById(id);
    Studio.completeLogin(u);
  },
  completeLogin(u){
    DB.currentUser = u;
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('app').style.display='block';
    state.page='dashboard';
    render();
    toast('Signed in as '+u.name+' ('+ROLE_LABELS[u.role]+').','success');
  },
  logout(){
    DB.currentUser=null;
    document.getElementById('app').style.display='none';
    document.getElementById('loginScreen').style.display='flex';
  },

  goto(page, arg){
    state.page = page;
    if(page==='projectDetail') state.selectedProjectId = arg;
    if(page==='assetDetail') state.selectedAssetId = arg;
    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo(0,0);
    render();
  },

  toggleForm(id){
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hidden');
  },

  /* ---- Projects ---- */
  createProject(){
    if(!can('manageProjects')) return;
    const name = document.getElementById('npName').value.trim();
    const client = document.getElementById('npClient').value.trim();
    const deadline = document.getElementById('npDeadline').value;
    const budget = parseFloat(document.getElementById('npBudget').value)||0;
    if(!name || !client){ toast('Project name and client are required.','error'); return; }
    const p = {id:nid('p'), name, client, status:'Pre-Production', deadline, pm:DB.currentUser.id, team:[DB.currentUser.id], budget};
    DB.projects.push(p);
    pushAudit('Create','Project', name);
    pushEvent('Project Created',{project:name,by:DB.currentUser.name});
    toast('Project created: '+name,'success');
    Studio.goto('projects');
  },

  /* ---- Assets / Submission ---- */
  submitAsset(){
    if(!can('submitAssets')){ toast('Your role cannot submit assets.','error'); return; }
    const project = document.getElementById('saProject').value;
    const existingId = document.getElementById('saExisting').value;
    const title = document.getElementById('saTitle').value.trim();
    const type = document.getElementById('saType').value;
    const notes = document.getElementById('saNotes').value.trim();
    const link = document.getElementById('saLink').value.trim();
    const fileInput = document.getElementById('saFile');
    const fileName = fileInput && fileInput.files.length ? fileInput.files[0].name : '';

    if(existingId !== 'new'){
      const asset = assetById(existingId);
      const v = {id:nid('v'), n:asset.versions.length+1, status:'For Review', notes: notes||('Revised file: '+ (fileName||'no file attached')), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)};
      asset.versions.push(v);
      if(link) asset.link = link;
      pushAudit('Upload', asset.title, 'Submitted v'+v.n+' (auto-status: For Review)');
      pushEvent('Asset Uploaded',{asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      pushNotif('submission', 'New version submitted: “'+asset.title+'” v'+v.n+' is awaiting review.', asset.id);
      toast('New version submitted — status set to For Review.','success');
      Studio.goto('assetDetail', asset.id);
      return;
    }
    if(!title || !project){ toast('Title and project are required.','error'); return; }
    const a = {id:nid('a'), project, title, type, link, versions:[
      {id:nid('v'), n:1, status:'For Review', notes: notes||('File: '+(fileName||'no file attached')), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)}
    ]};
    DB.assets.push(a);
    pushAudit('Upload', title, 'Submitted v1 (auto-status: For Review)');
    pushEvent('Asset Uploaded',{asset:title, version:'v1', by:DB.currentUser.name});
    pushNotif('submission', 'New submission: “'+title+'” is awaiting review.', a.id);
    toast('Asset submitted — workflow set status to “For Review”.','success');
    Studio.goto('assetDetail', a.id);
  },

  onSaExistingChange(){
    const v = document.getElementById('saExisting').value;
    const wrap = document.getElementById('saNewFields');
    wrap.style.display = v==='new' ? 'block' : 'none';
  },

  /* ---- Review workflow ---- */
  reviewAsset(assetId, decision){
    if(!can('review')){ toast('Your role cannot review assets.','error'); return; }
    const asset = assetById(assetId);
    const v = latestVersion(asset);
    const commentBox = document.getElementById('reviewComment');
    const text = commentBox ? commentBox.value.trim() : '';
    const markFinal = document.getElementById('markFinal');
    const asFinal = markFinal ? markFinal.checked : false;

    if(decision==='approve'){
      v.status = asFinal ? 'Final' : 'Approved';
      pushAudit('Approval', asset.title, 'v'+v.n+(asFinal?' approved as FINAL':' approved'));
      pushEvent(asFinal?'Final Output Approved':'Asset Approved', {asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      DB.webhooks.push({id:nid('w'), endpoint:'https://hooks.beeproduction.studio/asset-approved', status:200,
        payload:JSON.stringify({asset:asset.title, version:'v'+v.n, final:asFinal}), date:new Date().toISOString()});
      pushNotif('approval', (asFinal?'“'+asset.title+'” was approved as Final Output.':'“'+asset.title+'” v'+v.n+' was approved.'), asset.id);
      toast(asFinal?'Marked as Final Output. Webhook fired.':'Approved. Webhook fired to production dashboard.','success');
    } else if(decision==='reject'){
      v.status = 'Rejected';
      pushAudit('Rejection', asset.title, 'v'+v.n+' rejected');
      pushEvent('Asset Rejected', {asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      pushNotif('revision', '“'+asset.title+'” v'+v.n+' was rejected.', asset.id);
      toast('Marked as rejected.','error');
    } else if(decision==='revise'){
      v.status = 'Revision Requested';
      pushAudit('Revision', asset.title, 'v'+v.n+' — revision requested');
      pushEvent('Revision Requested', {asset:asset.title, version:'v'+v.n, by:DB.currentUser.name});
      pushNotif('revision', 'Revision requested on “'+asset.title+'” v'+v.n+'.', asset.id);
      toast('Revision requested.','success');
    }
    if(text){
      DB.comments.push({id:nid('c'), asset:asset.id, by:DB.currentUser.id, text, date:new Date().toISOString().slice(0,10)});
    }
    render();
  },

  quickApprove(assetId){
    state.selectedAssetId = assetId;
    Studio.reviewAsset(assetId,'approve');
    toast('Approved from Review Queue.','success');
  },

  /* ---- Comments ---- */
  addComment(assetId){
    if(!can('comment')) return;
    const box = document.getElementById('newComment');
    const text = box.value.trim();
    if(!text) return;
    DB.comments.push({id:nid('c'), asset:assetId, by:DB.currentUser.id, text, date:new Date().toISOString().slice(0,10)});
    box.value='';
    pushAudit('Comment', assetById(assetId).title, 'Feedback added');
    render();
  },

  /* ---- Notifications ---- */
  markRead(id){ const n = DB.notifications.find(x=>x.id===id); if(n) n.read=true; render(); },
  markAllRead(){ DB.notifications.forEach(n=>n.read=true); render(); toast('All notifications marked as read.'); },

  /* ---- Integration hub: API ---- */
  apiSend(){
    const sel = document.getElementById('apiAssetSelect');
    const assetId = sel.value;
    const asset = assetById(assetId);
    if(!asset) return;
    const v = latestVersion(asset);
    const reqPayload = {asset:asset.title, version:'v'+v.n, status:v.status, project:projectById(asset.project).name};
    DB.apiLogs.push({id:nid('api'), dir:'REQUEST', method:'POST', endpoint:'/api/v1/production-dashboard/assets', body:JSON.stringify(reqPayload), date:new Date().toISOString()});
    render();
    toast('Request sent…');
    setTimeout(()=>{
      DB.apiLogs.push({id:nid('api'), dir:'RESPONSE', method:'POST', endpoint:'/api/v1/production-dashboard/assets', status:201,
        body:JSON.stringify({received:true, id:'dash_'+asset.id, syncedAt:new Date().toISOString()}), date:new Date().toISOString()});
      pushAudit('Integration', asset.title, 'Synced to Production Dashboard via API');
      pushEvent('Asset Synced to Dashboard', {asset:asset.title});
      toast('201 Created — synced to Production Dashboard.','success');
      render();
    }, 650);
  },

  /* ---- Integration hub: ETL ---- */
  runETL(){
    const raw = document.getElementById('etlInput').value.trim();
    const log = document.getElementById('etlLog');
    if(!raw){ toast('Paste or keep the sample CSV first.','error'); return; }
    const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
    const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const rows = lines.slice(1);
    let steps = [];
    steps.push('EXTRACT — read '+rows.length+' row(s) from source file.');
    let loaded = 0, skipped = 0;
    rows.forEach(line=>{
      const cells = line.match(/(".*?"|[^,]+)/g) || [];
      const clean = cells.map(c=>c.replace(/^"|"$/g,'').trim());
      const rec = {};
      header.forEach((h,i)=> rec[h] = clean[i] || '');
      if(!rec.title || !rec.project){ skipped++; return; }
      const proj = DB.projects.find(p=> p.name.toLowerCase().includes(rec.project.toLowerCase()) || rec.project.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()));
      const type = ['Storyboard','Animatic','Character Sheet','Background Asset','Animation Scene','Render','Audio','Design Draft'].includes(rec.type) ? rec.type : 'Design Draft';
      const asset = {id:nid('a'), project: proj?proj.id:DB.projects[0].id, title:rec.title, type,
        link:'', versions:[{id:nid('v'), n:1, status:'For Review', notes:'Imported via ETL — assignee: '+(rec.assignee||'unassigned')+(rec.duedate?(', due '+rec.duedate):''), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)}]};
      DB.assets.push(asset);
      loaded++;
    });
    steps.push('TRANSFORM — validated required fields, normalized asset type, mapped project names ('+skipped+' row(s) skipped for missing data).');
    steps.push('LOAD — inserted '+loaded+' new asset record(s), each auto-set to “For Review”.');
    log.innerHTML = steps.map(s=>'<div class="log-line"><span class="t">›</span><span>'+esc(s)+'</span></div>').join('');
    pushAudit('Integration','ETL Import', loaded+' asset(s) imported from CSV');
    pushEvent('ETL Import Completed', {rows:rows.length, loaded, skipped});
    toast('ETL run complete — '+loaded+' record(s) loaded.','success');
    render();
  },

  /* ---- Resources / ERP ---- */
  addResource(){
    if(!can('manageResources')) return;
    const project = document.getElementById('rsProject').value;
    const category = document.getElementById('rsCategory').value;
    const desc = document.getElementById('rsDesc').value.trim();
    const cost = parseFloat(document.getElementById('rsCost').value)||0;
    const hours = parseFloat(document.getElementById('rsHours').value)||0;
    if(!desc){ toast('Add a short description.','error'); return; }
    DB.resources.push({id:nid('r'), project, category, desc, cost, hours});
    pushAudit('Resource', projectById(project).name, category+' entry added: '+desc);
    toast('Resource entry logged.','success');
    render();
  },

  /* ---- Users ---- */
  addUser(){
    if(!can('manageUsers')) return;
    const name = document.getElementById('umName').value.trim();
    const role = document.getElementById('umRole').value;
    if(!name){ toast('Enter a name.','error'); return; }
    const u = {id:nid('u'), name, role};
    DB.users.push(u);
    pushAudit('User', name, 'Added to team as '+ROLE_LABELS[role]);
    toast('Team member added.','success');
    document.getElementById('umName').value='';
    render();
  },
  changeRole(uid, role){
    const u = userById(uid); if(!u) return;
    u.role = role;
    pushAudit('User', u.name, 'Role changed to '+ROLE_LABELS[role]);
    toast(u.name+' is now '+ROLE_LABELS[role]+'.');
    render();
  },

  setFilter(key,val){ state.filter[key]=val; render(); },
};
