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

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true);
        
        $assetId = $input['asset_id'] ?? $input['id'] ?? null;
        $status  = $input['status'] ?? 'Approved';

        if ($assetId) {
            $stmt = $pdo->prepare("UPDATE asset_versions SET status = ? WHERE asset_id = ?");
            $stmt->execute([$status, $assetId]);
        }
    }

    $sql = "SELECT a.id, a.project_id, a.asset_title, a.asset_type, a.external_link, a.created_at,
                   v.version_number, v.status, v.notes 
            FROM assets a 
            LEFT JOIN asset_versions v ON a.id = v.asset_id 
            GROUP BY a.id 
            ORDER BY a.id DESC";
            
    $stmt = $pdo->query($sql);
    $rawRows = $stmt->fetchAll();

    $assets = [];
    foreach ($rawRows as $row) {
        $id = (int)$row['id'];
        $title = $row['asset_title'] ?? 'Untitled';
        $type = $row['asset_type'] ?? 'Storyboard';
        $link = $row['external_link'] ?? '';
        $status = $row['status'] ?? 'For Review';
        $version = (int)($row['version_number'] ?? 1);

        $assets[] = [
            "id"            => $id,
            "project_id"    => $row['project_id'],
            "title"         => $title,
            "asset_title"   => $title,
            "type"          => $type,
            "asset_type"    => $type,
            "link"          => $link,
            "external_link" => $link,
            "status"        => $status,
            "version_number"=> $version,
            "notes"         => $row['notes'] ?? '',
            "created_at"    => $row['created_at']
        ];
    }

    ob_clean();
    echo json_encode([
        "success" => true,
        "status"  => "success",
        "assets"  => $assets,
        "state"   => [
            "assets" => $assets,
            "currentUser" => ["id" => 1, "name" => "User", "role" => "admin", "is_admin" => true]
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