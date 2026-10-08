/* ==========================================================================
   INTEGRATION ACTIONS — API sync simulation + CSV/JSON ETL import.
   ========================================================================== */
Object.assign(Studio, {

  apiSend(){

  const sel = document.getElementById('apiAssetSelect');
  const assetId = sel.value;
  const asset = assetById(assetId);

  if(!asset) return;

  const v = latestVersion(asset);

  const reqPayload = {
    asset: asset.title,
    version: 'v' + v.n,
    status: v.status,
    project: projectById(asset.project).name
  };

  // Existing UI log
  DB.apiLogs.push({
    id: nid('api'),
    dir: 'REQUEST',
    method: 'POST',
    endpoint: '/api/v1/production-dashboard/assets',
    body: JSON.stringify(reqPayload),
    date: new Date().toISOString()
  });

  // Save REQUEST to database
  fetch('http://localhost/SIA/api/integration_api_logs.php', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      asset_id: asset.id,
      direction: 'REQUEST',
      method: 'POST',
      endpoint: '/api/v1/production-dashboard/assets',
      status_code: null,
      body: JSON.stringify(reqPayload)
    })
  })
  .catch(error => {
    console.error('API request log save error:', error);
  });

  render();
  toast('Request sent…');

  setTimeout(()=>{

    const responsePayload = {
      received: true,
      id: 'dash_' + asset.id,
      syncedAt: new Date().toISOString()
    };

    // Existing UI log
    DB.apiLogs.push({
      id: nid('api'),
      dir: 'RESPONSE',
      method: 'POST',
      endpoint: '/api/v1/production-dashboard/assets',
      status: 201,
      body: JSON.stringify(responsePayload),
      date: new Date().toISOString()
    });

    // Save RESPONSE to database
    fetch('http://localhost/SIA/api/integration_api_logs.php', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asset_id: asset.id,
        direction: 'RESPONSE',
        method: 'POST',
        endpoint: '/api/v1/production-dashboard/assets',
        status_code: 201,
        body: JSON.stringify(responsePayload)
      })
    })
    .catch(error => {
      console.error('API response log save error:', error);
    });

    pushAudit(
      'Integration',
      asset.title,
      'Synced to Production Dashboard via API'
    );

    pushEvent(
      'Asset Synced to Dashboard',
      {asset: asset.title}
    );

    toast(
      '201 Created — synced to Production Dashboard.',
      'success'
    );

    render();

  }, 650);

},  
async runETL(){

  const input=document.getElementById('etlInput');
  const error=document.getElementById('etlError');
  const raw=input?.value.trim()||'';

  const log =
    document.getElementById('etlLog');

  const showValidationError=message=>{
    if(error)error.textContent=message;
    else toast(message,'error');
  };
  if(error)error.textContent='';

  if(!raw){

    showValidationError('Paste CSV data in the format shown above.');

    return;
  }

  let rows;
  if(raw.startsWith('{')||raw.startsWith('[')){
    try{
      const parsed=JSON.parse(raw);
      rows=Array.isArray(parsed)
        ?parsed
        :Array.isArray(parsed.rows)
          ?parsed.rows
          :[parsed];
    }catch{
      showValidationError('That JSON is invalid. Paste one asset object or an array of asset objects.');
      return;
    }
    if(!rows.length||rows.some(row=>!row||Array.isArray(row)||typeof row!=='object')){
      showValidationError('JSON must contain one or more asset objects.');
      return;
    }
    rows=rows.map(row=>{
      const title=row.title??row.asset;
      return {
        ...row,
        title:typeof title==='string'||typeof title==='number'?String(title):'',
        project:typeof row.project==='string'||typeof row.project==='number'?String(row.project):''
      };
    });
  }else{
    const lines =
      raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    if(lines.length < 2){
      showValidationError('CSV needs a header row and at least one data row.');
      return;
    }

    const header =
      lines[0]
        .split(',')
        .map(h => h.trim().toLowerCase());

    const missingHeaders =
      ['title','project'].filter(h=>!header.includes(h));

    if(missingHeaders.length){
      showValidationError('CSV must include these columns: title, project.');
      return;
    }

    rows=lines.slice(1).map(line=>{
      const cells=line.match(/(".*?"|[^,]+)/g)||[];
      const clean=cells.map(cell=>cell.replace(/^"|"$/g,'').trim());
      const record={};
      header.forEach((name,index)=>{record[name]=clean[index]||'';});
      return record;
    });
  }

  if(rows.some(row=>typeof row.title!=='string'||!row.title.trim()||typeof row.project!=='string'||!row.project.trim())){
    showValidationError('Every row must include a title (or asset) and an existing project name.');
    return;
  }

  try {

    if(log){

      log.innerHTML = `
        <div class="log-line">
          <span class="t">›</span>
          <span>Running ETL import...</span>
        </div>
      `;

    }

    const response =
      await fetch(
        'http://localhost/SIA/api/integration_etl_logs.php',
        {
          method: 'POST',

          credentials: 'include',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            rows: rows
          })
        }
      );

    const data =
      await parseApiResponse(
        response
      );

    if(
      !response.ok ||
      !data.success
    ){

      throw new Error(
        data.error ||
        'ETL import failed.'
      );

    }

    if(log){

      log.innerHTML =
        (data.details || [])
          .map(step => `
            <div class="log-line">
              <span class="t">›</span>
              <span>${esc(step)}</span>
            </div>
          `)
          .join('');

    }

    await loadAssetsFromDB();

    pushEvent(
      'ETL Import Completed',
      {
        rows: data.total_rows,
        loaded: data.loaded_rows,
        skipped: data.skipped_rows
      }
    );

    toast(
      'ETL complete — ' +
      data.loaded_rows +
      ' asset(s) saved to MySQL.',
      'success'
    );

    if(typeof render === 'function'){
      render();
    }

  } catch(error){

    console.error(
      'ETL import error:',
      error
    );

    if(log){

      log.innerHTML = `
        <div class="log-line">
          <span class="t">!</span>
          <span>${esc(error.message)}</span>
        </div>
      `;

    }

    toast(
      error.message ||
      'ETL import failed.',
      'error'
    );

  }

},
});
