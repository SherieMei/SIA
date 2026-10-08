<?php
require_once __DIR__ . '/../config/db.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function current_user() {
    global $pdo;
    $userId = $_SESSION['user_id'] ?? ($_SESSION['user']['id'] ?? null);
    if (!$userId || !isset($pdo)) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT id, full_name, email, role
        FROM app_users
        WHERE id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || empty($user['role'])) {
        return null;
    }

    $user['role'] = strtolower(trim($user['role']));
    $user['name'] = $user['full_name'];
    $_SESSION['user'] = $user;
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['name'] = $user['full_name'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role'] = $user['role'];

    return $user;
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
