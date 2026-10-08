import { randomBytes } from 'node:crypto';

const roles = ['admin', 'project_manager', 'editor', 'animator', 'client'];
const loginUrl = 'https://siaa-ten.vercel.app/login/login.html';
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const now = () => new Date().toISOString();

export function createTeamInviteHandler({ auth, db, sendMail, configured = true }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    const allowed = ['https://siaa-ten.vercel.app', 'https://siaa-20635.web.app'];
    if (origin && (allowed.includes(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Use POST.' });
    try {
      const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!bearer) throw error('Sign in first.', 401);
      let token;
      try { token = await auth.verifyIdToken(bearer, true); } catch { throw error('Your session has expired. Sign in again.', 401); }
      const actor = (await db.collection('app_users').doc(token.uid).get()).data();
      if (!actor || actor.disabled) throw error('Account access denied.', 403);
      const input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      if (input.action === 'accept') {
        if (!token.email_verified || token.firebase?.sign_in_provider !== 'password') throw error('Verify your email and sign in with your password first.', 403);
        if (actor.verification_required) {
          const fields = { email_verified: true, invitation_status: 'accepted', accepted_at: actor.accepted_at || now() };
          const batch = db.batch();
          batch.update(db.collection('app_users').doc(token.uid), fields);
          batch.set(db.collection('team_invitations').doc(token.uid), fields, { merge: true });
          await batch.commit();
        }
        return res.status(200).json({ success: true });
      }
      if (actor.role !== 'admin' || (actor.verification_required && !token.email_verified)) throw error('Administrator access required.', 403);
      if (input.action === 'refresh') {
        const profiles = await db.collection('app_users').where('verification_required', '==', true).get();
        for (const doc of profiles.docs) {
          const profile = doc.data();
          if (profile.disabled || profile.email_verified) continue;
          const account = await auth.getUser(doc.id);
          if (account.emailVerified) {
            const fields = { email_verified: true, email_verified_at: now(), invitation_status: profile.accepted_at ? 'accepted' : 'verified' };
            const batch = db.batch(); batch.update(doc.ref, fields);
            batch.set(db.collection('team_invitations').doc(doc.id), fields, { merge: true });
            await batch.commit();
          }
        }
        return res.status(200).json({ success: true });
      }
      if (!['invite', 'resend'].includes(input.action)) throw error('Invalid invitation action.');
      if (!configured) throw error('Email invitations are not configured yet. Connect the Gmail service and EmailJS template first.', 503);
      let profile, uid;
      if (input.action === 'invite') {
        const name = String(input.name || '').trim(), email = String(input.email || '').trim().toLowerCase();
        if (!name || name.length > 100 || !/^[\p{L} '-]+$/u.test(name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.includes(input.role)) throw error('Enter a valid name, email and role.');
        try {
          await auth.getUserByEmail(email);
          throw error('This email already has an account. Use Resend invitation for an existing invite.', 409);
        } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
        await reserveMailSlot(db);
        const account = await auth.createUser({ email, displayName: name, password: randomBytes(32).toString('base64url'), emailVerified: false, disabled: false });
        uid = account.uid;
        profile = { id: uid, full_name: name, email, role: input.role, disabled: false, created_at: now(),
          invited_by: token.uid, verification_required: true, email_verified: false, invitation_status: 'sending' };
        try { await db.collection('app_users').doc(uid).create(profile); }
        catch (e) { await auth.deleteUser(uid); throw e; }
      } else {
        uid = String(input.uid || '');
        profile = (await db.collection('app_users').doc(uid).get()).data();
        if (!profile || profile.disabled || !profile.verification_required || profile.accepted_at) throw error('This account does not need another invitation.');
        if (profile.last_invite_at && Date.now() - Date.parse(profile.last_invite_at) < 60000) throw error('Wait one minute before resending this invitation.', 429);
        await reserveMailSlot(db);
      }
      const pending = { invitation_status: 'sending', last_invite_at: now(), last_invite_error: null };
      const batch = db.batch(); batch.update(db.collection('app_users').doc(uid), pending);
      batch.set(db.collection('team_invitations').doc(uid), { user_id: uid, email: profile.email, full_name: profile.full_name,
        role: profile.role, invited_by: token.uid, ...pending }, { merge: true });
      await batch.commit();
      let sent = false;
      try {
        const settings = { url: loginUrl, handleCodeInApp: false };
        const account = await auth.getUser(uid);
        const verification = account.emailVerified ? loginUrl : await auth.generateEmailVerificationLink(profile.email, settings);
        const setup = await auth.generatePasswordResetLink(profile.email, settings);
        await sendMail({ to_email: profile.email, to_name: profile.full_name, role: ({admin:'Administrator',project_manager:'Project Manager',editor:'Editor',animator:'Animator',client:'Client'})[profile.role],
          verification_link: verification, password_setup_link: setup, login_link: loginUrl });
        sent = true;
      } catch { /* The member remains saved, and the administrator can retry. */ }
      const delivery = { invitation_status: sent ? 'sent' : 'failed',
        last_invite_error: sent ? null : 'Invitation could not be sent. Check the email service and resend.',
        ...(sent ? { invitation_sent_at: now() } : {}) };
      const completed = db.batch(); completed.update(db.collection('app_users').doc(uid), delivery);
      completed.set(db.collection('team_invitations').doc(uid), delivery, { merge: true }); await completed.commit();
      return res.status(200).json({ success: true, user: { ...profile, ...pending, ...delivery }, email_sent: sent,
        message: sent ? 'Invitation sent. The member must verify their email and set a password.' : 'Account saved, but the invitation email failed. Use Resend invitation.' });
    } catch (e) {
      const status = e.status || 500;
      return res.status(status).json({ success: false, error: status === 500 ? 'Unable to process this invitation. Please retry.' : e.message });
    }
  };
}

async function reserveMailSlot(db) {
  const ref = db.collection('mail_control').doc('team_invites');
  await db.runTransaction(async transaction => {
    const last = (await transaction.get(ref)).data()?.last_attempt_ms || 0;
    if (Date.now() - last < 1100) throw error('Please wait a moment before sending another invitation.', 429);
    transaction.set(ref, { last_attempt_ms: Date.now() });
  });
}

let cached;
export default async function handler(req, res) {
  try {
    if (!cached) {
      const { getApps, initializeApp, cert } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const { getFirestore } = await import('firebase-admin/firestore');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
      if (serviceAccount.project_id !== 'siaa-20635') throw new Error('Missing server credential');
      const app = getApps().find(app => app.name === 'team-invitations') || initializeApp({ credential: cert(serviceAccount) }, 'team-invitations');
      const configured = Boolean(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY);
      cached = createTeamInviteHandler({ auth: getAuth(app), db: getFirestore(app), configured, sendMail: async params => {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ service_id: process.env.EMAILJS_SERVICE_ID, template_id: process.env.EMAILJS_TEMPLATE_ID,
            user_id: process.env.EMAILJS_PUBLIC_KEY, ...(process.env.EMAILJS_PRIVATE_KEY ? { accessToken: process.env.EMAILJS_PRIVATE_KEY } : {}), template_params: params })
        });
        if (!response.ok) throw new Error('Email delivery failed');
      } });
    }
    return cached(req, res);
  } catch { return res.status(503).json({ success: false, error: 'Email invitations are not configured yet.' }); }
}
