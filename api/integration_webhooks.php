<?php

ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'error' => 'POST method required'
    ]);

    exit;
}

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
            'error' => 'POST method required.'
        ]);
        exit;
    }

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {
        $input = [];
    }

    $id = 'wh_' . bin2hex(random_bytes(6));

    $userId = $currentUser['id'];

    $assetId = $input['asset_id'] ?? null;
    if ($assetId && !api_can_access_asset($pdo, $currentUser, $assetId)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'You do not have permission to log this asset webhook.'
        ]);
        exit;
    }
    $endpoint = $input['endpoint'] ?? '';
    $eventType = $input['event_type'] ?? 'asset-approved';
    $statusCode = $input['status_code'] ?? 200;
    $payload = $input['payload'] ?? '{}';

    if (!$endpoint) {
        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Webhook endpoint is required.'
        ]);

        exit;
    }

    if (!is_string($payload)) {
        $payload = json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE
        );
    }

    $stmt = $pdo->prepare("
        INSERT INTO integration_webhooks
        (
            id,
            user_id,
            asset_id,
            endpoint,
            event_type,
            status_code,
            payload
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $id,
        $userId,
        $assetId,
        $endpoint,
        $eventType,
        $statusCode,
        $payload
    ]);

    echo json_encode([
        'success' => true,
        'webhook' => [
            'id' => $id,
            'status' => $statusCode
        ]
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => 'Unable to save webhook log.'
    ]);
}