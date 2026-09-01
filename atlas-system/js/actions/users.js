/* ==========================================================================
   USER MANAGEMENT ACTIONS — add teammates, change roles.
   ========================================================================== */
Object.assign(Studio, {

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

});
