
function renderApprovalReceipt(asset,version){
  const receiptId=version.approval_id||('APR-'+version.id);
  return `<div class="asset-approval-receipt">
    <div class="asset-receipt-heading">✓ Approved · Final version</div>
    <div class="asset-receipt-id">${esc(receiptId)}</div>
    <dl><div><dt>Asset ID</dt><dd>${esc(String(asset.id))}</dd></div>
      <div><dt>Version</dt><dd>v${esc(String(version.n||1))}</dd></div>
      <div><dt>Project</dt><dd>${esc(projectById(asset.project_id||asset.project)?.name||String(asset.project_id||asset.project))}</dd></div>
      <div><dt>Approved by</dt><dd>${esc(userById(version.approved_by)?.name||version.approved_by||'Not recorded')}</dd></div>
      <div><dt>Approval date</dt><dd>${version.approved_at?esc(fmtDate(version.approved_at)):'Not recorded'}</dd></div></dl>
    <div class="asset-receipt-note">This version is closed to further submissions.</div>
  </div>`;
}
/* Page-specific BEE PRODUCTION controller. Shared runtime is loaded before this file. */
/* ==========================================================================
   PAGE — Assets (list + submission form) + Asset Detail
   ========================================================================== */

/* =========================================================
ASSETS — SHARED HELPERS
========================================================= */
function assetDueLabel(dueDate){
  if(!dueDate) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((due - today) / 86400000);

  if(diff < 0){
    const days = Math.abs(diff);
    return `Overdue by ${days} day${days === 1 ? '' : 's'}`;
  }

  if(diff === 0) return 'Due today';
  if(diff === 1) return 'Due tomorrow';

  return `${diff} days left`;
}

function assetMediaUrl(asset){
  return [asset.preview_url,asset.thumbnail,asset.file_path,asset.link,asset.external_link]
    .find(value=>typeof value==='string'&&value.trim())?.trim()||'';
}

function assetSubmitterName(version){
  return version.submitted_by||userById(version.by)?.name||'Not recorded';
}

function assetMediaKind(url){
  let parsed;
  try{
    parsed=new URL(url,window.location.href);
  }catch(error){
    return 'other';
  }
  if(!['http:','https:'].includes(parsed.protocol))return 'other';
  const path=parsed.pathname.toLowerCase();
  if(/(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|(^|\.)youtu\.be$/.test(parsed.hostname))return 'youtube';
  if(/\.(avif|gif|jpe?g|png|webp)$/.test(path))return 'image';
  if(/\.(mp4|webm|ogv|ogg|mov)$/.test(path))return 'video';
  if(/\.(mp3|wav|m4a|aac|flac|oga)$/.test(path))return 'audio';
  if(/\.pdf$/.test(path))return 'pdf';
  if(/\.(json|txt|csv|tsv)$/.test(path))return 'text';
  if(/\.(docx?|rtf|odt|xlsx?|ods|pptx?|odp)$/.test(path))return 'document';
  if(/(^|\.)canva\.com$|(^|\.)carrd\.co$/.test(parsed.hostname))return 'webpage';
  return 'webpage';
}

function canvaPreviewUrl(url){
  const embedUrl=new URL(url.href);
  const designPath=embedUrl.pathname.match(/^\/design\/([^/]+)(?:\/[^/]*)?/i);
  if(designPath){
    embedUrl.pathname=`/design/${designPath[1]}/view`;
  }
  embedUrl.searchParams.set('embed','');
  return embedUrl.href;
}

function showAssetCardFallback(media){
  const label=media.dataset.fallbackLabel||'PREVIEW';
  const title=media.dataset.previewTitle||'Preview unavailable';
  const fallback=document.createElement('div');
  fallback.className='asset-card-placeholder';

  const mark=document.createElement('span');
  mark.className='asset-card-placeholder-mark';
  mark.textContent='PREVIEW';
  const fallbackTitle=document.createElement('strong');
  fallbackTitle.textContent=title;
  fallback.append(mark,fallbackTitle);
  media.replaceWith(fallback);
}

function showAssetDetailPreviewFallback(media){
  const preview=media.closest('.asset-preview');
  if(!preview)return;
  media.remove();
  preview.classList.add('asset-preview-fallback');
}

function renderExternalPreviewCard(provider,label,url,filename='',showOpenLink=true){
  return `<div class="asset-external-preview-card asset-external-preview-card--${provider}">
    <span class="asset-external-preview-mark">${esc(label)}</span>
    <strong>${filename?esc(filename):`${esc(label)} preview`}</strong>
    <span class="asset-external-preview-hint">${provider==='canva'?'Open the design in Canva. Sign in if the design requires access.':'Open the PDF in a separate tab to view or download it.'}</span>
    ${showOpenLink?`<a class="asset-external-preview-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open ${esc(label)} ↗</a>`:''}
  </div>`;
}

function renderAssetCardPreview(asset){
  const url=assetMediaUrl(asset);
  const kind=assetMediaKind(url);
  let parsedUrl=null;
  try{
    parsedUrl=new URL(url,window.location.href);
  }catch(error){
    parsedUrl=null;
  }

  if(kind==='image'){
    return `<img src="${esc(url)}" alt="${esc(asset.title)} preview" loading="lazy" data-fallback-label="${esc(asset.type||'IMAGE')}" data-preview-title="${esc(asset.title)}" onerror="showAssetCardFallback(this)">`;
  }
  if(kind==='youtube'){
    const id=parsedUrl.hostname.endsWith('youtu.be')
      ?parsedUrl.pathname.split('/').filter(Boolean)[0]
      :parsedUrl.searchParams.get('v')||parsedUrl.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1];
    if(id&&/^[A-Za-z0-9_-]{11}$/.test(id)){
      return `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="${esc(asset.title)} video thumbnail" loading="lazy" data-fallback-label="VIDEO" data-preview-title="${esc(asset.title)}" onerror="showAssetCardFallback(this)"><span class="asset-card-media-kind">VIDEO</span>`;
    }
  }
  if(kind==='video'){
    return `<video class="asset-card-video" src="${esc(url)}" muted playsinline preload="metadata" tabindex="-1" aria-label="${esc(asset.title)} video thumbnail" data-fallback-label="VIDEO" data-preview-title="${esc(asset.title)}" onloadedmetadata="if(this.duration>0)this.currentTime=Math.min(1,this.duration/10)" onerror="showAssetCardFallback(this)"></video><span class="asset-card-media-kind">VIDEO</span>`;
  }
  if(kind==='audio'){
    return `<div class="asset-card-file-preview"><strong>AUDIO</strong><span>${esc(asset.title||'Open asset to listen')}</span></div>`;
  }
  if(kind==='pdf'){
    return renderExternalPreviewCard('pdf','PDF',parsedUrl.href,'PDF document',false);
  }
  if(kind==='document'&&/\.docx$/i.test(parsedUrl.pathname)){
    const previewId=`asset-card-docx-${String(asset.id).replace(/[^A-Za-z0-9_-]/g,'')}`;
    window.setTimeout(()=>loadAssetDocxPreview(previewId,parsedUrl.href),0);
    return `<div class="asset-card-docx-preview"><strong>DOCX</strong><pre id="${previewId}">Loading document preview…</pre></div>`;
  }
  if(kind==='document'||kind==='text'){
    const label=kind==='text'?'DATA':parsedUrl.pathname.split('.').pop().toUpperCase();
    return `<div class="asset-card-file-preview"><strong>${esc(label)}</strong><span>${esc(asset.title||'Open asset to view file')}</span></div>`;
  }
  if(url){
    if(kind==='webpage'&&parsedUrl){
      const isCanva=/(^|\.)canva\.com$/i.test(parsedUrl.hostname);
      if(isCanva){
        return `<div class="asset-card-canva-preview" role="img" aria-label="${esc(asset.title)} Canva design">
          <span class="asset-card-canva-mark">CANVA</span>
          <strong>DESIGN</strong>
          <span class="asset-card-canva-arrow" aria-hidden="true">↗</span>
        </div>`;
      }
      return `<div class="asset-card-link-preview"><span aria-hidden="true">↗</span><strong>WEB LINK</strong><span>${esc(parsedUrl.hostname)}</span></div>`;
    }
    return `<div class="asset-card-link-preview"><span aria-hidden="true">↗</span><strong>ASSET</strong><span>${esc(parsedUrl?.hostname||'External link')}</span></div>`;
  }
  return `<div class="asset-card-placeholder"><span class="asset-card-placeholder-mark">PREVIEW</span><strong>${esc(asset.title||'Preview unavailable')}</strong></div>`;
}

/* =========================================================
ASSETS — ASSET LIST
========================================================= */
  function pageAssets(){
    const today=new Date();
    const minimumDueDate=[
      today.getFullYear(),
      String(today.getMonth()+1).padStart(2,'0'),
      String(today.getDate()).padStart(2,'0')
    ].join('-');
    const params=
    new URLSearchParams(
      window.location.search
    );
  const openSubmitForm=
    params.get('submit')==='1';
  const submitProject=
    params.get('project')||'';
  const submitSequence=
    params.get('sequence')||'';
  const submitExisting=
    params.get('existing')||'new';
  const submitTitle=
    params.get('title')||'';
  const submitType=
    params.get('type')||'';
  const f=state.filter;
  const isClient=DB.currentUser?.role==='client';
  const canSubmitAsset=can('uploadAsset')&&DB.currentUser?.role!=='animator'&&
    (DB.currentUser?.role!=='editor'||Boolean(submitSequence));
  const activeProjects=DB.projects.filter(p=>p.status!=='Completed' && (isClient || (p.access_ids||p.team||[]).includes(DB.currentUser?.id)));
  const activeProjectIds=new Set(activeProjects.map(p=>String(p.id)));
  const activeAssets=DB.assets.filter(a=>activeProjectIds.has(String(a.project??a.project_id)));
  let list=[...activeAssets];
  if(f.project!=='all')list=list.filter(a=>String(a.project??a.project_id)===String(f.project));
  if(f.type!=='all')list=list.filter(a=>a.type===f.type);
  if(f.status==='Final'){
    list=list.filter(a=>['Approved','Final'].includes(latestVersion(a).status));
  }else if(f.status!=='all'){
    list=list.filter(a=>latestVersion(a).status===f.status);
  }
  if(f.q)list=list.filter(a=>a.title.toLowerCase().includes(f.q.toLowerCase()));
  const types=Object.keys(TYPE_META);
  const statuses=['For Review','Approved','Rejected','Revision Requested','Final'];
  /* Added only for the Assets status cards */
  const statusCards=[
    {
      status:'For Review',
      className:'b-review',
      color:'var(--coral)'
    },
    {
      status:'Approved',
      className:'b-approved',
      color:'var(--cyan)'
    },
    {
      status:'Rejected',
      className:'b-rejected',
      color:'var(--crimson)'
    },
    {
      status:'Revision Requested',
      className:'b-revision',
      color:'var(--violet)'
    },
    {
      status:'Final',
      className:'b-final',
      color:'var(--gold)'
    }
  ];
  return `
    <div class="panel-head">
    <div><div style="display:flex;align-items:center;gap:10px;"><button type="button" class="klay-back-btn" title="Back" aria-label="Go back" onclick="Studio.goBack('dashboard')">←</button><div class="section-title">Assets</div></div>${isClient?'<div class="section-sub">Preview assets from your assigned projects and leave feedback.</div>':DB.currentUser?.role==='project_manager'?'<div class="section-sub">Manage assets for your assigned projects.</div>':DB.currentUser?.role==='animator'?'<div class="section-sub">Browse assigned project assets. Submit animation versions in Studio Galeria.</div>':DB.currentUser?.role==='editor'?'<div class="section-sub">Browse approved production assets. Build sequences and submit final cuts in Sequence Editor.</div>':''}</div>
    ${canSubmitAsset?`<button class="btn btn-primary" onclick="Studio.toggleForm('newAssetForm')">${DB.currentUser?.role==='editor'?'＋ Submit final cut':'+ Submit asset'}</button>`:''}
    </div>
    ${canSubmitAsset?`
    <div
  id="newAssetForm"
  class="card ${openSubmitForm?'':'hidden'}"
  style="padding:20px;margin-top:6px;"
>
      <h3 style="margin-top:0;font-size:15px;">${DB.currentUser?.role==='editor'?(submitExisting==='new'?'Submit final cut':'Revise final cut'):'Submit an asset'}</h3>
      ${submitSequence?'<p class="editor-sequence-cut">Submitting a final cut for a saved editor sequence. The sequence will be linked after submission.</p>':''}
      <div class="field-row">
        <div class="field"><label>Project</label>
  <select id="saProject" onchange="Studio.onSaProjectChange()">
    ${activeProjects.length?'':'<option value="" selected disabled>No assigned active projects available</option>'}
    ${activeProjects.map(p=>`
      <option
        value="${p.id}"
        ${submitProject===String(p.id)?'selected':''}
        ${submitSequence&&submitProject!==String(p.id)?'disabled':''}
      >
        ${esc(p.name)}
      </option>
    `).join('')}
  </select>
</div>
<div class="field">
  <label>This is</label>

  <select
    id="saExisting"
    onchange="Studio.onSaExistingChange()"
  >

    <option value="new">
      ${submitSequence?'A new final cut':'A new asset'}
    </option>

    ${
      activeAssets
        .filter(a => {
          const latest = latestVersion(a);

          return (
            latest &&
            latest.status === 'Revision Requested' &&
            String(a.project_id||a.project)===String(submitProject||activeProjects[0]?.id) &&
            (DB.currentUser?.role!=='editor'||String(a.assigned_editor||projectById(a.project_id||a.project)?.artist_id)===String(DB.currentUser.id)) &&
            (DB.currentUser?.role!=='editor'||(
              a.type==='Render'&&
              (!submitSequence||String(a.id)===submitExisting)
            ))
          );
        })
        .map(a => `
          <option value="${a.id}" ${submitExisting===String(a.id)?'selected':''}>
            Revise: ${esc(a.title)}
          </option>
        `)
        .join('')
    }

  </select>
</div>
      </div>
      <div id="saNewFields" style="display:${submitExisting==='new'?'block':'none'}">
        <div class="field-row">
          <div class="field"><label>Title</label><input id="saTitle" value="${esc(submitTitle)}" placeholder="e.g. Scene 14 — Alley Confrontation Storyboard"></div>
          <div class="field"><label>Asset type</label>
            <select id="saType" ${submitSequence?'disabled':''}>${types.map(t=>`<option value="${t}" ${t===submitType?'selected':''}>${t}</option>`).join('')}</select>
          </div>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="saLink">Media link</label>
          <input id="saLink" type="url" inputmode="url" placeholder="Paste an HTTPS link to your media" oninput="previewAssetLink(this)">
          <small class="asset-link-hint">Paste YouTube, Canva, image, video, document, or webpage links.</small>
          <div id="saLinkPreview" class="asset-link-preview" hidden></div>
        </div>

      </div>
      <div class="field"><label>Notes for reviewers</label><textarea id="saNotes" placeholder="What changed, what to check..."></textarea></div>

      <div class="field">
        <label>Due Date</label>
        <input type="date" id="saDueDate" min="${minimumDueDate}">
      </div>

      <button class="btn btn-primary" onclick="Studio.submitAsset()" ${activeProjects.length?'':'disabled'}>Submit — sets status to “For Review”</button>
      ${activeProjects.length?'':'<div class="asset-link-hint" style="margin-top:10px;">Projects could not be loaded or this account is not assigned to an active project.</div>'}
      <span style="font-size:11.5px;color:var(--text-faint);margin-left:10px;">Workflow automation will move this asset into the review queue automatically.</span>
    </div>`:''}
    <!-- Added: Asset status cards -->
    <div class="stat-grid assets-status-grid">
      ${statusCards.map(s=>{
        const count=s.status==='Final'
          ?activeAssets.filter(a=>['Approved','Final'].includes(latestVersion(a).status)).length
          :activeAssets.filter(a=>latestVersion(a).status===s.status).length;
        const active=f.status===s.status;
        return `
          <button
            type="button"
            class="card stat asset-status-card ${active?'active':''}"
            onclick="Studio.setFilter('status','${s.status}')"
            aria-label="Show ${s.status} assets"
            title="Show ${s.status} assets"
          >
            <div class="bar" style="background:${s.color}"></div>
            <div class="n">${count}</div>
            <div class="l">${s.status}</div>
          </button>
        `;
      }).join('')}
    </div>
    <div class="toolbar">
      <select onchange="Studio.setFilter('project',this.value)">
        <option value="all">All projects</option>
        ${activeProjects.map(p=>`<option value="${p.id}" ${String(f.project)===String(p.id)?'selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <select onchange="Studio.setFilter('type',this.value)">
        <option value="all">All types</option>
        ${types.map(t=>`<option value="${t}" ${f.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <select onchange="Studio.setFilter('status',this.value)">
        <option value="all">All statuses</option>
        ${statuses.map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <input placeholder="Search title…" value="${esc(f.q)}" oninput="Studio.setFilter('q',this.value)">
    </div>
    <div class="editor-assets-grid">
      ${list.length?list.map(a=>{
        const v=latestVersion(a);
        const meta=TYPE_META[a.type]||{color:'var(--cyan)'};
        const proj=projectById(a.project||a.project_id);
        const resolvedVersions=(a.versions||[]).filter(version=>
          ['Approved','Rejected','Final'].includes(version.status)
        );
        return `<button type="button" class="editor-asset-card" onclick="Studio.goto('assetDetail','${esc(a.id)}')">
          <div class="editor-asset-preview" data-preview-label="${esc(a.type||'Asset')}">
            ${renderAssetCardPreview(a)}
            <span class="editor-type-tag" style="background:${meta.color}22;color:${meta.color};">${esc(a.type||'Asset')}</span>
          </div>
          <div class="editor-asset-content">
            <div class="editor-asset-project">${proj?esc(proj.name):''}</div>
            <h3>${esc(a.title)}</h3>
            <div class="editor-asset-submitter">Submitted by ${esc(assetSubmitterName(v))}</div>
            ${resolvedVersions.length?`<div class="editor-asset-version-history">Previous decisions: ${resolvedVersions.map(version=>`${esc(version.status)} V${String(version.n).padStart(2,'0')}`).join(' · ')}</div>`:''}
            ${['Approved','Final'].includes(v.status)?renderApprovalReceipt(a,v):v.status==='Rejected'?'<div class="asset-closed-label">Rejected · Closed at this version</div>':''}
            <div class="editor-asset-footer">
              <span class="vtag">v${String(v.n||1).padStart(2,'0')}</span>
              <span class="badge ${STATUS_CLASS[v.status]||'b-role'}">${esc(v.status)}</span>
              ${can('manageProjects') && (DB.currentUser.role==='admin' || projectById(a.project_id||a.project)?.pm===DB.currentUser.id) ? `<span role="button" tabindex="0" aria-label="Move asset to Trash" title="Move asset to Trash" onclick="event.stopPropagation();Studio.deleteAsset('${esc(a.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();Studio.deleteAsset('${esc(a.id)}')}">✕ Delete</span>` : ''}
            </div>
          </div>
        </button>`;
      }).join(''):`<div class="editor-assets-empty">${isClient?'No assets from your assigned projects match these filters.':'No assets match these filters.'}</div>`}
    </div>
  `;
}

function previewAssetFile(input){
  const selection=document.getElementById('saFileSelection');
  const fileName=document.getElementById('saFileName');
  const preview=document.getElementById('saFilePreview');
  if(!selection||!fileName||!preview)return;

  const previousUrl=preview.dataset.objectUrl;
  if(previousUrl){
    URL.revokeObjectURL(previousUrl);
    delete preview.dataset.objectUrl;
  }
  preview.replaceChildren();

  const file=input.files&&input.files[0];
  if(!file){
    fileName.textContent='';
    selection.hidden=true;
    return;
  }

  selection.hidden=false;
  fileName.textContent=file.name;

  const extension=file.name.split('.').pop().toLowerCase();
  const isImage=/^image\/(avif|gif|jpeg|png|webp)$/.test(file.type)||['avif','gif','jpeg','jpg','png','webp'].includes(extension);
  const isVideo=/^video\/(mp4|ogg|quicktime|webm)$/.test(file.type)||['mov','mp4','ogv','ogg','webm'].includes(extension);
  const isAudio=/^audio\/(mpeg|ogg|wav|mp4|aac|flac)$/.test(file.type)||['mp3','wav','m4a','aac','flac','oga'].includes(extension);
  const isJson=extension==='json';
  const isPdf=extension==='pdf';
  const isWord=['doc','docx','rtf','odt'].includes(extension);
  const isText=['txt','csv','tsv'].includes(extension);

  if(isJson||isText){
    file.text().then(text=>{
      const code=document.createElement('pre');
      code.className='asset-json-file-preview';
      try{
        code.textContent=isJson?JSON.stringify(JSON.parse(text),null,2):text.slice(0,20000);
      }catch(error){
        code.textContent='This file does not contain valid JSON.';
      }
      preview.append(code);
    }).catch(error=>{
      console.error('JSON file preview error:',error);
      preview.textContent='Could not read this JSON file.';
    });
    return;
  }

  const objectUrl=URL.createObjectURL(file);
  preview.dataset.objectUrl=objectUrl;
  if(isWord){
    if(extension==='docx'){
      const code=document.createElement('pre');
      code.className='asset-docx-text-preview';
      code.textContent='Loading Word preview…';
      preview.append(code);
      readDocxText(file).then(text=>{
        code.textContent=text||'This Word document has no readable text.';
      }).catch(error=>{
        console.warn('Word file preview unavailable:',error);
        code.textContent='Could not render this Word document here. Use the download link below.';
      });
    }
    const card=document.createElement('div');
    card.className='asset-document-preview';
    const label=document.createElement('strong');
    label.textContent=extension.toUpperCase();
    const name=document.createElement('span');
    name.textContent=file.name;
    const download=document.createElement('a');
    download.href=objectUrl;
    download.download=file.name;
    download.textContent='Open / download document';
    card.append(label,name,download);
    preview.append(card);
    return;
  }
  if(isPdf){
    const card=document.createElement('div');
    card.className='asset-document-preview';
    const label=document.createElement('strong');
    label.textContent='PDF';
    const name=document.createElement('span');
    name.textContent=file.name;
    const open=document.createElement('a');
    open.href=objectUrl;
    open.target='_blank';
    open.rel='noopener noreferrer';
    open.textContent='Open PDF in a new tab';
    card.append(label,name,open);
    preview.append(card);
    return;
  }
  if(!isImage&&!isVideo&&!isAudio){
    preview.textContent=`${extension.toUpperCase()} file selected. It can be opened or downloaded after submission.`;
    return;
  }
  const media=document.createElement(isVideo?'video':isAudio?'audio':'img');
  media.src=objectUrl;
  if(isVideo||isAudio){
    media.controls=true;
  }else{
    media.alt=file.name;
  }
  preview.append(media);
}

function previewAssetLink(input){
  const preview=document.getElementById('saLinkPreview');
  if(!preview)return;
  const link=input.value.trim();
  preview.replaceChildren();
  preview.hidden=!link;
  if(link){
    preview.innerHTML=renderAssetPreview({
      id:'submission-link-preview',
      title:'Link preview',
      type:'Asset',
      link
    });
  }
}

function renderAssetPreview(asset){
  const mediaUrl=assetMediaUrl(asset);
  const mediaPath=mediaUrl.split(/[?#]/,1)[0].toLowerCase();
  let parsedUrl=null;
  try{
    parsedUrl=new URL(mediaUrl,window.location.href);
  }catch(error){
    parsedUrl=null;
  }
  const hasSafeProtocol=parsedUrl&&['http:','https:'].includes(parsedUrl.protocol);
  const videoId=hasSafeProtocol&&/^(www\.)?(youtube\.com|youtube-nocookie\.com)$/.test(parsedUrl.hostname)
    ?parsedUrl.searchParams.get('v')||parsedUrl.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1]
    :hasSafeProtocol&&/^(www\.)?youtu\.be$/.test(parsedUrl.hostname)
      ?parsedUrl.pathname.split('/').filter(Boolean)[0]
      :null;
  const safeVideoId=videoId&&/^[A-Za-z0-9_-]{11}$/.test(videoId)?videoId:null;
  const isVideoPreview=hasSafeProtocol&&/\.(mp4|webm|ogv|ogg|mov)$/.test(mediaPath);
  const isAudioPreview=hasSafeProtocol&&/\.(mp3|wav|m4a|aac|flac|oga)$/.test(mediaPath);
  const isImagePreview=hasSafeProtocol&&/\.(avif|gif|jpe?g|png|webp)$/.test(mediaPath);
  const isJsonPreview=hasSafeProtocol&&/\.json$/.test(mediaPath);
  const isPdfPreview=hasSafeProtocol&&/\.pdf$/.test(mediaPath);
  const isDocumentPreview=hasSafeProtocol&&/\.(docx?|rtf|odt|xlsx?|ods|pptx?|odp)$/.test(mediaPath);
  const isTextPreview=hasSafeProtocol&&/\.(txt|csv|tsv)$/.test(mediaPath);
  const isCanvaLink=hasSafeProtocol&&/(^|\.)canva\.com$/i.test(parsedUrl.hostname);
  const isCarrdLink=hasSafeProtocol&&/(^|\.)carrd\.co$/i.test(parsedUrl.hostname);
  const previewSizeClass=isCanvaLink?'asset-preview--canva':isPdfPreview?'asset-preview--pdf':'';
  let previewMarkup;
  if(safeVideoId){
    const youtubeUrl=`https://www.youtube.com/watch?v=${safeVideoId}`;
    previewMarkup=`<div class="asset-embed-wrap">
      <iframe class="asset-embed-preview" src="https://www.youtube-nocookie.com/embed/${safeVideoId}" title="${esc(asset.title)} video preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <a class="asset-preview-external-link" href="${esc(youtubeUrl)}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
    </div>`;
  }else if(isCanvaLink){
    const canvaUrl=canvaPreviewUrl(parsedUrl);
    previewMarkup=`<div class="asset-embed-wrap asset-canva-preview-wrap">
      <iframe class="asset-embed-preview" src="${esc(canvaUrl)}" title="${esc(asset.title)} Canva preview" allow="fullscreen" referrerpolicy="no-referrer" loading="lazy"></iframe>
      <a class="asset-preview-external-link" href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open in Canva ↗</a>
    </div>`;
  }else if(isCarrdLink){
    previewMarkup=`<div class="asset-embed-wrap">
      <iframe class="asset-embed-preview asset-carrd-preview" src="${esc(parsedUrl.href)}" title="${esc(asset.title)} Carrd preview" referrerpolicy="no-referrer" loading="lazy"></iframe>
      <a class="asset-preview-external-link" href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open in Carrd ↗</a>
    </div>`;
  }else if(isVideoPreview){
    previewMarkup=`<video controls preload="metadata" playsinline><source src="${esc(mediaUrl)}"></video>`;
  }else if(isAudioPreview){
    previewMarkup=`<audio controls preload="metadata"><source src="${esc(mediaUrl)}"></audio>`;
  }else if(isImagePreview){
    previewMarkup=`<img src="${esc(mediaUrl)}" alt="${esc(asset.title)} preview" onerror="showAssetDetailPreviewFallback(this)">`;
  }else if(isJsonPreview){
    const jsonPreviewId=`asset-json-preview-${String(asset.id).replace(/[^A-Za-z0-9_-]/g,'')}`;
    previewMarkup=`<div class="asset-json-preview-wrap">
      <pre id="${jsonPreviewId}" class="asset-json-preview" aria-label="${esc(asset.title)} JSON preview">Loading JSON preview…</pre>
      <a class="asset-preview-external-link" href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open JSON ↗</a>
    </div>`;
    window.setTimeout(()=>loadAssetJsonPreview(jsonPreviewId,parsedUrl.href),0);
  }else if(isPdfPreview){
    previewMarkup=`<div class="asset-embed-wrap asset-pdf-preview-wrap">
      <iframe class="asset-embed-preview" src="${esc(parsedUrl.href)}" title="${esc(asset.title)} PDF preview" loading="lazy"></iframe>
      <a class="asset-preview-external-link" href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open / download PDF ↗</a>
    </div>`;
  }else if(isDocumentPreview){
    const extension=mediaPath.split('.').pop().toUpperCase();
    if(extension==='DOCX'){
      const docxPreviewId=`asset-docx-preview-${String(asset.id).replace(/[^A-Za-z0-9_-]/g,'')}`;
      previewMarkup=`<div class="asset-docx-preview-wrap">
        <pre id="${docxPreviewId}" class="asset-docx-text-preview">Loading Word preview…</pre>
        <a href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open / download document ↗</a>
      </div>`;
      window.setTimeout(()=>loadAssetDocxPreview(docxPreviewId,parsedUrl.href),0);
    }else{
      previewMarkup=`<div class="asset-document-preview">
        <strong>${esc(extension)}</strong>
        <span>${esc(mediaPath.split('/').pop()||asset.title)}</span>
        <a href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open / download document ↗</a>
      </div>`;
    }
  }else if(isTextPreview){
    const textPreviewId=`asset-text-preview-${String(asset.id).replace(/[^A-Za-z0-9_-]/g,'')}`;
    previewMarkup=`<div class="asset-json-preview-wrap">
      <pre id="${textPreviewId}" class="asset-json-preview">Loading text preview…</pre>
      <a class="asset-preview-external-link" href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open file ↗</a>
    </div>`;
    window.setTimeout(()=>loadAssetTextPreview(textPreviewId,parsedUrl.href),0);
  }else if(mediaUrl&&hasSafeProtocol){
    previewMarkup=`<div class="asset-embed-wrap">
      <iframe class="asset-embed-preview asset-webpage-preview" src="${esc(parsedUrl.href)}" title="${esc(asset.title)} webpage preview" referrerpolicy="no-referrer" loading="lazy"></iframe>
      <a class="asset-preview-external-link" href="${esc(parsedUrl.href)}" target="_blank" rel="noopener noreferrer">Open external link ↗</a>
    </div>`;
  }else{
    previewMarkup='';
  }
  return `
    <section class="asset-detail-preview">
      <h3>Preview</h3>
      <div class="asset-preview ${previewMarkup?'':'asset-preview-fallback'} ${previewSizeClass}" data-preview-label="${esc(asset.type||'Asset')}">
        ${previewMarkup||''}
      </div>
    </section>
  `;
}

async function loadAssetJsonPreview(elementId,url){
  const preview=document.getElementById(elementId);
  if(!preview)return;
  try{
    const response=await window.beeFetch(url,{credentials:'omit'});
    if(!response.ok)throw new Error(`JSON request failed with HTTP ${response.status}.`);
    const text=await response.text();
    if(text.length>2_000_000)throw new Error('JSON preview is larger than 2 MB.');
    const data=JSON.parse(text);
    preview.textContent=JSON.stringify(data,null,2);
  }catch(error){
    console.warn('Asset JSON preview unavailable:',error);
    preview.textContent='JSON preview could not be loaded here. Use “Open JSON” to view it.';
  }
}

async function readDocxText(file){
  if(file.size>30*1024*1024)throw new Error('Word preview is limited to files smaller than 30 MB.');
  return extractDocxText(await file.arrayBuffer());
}

async function loadAssetDocxPreview(elementId,url){
  const preview=document.getElementById(elementId);
  if(!preview)return;
  try{
    const response=await window.beeFetch(url,{credentials:'same-origin'});
    if(!response.ok)throw new Error(`Word document request failed with HTTP ${response.status}.`);
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength>30*1024*1024)throw new Error('Word preview is limited to files smaller than 30 MB.');
    preview.textContent=await extractDocxText(buffer)||'This Word document has no readable text.';
  }catch(error){
    console.warn('Word document preview unavailable:',error);
    preview.textContent='Word preview could not be loaded here. Use the document link to open or download it.';
  }
}

async function extractDocxText(buffer){
  const bytes=new Uint8Array(buffer);
  const view=new DataView(buffer);
  let endOfCentralDirectory=-1;
  for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--){
    if(view.getUint32(offset,true)===0x06054b50){
      endOfCentralDirectory=offset;
      break;
    }
  }
  if(endOfCentralDirectory<0)throw new Error('The Word document ZIP directory is missing.');

  const entryCount=view.getUint16(endOfCentralDirectory+10,true);
  let entryOffset=view.getUint32(endOfCentralDirectory+16,true);
  const decoder=new TextDecoder();
  for(let entry=0;entry<entryCount;entry++){
    if(view.getUint32(entryOffset,true)!==0x02014b50)throw new Error('The Word document archive is invalid.');
    const method=view.getUint16(entryOffset+10,true);
    const compressedSize=view.getUint32(entryOffset+20,true);
    const nameLength=view.getUint16(entryOffset+28,true);
    const extraLength=view.getUint16(entryOffset+30,true);
    const commentLength=view.getUint16(entryOffset+32,true);
    const localHeaderOffset=view.getUint32(entryOffset+42,true);
    const name=decoder.decode(bytes.subarray(entryOffset+46,entryOffset+46+nameLength));
    if(name==='word/document.xml'){
      if(view.getUint32(localHeaderOffset,true)!==0x04034b50)throw new Error('The Word document content is invalid.');
      const localNameLength=view.getUint16(localHeaderOffset+26,true);
      const localExtraLength=view.getUint16(localHeaderOffset+28,true);
      const contentOffset=localHeaderOffset+30+localNameLength+localExtraLength;
      const compressed=bytes.subarray(contentOffset,contentOffset+compressedSize);
      let xmlBytes;
      if(method===0){
        xmlBytes=compressed;
      }else if(method===8&&typeof DecompressionStream==='function'){
        const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        xmlBytes=new Uint8Array(await new Response(stream).arrayBuffer());
      }else{
        throw new Error('This Word document uses an unsupported compression format.');
      }
      const xml=new DOMParser().parseFromString(decoder.decode(xmlBytes),'application/xml');
      if(xml.querySelector('parsererror'))throw new Error('The Word document XML is invalid.');
      const paragraphs=Array.from(xml.getElementsByTagNameNS('*','p'));
      return paragraphs.map(paragraph=>{
        const collect=node=>Array.from(node.childNodes).map(child=>{
          if(child.nodeType===Node.TEXT_NODE)return child.nodeValue||'';
          if(child.nodeType!==Node.ELEMENT_NODE)return '';
          if(child.localName==='t')return child.textContent||'';
          if(child.localName==='tab')return '\t';
          if(child.localName==='br'||child.localName==='cr')return '\n';
          return collect(child);
        }).join('');
        return collect(paragraph);
      }).filter(Boolean).join('\n').slice(0,30000);
    }
    entryOffset+=46+nameLength+extraLength+commentLength;
  }
  throw new Error('The Word document does not contain readable document text.');
}

async function loadAssetTextPreview(elementId,url){
  const preview=document.getElementById(elementId);
  if(!preview)return;
  try{
    const response=await window.beeFetch(url,{credentials:'omit'});
    if(!response.ok)throw new Error(`Text request failed with HTTP ${response.status}.`);
    const text=await response.text();
    if(text.length>20000)throw new Error('Text preview is larger than 20 KB.');
    preview.textContent=text;
  }catch(error){
    console.warn('Asset text preview unavailable:',error);
    preview.textContent='Text preview could not be loaded here. Use “Open file” to view it.';
  }
}

/* =========================================================
   ASSETS — ACCESS & ROLE HELPERS
   ========================================================= */
function pageAssetDetail(){
  const asset=assetById(state.selectedAssetId);
  if(!asset)return `<div class="empty">Asset not found.</div>`;
  if(!userHasExistingAssetAccess(asset))return renderNoAssetAccess();
  const versionNumber=new URLSearchParams(window.location.search).get('version');
  if(versionNumber){
    const version=asset.versions.find(item=>String(item.n)===versionNumber);
    return version
      ?renderAssetVersionDetail(asset,version)
      :`<section class="card asset-access-unavailable"><h2>Version not found</h2><p>This version is no longer available in the asset history.</p><button type="button" class="btn btn-sm" onclick="Studio.goto('assetDetail','${esc(asset.id)}')">Back to asset</button></section>`;
  }
  return renderAssetDetail(asset);
}

function openAssetVersion(assetId,versionNumber){
  const url=new URL(window.location.href);
  url.searchParams.set('asset',String(assetId));
  url.searchParams.set('version',String(versionNumber));
  window.location.href=url.href;
}

function renderAssetDetail(asset){
  const currentRole=DB.currentUser&&DB.currentUser.role;
  if(!userHasExistingAssetAccess(asset))return renderNoAssetAccess();
  if(currentRole==='client')return renderClientAssetView(asset);
  if(!isInternalAssetRole(currentRole))return renderNoAssetAccess();
  if(currentRole==='admin')return renderAdminAssetView(asset);
  return renderInternalAssetView(asset);
}

function isInternalAssetRole(role){
  return ['admin','project_manager','animator','editor'].includes(role);
}

function userHasExistingAssetAccess(asset){
  return !!projectById(asset.project??asset.project_id);
}

function renderNoAssetAccess(){
  return `
    <section class="card asset-access-unavailable">
      <h2>Access unavailable</h2>
      <p>You do not have access to this asset.</p>
    </section>
  `;
}

/* =========================================================
   ASSETS — ADMIN REVIEW VIEW
   ========================================================= */
function renderAdminAssetView(asset){
  return renderInternalAssetWorkspace(asset);
}

/* =========================================================
   ASSETS — INTERNAL STAFF VIEW
   Project Manager / Animator / Editor
   ========================================================= */
function renderInternalAssetView(asset){
  return renderInternalAssetWorkspace(asset);
}

function renderInternalAssetWorkspace(asset){
  const project=projectById(asset.project);
  const version=latestVersion(asset);
  const meta=TYPE_META[asset.type];
  const isAnimatorShot=DB.currentUser?.role==='animator'&&asset.type==='Animation Scene';
  const role=DB.currentUser?.role;
  const roleCanRevise=role==='admin'||role==='project_manager';
  const canSubmitRevision=can('uploadAsset')&&roleCanRevise&&version.status==='Revision Requested';
  return `
    <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goto('${isAnimatorShot?'shotTracker':'assets'}')">←</button>
    <div class="card asset-client-heading asset-internal-heading" style="margin-top:14px;">
      <div class="asset-client-heading-content">
        <div class="asset-client-overline">
          <div class="asset-detail-type" style="background:${meta.color}22;color:${meta.color};">${esc(asset.type||'Asset')}</div>
          <div class="eyebrow">${esc(project?project.name:'')}</div>
        </div>
        <h2>${esc(asset.title)}</h2>
        <div class="asset-client-summary">
          <span class="chip">${esc(asset.type)}</span>
          <span class="badge ${STATUS_CLASS[version.status]}">${esc(version.status)}</span>
          ${asset.link?`<span class="chip" title="External storage link">🔗 ${esc(asset.link)}</span>`:''}
        </div>
      </div>
      ${canSubmitRevision?`
      <button class="btn btn-sm" onclick="Studio.goto('assets');Studio.toggleForm('newAssetForm');document.getElementById('saProject').value='${asset.project_id||asset.project}';Studio.onSaProjectChange();document.getElementById('saExisting').value='${asset.id}';Studio.onSaExistingChange();">
        + Submit Revised Version
      </button>`:''}
    </div>
    <div class="asset-detail-layout">
      <div class="asset-detail-main">
        ${renderAssetPreview(asset)}
        ${renderAssetVersionHistory(asset)}
      </div>
      <div class="asset-detail-notes">
        ${renderAssetFeedback(asset)}
      </div>
    </div>
    ${renderAssetStatusSections(asset)}
  `;
}

function renderAssetVersionHistory(asset){
  const currentVersion=latestVersion(asset);
  return `
    ${['Approved','Final'].includes(currentVersion.status)?renderApprovalReceipt(asset,currentVersion):''}
    <section class="asset-version-history">
      <h3>Version history</h3>
      ${asset.versions.slice().reverse().map(version=>{
        const author=userById(version.by);
        const Tag='button';
        return `<${Tag} type="button" onclick="openAssetVersion('${esc(asset.id)}','${esc(version.n)}')" aria-label="Open ${esc(version.status)} version ${esc(version.n)}" class="version-item version-item-clickable ${version.id===currentVersion.id?'latest':''}">
          <div class="vh-top">
            <span class="vtag">v${String(version.n).padStart(2,'0')}</span>
            <span class="badge ${STATUS_CLASS[version.status]}">${esc(version.status)}</span>
            <span style="font-size:12px;color:var(--text-faint);margin-left:auto;">${fmtDate(version.date)}</span>
          </div>
          <div style="font-size:13px;margin-top:8px;color:var(--text-dim);">${esc(version.notes||'—')}</div>
          <div style="font-size:11px;color:var(--text-faint);margin-top:6px;" class="mono">Submitted by ${esc(version.submitted_by||author?.name||'Not recorded')}</div>
        </${Tag}>`;
      }).join('')}
      ${asset.versions.length?'<p class="asset-version-history-hint">Select any version to open its saved details and media.</p>':''}
    </section>
  `;
}

function renderAssetVersionDetail(asset,version){
  const project=projectById(asset.project??asset.project_id);
  const latest=latestVersion(asset);
  const mediaUrl=version.media_url||(String(version.n)===String(latest.n)?assetMediaUrl(asset):'');
  const versionAsset={
    ...asset,
    preview_url:'',
    thumbnail:'',
    file_path:'',
    link:mediaUrl,
    external_link:mediaUrl
  };
  const author=version.by?userById(version.by):null;
  return `
    <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goto('assetDetail','${esc(asset.id)}')">←</button>
    <section class="card asset-version-detail-heading">
      <div class="eyebrow">${esc(project?.name||'')}</div>
      <h1>${esc(asset.title)} · v${String(version.n).padStart(2,'0')}</h1>
      <div class="asset-client-summary">
        <span class="chip">${esc(asset.type||'Asset')}</span>
        <span class="badge ${STATUS_CLASS[version.status]||'b-role'}">${esc(version.status)}</span>
        <span class="asset-client-version-date">${fmtDate(version.date)}</span>
      </div>
      <div class="asset-version-submitter">Submitted by ${esc(version.submitted_by||author?.name||'Not recorded')}</div>
    </section>
    <div class="asset-version-detail-layout">
      ${mediaUrl?renderAssetPreview(versionAsset):`
        <section class="asset-detail-preview">
          <h3>Version preview</h3>
          <div class="card asset-version-media-unavailable">
            <strong>Media not available</strong>
            <span>This older version was saved before version-specific media history was enabled.</span>
          </div>
        </section>
      `}
      <section class="card asset-version-notes-panel">
        <h2>Version notes</h2>
        <p>${esc(version.notes||'No notes were saved for this version.')}</p>
        <h2>Review feedback</h2>
        <p>${esc(version.review_feedback||'No review feedback was recorded for this version.')}</p>
      </section>
    </div>
  `;
}

function renderAssetFeedback(asset){
  const isClient=DB.currentUser?.role==='client';
  const version=latestVersion(asset);
  const comments=DB.currentUser?.role==='client'
    ?(asset.comments||[])
    :[
      ...(asset.comments||[]),
      ...DB.comments.filter(comment=>
        String(comment.asset)===String(asset.id)&&
        !(asset.comments||[]).some(saved=>String(saved.id)===String(comment.id))
      )
    ];
  const entries=[];
  if(!isClient&&String(version.notes||'').trim()){
    const author=version.by?userById(version.by):null;
    entries.push({
      name:author?.name||'Asset note',
      role:author?ROLE_LABELS[author.role]:'Version note',
      date:version.date,
      text:version.notes
    });
  }
  comments.forEach(comment=>{
    const user=userById(comment.by);
    entries.push({
      name:comment.name||user?.name||'Unknown',
      role:ROLE_LABELS[comment.role||user?.role]||'',
      date:comment.date,
      text:comment.text
    });
  });
  return `
    <section class="asset-detail-feedback">
      <h3>Notes &amp; feedback</h3>
      <div class="asset-feedback-list">
        ${entries.length?entries.map(entry=>renderFeedbackEntry({
          context:entry.role||'Feedback',
          title:entry.name,
          meta:entry.date?fmtDate(entry.date):'',
          text:entry.text
        })).join(''):'<div class="empty">No feedback yet. Notes from reviewers and clients will show up here.</div>'}
        ${(can('commentAsset')||DB.currentUser?.role==='client')?`
        <div class="asset-feedback-form">
          <textarea id="newComment" placeholder="Add notes or feedback..."></textarea>
          <button class="btn btn-sm" onclick="Studio.addComment('${asset.id}')">Add comment</button>
        </div>`:''}
      </div>
    </section>
  `;
}

/* =========================================================
   ASSETS — CLIENT PREVIEW VIEW
   ========================================================= */
function renderClientAssetView(asset){
  const project=projectById(asset.project);
  const version=latestVersion(asset);
  const canClientDecide=version.status==='For Review';
  return `
    <button type="button" class="klay-back-btn" title="Go back" aria-label="Go back" onclick="Studio.goto('assets')">←</button>
    <div class="card asset-client-heading">
      <div class="asset-client-heading-content">
        <div class="asset-client-overline">
          <div class="asset-detail-type" style="background:${(TYPE_META[asset.type]||{color:'var(--cyan)'}).color}22;color:${(TYPE_META[asset.type]||{color:'var(--cyan)'}).color};">${esc(asset.type||'Asset')}</div>
          <div class="eyebrow">${esc(project?project.name:'')}</div>
        </div>
        <h1>${esc(asset.title)}</h1>
        <div class="asset-client-summary">
          <span class="chip">${esc(asset.type||'Asset')}</span>
          <span class="badge ${STATUS_CLASS[version.status]||'b-role'}">${esc(version.status)}</span>
          <span class="vtag">v${String(version.n||1).padStart(2,'0')}</span>
        </div>
      </div>
    </div>
    <div class="asset-detail-layout asset-client-detail-layout">
      <div class="asset-detail-main">
        ${renderAssetPreview(asset)}
        ${canClientDecide?`
          <section class="card asset-review-panel client-asset-decision-panel">
            <h3 style="margin-top:0;font-size:14px;">Your decision</h3>
            <div class="asset-review-actions">
              <button type="button" class="asset-review-btn approve" onclick="Studio.reviewAsset('${esc(asset.id)}','approve')">✓ Approve</button>
              <button type="button" class="asset-review-btn revision" onclick="Studio.reviewAsset('${esc(asset.id)}','revise')">↺ Request Changes</button>
              <button type="button" class="asset-review-btn reject" onclick="Studio.reviewAsset('${esc(asset.id)}','reject')">✕ Reject</button>
            </div>
          </section>
        `:''}
        ${renderAssetVersionHistory(asset)}
      </div>
      <aside class="asset-detail-notes">
        ${renderAssetFeedback(asset)}
      </aside>
    </div>
  `;
}

/* =========================================================
   ASSETS — STATUS-SPECIFIC SECTIONS
========================================================= */
function renderAssetStatusSections(asset){
  const role=DB.currentUser&&DB.currentUser.role;
  const status=latestVersion(asset).status;
  const showStudioSections=isInternalAssetRole(role)&&['Approved','Revision Requested','Final'].includes(status);
  return showStudioSections?renderTeamRoles():'';
}

/* =========================================================
ASSETS — TEAM ROLES
========================================================= */
function renderTeamRoles(){
  const studioRoles=[
    {name:'Administrator',role:'Administrator',description:'Studio Admin'},
    {name:'Project Manager',role:'Project Manager',description:'Production Lead'},
    {name:'Animator',role:'Animator',description:'Bringing scenes to life'},
    {name:'Editor',role:'Editor',description:'Crafting the final cut'}
  ];
  return `
    <section class="studio-roles-section" aria-labelledby="studioRolesTitle">
      <div class="studio-showcase-heading">
        <span class="eyebrow">THE CREATIVE CREW</span>
        <h2 id="studioRolesTitle">Team Roles</h2>
      </div>
      <div class="studio-roles-grid">
        ${studioRoles.map(member=>`
          <article class="studio-role-card">
            <div class="studio-role-avatar" aria-hidden="true">${member.name.charAt(0)}</div>
            <h3>${member.name}</h3>
            <span class="studio-role-name">${member.role}</span>
            <p>${member.description}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function render(){
  if(!DB.currentUser)return;
  renderSidebar();
  const el=document.getElementById('pageContent');
  if(!el)return;
  switch(state.page){
    case 'dashboard':el.innerHTML=pageDashboard();break;
    case 'projects':el.innerHTML=pageProjects();break;
    case 'projectDetail':el.innerHTML=pageProjectDetail();break;
    case 'assets':el.innerHTML=pageAssets();break;
    case 'assetDetail':el.innerHTML=pageAssetDetail();break;
    case 'review':el.innerHTML=pageReview();break;
    case 'notifications':el.innerHTML=pageNotifications();break;
    case 'integrations':el.innerHTML=pageIntegrations();break;
    case 'resources':el.innerHTML=pageResources();break;
    case 'audit':el.innerHTML=pageAudit();break;
    case 'users':el.innerHTML=pageUsers();break;
    case 'architecture':el.innerHTML=pageArchitecture();break;
    default:el.innerHTML=pageDashboard();
  }
}
document.addEventListener('DOMContentLoaded',async () => {
  await window.BEE_SERVER_READY;
  // When opened from Project Details via ?submit=1&project=..., keep this as the Assets page.
  if(new URLSearchParams(window.location.search).get('submit')==='1'){
    state.page='assets';
  }
  if(!DB.currentUser){
    window.location.assign('../login/login.html');
    return;
  }
  const menu=document.getElementById('menuButton');
  if(menu){
    menu.addEventListener('click',()=>{
      document.getElementById('sidebar')?.classList.toggle('open');
    });
  }
  // Render the actual page after the separated HTML document loads.
  render();
});
