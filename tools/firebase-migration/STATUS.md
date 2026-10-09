# Firebase migration status

Target: bee-production-e1058.

- Asset workflow: only Revision Requested allows another version. Pending, Approved,
  Final and Rejected versions are locked against new submissions in the app and rules.
  Revisions stay with the original project and require project and asset assignment.
- Asset reads and related production records require project assignment, including
  administrators. Approved versions appear in the Final filter with approval receipts.
- Verified with temporary records: request-revision progression through v2/v3/v4,
  pending/approved/rejected direct-write denial, cross-project revision denial,
  unassigned administrator read denial, receipt rendering, editor cut revisions and
  terminal cut status display. Both test projects and accounts were removed.
- Published the updated frontend to Vercel and Firebase Hosting. Added an editor
  sequence index for editor_id/access_ids and aligned its query with project scope.

- Vercel production: https://siaa-ten.vercel.app, deployment
  dpl_EfEhxdPwWRk62QUh6NWRLCsm7omS reported READY on 2026-10-09.
  Firebase Authentication authorized domains include siaa-ten.vercel.app.
  Vercel's security checkpoint blocked automated live checks from this connection;
  live browser login verification remains unconfirmed.

- Firestore: the latest available backup was restored and read back for verification.
  Required composite indexes were recreated in the new project.
- Authentication: nine current accounts were imported with their password hashes;
  IDs, emails, display names and password sign-in were verified. Historical profiles
  missing from Authentication were retained as disabled records.
- Local uploads/assets: only .gitkeep, no media files available to transfer.
- Media: the user selected the free setup with external HTTPS links. Direct file
  uploads and Cloud Storage are not used.
- Hosting project: https://bee-production-e1058.web.app. Build with
  `node tools/firebase-migration/build-hosting.mjs` before future deployments.
- Application runtime: Firebase Authentication and direct Firestore operations
  replace the PHP API calls through js/firebase-api.js. The existing PHP endpoint
  names are local operation identifiers; no PHP network requests occur.
- Firestore rules and indexes deployed. Client projections exclude private budgets
  and version notes. Feedback and decisions save audit entries and notifications.
- Chrome integration tests passed: registration, admin team creation without losing
  the admin session, all five role dashboards, project creation/assignment changes,
  private field protection, comments/reviews, animation progress/version submission,
  editor sequences/cuts, resources, completion validation and unauthorized operation
  denial. All main pages rendered without JavaScript errors. Test records removed.
- Integration Hub's external API/webhook simulation remains simulated; logs are
  saved online. SQL foreign-key/cascade semantics are implemented only where needed
  by the supported app workflows, not by a generic SQL compatibility layer.

Neither the original database nor the account credential was put in the Hosting
package. The original MySQL database is preserved; the frontend now uses Firebase.
