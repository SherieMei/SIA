function doLogin(name,role){name=(name||'').trim();if(!name){toast('Enter a name to sign in.','error');return}let u=DB.users.find(x=>x.name.toLowerCase()===name.toLowerCase());if(!u){u={id:nid('u'),name,role};DB.users.push(u)}else u.role=role;Studio.completeLogin(u)}
document.getElementById('loginBtn').addEventListener('click',()=>doLogin(document.getElementById('loginName').value,document.getElementById('loginRole').value));
document.getElementById('loginName').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginBtn').click()});
document.getElementById('demoUsers').innerHTML=DB.users.slice(0,8).map(u=>`<button class="demo-card" data-id="${u.id}"><b>${esc(u.name)}</b><span>${ROLE_LABELS[u.role]}</span></button>`).join('');
document.querySelectorAll('.demo-card').forEach(b=>b.addEventListener('click',()=>{const u=userById(b.dataset.id);Studio.completeLogin(u)}));
