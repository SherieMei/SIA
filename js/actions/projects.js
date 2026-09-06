async function loadProjectsFromDB(){
  try {
    const response = await fetch('../api/projects.php');

    if (!response.ok) {
      throw new Error('Projects API unavailable');
    }

    const data = await response.json();

    if(!Array.isArray(data)){
      throw new Error('Invalid projects API response');
    }

    DB.projects = data.map(p => ({
      id: String(p.id),
      name: p.name,
      client: p.client,
      status: p.status,
      deadline: p.deadline,
      budget: Number(p.budget) || 0,
      pm: p.project_manager_id,
      team: []
    }));

  } catch(error) {
    console.warn('Projects API unavailable. Using local project data.', error);
  }

  render();
}