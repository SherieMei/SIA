/* ==========================================================================
   COMMENTS + NOTIFICATIONS ACTIONS
   ========================================================================== */
Object.assign(Studio, {

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

  markRead(id){ const n = DB.notifications.find(x=>x.id===id); if(n) n.read=true; render(); },
  markAllRead(){ DB.notifications.forEach(n=>n.read=true); render(); toast('All notifications marked as read.'); },

});
