import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc,
  deleteDoc, writeBatch, runTransaction, onSnapshot } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { app, auth, db } from './firebase.js';
import { timestamp, staffRoles, projectAccess, publicProject, publicAsset,
  projectView, assetView, versionView, assertMediaLink, assertComplete } from './firebase-model.js';

const nativeFetch = window.fetch.bind(window);
const ref = (name, id) => doc(db, name, String(id));
const uuid = prefix => prefix + crypto.randomUUID();
const numericId = () => Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000;
const result = data => new Response(JSON.stringify({ success: true, ...data }), {
  headers: { 'Content-Type': 'application/json' }
});
const fail = (message, code = 400) => Object.assign(new Error(message), { status: code });
const record = snapshot => snapshot.exists() ? { ...snapshot.data(), id: snapshot.data().id ?? snapshot.id } : null;
async function get(name, id) { return record(await getDoc(ref(name, id))); }
async function list(name, constraints = []) {
  const source = collection(db, name);
  return (await getDocs(constraints.length ? query(source, ...constraints) : source))
    .docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.data().id ?? snapshot.id }));
}
async function currentUser() {
  await auth.authStateReady();
  if (!auth.currentUser) return null;
  const user = await get('app_users', auth.currentUser.uid);
  if (!user || user.disabled) { await signOut(auth); return null; }
  if (user.verification_required && !auth.currentUser.emailVerified) { await signOut(auth); throw fail('Verify your email using the invitation link before signing in.', 403); }
  return { ...user, id: auth.currentUser.uid, name: user.full_name };
}
const requireRoles = (user, roles) => {
  if (!roles.includes(user.role)) throw fail('You do not have permission to perform this action.', 403);
};
async function scoped(name, user) {
  if (user.role === 'admin') return list(name);
  return list(name, [where('access_ids', 'array-contains', user.id)]);
}
async function scopedBy(name, user, field, value) {
  const constraints = [where(field, '==', value)];
  if (user.role !== 'admin') constraints.push(where('access_ids', 'array-contains', user.id));
  return list(name, constraints);
}
async function projects(user) {
  return user.role === 'client'
    ? list('client_projects', [where('client_id', '==', user.id)])
    : (await scoped('projects', user)).map(projectView);
}
async function assets(user) {
  const rows = user.role === 'client'
    ? await list('client_assets', [where('client_id', '==', user.id)])
    : await scoped('assets', user);
  const comments = user.role === 'admin'
    ? await list('comments')
    : await list('comments', [where('reader_ids', 'array-contains', user.id)]);
  if (user.role === 'client') return rows.map(row => ({ ...row, comments: comments.filter(c => String(c.asset_id) === String(row.id)) }));
  const versions = await scoped('asset_versions', user);
  return rows.map(row => assetView(row, versions.filter(v => String(v.asset_id) === String(row.id)),
    comments.filter(c => String(c.asset_id) === String(row.id))));
}
async function notifications(user) {
  return (await list('notifications', [where('user_id', '==', user.id)]))
    .map(row => ({ ...row, text: row.message, read: Boolean(Number(row.is_read)), date: row.created_at }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
async function audit(user) {
  if (!['admin', 'project_manager'].includes(user.role)) return [];
  const rows = user.role === 'admin' ? await list('audit_logs') : (await Promise.all(
    (await scoped('projects', user)).map(p => list('audit_logs', [where('project_id', '==', p.id), where('entity_type', '==', 'project')]))
  )).flat();
  return rows.map(row => ({ ...row, date: row.created_at, by: row.by || 'System' }));
}
async function projectFor(user, id) {
  const project = await get('projects', id);
  if (!project) throw fail('Project not found.', 404);
  if (user.role !== 'admin' && !project.access_ids?.includes(user.id)) throw fail('Project access denied.', 403);
  return project;
}
function auditWrite(batch, user, project, action, entity, detail) {
  const id = uuid('au');
  batch.set(ref('audit_logs', id), { id, user_id: user.id, by: user.full_name,
    project_id: project.id, entity_type: 'project', client_id: project.client_id || '', action, entity, detail,
    access_ids: project.access_ids || projectAccess(project), created_at: timestamp() });
}
function notifyWrite(batch, user, project, title, message, type = 'submission') {
  for (const uid of [...new Set([...(project.access_ids || projectAccess(project)), project.client_id].filter(Boolean))]) {
    const id = uuid('n');
    batch.set(ref('notifications', id), { id, user_id: uid, author_id: user.id,
      project_id: project.id, title, message, type, is_read: 0, created_at: timestamp() });
  }
}
async function teamFields(user, input, previous = {}) {
  const values = {
    pm: user.role === 'project_manager' ? user.id : (input.project_manager_id ?? input.pm ?? previous.pm),
    artist_id: input.editor_id ?? input.artist_id ?? previous.artist_id ?? null,
    animator_id: input.animator_id ?? previous.animator_id ?? null,
    client_id: input.client_id ?? previous.client_id
  };
  for (const [key, role] of Object.entries({ pm: 'project_manager', artist_id: 'editor', animator_id: 'animator', client_id: 'client' })) {
    if (!values[key]) {
      if (key === 'pm' || key === 'client_id') throw fail('Assign a project manager and client.');
      values[key] = null;
      continue;
    }
    const member = await get('app_users', values[key]);
    if (!member || member.role !== role || member.disabled) throw fail('Invalid ' + role.replaceAll('_', ' ') + ' account.');
    if (key === 'client_id') values.client = member.full_name;
  }
  return values;
}
async function saveProject(user, method, input) {
  requireRoles(user, ['admin', 'project_manager']);
  const id = String(input.project_id || input.id || uuid('p'));
  const previous = input.project_id || input.id ? await projectFor(user, id) : {};
  if (!previous.id && user.role !== 'admin') throw fail('Only Administrators can create projects.', 403);
  const assignments = await teamFields(user, input, previous);
  if (previous.id && !previous.access_ids?.includes(user.id) && ['pm','artist_id','animator_id','client_id'].some(key => assignments[key] !== previous[key])) throw fail('Only an assigned project manager or administrator can change this project team.', 403);
  const project = { ...previous, ...assignments, id,
    name: input.name ?? previous.name, deadline: input.deadline ?? previous.deadline ?? null,
    budget: Number(input.budget ?? previous.budget), status: input.status ?? previous.status ?? 'Pre-Production',
    producer: previous.producer || user.full_name, created_at: previous.created_at || timestamp() };
  if (!project.name?.trim() || project.budget < 5000 || project.budget > 999999) throw fail('Enter a project name and a budget between PHP 5,000 and PHP 999,999.');
  if (project.status === 'Completed') assertComplete((await assets(user)).filter(asset => asset.project_id === id));
  project.access_ids = projectAccess(project);
  const batch = writeBatch(db);
  batch.set(ref('projects', id), project);
  batch.set(ref('client_projects', id), publicProject(project));
  // Keep the asset/child access metadata aligned when assignments change.
  if (previous.id) {
    for (const name of ['assets', 'asset_versions', 'resources', 'editor_sequences', 'animation_shot_progress', 'animation_shot_workflow']) {
      for (const child of await scopedBy(name, user, 'project_id', id)) {
        batch.update(ref(name, child.id), { access_ids: project.access_ids });
      }
    }
    for (const child of (await list('comments', [where('reader_ids', 'array-contains', user.id)])).filter(c => c.project_id === id)) {
      batch.update(ref('comments', child.id), { reader_ids: [...project.access_ids, project.client_id] });
    }
    for (const asset of await scopedBy('assets', user, 'project_id', id)) {
      const versions = await scopedBy('asset_versions', user, 'asset_id', asset.id);
      const latest = versions.sort((a, b) => Number(a.version_number) - Number(b.version_number)).at(-1);
      batch.set(ref('client_assets', asset.id), publicAsset(asset, latest, project));
    }
  }
  auditWrite(batch, user, project, previous.id ? 'Updated' : 'Created', 'Project', project.name);
  notifyWrite(batch, user, project, 'Project updated', project.name, 'general');
  await batch.commit();
  return { project: projectView(project), message: 'Project saved.' };
}
async function saveAsset(user, input) {
  requireRoles(user, staffRoles);
  if (input.asset_file instanceof File && input.asset_file.size) throw fail('Use an external media link for this app.');
  const existing = input.asset_id ? await get('assets', input.asset_id) : null;
  if (input.asset_id && !existing) throw fail('Asset not found.', 404);
  if (existing && input.project_id && String(input.project_id) !== String(existing.project_id)) throw fail('A revision must stay in its original project.', 403);
  const project = await projectFor(user, existing?.project_id || input.project_id);
  if (user.role !== 'admin' && !project.access_ids?.includes(user.id)) throw fail('You must be assigned to this project to submit assets.', 403);
  const link = assertMediaLink(input.link || input.external_link);
  if (existing && !['admin', 'project_manager'].includes(user.role)) {
    const assigned = user.role === 'editor' ? existing.assigned_editor || project.artist_id : existing.assigned_animator || project.animator_id;
    if (assigned !== user.id) throw fail('This asset is not assigned to you.', 403);
  }
  const id = existing?.id ?? numericId();
  const asset = { ...existing, id, project_id: project.id, asset_title: input.title || existing?.asset_title,
    asset_type: input.type || existing?.asset_type, external_link: link,
    assigned_editor: input.assigned_editor || existing?.assigned_editor || project.artist_id || null,
    assigned_animator: input.assigned_animator || existing?.assigned_animator || project.animator_id || null,
    created_at: existing?.created_at || timestamp(), due_date: input.due_date || existing?.due_date || null,
    uploaded_by: existing?.uploaded_by || user.id, access_ids: project.access_ids };
  if ([asset.assigned_editor, asset.assigned_animator].some(id => id && !project.access_ids.includes(String(id)))) throw fail('Asset assignees must belong to this project.', 403);
  if (!asset.asset_title?.trim() || !asset.asset_type) throw fail('Enter an asset title and type.');
  const oldVersions = existing ? await scopedBy('asset_versions', user, 'asset_id', id) : [];
  const last = oldVersions.sort((a, b) => Number(a.version_number) - Number(b.version_number)).at(-1);
  if (existing && last?.status !== 'Revision Requested') throw fail('Only Request revisions allows another version. Approved and rejected assets are closed.', 409);
  const version = { id: numericId(), asset_id: id, project_id: project.id,
    version_number: Number(last?.version_number || 0) + 1, status: 'For Review',
    notes: input.notes || '', uploaded_by: user.id, created_at: timestamp(),
    version_media_url: link, review_feedback: '', access_ids: project.access_ids };
  const batch = writeBatch(db);
  batch.set(ref('assets', id), asset);
  batch.set(ref('asset_versions', version.id), version);
  batch.set(ref('client_assets', id), publicAsset(asset, version, project));
  if (input.sequence_id) {
    const sequence = await get('editor_sequences', input.sequence_id);
    if (!sequence || sequence.editor_id !== user.id || sequence.project_id !== project.id) throw fail('Invalid sequence cut assignment.', 403);
    batch.update(ref('editor_sequences', input.sequence_id), { cut_asset_id: id, cut_title: asset.asset_title, cut_status: 'For Review' });
  }
  auditWrite(batch, user, project, 'Uploaded', 'Asset #' + id, asset.asset_title);
  notifyWrite(batch, user, project, 'Asset for review', asset.asset_title);
  await batch.commit();
  return { asset: assetView(asset, [...oldVersions, version]), version: versionView(version), link };
}
async function reviewAsset(user, input) {
  requireRoles(user, ['client']);
  const assetId = String(input.asset_id || input.id);
  const status = input.status;
  if (!['Approved', 'Revision Requested', 'Rejected'].includes(status)) throw fail('Invalid review decision.');
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref('client_assets', assetId));
    const asset = record(snapshot);
    if (!asset || asset.client_id !== user.id || asset.status !== 'For Review') throw fail('This asset is not awaiting your review.', 403);
    const approval = status === 'Approved' ? { approval_id: 'APR-' + asset.latest_version_id, approved_by: user.id, approved_at: timestamp() } : {};
    const view = { ...asset.versions[0], status, review_feedback: input.feedback || '', ...approval };
    transaction.update(snapshot.ref, { status, versions: [view] });
    transaction.update(ref('asset_versions', asset.latest_version_id), { status, review_feedback: input.feedback || '', ...approval });
    const project = { id: asset.project_id, client_id: asset.client_id,
      access_ids: asset.reader_ids.filter(id => id !== asset.client_id) };
    auditWrite(transaction, user, project, 'Reviewed', 'Asset #' + asset.id, status);
    notifyWrite(transaction, user, project, 'Client decision', asset.title + ': ' + status, 'approval');
  });
  return { status };
}
async function commentAsset(user, input) {
  const asset = await get(user.role === 'client' ? 'client_assets' : 'assets', input.asset_id);
  if (!asset) throw fail('Asset not found.', 404);
  const project = user.role === 'client' ? await get('client_projects', asset.project_id) : await projectFor(user, asset.project_id);
  const text = String(input.comment || '').trim();
  if (!text || text.length > 10000) throw fail('Enter feedback up to 10,000 characters.');
  const id = uuid('c');
  const comment = { id, asset_id: asset.id, project_id: project.id,
    text, by: user.full_name, user_id: user.id, date: timestamp(),
    reader_ids: user.role === 'client' ? [user.id] : [...project.access_ids, project.client_id] };
  // For client feedback the server rules verify the asset; readers are copied from
  // the client view's explicit metadata to keep feedback visible to the project team.
  if (user.role === 'client') comment.reader_ids = asset.reader_ids;
  const activityProject = { ...project, access_ids: asset.reader_ids
    ? asset.reader_ids.filter(id => id !== project.client_id) : project.access_ids };
  const batch = writeBatch(db);
  batch.set(ref('comments', id), comment);
  auditWrite(batch, user, activityProject, 'Comment', 'Asset #' + asset.id, text);
  notifyWrite(batch, user, activityProject, 'New feedback', text, 'revision');
  await batch.commit();
  return { comment };
}
async function saveResource(user, input) {
  requireRoles(user, ['admin', 'project_manager']);
  const project = await projectFor(user, input.project_id);
  const row = { id: uuid('r'), project_id: project.id, category: input.category,
    description: input.description, cost: Number(input.cost || 0), hours: Number(input.hours || 0),
    logged_by: user.id, created_at: timestamp(), access_ids: project.access_ids };
  if (!row.category || !row.description || row.cost < 0 || row.hours < 0 || !Number.isFinite(row.cost + row.hours)) throw fail('Enter valid resource details.');
  const batch = writeBatch(db);
  batch.set(ref('resources', row.id), row);
  auditWrite(batch, user, project, 'Created', 'Resource', row.description);
  await batch.commit();
  return { resource: row };
}
async function sequenceApi(user, method, input) {
  requireRoles(user, ['editor']);
  const projectRows = await projects(user);
  const assetRows = await assets(user);
  const library = assetRows.filter(a => ['Animation Scene', 'Audio'].includes(a.type) && ['Approved', 'Final'].includes(a.versions.at(-1)?.status))
    .map(a => ({ asset_id: a.id, project_id: a.project_id, title: a.title, type: a.type, external_link: a.link, status: a.versions.at(-1)?.status }));
  if (method === 'GET') {
    const rows = await list('editor_sequences', [where('editor_id', '==', user.id), where('access_ids', 'array-contains', user.id)]);
    return { projects: projectRows, library, sequences: rows.map(sequence => {
      const cut = assetRows.find(asset => String(asset.id) === String(sequence.cut_asset_id));
      return cut ? { ...sequence, cut_title: cut.title, cut_status: cut.versions.at(-1)?.status } : sequence;
    }) };
  }
  if (input.action === 'delete') { await deleteDoc(ref('editor_sequences', input.sequence_id)); return {}; }
  const project = await projectFor(user, input.project_id);
  if (!input.title?.trim() || !Array.isArray(input.items) || !input.items.length) throw fail('Enter a title and at least one sequence item.');
  const id = input.sequence_id || numericId();
  const previous = input.sequence_id ? await get('editor_sequences', id) : null;
  const items = input.items.map((item, index) => {
    const assetId = typeof item === 'object' ? item.asset_id : item;
    const asset = library.find(a => String(a.asset_id) === String(assetId) && a.project_id === project.id);
    if (!asset) throw fail('Sequence items must be approved assets from this project.');
    return { ...asset, sequence_id: id, item_order: index + 1 };
  });
  const sequence = { ...previous, id, project_id: project.id, project_name: project.name,
    title: input.title, notes: input.notes || '', editor_id: user.id, items,
    access_ids: project.access_ids, updated_at: timestamp(), cut_asset_id: previous?.cut_asset_id || null };
  const sequenceBatch = writeBatch(db);
  sequenceBatch.set(ref('editor_sequences', id), sequence);
  auditWrite(sequenceBatch, user, project, previous ? 'Updated' : 'Created', 'Production', sequence.title);
  await sequenceBatch.commit();
  return { sequence, sequence_id: id };
}
async function shotApi(user, method, input) {
  requireRoles(user, ['animator']);
  const projectRows = await projects(user);
  const assetRows = await assets(user);
  const progressRows = await scoped('animation_shot_progress', user);
  const workflowRows = await scoped('animation_shot_workflow', user);
  const shots = assetRows.filter(a => a.type === 'Animation Scene' && a.versions.at(-1)?.status === 'Revision Requested')
    .map(a => ({ asset_id: a.id, title: a.title, type: a.type, project_id: a.project_id,
      project_name: projectRows.find(p => p.id === a.project_id)?.name || '', due_date: a.due_date,
      asset_media_url: a.link, review_status: a.versions.at(-1)?.status,
      version_number: a.versions.at(-1)?.n, review_notes: a.versions.at(-1)?.notes,
      stage: 'Blocking', progress: 0, workflow_status: 'Not Started',
      ...progressRows.find(p => String(p.asset_id) === String(a.id)),
      ...workflowRows.find(p => String(p.asset_id) === String(a.id)) }));
  if (method === 'GET') return { shots };
  const shot = shots.find(s => String(s.asset_id) === String(input.asset_id));
  if (!shot) throw fail('This shot is not assigned for revision.', 403);
  const project = await projectFor(user, shot.project_id);
  const progress = Number(input.progress);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw fail('Progress must be between 0 and 100.');
  const row = { id: String(shot.asset_id), asset_id: shot.asset_id, project_id: shot.project_id,
    stage: input.stage, progress, playblast_url: input.playblast_url ? assertMediaLink(input.playblast_url) : '',
    workflow_status: input.workflow_status || 'In Progress', task_notes: input.task_notes || '',
    updated_by: user.id, updated_at: timestamp(), access_ids: project.access_ids };
  const shotBatch = writeBatch(db);
  shotBatch.set(ref('animation_shot_progress', row.id), row);
  auditWrite(shotBatch, user, project, 'Updated', 'Production', shot.title + ': ' + row.workflow_status + ' (' + progress + '%)');
  await shotBatch.commit();
  return { shot: { ...shot, ...row } };
}
async function teamInvitation(input, service = 'team-invite') {
  await auth.authStateReady();
  if (!auth.currentUser) throw fail('Sign in first.', 401);
  const endpoint = location.hostname === 'siaa-ten.vercel.app' ? '/api/' + service : 'https://siaa-ten.vercel.app/api/' + service;
  const response = await nativeFetch(endpoint, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + await auth.currentUser.getIdToken()
  }, body: JSON.stringify(input) });
  const data = await response.json();
  if (!response.ok || !data.success) throw fail(data.error || 'Unable to process invitation.', response.status);
  return data;
}
async function authApi(method, input, url) {
  if (method === 'GET' && (url.searchParams.get('action') || 'session') === 'session') {
    const user = await currentUser();
    return { authenticated: Boolean(user), user };
  }
  if (method === 'POST' && input.action === 'logout') { await signOut(auth); return {}; }
  if (method === 'POST' && (input.action || 'login') === 'login') {
    await signInWithEmailAndPassword(auth, input.email, input.password);
    const user = await currentUser();
    if (!user) throw fail('This account is disabled.', 403);
    if (user.verification_required) {
      try { await teamInvitation({ action: 'accept' }); } catch { /* Sign-in remains valid; admin refresh can verify ownership. */ }
    }
    return { user };
  }
  if (method === 'POST' && ['register', 'create_team_member'].includes(input.action)) {
    const administrator = input.action === 'create_team_member' ? await currentUser() : null;
    if (administrator) requireRoles(administrator, ['admin']);
    if (input.action === 'create_team_member' && !administrator) throw fail('Sign in as administrator.', 401);
    if (administrator) return teamInvitation({ action: 'invite', name: input.name, email: input.email, role: input.role });
    const role = 'client';
    if (![...staffRoles, 'client'].includes(role) || !input.name?.trim()) throw fail('Enter a valid name and role.');
    const secondary = initializeApp(app.options, uuid('signup'));
    const secondaryAuth = getAuth(secondary);
    try {
      const created = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
      await updateProfile(created.user, { displayName: input.name });
      const profile = { id: created.user.uid, full_name: input.name, email: created.user.email,
        role, created_at: timestamp(), disabled: false };
      // New registrations write their own minimal client profile. Admin team
      // creation writes with the administrator's original, unchanged session.
      if (administrator) await setDoc(ref('app_users', profile.id), profile);
      else {
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');
        await setDoc(doc(getFirestore(secondary), 'app_users', profile.id), profile);
      }
      return { user: profile };
    } finally { await signOut(secondaryAuth); await deleteApp(secondary); }
  }
  const user = await currentUser();
  if (!user) throw fail('Not authenticated.', 401);
  if (method === 'POST' && ['resend_invitation','refresh_invitations'].includes(input.action)) {
    requireRoles(user, ['admin']);
    return teamInvitation({ action: input.action === 'resend_invitation' ? 'resend' : 'refresh', uid: input.uid });
  }
  requireRoles(user, ['admin', 'project_manager']);
  return { users: (await list('app_users')).filter(u => !u.disabled) };
}
let unsubscribe = [];
async function startRealtime(user) {
  if (unsubscribe.length) return;
  const announceChange = name => window.dispatchEvent(new CustomEvent('bee-firebase-change', {
    detail: { collection: name }
  }));
  if (user.role === 'admin') {
    let first = true;
    unsubscribe.push(onSnapshot(collection(db, 'app_users'), () => {
      if (first) { first = false; return; }
      announceChange('app_users');
    }, error => console.error('Team updates unavailable:', error.code)));
  }
  for (const name of user.role === 'client' ? ['client_projects', 'client_assets', 'comments', 'notifications'] : ['projects', 'assets', 'asset_versions', 'comments', 'notifications']) {
    const source = collection(db, name);
    const constraint = name === 'notifications' ? where('user_id', '==', user.id)
      : user.role === 'admin' ? null
      : name === 'comments' ? where('reader_ids', 'array-contains', user.id)
      : user.role === 'client' ? where('client_id', '==', user.id)
      : where('access_ids', 'array-contains', user.id);
    let first = true;
    unsubscribe.push(onSnapshot(constraint ? query(source, constraint) : source, () => {
      if (first) { first = false; return; }
      announceChange(name);
    }, error => console.error('Live updates unavailable:', error.code)));
  }
}
export async function firebaseFetch(inputUrl, options = {}) {
  const url = new URL(typeof inputUrl === 'string' ? inputUrl : inputUrl.url, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.includes('/api/') || !url.pathname.endsWith('.php')) return nativeFetch(inputUrl, options);
  const endpoint = url.pathname.split('/api/')[1];
  const method = (options.method || 'GET').toUpperCase();
  let input = {};
  if (options.body instanceof FormData) input = Object.fromEntries(options.body);
  else if (options.body) input = JSON.parse(options.body);
  try {
    if (endpoint === 'auth.php') return result(await authApi(method, input, url));
    const user = await currentUser();
    if (!user) throw fail('Not authenticated.', 401);
    if (endpoint === 'bootstrap.php') {
      await startRealtime(user);
      return result({ state: { currentUser: user, projects: await projects(user), assets: await assets(user),
        notifications: await notifications(user), auditLog: await audit(user),
        users: ['admin', 'project_manager'].includes(user.role) ? (await list('app_users')).filter(u => !u.disabled).map(u => ({ ...u, name: u.full_name })) : [user],
        apiLogs: ['admin', 'project_manager', 'editor'].includes(user.role) ? (await list('integration_api_logs')).map(row => ({
          ...row, dir: row.direction || row.dir, date: row.created_at, status: row.status_code || row.status })) : [],
        webhooks: ['admin', 'project_manager', 'editor'].includes(user.role) ? (await list('integration_webhooks')).map(row => ({
          ...row, date: row.created_at, status: row.status_code || row.status })) : [],
        events: [] } });
    }
    if (endpoint === 'projects.php') return result(method === 'GET' ? { projects: await projects(user) } : await saveProject(user, method, input));
    if (endpoint === 'assets.php' || endpoint === 'review.php') {
      if (method === 'GET') { const rows = await assets(user); return result({ assets: rows, state: { assets: rows } }); }
      if (method === 'PUT' || input.action === 'update_status' || endpoint === 'review.php') return result(await reviewAsset(user, input));
      return result(input.action === 'comment' ? await commentAsset(user, input) : await saveAsset(user, input));
    }
    if (endpoint === 'assets/resources.php') {
      if (user.role === 'client') return result({ resources: [] });
      return result(method === 'GET' ? { resources: await scoped('resources', user) } : await saveResource(user, input));
    }
    if (endpoint === 'trash.php') return result(await teamInvitation(input, 'trash'));
    if (endpoint === 'audit.php') { if (method !== 'GET') throw fail('Audit logs are read-only.', 403); const rows = await audit(user); return result({ data: rows, logs: rows, auditLog: rows, auditLogs: rows }); }
    if (endpoint === 'notifications.php') {
      const rows = await notifications(user);
      const action = url.searchParams.get('action') || 'list';
      if (action.startsWith('mark_')) {
        const batch = writeBatch(db);
        for (const row of rows.filter(n => action === 'mark_all_read' || String(n.id) === String(input.id || input.notification_id))) batch.update(ref('notifications', row.id), { is_read: 1 });
        await batch.commit();
      }
      return result({ data: rows, unread_count: rows.filter(n => !n.read).length });
    }
    if (endpoint === 'editor_sequences.php') return result(await sequenceApi(user, method, input));
    if (endpoint === 'animation_shots.php') return result(await shotApi(user, method, input));
    if (endpoint === 'sync.php') {
      requireRoles(user, ['admin']);
      if (input.id === user.id) throw fail('You cannot change your own access while signed in.');
      if (input.action === 'change_role' && [...staffRoles, 'client'].includes(input.role)) {
        await updateDoc(ref('app_users', input.id), { role: input.role });
      } else if (input.action === 'disable_user') await updateDoc(ref('app_users', input.id), { disabled: true });
      else throw fail('Invalid team operation.');
      return result({});
    }
    if (endpoint === 'integration_etl_logs.php') {
      requireRoles(user, ['admin', 'project_manager']);
      const projectRows = await projects(user);
      let loaded = 0; const details = [];
      for (const row of input.rows || []) {
        const project = projectRows.find(p => p.id === row.project || p.name === row.project);
        try {
          if (!project) throw fail('Unknown project');
          await saveAsset(user, { ...row, project_id: project.id, type: row.type || 'Storyboard', external_link: row.link || row.external_link });
          loaded++; details.push('Imported ' + row.title);
        } catch (error) { details.push('Skipped ' + row.title + ': ' + error.message); }
      }
      const id = uuid('etl');
      const summary = { total_rows: (input.rows || []).length, loaded_rows: loaded,
        skipped_rows: (input.rows || []).length - loaded, details };
      await setDoc(ref('integration_etl_logs', id), { id, user_id: user.id, ...summary, created_at: timestamp() });
      return result(summary);
    }
    if (['integration_api_logs.php', 'integration_webhooks.php'].includes(endpoint)) {
      requireRoles(user, ['admin', 'project_manager', 'editor']);
      const name = endpoint.replace('.php', '');
      const id = uuid('log');
      await setDoc(ref(name, id), { ...input, id, user_id: user.id, created_at: timestamp() });
      return result({ id });
    }
    throw fail('Unknown application operation.', 404);
  } catch (error) {
    console.error('Firebase operation failed:', endpoint, error.code || error.message);
    const messages = { 'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/email-already-in-use': 'An account with that email already exists.',
      'permission-denied': 'You do not have permission to access this data.' };
    return new Response(JSON.stringify({ success: false, error: messages[error.code] || error.message,
      message: messages[error.code] || error.message }), { status: error.status || (error.code === 'permission-denied' ? 403 : 400),
      headers: { 'Content-Type': 'application/json' } });
  }
}
