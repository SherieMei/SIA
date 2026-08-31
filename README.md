# ATLAS — Animation Production & Asset Approval System

## How to run it
1. Keep this whole folder together (don't move `index.html` away from `css/` and `js/`).
2. Open `index.html` in a browser — double-click it, or right-click → Open with.
3. Sign in with any of the quick demo accounts to explore each role.

No installation, server, or database needed — it's a fully working front-end prototype.
Data lives in memory for the browser session; refreshing the page resets it back to the seeded demo data.

## Folder map — where to make changes

```
index.html                    Page shell only: login screen + app layout skeleton.
                               Loads every CSS/JS file below, in order.

css/
  theme.css                   Colors and fonts. Change the palette here — nothing
                               else needs to be touched to re-skin the app.
  base.css                    Buttons, inputs, badges, cards — generic building blocks.
  layout.css                  Login slate, sidebar, topbar, stat grid, page shell.
  components.css               Project cards, tables, version items, comments,
                                consoles/logs, toasts.

js/
  data/
    constants.js               Roles, permissions, asset-type colors/tags, status labels.
    seed.js                    Demo users, projects, assets, comments, notifications,
                                audit log, events — the app's starting data.

  core/
    state.js                   Current page/filters + shared helper functions
                                (date formatting, lookups, toast()).
    nav.js                     Login/logout, page navigation, sidebar menu — and
                                creates the global `Studio` object.

  actions/                     Each file adds its own methods onto `Studio`.
    projects.js                 Create project.
    assets.js                    Submit asset / new version.
    review.js                     Approve / reject / request revision.
    feedback.js                    Comments + notifications.
    integrations.js                 API sync + CSV/ETL import.
    resources.js                     Resource & budget logging.
    users.js                          Add teammate / change role.

  pages/                        One file per screen — edit a page without
                                 touching any other page.
    dashboard.js
    projects.js                    (list + project detail)
    assets.js                      (list + asset detail)
    review.js
    notifications.js
    integrations.js
    resources.js
    audit.js
    users.js
    architecture.js

  render.js                    Routes the current page to the right page function.
  main.js                      Boot sequence.
```

## Why it's split this way
- **Change a color** → `css/theme.css` only.
- **Change how one page looks** → its one file in `js/pages/`.
- **Change what a button does** → its one file in `js/actions/`.
- **Change who can do what** → `js/data/constants.js` (`PERMISSIONS`).
- **Change starting demo data** → `js/data/seed.js`.

Every file loads as a plain `<script>`/`<link>` tag (no build step, no bundler), so this
runs directly from disk in any browser.
