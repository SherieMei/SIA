<?php
/**
 * Data Access Layer
 * -------------------------------------------------------------
 * Part of the LAYERED ARCHITECTURE used in this project:
 *   Presentation Layer  -> .php pages + assets/css + assets/js
 *   Business Logic Layer -> includes/functions.php, includes/auth.php
 *   Data Access Layer    -> config/db.php (this file, PDO wrapper)
 * Every other layer talks to the database ONLY through this file.
 */

$DB_HOST = 'localhost';
$DB_NAME = 'atlas';
$DB_USER = 'root';
$DB_PASS = '';

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success'=>false,'error'=>'Database connection failed.','detail'=>$e->getMessage()]);
    exit;
}
