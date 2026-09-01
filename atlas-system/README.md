# ATLAS — Animation Production & Asset Approval System

## Working separated-page build

This build keeps ATLAS separated by page and stylesheet/script:

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

Open `index.html` or serve the `atlas-system` folder with Live Server / a local web server. The demo login stores the current user in `sessionStorage`, so navigation between separated pages remains signed in for the current browser tab/session.
