<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);
if (session_status() === PHP_SESSION_NONE) session_start();

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

        // Group asset_versions by asset_id so each asset can carry its own version history —
        // the client always expects `versions` to be an array (see js/shared.js withVersions()).
        $verStmt = $pdo->query("SELECT * FROM asset_versions ORDER BY asset_id, version_no ASC");
        $versionsByAsset = [];
        foreach ($verStmt->fetchAll() as $vRow) {
            $versionsByAsset[$vRow['asset_id']][] = [
                "id"     => $vRow['id'],
                "n"      => (int)$vRow['version_no'],
                "status" => $vRow['status'],
                "notes"  => $vRow['notes'],
                "by"     => $vRow['uploaded_by'],
                "date"   => $vRow['uploaded_at']
            ];
        }

        // Map database columns to support both naming styles for the frontend
        $assets = [];
        foreach ($rawAssets as $row) {
            $t = $row['asset_title'] ?? $row['title'] ?? '';
            $ty = $row['asset_type'] ?? $row['type'] ?? 'Storyboard';
            $l = $row['external_link'] ?? $row['link'] ?? '';

            $assets[] = [
                "id"            => $row['id'],
                "project_id"    => $row['project_id'] ?? null,
                "project"       => $row['project_id'] ?? null,
                "title"         => $t,
                "asset_title"   => $t,
                "type"          => $ty,
                "asset_type"    => $ty,
                "link"          => $l,
                "external_link" => $l,
                "created_at"    => $row['created_at'] ?? date('Y-m-d H:i:s'),
                "versions"      => $versionsByAsset[$row['id']] ?? []
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

        $rawProject = $input['project_id'] ?? $input['projectId'] ?? $input['project'] ?? null;
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

        // assets.id / asset_versions.id are varchar PKs, not auto-increment — generate ids in the
        // same shape every existing row already uses (1-letter prefix + 12 hex chars).
        $assetId = 'a' . bin2hex(random_bytes(6));
        $uploadedBy = $_SESSION['user']['id'] ?? null;

        $stmt = $pdo->prepare("INSERT INTO assets (id, project_id, asset_title, asset_type, external_link) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$assetId, $rawProject, $title, $type, $link]);

        $initialVersion = null;
        try {
            $versionId = 'v' . bin2hex(random_bytes(6));
            $stmtVer = $pdo->prepare("INSERT INTO asset_versions (id, asset_id, version_no, status, notes, uploaded_by) VALUES (?, ?, 1, 'For Review', ?, ?)");
            $stmtVer->execute([$versionId, $assetId, $notes, $uploadedBy]);
            $initialVersion = [
                "id" => $versionId, "n" => 1, "status" => "For Review",
                "notes" => $notes, "by" => $uploadedBy, "date" => date('Y-m-d H:i:s')
            ];
        } catch (Exception $eVer) {}

        respondWithState($pdo, [
            "id" => $assetId,
            "asset" => [
                "id" => $assetId,
                "project_id" => $rawProject,
                "title" => $title,
                "asset_title" => $title,
                "type" => $type,
                "asset_type" => $type,
                "link" => $link,
                "external_link" => $link,
                "versions" => $initialVersion ? [$initialVersion] : []
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