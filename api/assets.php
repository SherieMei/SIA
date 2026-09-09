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

    function respondWithState($pdo, $extraData = []) {
        $stmt = $pdo->query("SELECT * FROM assets ORDER BY id DESC");
        $rawAssets = $stmt->fetchAll();

        // Map database columns to support both naming styles for the frontend
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

        $payload = array_merge([
            "success" => true,
            "status"  => "success",
            "state"   => [
                "assets" => $assets,
                "currentUser" => ["id" => 1, "name" => "User"]
            ]
        ], $extraData);

        ob_clean();
        echo json_encode($payload);
        exit();
    }

    if ($method === 'GET') {
        respondWithState($pdo);
    }

    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true);

        if (!$input) {
            ob_clean();
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "No JSON payload received."]);
            exit();
        }

        $rawProject = $input['projectId'] ?? $input['project'] ?? null;
        $title      = trim($input['title'] ?? $input['asset_title'] ?? '');
        $type       = $input['type'] ?? $input['asset_type'] ?? 'Storyboard';
        $link       = $input['link'] ?? $input['external_link'] ?? '';
        $notes      = $input['notes'] ?? '';

        if (empty($title)) {
            ob_clean();
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Title is required."]);
            exit();
        }

        $stmt = $pdo->prepare("INSERT INTO assets (project_id, asset_title, asset_type, external_link) VALUES (?, ?, ?, ?)");
        $stmt->execute([$rawProject, $title, $type, $link]);
        $assetId = $pdo->lastInsertId();

        try {
            $stmtVer = $pdo->prepare("INSERT INTO asset_versions (asset_id, version_number, status, notes) VALUES (?, 1, 'For Review', ?)");
            $stmtVer->execute([$assetId, $notes]);
        } catch (Exception $eVer) {}

        respondWithState($pdo, [
            "id" => (int)$assetId,
            "asset" => [
                "id" => (int)$assetId,
                "project_id" => $rawProject,
                "title" => $title,
                "asset_title" => $title,
                "type" => $type,
                "asset_type" => $type,
                "link" => $link,
                "external_link" => $link
            ]
        ]);
    }

} catch (Exception $e) {
    ob_clean();
    http_response_code(200);
    echo json_encode([
        "success" => false,
        "status"  => "error",
        "error"   => "Database failure: " . $e->getMessage()
    ]);
    exit();
}
?>