/* ==========================================================================
   INTEGRATION ACTIONS — API sync simulation + CSV/ETL import.
   ========================================================================== */
Object.assign(Studio, {

  apiSend(){
    const sel = document.getElementById('apiAssetSelect');
    const assetId = sel.value;
    const asset = assetById(assetId);
    if(!asset) return;
    const v = latestVersion(asset);
    const reqPayload = {asset:asset.title, version:'v'+v.n, status:v.status, project:projectById(asset.project).name};
    DB.apiLogs.push({id:nid('api'), dir:'REQUEST', method:'POST', endpoint:'/api/v1/production-dashboard/assets', body:JSON.stringify(reqPayload), date:new Date().toISOString()});
    render();
    toast('Request sent…');
    setTimeout(()=>{
      DB.apiLogs.push({id:nid('api'), dir:'RESPONSE', method:'POST', endpoint:'/api/v1/production-dashboard/assets', status:201,
        body:JSON.stringify({received:true, id:'dash_'+asset.id, syncedAt:new Date().toISOString()}), date:new Date().toISOString()});
      pushAudit('Integration', asset.title, 'Synced to Production Dashboard via API');
      pushEvent('Asset Synced to Dashboard', {asset:asset.title});
      toast('201 Created — synced to Production Dashboard.','success');
      render();
    }, 650);
  },

  runETL(){
    const raw = document.getElementById('etlInput').value.trim();
    const log = document.getElementById('etlLog');
    if(!raw){ toast('Paste or keep the sample CSV first.','error'); return; }
    const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
    const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const rows = lines.slice(1);
    let steps = [];
    steps.push('EXTRACT — read '+rows.length+' row(s) from source file.');
    let loaded = 0, skipped = 0;
    rows.forEach(line=>{
      const cells = line.match(/(".*?"|[^,]+)/g) || [];
      const clean = cells.map(c=>c.replace(/^"|"$/g,'').trim());
      const rec = {};
      header.forEach((h,i)=> rec[h] = clean[i] || '');
      if(!rec.title || !rec.project){ skipped++; return; }
      const proj = DB.projects.find(p=> p.name.toLowerCase().includes(rec.project.toLowerCase()) || rec.project.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()));
      const type = ['Storyboard','Animatic','Character Sheet','Background Asset','Animation Scene','Render','Audio','Design Draft'].includes(rec.type) ? rec.type : 'Design Draft';
      const asset = {id:nid('a'), project: proj?proj.id:DB.projects[0].id, title:rec.title, type,
        link:'', versions:[{id:nid('v'), n:1, status:'For Review', notes:'Imported via ETL — assignee: '+(rec.assignee||'unassigned')+(rec.duedate?(', due '+rec.duedate):''), by:DB.currentUser.id, date:new Date().toISOString().slice(0,10)}]};
      DB.assets.push(asset);
      loaded++;
    });
    steps.push('TRANSFORM — validated required fields, normalized asset type, mapped project names ('+skipped+' row(s) skipped for missing data).');
    steps.push('LOAD — inserted '+loaded+' new asset record(s), each auto-set to “For Review”.');
    log.innerHTML = steps.map(s=>'<div class="log-line"><span class="t">›</span><span>'+esc(s)+'</span></div>').join('');
    pushAudit('Integration','ETL Import', loaded+' asset(s) imported from CSV');
    pushEvent('ETL Import Completed', {rows:rows.length, loaded, skipped});
    toast('ETL run complete — '+loaded+' record(s) loaded.','success');
    render();
  },

});
