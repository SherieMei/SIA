/* ==========================================================================
   RENDER DISPATCHER — picks which js/pages/*.js function draws the
   current page. This is the only file that needs to know every page exists.
   ========================================================================== */
function render(){
  if(!DB.currentUser) return;
  renderSidebar();
  const el = document.getElementById('pageContent');
  switch(state.page){
    case 'dashboard': el.innerHTML = pageDashboard(); break;
    case 'projects': el.innerHTML = pageProjects(); break;
    case 'projectDetail': el.innerHTML = pageProjectDetail(); break;
    case 'assets': el.innerHTML = pageAssets(); break;
    case 'assetDetail': el.innerHTML = pageAssetDetail(); break;
    case 'review': el.innerHTML = pageReview(); break;
    case 'notifications': el.innerHTML = pageNotifications(); break;
    case 'integrations': el.innerHTML = pageIntegrations(); break;
    case 'resources': el.innerHTML = pageResources(); break;
    case 'audit': el.innerHTML = pageAudit(); break;
    case 'users': el.innerHTML = pageUsers(); break;
    case 'architecture': el.innerHTML = pageArchitecture(); break;
    default: el.innerHTML = pageDashboard();
  }
}
