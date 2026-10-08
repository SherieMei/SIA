import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const credential = JSON.parse(await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
initializeApp({ credential: cert(credential), projectId: 'siaa-20635' });
const db = getFirestore();
const adminAuth = getAuth();
const users = (await db.collection('app_users').get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
const byRole = role => users.find(user => user.role === role && !user.disabled);
for (const role of ['admin', 'project_manager', 'editor', 'animator', 'client']) assert.ok(byRole(role), 'Missing ' + role + ' test account');
const root = resolve('../../firebase-public');
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  try {
    if (!path.startsWith(root + '/') && path !== root) throw new Error('Invalid path');
    const target = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    const content = await readFile(target);
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[extname(target)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done => server.listen(4189, '127.0.0.1', done));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const contexts = [];
let projectId;
const assetIds = [];
const testUserIds = [];
const runtimeErrors = [];
async function session(role) {
  const context = await browser.newContext(); contexts.push(context);
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => { errors.push(error.message); runtimeErrors.push(role + ' ' + page.url() + ': ' + error.stack); });
  page.on('request', req => { if (new URL(req.url()).pathname.endsWith('.php')) errors.push('Unexpected PHP network request'); });
  await page.goto('http://127.0.0.1:4189/login/login.html');
  await page.waitForFunction(() => typeof window.beeFetch === 'function');
  const token = await adminAuth.createCustomToken(byRole(role).id);
  await page.evaluate(async token => {
    const { auth } = await import('/js/firebase.js');
    const { signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');
    await signInWithCustomToken(auth, token);
  }, token);
  await page.goto('http://127.0.0.1:4189/dashboard/dashboard.html');
  await page.waitForFunction(() => typeof DB !== 'undefined' && DB.currentUser && document.querySelector('#sideName')?.textContent.trim(), { timeout: 30000 });
  assert.equal(await page.evaluate(() => DB.currentUser.role), role);
  assert.deepEqual(errors, [], role + ' page runtime errors');
  return page;
}
async function api(page, endpoint, body, method = body ? 'POST' : 'GET') {
  return page.evaluate(async ({ endpoint, body, method }) => {
    const response = await window.beeFetch('/api/' + endpoint, { method,
      ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) });
    return { status: response.status, ...await response.json() };
  }, { endpoint, body, method });
}
try {
  const administrator = await session('admin');
  const createdMember = await api(administrator, 'auth.php', { action: 'create_team_member',
    name: 'Migration Test Member', email: 'migration-' + crypto.randomUUID() + '@example.com',
    password: crypto.randomUUID() + 'Aa1!', role: 'editor' });
  assert.ok(createdMember.success, JSON.stringify(createdMember)); testUserIds.push(createdMember.user.id);
  assert.equal((await api(administrator, 'auth.php?action=session')).user.role, 'admin');
  const anonymousContext = await browser.newContext(); contexts.push(anonymousContext);
  const signupPage = await anonymousContext.newPage();
  await signupPage.goto('http://127.0.0.1:4189/login/login.html');
  await signupPage.waitForFunction(() => typeof window.beeFetch === 'function');
  const registered = await api(signupPage, 'auth.php', { action: 'register', name: 'Migration Test Client',
    email: 'migration-' + crypto.randomUUID() + '@example.com', password: crypto.randomUUID() + 'Aa1!' });
  assert.ok(registered.success, JSON.stringify(registered)); testUserIds.push(registered.user.id);
  assert.equal(registered.user.role, 'client');
  const created = await api(administrator, 'projects.php', {
    name: 'Firebase migration verification', budget: 5000, deadline: '2030-12-31',
    client_id: byRole('client').id, project_manager_id: byRole('project_manager').id,
    editor_id: byRole('editor').id, animator_id: byRole('animator').id
  });
  assert.ok(created.success, JSON.stringify(created)); projectId = created.project.id;
  const submitted = await api(administrator, 'assets.php', { project_id: projectId,
    title: 'Verification animation', type: 'Animation Scene', external_link: 'https://example.com/animation.mp4', notes: 'Private staff notes' });
  assert.ok(submitted.success, JSON.stringify(submitted)); assetIds.push(submitted.asset.id);
  const client = await session('client');
  const clientProjects = await api(client, 'projects.php');
  const publicProject = clientProjects.projects.find(p => p.id === projectId);
  assert.ok(publicProject); assert.equal(publicProject.budget, undefined);
  const clientAssets = await api(client, 'assets.php');
  const publicAsset = clientAssets.state.assets.find(a => a.id === submitted.asset.id);
  assert.ok(publicAsset); assert.equal(publicAsset.versions[0].notes, undefined);
  assert.ok((await api(client, 'assets.php', { action: 'comment', asset_id: submitted.asset.id, comment: 'Verification feedback' })).success);
  const reviewed = await api(client, 'assets.php', { asset_id: submitted.asset.id, status: 'Revision Requested' }, 'PUT');
  assert.ok(reviewed.success, JSON.stringify(reviewed));
  const animator = await session('animator');
  const shots = await api(animator, 'animation_shots.php');
  assert.ok(shots.shots.some(shot => shot.asset_id === submitted.asset.id));
  const progress = await api(animator, 'animation_shots.php', { asset_id: submitted.asset.id,
    stage: 'Blocking', progress: 20, playblast_url: 'https://example.com/playblast.mp4', task_notes: 'Verification' });
  assert.ok(progress.success, JSON.stringify(progress));
  const nextVersion = await api(animator, 'assets.php', { action: 'version', asset_id: submitted.asset.id,
    link: 'https://example.com/revised.mp4', notes: 'Second verification version' });
  assert.ok(nextVersion.success, JSON.stringify(nextVersion));
  assert.equal(nextVersion.version.n, 2);
  const pm = await session('project_manager');
  const resource = await api(pm, 'assets/resources.php', { project_id: projectId,
    category: 'Software', description: 'Verification entry', cost: 10, hours: 1 });
  assert.ok(resource.success, JSON.stringify(resource));
  const rejectedCompletion = await api(pm, 'projects.php', { id: projectId, status: 'Completed' }, 'PUT');
  assert.equal(rejectedCompletion.success, false);
  const editor = await session('editor');
  assert.ok((await api(client, 'assets.php', { asset_id: submitted.asset.id, status: 'Approved' }, 'PUT')).success);
  const sequence = await api(editor, 'editor_sequences.php', { title: 'Verification sequence', project_id: projectId,
    notes: 'Verification', items: [{ asset_id: submitted.asset.id }] });
  if (!sequence.success) {
    const library = await api(editor, 'editor_sequences.php');
    console.log('Sequence diagnostic:', JSON.stringify({ available: library.library?.filter(a => a.project_id === projectId),
      versions: (await db.collection('asset_versions').where('project_id', '==', projectId).get()).docs.map(d => ({ id: d.id, n: d.data().version_number, status: d.data().status })) }));
  }
  assert.ok(sequence.success, JSON.stringify(sequence));
  const cut = await api(editor, 'assets.php', { project_id: projectId, title: 'Verification cut', type: 'Render',
    sequence_id: sequence.sequence_id, external_link: 'https://example.com/cut.mp4' });
  assert.ok(cut.success, JSON.stringify(cut)); assetIds.push(cut.asset.id);
  const assigned = await api(pm, 'projects.php', { action: 'assign_team', project_id: projectId,
    project_manager_id: byRole('project_manager').id, editor_id: byRole('editor').id,
    animator_id: byRole('animator').id, client_id: byRole('client').id });
  assert.ok(assigned.success, JSON.stringify(assigned));
  const sequenceRows = await api(editor, 'editor_sequences.php');
  assert.equal(sequenceRows.sequences.find(s => s.id === sequence.sequence_id).cut_asset_id, cut.asset.id);
  assert.equal((await api(editor, 'projects.php', { name: 'Unauthorized project', budget: 5000 })).success, false);
  const invalidReview = await api(editor, 'assets.php', { asset_id: submitted.asset.id, status: 'Approved' }, 'PUT');
  assert.equal(invalidReview.success, false);
  // Rules are checked directly as well as through UI validation.
  assert.equal(await client.evaluate(async id => {
    const { db } = await import('/js/firebase.js');
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js');
    try { await getDoc(doc(db, 'projects', id)); return false; }
    catch (error) { return error.code === 'permission-denied'; }
  }, projectId), true);
  for (const route of ['projects/projects.html', 'assets/assets.html', 'resources/resources.html',
    'users/users.html', 'audit/audit.html', 'integrations/integrations.html',
    'notifications/notifications.html', 'completed-projects/completed-projects.html', 'architecture/architecture.html']) {
    await administrator.goto('http://127.0.0.1:4189/' + route);
    await administrator.waitForFunction(() => document.querySelector('#pageContent')?.children.length > 0);
  }
  await client.goto('http://127.0.0.1:4189/review/review.html');
  await client.waitForFunction(() => document.querySelector('#pageContent')?.children.length > 0);
  assert.deepEqual(runtimeErrors, [], 'Page runtime errors');
  console.log('Passed: registration; admin team creation with preserved session; all 5 role dashboards; project creation/assignments; client-safe views; feedback/reviews; animator progress/version; editor sequence/cut; resource logging; completion validation; unauthorized operation denial; no PHP network requests.');
} finally {
  await browser.close(); server.close();
  for (const uid of testUserIds) { await adminAuth.deleteUser(uid); await db.collection('app_users').doc(uid).delete(); }
  if (projectId) {
    // Remove only records created for this test project.
    for (const name of ['projects', 'client_projects']) await db.collection(name).doc(projectId).delete();
    for (const name of ['assets', 'asset_versions', 'client_assets', 'comments', 'resources',
      'audit_logs', 'notifications', 'animation_shot_progress', 'animation_shot_workflow', 'editor_sequences']) {
      const rows = await db.collection(name).where('project_id', '==', projectId).get();
      for (let offset = 0; offset < rows.docs.length; offset += 100) {
        const batch = db.batch(); for (const row of rows.docs.slice(offset, offset + 100)) batch.delete(row.ref);
        await batch.commit();
      }
    }
    console.log('Temporary verification project and records removed.');
  }
}
