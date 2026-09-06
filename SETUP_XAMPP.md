# BEE PRODUCTION — XAMPP Setup

1. Install/start **Apache** and **MySQL** in XAMPP.
2. Copy the entire `bee-production` folder into `C:\xampp\htdocs\`.
3. Open **phpMyAdmin**: `http://localhost/phpmyadmin/`.
4. Import `bee-production/database/install.sql`.
5. Open: `http://localhost/bee-production/`

## Demo login
All demo accounts use:
- Password: `password123`

Examples:
- `jordan.reyes@beeproduction.studio` — Administrator
- `mika.santos@beeproduction.studio` — Project Manager
- `leo.cruz@beeproduction.studio` — Artist
- `ava.domingo@beeproduction.studio` — Animator
- `noah.bautista@beeproduction.studio` — Editor
- `priya.fernandez@beeproduction.studio` — Reviewer
- `client@skylinemedia.com` — Client
- `guest@beeproduction.studio` — Viewer

## Important
Do **not** open the HTML files directly with `file:///...`. Use the Apache URL above so PHP sessions and MySQL APIs can run.

The frontend remains separated by page (login, dashboard, projects, assets, review, users, etc.). JavaScript talks to `api/*.php`, while `app_state` stores the application's production data in MySQL.
