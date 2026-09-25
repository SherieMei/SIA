/* ==========================================================================
   SEED DATA — demo team, projects, and assets the app boots with.
   Everything lives in memory for the session (see Architecture page).
   ========================================================================== */
let idCounters = {p:2,a:0,v:0,c:0,n:0,e:0,au:0,w:0,api:0,r:0,u:8};
function nid(prefix){ idCounters[prefix]++; return prefix+idCounters[prefix]; }

const DB = {
  currentUser:null,
  users:[
    {id:'u1',name:'Jordan Reyes',role:'admin'},
    {id:'u2',name:'Mika Santos',role:'project_manager'},
    {id:'u3',name:'Leo Cruz',role:'artist'},
    {id:'u4',name:'Ava Domingo',role:'animator'},
    {id:'u5',name:'Noah Bautista',role:'editor'},
    {id:'u6',name:'Priya Fernandez',role:'reviewer'},
    {id:'u7',name:'Skyline Media (Client)',role:'client'},
    {id:'u8',name:'Guest',role:'viewer'},
  ],
  projects:[
    {id:'p2',name:"Lumen Oral Care — “Bright Mornings” Campaign",client:'Lumen Oral Care Co.',
     status:'Client Review',deadline:'2026-09-20',pm:'u2',team:['u3','u4','u6','u7'],budget:22000},
    {id:'p3',name:"Nightfall Games — Cinematic Trailer",client:'Nightfall Interactive',
     status:'Pre-Production',deadline:'2026-11-30',pm:'u2',team:['u3','u4'],budget:35000},
  ],
  assets:[],
  comments:[],
  notifications:[],
  auditLog:[],
  events:[],
  webhooks:[],
  apiLogs:[],
  resources:[
    {id:nid('r'),project:'p2',category:'Labor',desc:'Animator — spot revisions',cost:1600,hours:40},
  ],
};

function latestVersion(asset){ return asset.versions[asset.versions.length-1]; }

function seedAsset(project,title,type,link,entries){
  const a = {id:nid('a'), project, title, type, link, versions:[]};
  entries.forEach((e,i)=>{
    a.versions.push({id:nid('v'), n:i+1, status:e.status, notes:e.notes, by:e.by, date:e.date, final:!!e.final});
  });
  DB.assets.push(a);
  return a;
}

seedAsset('p2','Bright Mornings — 15s Storyboard','Storyboard','drive://lumen/sb/15s',[
  {status:'Approved',notes:'Client-approved concept.',by:'u3',date:'2026-08-01'},
]);
seedAsset('p2','Bright Mornings — Bathroom BG Set','Background Asset','dropbox://lumen/bg/bathroom',[
  {status:'For Review',notes:'Morning light variant.',by:'u4',date:'2026-08-16'},
]);
const seedA10 = seedAsset('p2','Bright Mornings — Final Cut','Render','local://lumen/render/final_15s',[
  {status:'Approved',notes:'Master export, 1080p ProRes.',by:'u5',date:'2026-08-19',final:true},
]);
seedAsset('p3','Trailer — Opening Boards','Storyboard','drive://nightfall/sb/opening',[
  {status:'For Review',notes:'Beat 1–5 of teaser.',by:'u3',date:'2026-08-22'},
]);
const seedA12 = seedAsset('p3','Trailer — Theme Sting','Audio','dropbox://nightfall/audio/sting',[
  {status:'Revision Requested',notes:'Rough mix, temp score.',by:'u5',date:'2026-08-17'},
]);

DB.comments.push(
  {id:nid('c'), asset:seedA12.id, by:'u6', text:'Rough mix needs higher high-end clarity on the strings.', date:'2026-08-18'}
);

function pushNotif(type,text,ref){
  DB.notifications.push({id:nid('n'), type, text, ref, read:false, date:new Date().toISOString()});
}
pushNotif('revision','Revision requested on “Trailer — Theme Sting”.',seedA12.id);
pushNotif('approval','“Bright Mornings — Final Cut” was approved as Final Output.',seedA10.id);

function pushAudit(action,entity,detail){
  DB.auditLog.push({id:nid('au'), by:DB.currentUser?DB.currentUser.name:'System', action, entity, detail, date:new Date().toISOString()});
}
DB.auditLog.push(
  {id:nid('au'),by:'Priya Fernandez',action:'Revision',entity:'Trailer — Theme Sting',detail:'Requested revision on v1',date:'2026-08-17T14:40:00'},
  {id:nid('au'),by:'Priya Fernandez',action:'Approval',entity:'Bright Mornings — Final Cut',detail:'Approved v1 as FINAL',date:'2026-08-19T16:10:00'},
);

function pushEvent(name,payload){
  DB.events.unshift({id:nid('e'), name, payload, date:new Date().toISOString()});
}
pushEvent('Revision Requested',{asset:'Trailer — Theme Sting',version:'v1',by:'Priya Fernandez'});
pushEvent('Final Output Approved',{asset:'Bright Mornings — Final Cut',version:'v1',by:'Priya Fernandez'});

DB.webhooks.push(
  {id:nid('w'), endpoint:'https://hooks.beeproduction.studio/asset-approved', status:200, payload:'{"asset":"Bright Mornings — Final Cut","event":"final_output_approved"}', date:'2026-08-19T16:10:02'}
);