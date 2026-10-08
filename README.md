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

### Run

Open `index.html` or serve the `bee-production-system` folder with Live Server / a local web server. The demo login stores the current user in `sessionStorage`, so navigation between separated pages remains signed in for the current browser tab/session.

### Asset uploads

Uploaded media is stored in `uploads/assets/` and is intentionally excluded from Git; only the empty-folder placeholder should be committed. The PHP/Apache worker must have write access to this directory. For XAMPP on macOS, run this after a fresh checkout if uploads fail with a storage-permission error:

```sh
chmod +a "daemon allow add_file,delete_child,search" uploads/assets
```

### Animator shot tracker

Apply `database/add_animation_shot_progress.sql` to the `Atlas` database to create persistent stage, progress, and playblast-link storage for assigned Animation Scene assets. Only the assigned animator can update a shot in Studio Galeria.

Apply `database/add_production_role_workflows.sql` after the shot-tracker migration to add animation review-state tracking and editor sequence drafts. Animators can submit scene versions through the existing client approval workflow. Editors can arrange approved animation and audio assets into sequences, then submit a Render cut through the existing Assets form for approval.

Studio Galeria is Animator-only: animators update assigned Animation Scene progress and submit shot versions there. They cannot create unrelated assets or submit versions for other asset types. Sequence Editor is Editor-only: editors build drafts from approved shots and audio, then submit one Render final cut per sequence. If the client requests changes, the editor can submit a new version of that cut. Clients make the approval/revision decision; Admins and Project Managers are notified. These role-specific submission rules are enforced by the API as well as the interface.

Apply `database/add_asset_version_media.sql` to preserve the upload or external media link on each asset version. Rejected versions can then be opened from Version history; older versions created before this migration may not have a recoverable media link.
