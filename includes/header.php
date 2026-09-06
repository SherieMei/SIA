<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/functions.php';
$user = current_user();
$unread = $user ? unread_notification_count($user['id']) : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= isset($pageTitle) ? h($pageTitle) . ' · ' : '' ?>FrameForward Studio Tracker</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
<div class="clapper-stripe" aria-hidden="true"></div>
<?php if ($user): ?>
<header class="topbar">
  <div class="brand">
    <span class="brand-mark">FF</span>
    <span class="brand-name">FrameForward <em>Tracker</em></span>
  </div>
  <nav class="topnav">
    <a href="dashboard.php">Dashboard</a>
    <a href="projects.php">Projects</a>
    <a href="approvals.php">Approvals</a>
    <a href="notifications.php" class="bell">Notifications <?php if ($unread): ?><span class="bell-count"><?= $unread ?></span><?php endif; ?></a>
    <?php if (is_admin()): ?><a href="audit_log.php">Audit Log</a><?php endif; ?>
  </nav>
  <div class="userbox">
    <div class="userbox-info">
      <strong><?= h($user['full_name']) ?></strong>
      <span class="role-tag"><?= h(role_label($user['role'])) ?></span>
    </div>
    <a href="logout.php" class="btn-ghost small">Log out</a>
  </div>
</header>
<?php endif; ?>
<main class="page-wrap">
