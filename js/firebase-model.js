// Pure data adapters shared by the browser and migration tooling.
export const timestamp = () => new Date().toISOString();
export const staffRoles = ['admin', 'project_manager', 'editor', 'animator'];
export const projectAccess = project => [...new Set([
  project.pm, project.artist_id, project.animator_id, ...(project.extra_staff_ids || [])
].filter(Boolean).map(String))];
export const publicProject = project => ({
  id: project.id, name: project.name, status: project.status,
  deadline: project.deadline || null, client_id: project.client_id || ''
});
export const versionView = version => ({
  id: version.id, n: Number(version.version_number || version.version_no || 1),
  status: version.status, by: version.uploaded_by || null,
  date: version.created_at || version.uploaded_at || '', notes: version.notes || '',
  media_url: version.version_media_url || '', review_feedback: version.review_feedback || ''
});
export const projectView = project => ({
  ...project, project_manager_id: project.pm, editor_id: project.artist_id,
  team: projectAccess(project)
});
export const assetView = (asset, versions = [], comments = []) => ({
  ...asset, project: asset.project_id, title: asset.asset_title,
  type: asset.asset_type, link: asset.external_link || '',
  versions: versions.map(versionView).sort((a, b) => a.n - b.n), comments
});
export function publicAsset(asset, version, project) {
  const view = version ? versionView(version) : null;
  if (view) { delete view.notes; delete view.by; }
  return {
    id: asset.id, project_id: asset.project_id, project: asset.project_id,
    title: asset.asset_title, asset_title: asset.asset_title,
    type: asset.asset_type, asset_type: asset.asset_type,
    link: asset.external_link || '', external_link: asset.external_link || '',
    created_at: asset.created_at || '', due_date: asset.due_date || null,
    client_id: project.client_id || '', versions: view ? [view] : [],
    latest_version_id: version ? String(version.id) : '', status: version?.status || 'For Review',
    reader_ids: [...new Set([...projectAccess(project), project.client_id].filter(Boolean))]
  };
}
export function assertMediaLink(value) {
  const link = String(value || '').trim();
  let url;
  try { url = new URL(link); } catch { throw new Error('Enter a complete HTTPS link to your media.'); }
  if (url.protocol !== 'https:') throw new Error('Use an HTTPS media link.');
  return link;
}
export function assertComplete(assets) {
  const types = ['Storyboard', 'Animatic', 'Character Sheet', 'Background Asset',
    'Animation Scene', 'Render', 'Audio', 'Design Draft'];
  const missing = types.filter(type => !assets.some(asset => asset.type === type));
  if (missing.length) throw new Error('Missing asset types: ' + missing.join(', '));
  if (!assets.length || assets.some(asset => !['Approved', 'Final', 'Rejected'].includes(asset.versions.at(-1)?.status))) {
    throw new Error('All assets must have a resolved client decision before completing the project.');
  }
}
