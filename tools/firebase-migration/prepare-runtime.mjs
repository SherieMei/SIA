import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { projectAccess, publicProject, publicAsset } from '../../js/firebase-model.js';

initializeApp({ credential: applicationDefault(), projectId: 'siaa-20635' });
const db = getFirestore();
const names = ['projects', 'assets', 'asset_versions', 'app_users', 'audit_logs',
  'resources', 'animation_shot_progress', 'animation_shot_workflow', 'editor_sequences'];
const tables = {};
for (const name of names) tables[name] = (await db.collection(name).get()).docs.map(doc => ({ key: doc.id, data: doc.data() }));
// Preserve the pre-conversion documents locally so metadata/projections can be audited.
writeFileSync('/private/tmp/sia-firebase-runtime-backup.json', JSON.stringify(tables), { mode: 0o600, flag: 'wx' });
const projects = new Map(tables.projects.map(row => [String(row.data.id), row.data]));
const users = new Map(tables.app_users.map(row => [String(row.data.id), row.data]));
const assets = new Map(tables.assets.map(row => [String(row.data.id), row.data]));
const writes = [];
for (const project of projects.values()) {
  project.extra_staff_ids = [...new Set(tables.assets.filter(row => row.data.project_id === project.id)
    .flatMap(row => [row.data.assigned_editor, row.data.assigned_animator]).filter(Boolean))];
  project.access_ids = projectAccess(project);
  writes.push(['projects', project.id, { access_ids: project.access_ids, extra_staff_ids: project.extra_staff_ids }, true]);
  writes.push(['client_projects', project.id, publicProject(project), false]);
}
for (const { key, data: user } of tables.app_users) writes.push(['app_users', key, { disabled: user.disabled || false }, true]);
for (const name of names.filter(name => !['projects', 'app_users'].includes(name))) {
  for (const { key, data } of tables[name]) {
    const asset = assets.get(String(data.asset_id));
    const projectId = data.project_id || asset?.project_id || '';
    const project = projects.get(String(projectId));
    const metadata = { project_id: projectId, access_ids: project?.access_ids || [] };
    if (name === 'audit_logs') metadata.by = users.get(String(data.user_id))?.full_name || 'System';
    writes.push([name, key, metadata, true]);
  }
}
for (const asset of assets.values()) {
  const project = projects.get(String(asset.project_id));
  if (!project) throw new Error('Asset references missing project: ' + asset.id);
  const versions = tables.asset_versions.filter(row => String(row.data.asset_id) === String(asset.id))
    .map(row => ({ ...row.data, id: row.data.id ?? row.key }))
    .sort((a, b) => Number(a.version_number || a.version_no) - Number(b.version_number || b.version_no));
  writes.push(['client_assets', String(asset.id), publicAsset(asset, versions.at(-1), project), false]);
}
// The PHP implementation stored feedback as Comment audit entries.
for (const { key, data } of tables.audit_logs) {
  const match = /^Asset #(\d+)$/.exec(data.entity || '');
  if (data.action !== 'Comment' || !match) continue;
  const asset = assets.get(match[1]);
  const project = asset && projects.get(String(asset.project_id));
  if (!project) continue;
  const id = 'legacy-' + key;
  writes.push(['comments', id, { id, asset_id: asset.id, project_id: project.id,
    text: data.detail || '', by: users.get(data.user_id)?.full_name || 'System', user_id: data.user_id,
    date: data.created_at || '', reader_ids: [...project.access_ids, project.client_id].filter(Boolean) }, false]);
}
for (let offset = 0; offset < writes.length; offset += 100) {
  const batch = db.batch();
  for (const [name, id, data, merge] of writes.slice(offset, offset + 100)) batch.set(db.collection(name).doc(String(id)), data, { merge });
  await batch.commit();
}
console.log(`Prepared ${writes.length} metadata/profile/view records. Original table fields preserved.`);
