/* ==========================================================================
   REVIEW / APPROVAL ACTIONS — approve, reject, request revision.
   Also fires the webhook simulation on every approval.
   ========================================================================== */
Object.assign(Studio, {

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

});
