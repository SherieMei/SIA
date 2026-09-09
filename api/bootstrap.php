<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    $host = '127.0.0.1';
    $db   = 'Atlas';
    $user = 'root';
    $pass = '';

    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $stmt = $pdo->query("SELECT * FROM assets ORDER BY id DESC");
    $rawAssets = $stmt->fetchAll();

    $assets = [];
    foreach ($rawAssets as $row) {
        $t = $row['asset_title'] ?? $row['title'] ?? '';
        $ty = $row['asset_type'] ?? $row['type'] ?? 'Storyboard';
        $l = $row['external_link'] ?? $row['link'] ?? '';
        
        $assets[] = [
            "id"            => (int)$row['id'],
            "project_id"    => $row['project_id'] ?? null,
            "project"       => $row['project_id'] ?? null,
            "title"         => $t,
            "asset_title"   => $t,
            "type"          => $ty,
            "asset_type"    => $ty,
            "link"          => $l,
            "external_link" => $l,
            "created_at"    => $row['created_at'] ?? date('Y-m-d H:i:s')
        ];
    }

    ob_clean();
    echo json_encode([
        "success" => true,
        "status"  => "success",
        "state"   => [
            "assets" => $assets,
            "currentUser" => [
                "id" => 1, 
                "name" => "User",
                "role" => "admin",
                "is_admin" => true,
                "permissions" => ["create_asset", "edit_asset", "delete_asset"]
            ]
        ]
    ]);
    exit();

} catch (Exception $e) {
    ob_clean();
    echo json_encode([
        "success" => false,
        "status"  => "error",
        "error"   => $e->getMessage()
    ]);
    exit();
}
?>