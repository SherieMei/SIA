/* ---------------- Boot ---------------- */
renderSidebar();
setInterval(()=>{ if(DB.currentUser){ document.getElementById('clockChip').textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}); } }, 60000);
