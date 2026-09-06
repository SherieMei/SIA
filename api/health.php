<?php
header('Content-Type: application/json; charset=utf-8');
try {
    require_once __DIR__ . '/../config/db.php';
    $tables = [];
    foreach (['app_users','app_state'] as $table) {
        $q = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table));
        $tables[$table] = (bool)$q->fetchColumn();
    }
    echo json_encode(['success'=>true,'database'=>'atlas','tables'=>$tables], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
