# ATLAS — Animation Production & Asset Approval System

A redesigned, light-theme prototype with each application page separated into its own HTML, CSS, and page JavaScript files.

## Run immediately

### Easiest
Open `index.html` in your browser. It redirects to the separate login page.

### Recommended in VS Code
Use Live Server and open `index.html`.

### Optional local server
From the project root:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

No npm installation is required for this static prototype.

## Page structure

Each page is isolated:

- `login/login.html`, `login/login.css`, `login/login.js`
- `dashboard/dashboard.html`, `dashboard/dashboard.css`, `dashboard/dashboard.js`
- `projects/projects.html`, `projects/projects.css`, `projects/projects.js`
- `assets/assets.html`, `assets/assets.css`, `assets/assets.js`
- `review/review.html`, `review/review.css`, `review/review.js`
- `notifications/notifications.html`, `notifications/notifications.css`, `notifications/notifications.js`
- `integrations/integrations.html`, `integrations/integrations.css`, `integrations/integrations.js`
- `resources/resources.html`, `resources/resources.css`, `resources/resources.js`
- `audit/audit.html`, `audit/audit.css`, `audit/audit.js`
- `users/users.html`, `users/users.css`, `users/users.js`
- `architecture/architecture.html`, `architecture/architecture.css`, `architecture/architecture.js`

Shared data, actions, and utility code remain in `js/` so the application logic stays consistent while page presentation remains easy to edit.
