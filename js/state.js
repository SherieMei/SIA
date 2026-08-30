/* ---------------- App state ---------------- */
const state = { page:'dashboard', selectedProjectId:null, selectedAssetId:null,
  filter:{project:'all',type:'all',status:'all',q:''} };

/* ---------------- Helpers ---------------- */
function fmtDate(d){
  if(!d) return '—';
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'});
}
function fmtDateTime(d){
  const dt = new Date(d);
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US',{month:'short',day:'2-digit'})+' · '+dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}
function userById(id){ return DB.users.find(u=>u.id===id); }
function projectById(id){ return DB.projects.find(p=>p.id===id); }
function assetById(id){ return DB.assets.find(a=>a.id===id); }
function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function esc(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toast(msg, kind){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast'+(kind?' '+kind:'');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.25s'; setTimeout(()=>el.remove(),260); }, 3200);
}

function projectProgress(pid){
  const list = DB.assets.filter(a=>a.project===pid);
  if(!list.length) return 0;
  const done = list.filter(a=>{ const v=latestVersion(a); return v.status==='Approved'||v.status==='Final'; }).length;
  return Math.round(done/list.length*100);
}
