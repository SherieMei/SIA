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

    $id = 'etl_' . bin2hex(random_bytes(6));

    $userId = $_SESSION['user']['id'] ?? null;
    $source = $data['source'] ?? null;
    $totalRows = $data['total_rows'] ?? 0;
    $loadedRows = $data['loaded_rows'] ?? 0;
    $skippedRows = $data['skipped_rows'] ?? 0;
    $status = $data['status'] ?? null;
    $details = $data['details'] ?? null;

    $stmt = $pdo->prepare("
        INSERT INTO integration_etl_logs
        (
            id,
            user_id,
            source,
            total_rows,
            loaded_rows,
            skipped_rows,
            status,
            details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $id,
        $userId,
        $source,
        $totalRows,
        $loadedRows,
        $skippedRows,
        $status,
        $details
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