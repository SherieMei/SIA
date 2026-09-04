/* ==========================================================================
   ASSET / SUBMISSION ACTIONS — new assets, new versions of existing assets.
   Workflow automation lives here: every submission auto-sets "For Review".
   ========================================================================== */
Object.assign(Studio, {

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

});
