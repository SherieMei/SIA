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

    $host = '127.0.0.1';
    $db   = 'Atlas';
    $user = 'root';
    $pass = '';

    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {
        $input = [];
    }

    $id = 'wh_' . bin2hex(random_bytes(6));

    $userId = $_SESSION['user']['id'] ?? null;

    $assetId = $input['asset_id'] ?? null;
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