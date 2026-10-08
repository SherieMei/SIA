# Firebase migration status

Target: siaa-20635.

- Firestore: 723 records copied and read back for verification.
- Authentication: six bcrypt accounts imported; IDs, normalized emails, display
  names and password providers verified.
- Local uploads/assets: only .gitkeep, no media files available to transfer.
- Media: the user selected the free setup with external HTTPS links. Direct file
  uploads and Cloud Storage are not used.
- Hosting: deployed at https://siaa-20635.web.app. Build with
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
