import { readdir, mkdir, copyFile, rm, readFile } from 'node:fs/promises';
import { resolve, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, 'firebase-public');
const directories = [
  'login', 'dashboard', 'projects', 'completed-projects', 'assets',
  'review', 'resources', 'users', 'notifications', 'audit',
  'integrations', 'architecture', 'css', 'js'
];
const extensions = new Set(['.html', '.css', '.js', '.svg', '.png', '.jpg',
  '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf']);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
let files = 0;
async function copyDirectory(source) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = resolve(source, entry.name);
    if (entry.isDirectory()) await copyDirectory(path);
    if (!entry.isFile() || !extensions.has(extname(entry.name).toLowerCase())) continue;
    const target = resolve(output, relative(root, path));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(path, target);
    files++;
  }
}
await copyFile(resolve(root, 'index.html'), resolve(output, 'index.html'));
for (const directory of directories) await copyDirectory(resolve(root, directory));
// A successful package build does not mean the backend has been migrated.
const shared = await readFile(resolve(output, 'js/shared.js'), 'utf8');
console.log(`Built ${files + 1} frontend files in firebase-public.`);
if (!shared.includes('window.beeFetch =')) {
  console.log('Deployment readiness: pending. The frontend still requires PHP APIs.');
} else {
  console.log('Firebase API adapter included. PHP endpoint names are local operation identifiers.');
}
