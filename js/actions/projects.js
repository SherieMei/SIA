/* ==========================================================================
   PROJECT ACTIONS — create new productions/campaigns.
   ========================================================================== */
Object.assign(Studio, {

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

});
