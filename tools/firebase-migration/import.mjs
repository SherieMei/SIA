import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const input = process.argv[2];
const apply = process.argv.includes('--apply');
const firestoreOnly = process.argv.includes('--firestore-only');
const authOnly = process.argv.includes('--auth-only');
if (firestoreOnly && authOnly) throw new Error('Choose only one import mode.');
if (!input) throw new Error('Usage: node import.mjs /private/tmp/atlas-export.json [--apply]');
const snapshot = JSON.parse(readFileSync(input, 'utf8'));
if (snapshot.database !== 'Atlas' && snapshot.database !== 'atlas') {
  throw new Error('Expected the Atlas app database.');
}
const documents = [];
const users = [];
for (const [name, table] of Object.entries(snapshot.tables)) {
  const seen = new Set();
  for (const source of table.rows) {
    const row = { ...source };
    const keys = table.primaryKeys.map(key => row[key]);
    const id = keys.length === 1 ? String(keys[0]) : createHash('sha256')
      .update(JSON.stringify(keys.length ? keys : source)).digest('hex');
    if (!id || id === '.' || id === '..' || id.includes('/') || Buffer.byteLength(id) > 1500 || seen.has(id)) {
      throw new Error(`Invalid or duplicate document ID in ${name}: ${id}`);
    }
    seen.add(id);
    if (name === 'app_users') {
      if (!/^\$2[aby]\$/.test(row.password ?? '')) {
        throw new Error(`Unsupported password hash for user ${id}; resolve before importing.`);
      }
      users.push({ uid: id, email: row.email, displayName: row.full_name,
        passwordHash: Buffer.from(row.password.replace(/^\$2y\$/, '$2b$')) });
      delete row.password;
    }
    // Keep SQL JSON as its original string, preserving exact source data.
    if (Buffer.byteLength(JSON.stringify(row)) > 900000) {
      throw new Error(`${name}/${id} is too large for a Firestore document; split it before importing.`);
    }
    documents.push({ path: `${name}/${id}`, data: row });
  }
  console.log(`${name}: ${table.rows.length} documents`);
}
console.log(`Total: ${documents.length} documents, ${users.length} Authentication users.`);
if (firestoreOnly) users.length = 0;
if (authOnly) documents.length = 0;
if (!apply) {
  console.log('Dry run complete. No Firebase data was changed.');
  process.exit(0);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a local administrator credential file outside the website.');
}
const credential = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
if (credential.project_id !== 'bee-production-e1058') throw new Error('Credential must belong to bee-production-e1058.');
const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
const { getAuth } = await import('firebase-admin/auth');
initializeApp({ credential: cert(credential), projectId: 'bee-production-e1058' });
const db = getFirestore();
const auth = getAuth();
// Preflight every destination before making changes. Never overwrite existing records.
for (let offset = 0; offset < documents.length; offset += 100) {
  const existing = await db.getAll(...documents.slice(offset, offset + 100).map(doc => db.doc(doc.path)));
  if (existing.some(doc => doc.exists)) throw new Error('Destination documents exist. Import stopped to avoid overwriting them.');
}
for (let offset = 0; offset < users.length; offset += 50) {
  const group = users.slice(offset, offset + 50);
  const existing = await auth.getUsers(group.flatMap(user => [{ uid: user.uid }, { email: user.email }]));
  if (existing.users.length) throw new Error('Destination Authentication accounts exist. Resolve collisions before importing.');
}
for (let offset = 0; offset < users.length; offset += 1000) {
  const result = await auth.importUsers(users.slice(offset, offset + 1000), { hash: { algorithm: 'BCRYPT' } });
  if (result.failureCount) throw new Error(`Authentication import partially failed: ${result.failureCount} failures. Inspect Firebase before retrying.`);
}
for (let offset = 0; offset < documents.length; offset += 100) {
  const group = documents.slice(offset, offset + 100);
  const batch = db.batch();
  for (const doc of group) batch.create(db.doc(doc.path), doc.data);
  await batch.commit();
  console.log(`Imported ${Math.min(offset + 100, documents.length)}/${documents.length} documents.`);
}
// Verify content without printing private data.
for (let offset = 0; offset < documents.length; offset += 100) {
  const group = documents.slice(offset, offset + 100);
  const saved = await db.getAll(...group.map(doc => db.doc(doc.path)));
  for (let index = 0; index < group.length; index++) {
    const actual = saved[index].data();
    if (!actual || Object.keys(actual).length !== Object.keys(group[index].data).length ||
        Object.entries(group[index].data).some(([key, value]) => JSON.stringify(actual[key]) !== JSON.stringify(value))) {
      throw new Error(`Verification failed: ${group[index].path}`);
    }
  }
}
console.log(`${authOnly ? 'Authentication' : 'Firestore'} import completed${authOnly ? '' : ' and verified'}. MySQL was not changed.`);
