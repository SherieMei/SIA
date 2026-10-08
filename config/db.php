<?php

require_once __DIR__ . '/database.php';

try {
    $pdo = atlas_database_connection();
} catch (PDOException $e) {
    http_response_code(500);
    die("Database connection failed: " . $e->getMessage());
}