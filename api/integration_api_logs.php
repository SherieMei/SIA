<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $origin === 'http://127.0.0.1:5501' ||
    $origin === 'http://localhost:5501' ||
    $origin === 'http://localhost'
) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

try {


    require_once __DIR__ . '/../config/database.php';
    $pdo = atlas_database_connection();

    require_once __DIR__ . '/../includes/api_auth.php';
    $currentUser = api_require_user($pdo);
    api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator']);

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'error' => 'POST method required'
        ]);
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid JSON payload'
        ]);
        exit;
    }

    $id = 'api_' . bin2hex(random_bytes(6));

    $userId = $currentUser['id'];
    $assetId = $data['asset_id'] ?? null;
    if ($assetId && !api_can_access_asset($pdo, $currentUser, $assetId)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'You do not have permission to log this asset API request.'
        ]);
        exit;
    }
    $direction = $data['direction'] ?? null;
    $method = $data['method'] ?? null;
    $endpoint = $data['endpoint'] ?? null;
    $statusCode = $data['status_code'] ?? null;
    $body = $data['body'] ?? null;

    if (!$direction || !$endpoint) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Direction and endpoint are required'
        ]);
        exit;
    }

    $stmt = $pdo->prepare("
        INSERT INTO integration_api_logs
        (
            id,
            user_id,
            asset_id,
            direction,
            method,
            endpoint,
            status_code,
            body
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $id,
        $userId,
        $assetId,
        $direction,
        $method,
        $endpoint,
        $statusCode,
        $body
    ]);

    echo json_encode([
        'success' => true,
        'id' => $id
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}