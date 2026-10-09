import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';
initializeApp({ credential: applicationDefault(), projectId: 'bee-production-e1058' });
const service = getSecurityRules();
const source = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
if (process.argv.includes('--apply')) {
  await service.releaseFirestoreRulesetFromSource(source);
  console.log('Firestore access rules deployed.');
} else {
  const file = service.createRulesFileFromSource('firestore.rules', source);
  const ruleset = await service.createRuleset(file);
  console.log('Firestore rules compiled: ' + ruleset.name);
}
