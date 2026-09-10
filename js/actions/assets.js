/* ==========================================================================
   ASSET / SUBMISSION ACTIONS — new assets, new versions of existing assets.
   Workflow automation lives here: every submission auto-sets "For Review".
   ========================================================================== */
Object.assign(Studio, {

  async submitAsset(){
  if(!can('submitAssets')){
    toast('Your role cannot submit assets.','error');
    return;
  }

  const project = document.getElementById('saProject').value;
  const existingId = document.getElementById('saExisting').value;
  const title = document.getElementById('saTitle').value.trim();
  const type = document.getElementById('saType').value;
  const notes = document.getElementById('saNotes').value.trim();
  const link = document.getElementById('saLink').value.trim();

  const fileInput = document.getElementById('saFile');
  const fileName = fileInput && fileInput.files.length
    ? fileInput.files[0].name
    : '';

  /* ============================================================
     EXISTING ASSET → NEW VERSION
     ============================================================ */
  if(existingId !== 'new'){
  const asset = assetById(existingId);

  if(!asset){
    toast('Asset not found.','error');
    return;
  }

  try {
    const response = await fetch('/SIA/api/assets.php', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'version',
        asset_id: asset.id,
        external_link: link,
        notes: notes || ('Revised file: ' + (fileName || 'no file attached'))
      })
    });

    const data = await response.json();

    if(!response.ok || !data.success){
      toast(data.error || 'Failed to save new version.', 'error');
      return;
    }

    /* Use the version returned by PHP/MySQL */
    asset.versions.push(data.version);

    if(link){
      asset.link = link;
    }

    pushAudit(
      'Upload',
      asset.title,
      'Submitted v' + data.version.n + ' (auto-status: For Review)'
    );

    pushEvent('Asset Uploaded', {
      asset: asset.title,
      version: 'v' + data.version.n,
      by: DB.currentUser.name
    });

    pushNotif(
      'submission',
      'New version submitted: “' + asset.title + '” v' + data.version.n + ' is awaiting review.',
      asset.id
    );

    toast(
      'New version submitted — status set to For Review.',
      'success'
    );

    Studio.goto('assetDetail', asset.id);

  } catch(error) {
    toast('Could not connect to the server.', 'error');
  }

  return;
}
  /* ============================================================
     NEW ASSET
     ============================================================ */
  if(!title || !project){
    toast('Title and project are required.','error');
    return;
  }

  try {

    const response = await fetch('/SIA/api/assets.php', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: project,
        title: title,
        type: type,
        external_link: link,
        notes: notes
      })
    });

    const data = await response.json();

    if(!response.ok || !data.success){
      toast(
        data.error || 'Failed to save asset.',
        'error'
      );
      return;
    }

    /* Use the asset returned by PHP/MySQL */
    DB.assets.push(data.asset);

    pushAudit(
      'Upload',
      title,
      'Submitted v1 (auto-status: For Review)'
    );

    pushEvent('Asset Uploaded', {
      asset: title,
      version: 'v1',
      by: DB.currentUser.name
    });

    pushNotif(
      'submission',
      'New submission: “' + title + '” is awaiting review.',
      data.asset.id
    );

    toast(
      'Asset submitted — workflow set status to “For Review”.',
      'success'
    );

    Studio.goto('assetDetail', data.asset.id);

  } catch(error) {

    console.error('submitAsset error:', error);

    toast(
      'Could not connect to the server.',
      'error'
    );
  }
},

});
