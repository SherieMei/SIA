/* ==========================================================================
   REVIEW / APPROVAL ACTIONS — approve, reject, request revision.
   Also fires the webhook simulation on every approval.
   ========================================================================== */
Object.assign(Studio, {

  async reviewAsset(assetId, decision){
  if(!can('review')){
    toast('Your role cannot review assets.','error');
    return;
  }

  const asset = assetById(assetId);
  if(!asset){
    toast('Asset not found.','error');
    return;
  }

  const v = latestVersion(asset);
  if(!v){
    toast('No version found.','error');
    return;
  }

  const commentBox = document.getElementById('reviewComment');
  const text = commentBox ? commentBox.value.trim() : '';

  const statusMap = {
    approve: 'Approved',
    reject: 'Rejected',
    revise: 'Revisi'
  };

  const status = statusMap[decision];
  if(!status) return;

  try {
    const response = await fetch('/SIA/api/assets.php', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'update_status',
        asset_id: assetId,
        status: status,
        comment: text
      })
    });

    const data = await response.json();

    if(!response.ok || !data.success){
      toast(data.error || 'Failed to update asset status.','error');
      return;
    }

    v.status = data.status || status;

    if(decision === 'approve'){
      pushAudit('Approval', asset.title, 'v'+v.n+' approved');
      pushEvent('Asset Approved', {
        asset: asset.title,
        version: 'v'+v.n,
        by: DB.currentUser.name
      });

      pushNotif(
        'approval',
        '“'+asset.title+'” v'+v.n+' was approved.',
        asset.id
      );

      toast('Approved successfully.','success');

    } else if(decision === 'reject'){
      pushAudit('Rejection', asset.title, 'v'+v.n+' rejected');
      pushEvent('Asset Rejected', {
        asset: asset.title,
        version: 'v'+v.n,
        by: DB.currentUser.name
      });

      pushNotif(
        'revision',
        '“'+asset.title+'” v'+v.n+' was rejected.',
        asset.id
      );

      toast('Marked as rejected.','error');

    } else if(decision === 'revise'){
      pushAudit('Revision', asset.title, 'v'+v.n+' — revision requested');
      pushEvent('Revision Requested', {
        asset: asset.title,
        version: 'v'+v.n,
        by: DB.currentUser.name
      });

      pushNotif(
        'revision',
        'Revision requested on “'+asset.title+'” v'+v.n+'.',
        asset.id
      );

      toast('Revision requested.','success');
    }

    render();

  } catch(error) {
    console.error(error);
    toast('Could not connect to the server.','error');
  }
},

  quickApprove(assetId){
    state.selectedAssetId = assetId;
    Studio.reviewAsset(assetId,'approve');
    toast('Approved from Review Queue.','success');
  },

});
