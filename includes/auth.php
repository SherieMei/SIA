<?php
require_once __DIR__ . '/../config/db.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function current_user() {
    return $_SESSION['user'] ?? null;
}

function require_login() {
    if (!current_user()) {
        header('Location: login.php');
        exit;
    }
}

/** Restrict a page to one or more roles. Admin always passes. */
function require_role(array $roles) {
    require_login();
    $user = current_user();
    if ($user['role'] !== 'admin' && !in_array($user['role'], $roles, true)) {
        http_response_code(403);
        die('<div style="padding:40px;font-family:sans-serif">403 - You do not have permission to view this page.</div>');
    }
}

function is_admin() {
    $u = current_user();
    return $u && $u['role'] === 'admin';
}
