/* ==========================================================================
   CONSTANTS — roles, permissions, asset type styling, status labels.
   Edit permissions here to change who can do what.
   ========================================================================== */
const ROLE_LABELS = {
  admin:'Administrator', project_manager:'Project Manager', artist:'Artist',
  animator:'Animator', editor:'Editor', reviewer:'Reviewer', client:'Client', viewer:'Viewer'
};

const PERMISSIONS = {
  manageUsers:['admin'],
  manageProjects:['admin','project_manager'],
  submitAssets:['admin','artist','animator','editor','project_manager'],
  review:['admin','reviewer','project_manager','client'],
  comment:['admin','project_manager','artist','animator','editor','reviewer','client'],
  viewAudit:['admin','project_manager'],
  manageResources:['admin','project_manager'],
  runIntegrations:['admin','project_manager','editor'],
};
function can(action){ return DB.currentUser && PERMISSIONS[action] && PERMISSIONS[action].includes(DB.currentUser.role); }

const TYPE_META = {
  'Storyboard':{tag:'SB',color:'#ff6b4d'},
  'Animatic':{tag:'AN',color:'#9b8cfb'},
  'Character Sheet':{tag:'CS',color:'#2bd9c9'},
  'Background Asset':{tag:'BG',color:'#6ea8e0'},
  'Animation Scene':{tag:'AS',color:'#f0495a'},
  'Render':{tag:'RN',color:'#ffd479'},
  'Audio':{tag:'AU',color:'#e08ce0'},
  'Design Draft':{tag:'DD',color:'#9aa0ab'},
};
const STATUS_CLASS = {
  'For Review':'b-review', 'Approved':'b-approved', 'Rejected':'b-rejected',
  'Revision Requested':'b-revision', 'Final':'b-final'
};
const NOTIF_ICON = {submission:'▲', revision:'↺', deadline:'◷', approval:'✓', completed:'●'};
