/* ==========================================================================
   RESOURCE / ERP ACTIONS — log labor, equipment, and cost per project.
   ========================================================================== */

Object.assign(Studio, {

  addResource(){

    if(!can('manageResources')) return;


    const project =
      document.getElementById('rsProject').value;

    const category =
      document.getElementById('rsCategory').value;

    const desc =
      document.getElementById('rsDesc').value.trim();

    const cost =
      parseFloat(
        document.getElementById('rsCost').value
      ) || 0;

    const hours =
      parseFloat(
        document.getElementById('rsHours').value
      ) || 0;


    /* ==========================================================
       BASIC VALIDATION
       ========================================================== */

    if(!desc){

      toast(
        'Add a short description.',
        'error'
      );

      return;
    }


    if(cost <= 0){

      toast(
        'Enter a valid cost.',
        'error'
      );

      return;
    }


    if(hours < 0){

      toast(
        'Hours cannot be negative.',
        'error'
      );

      return;
    }
    if(cost < 750){
  toast(
    'Minimum cost is ₱750.',
    'error'
  );
  return;
}

if(cost > 99999){
  toast(
    'Maximum cost is ₱99,999.',
    'error'
  );
  return;
}

if(hours < 0 || hours > 99){
  toast(
    'Hours must be between 0 and 99.',
    'error'
  );
  return;
}


    /* ==========================================================
       FIND PROJECT
       ========================================================== */

    const selectedProject =
      DB.projects.find(
        p =>
          String(p.id) ===
          String(project)
      );


    if(!selectedProject){

      toast(
        'Project not found.',
        'error'
      );

      return;
    }


    /* ==========================================================
       BUDGET LIMIT
       ========================================================== */

    const projectBudget =
      Number(
        selectedProject.budget || 0
      );


    const alreadySpent =
      DB.resources
        .filter(
          r =>
            String(r.project) ===
            String(project)
        )
        .reduce(
          (total, r) =>
            total +
            Number(r.cost || 0),
          0
        );


    const remainingBudget =
      projectBudget -
      alreadySpent;


    if(projectBudget <= 0){

      toast(
        'This project does not have a valid budget.',
        'error'
      );

      return;
    }


    if(remainingBudget <= 0){

      toast(
        'This project has already reached its budget limit.',
        'error'
      );

      return;
    }


    if(cost > remainingBudget){

      toast(
        'Budget limit exceeded. Remaining budget: ₱' +
        remainingBudget.toLocaleString(),
        'error'
      );

      return;
    }


    /* ==========================================================
       SAVE RESOURCE
       ========================================================== */

    window.beeFetch(
      window.BEE_API_BASE+'assets/resources.php',
      {
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
      }
    )

    .then(res => res.json())

    .then(data => {

      console.log(
        'RESOURCE POST RESPONSE:',
        data
      );


      if(!data.success){

        toast(
          data.message ||
          'Failed to save resource.',
          'error'
        );

        return;
      }


      toast(
        'Resource entry logged.',
        'success'
      );


      document.getElementById('rsDesc').value = '';
      document.getElementById('rsCost').value = '';
      document.getElementById('rsHours').value = '';


      loadResourcesFromDB();

    })

    .catch(err => {

      console.error(err);

      toast(
        'Failed to connect to the server.',
        'error'
      );

    });

  },

});