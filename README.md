# BEE PRODUCTION — Animation Production & Asset Approval System

## Working separated-page build

This build keeps BEE PRODUCTION separated by page and stylesheet/script:

- `login/login.html` + `login.css` + `login.js`
- `dashboard/dashboard.html` + `dashboard.css` + `dashboard.js`
- `projects/projects.html` + `projects.css` + `projects.js`
- `assets/assets.html` + `assets.css` + `assets.js`
- `review/review.html` + `review.css` + `review.js`
- `notifications/notifications.html` + `notifications.css` + `notifications.js`
- `integrations/integrations.html` + `integrations.css` + `integrations.js`
- `resources/resources.html` + `resources.css` + `resources.js`
- `audit/audit.html` + `audit.css` + `audit.js`
- `users/users.html` + `users.css` + `users.js`
- `architecture/architecture.html` + `architecture.css` + `architecture.js`
- `js/shared.js` contains shared data, permissions, actions, and multipage navigation.

### Navigation fix

The separated pages now initialize their route from each document's `data-page` attribute before rendering. Detail routes also restore their `project` or `asset` query parameter. This prevents non-dashboard pages from accidentally booting with `state.page = 'dashboard'`, which previously caused blank/frozen pages because their page-specific render function was not loaded.

### Run with Firebase

Serve this folder over HTTP while developing (for example, Live Server). The frontend
uses Firebase Authentication and Firestore directly through `js/firebase-api.js`.
Opening HTML files through `file://` does not support this module workflow.

Project: `siaa-20635`. Firebase web settings are in `js/firebase.js`.
Existing users were imported with their original IDs and bcrypt password hashes.
New registrations receive the client role. Administrators can add team members,
change roles, and disable access. Disabled users are rejected by the Firestore rules.

### Media

This is the free-plan configuration. Submit an HTTPS link to media hosted elsewhere
(for example Google Drive or YouTube). Each asset version retains its own media link.
Direct file uploads and Cloud Storage are not used. Make media links accessible to
intended reviewers on the external service.

### Deploy

```sh
node tools/firebase-migration/build-hosting.mjs
tools/firebase-migration/node_modules/.bin/firebase deploy --only firestore,hosting --project siaa-20635
```

`firebase-public` contains only the frontend. PHP files, SQL exports, administrator
credentials, dependencies and migration tools are excluded from that package.
Do not set Hosting's public directory to the repository root.

`firestore.rules` enforces project access and client review permissions. Client-facing
views exclude budgets and private version notes. Project assignment changes update
access metadata. Financial records remain in the staff collections.

### Production workflows

Asset revisions are accepted only when the latest version is `Revision Requested`.
New assets start at v1; each permitted revision increments by one and returns to
`For Review`. Approved, Final and Rejected assets cannot receive another version.
Firebase rules enforce the same restrictions for direct writes and keep revisions
bound to the original asset and project.

Asset records, version history, feedback and related production records are scoped
to the assigned project team and client. Administrators also need project assignment
to read assets. An unassigned administrator cannot change that project's team through
the app. Authorized project managers maintain assignment metadata when teams change.

Approval saves a stable `APR-<version ID>` receipt ID, approver ID and approval date.
The Assets Final filter includes approved versions and shows their receipt cards.
Older approvals use their existing version ID for a stable receipt reference and
show `Not recorded` where historical approval metadata is unavailable.

Vercel production is available at https://siaa-ten.vercel.app. `vercel.json`
builds the same static frontend into `firebase-public`; `.vercelignore` excludes
server files and migration dependencies. Firebase still provides authentication
and database access. Deploy updates to the linked `siaa` project with
`vercel deploy --prod`. Keep `siaa-ten.vercel.app` in Firebase Authentication's
authorized domains.

Animators update assigned Animation Scene progress and submit revision media links.
Editors build sequences from approved Animation Scene and Audio assets, then submit
Render cuts through the Assets form. Clients review the latest version; team members
can add feedback. Resources, project activity and notifications are stored in Firestore.
Integration Hub retains its existing simulated external API/webhook behavior and
stores integration logs online. ETL imports require an HTTPS media link per row.

### Migration and checks

Scripts in `tools/firebase-migration` export/import the original database, prepare
client views and access metadata, and validate the converted workflows. The original
PHP/MySQL source remains available for reference and is not part of Firebase Hosting.

```sh
cd tools/firebase-migration
npm install
GOOGLE_APPLICATION_CREDENTIALS=/path/outside/website/key.json node smoke-test.mjs
```

The smoke test uses local Chrome, creates temporary records/accounts and removes them
on completion. Keep all administrator keys outside the website and out of Git.
