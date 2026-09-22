/* ==========================================================================
   RESOURCE / ERP ACTIONS — log labor, equipment, and cost per project.
   ========================================================================== */
Object.assign(Studio, {

  addResource(){
  if(!can('manageResources')) return;

  const project = document.getElementById('rsProject').value;
  const category = document.getElementById('rsCategory').value;
  const desc = document.getElementById('rsDesc').value.trim();
  const cost = parseFloat(document.getElementById('rsCost').value) || 0;
  const hours = parseFloat(document.getElementById('rsHours').value) || 0;

  if(!desc){
    toast('Add a short description.','error');
    return;
  }

  fetch('http://localhost/SIA/api/resources.php', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_id: project,
      category: category,
      description: desc,
      cost: cost,
      hours: hours
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log('RESOURCE POST RESPONSE:', data);
    
    if(!data.success){
      toast(data.message || 'Failed to save resource.','error');
      return;
    }

    toast('Resource entry logged.','success');

    document.getElementById('rsDesc').value = '';
    document.getElementById('rsCost').value = '';
    document.getElementById('rsHours').value = '';

    loadResourcesFromDB();
  })
  .catch(err => {
    console.error(err);
    toast('Failed to connect to the server.','error');
  });
},

});
