/* ==========================================================================
   PROJECT ACTIONS — create new productions/campaigns.
   ========================================================================== */
Object.assign(Studio, {

  createProject(){

    if(!can('manageProjects')) return;

    const name = document.getElementById('npName').value.trim();
    const client = document.getElementById('npClient').value.trim();
    const deadline = document.getElementById('npDeadline').value;
    const budget = parseFloat(document.getElementById('npBudget').value) || 0;

    if(!name || !client){
        toast('Project name and client are required.','error');
        return;
    }

    const project = {
        name: name,
        client: client,
        status: 'Pre-Production',
        deadline: deadline,
        project_manager_id: DB.currentUser.id,
        budget: budget
    };

    fetch('/SIA/api/projects.php', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(project)
    })
    .then(response => parseApiResponse(response))
    .then(data => {

        if(data.success){
            pushAudit('Create', 'Project', name);
            pushEvent('Project Created', {
                project: name,
                by: DB.currentUser.name
            });

            toast('Project created: ' + name, 'success');
            Studio.goto('projects');
        } else {
            toast(data.message || 'Failed to create project.', 'error');
        }
    })
    .catch(error => {
        console.error('Error creating project:', error);
        toast('An error occurred while creating the project.', 'error');
    });
}
});
