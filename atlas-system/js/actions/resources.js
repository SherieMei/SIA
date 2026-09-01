/* ==========================================================================
   RESOURCE / ERP ACTIONS — log labor, equipment, and cost per project.
   ========================================================================== */
Object.assign(Studio, {

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

});
