<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

if (!current_user()) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

$user = current_user();
$action = $_GET['action'] ?? 'list';

if ($action === 'unread_count') {
    echo json_encode(['unread' => unread_notification_count($user['id'])]);
    exit;
}

// default: list latest notifications as JSON
$stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
$stmt->execute([$user['id']]);
echo json_encode(['data' => $stmt->fetchAll()]);
