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

        function createReviewNotifications($pdo, $assetTitle, $versionNo) {
        $stmt = $pdo->query("
            SELECT id
            FROM app_users
            WHERE role IN ('admin', 'project_manager')
        ");

        $users = $stmt->fetchAll();

        $notify = $pdo->prepare("
            INSERT INTO notifications
            (user_id, title, message, type, is_read)
            VALUES (?, ?, ?, ?, 0)
        ");

        foreach ($users as $user) {
            error_log("NOTIFICATION INSERT: " . $user['id']);
            
            $notify->execute([
                $user['id'],
                'New Asset for Review',
                "A new version (V{$versionNo}) of '{$assetTitle}' is waiting for review.",
                'asset_review'
            ]);
        }
    }

    function createAuditLog($pdo, $action, $entity = null, $details = null) {
    $userId = $_SESSION['user']['id'] ?? null;

    $stmt = $pdo->prepare("
        INSERT INTO audit_logs
        (user_id, action, entity, detail)
        VALUES (?, ?, ?, ?)
    ");

    $stmt->execute([
        $userId,
        $action,
        $entity,
        $details
    ]);
}

    function respondWithState($pdo, $extraData = []) {
        if ($_SESSION['user']['role'] === 'client') {
    $stmt = $pdo->prepare("
        SELECT a.*
        FROM assets a
        INNER JOIN projects p ON a.project_id = p.id
        WHERE p.client_id = ?
        ORDER BY a.id DESC
    ");
    $stmt->execute([$_SESSION['user']['id']]);
} else {
    $stmt = $pdo->query("SELECT * FROM assets ORDER BY id DESC");
}
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

        if (($input['action'] ?? '') === 'update_status') {
    $assetId = $input['asset_id'] ?? null;
    $status = $input['status'] ?? null;

    if (!$assetId || !$status) {
        ob_clean();
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "Asset ID and status are required."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        UPDATE asset_versions
        SET status = ?
        WHERE asset_id = ?
        ORDER BY version_no DESC
        LIMIT 1
    ");

    $stmt->execute([
        $status,
        $assetId
    ]);

    // Check if all assets under this project are completed
if ($status === 'Approved' || $status === 'Final') {

    $projectStmt = $pdo->prepare("
        SELECT project_id
        FROM assets
        WHERE id = ?
    ");
    $projectStmt->execute([$assetId]);
    $assetRow = $projectStmt->fetch();

    if ($assetRow) {
        $projectId = $assetRow['project_id'];

        $checkStmt = $pdo->prepare("
            SELECT COUNT(*) AS total,
                   SUM(
                       CASE
                           WHEN av.status IN ('Approved', 'Final')
                           THEN 1
                           ELSE 0
                       END
                   ) AS completed
            FROM assets a
            LEFT JOIN (
                SELECT av1.asset_id, av1.status
                FROM asset_versions av1
                INNER JOIN (
                    SELECT asset_id, MAX(version_no) AS max_version
                    FROM asset_versions
                    GROUP BY asset_id
                ) av2
                ON av1.asset_id = av2.asset_id
                AND av1.version_no = av2.max_version
            ) av
            ON a.id = av.asset_id
            WHERE a.project_id = ?
        ");

        $checkStmt->execute([$projectId]);
        $result = $checkStmt->fetch();

        if (
            $result &&
            $result['total'] > 0 &&
            $result['total'] == $result['completed']
        ) {
            $updateProject = $pdo->prepare("
                UPDATE projects
                SET status = 'Completed'
                WHERE id = ?
            ");

            $updateProject->execute([$projectId]);
        }
    }
}

    ob_clean();
    echo json_encode([
        "success" => true,
        "status" => $status
    ]);
    exit();
}

        if (($input['action'] ?? '') === 'version') {

    $assetId = $input['asset_id'] ?? null;

    if (!$assetId) {
        ob_clean();
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "Asset ID is required."
        ]);
        exit();
    }

    // Get the latest version number
    $stmt = $pdo->prepare("
        SELECT MAX(version_no) AS latest_version
        FROM asset_versions
        WHERE asset_id = ?
    ");
    $stmt->execute([$assetId]);

    $row = $stmt->fetch();
    $nextVersion = ((int)($row['latest_version'] ?? 0)) + 1;

    // Generate version ID
    $versionId = 'v' . bin2hex(random_bytes(6));

    // Current user
    $uploadedBy = $_SESSION['user']['full_name']
        ?? $_SESSION['user']['name']
        ?? 'User';

    // Insert new version
    $stmt = $pdo->prepare("
        INSERT INTO asset_versions
        (
            id,
            asset_id,
            version_no,
            status,
            notes,
            uploaded_by,
            uploaded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([
        $versionId,
        $assetId,
        $nextVersion,
        'For Review',
        $notes,
        $uploadedBy
    ]);

    createAuditLog(
    $pdo,
    'Created',
    'Asset Version',
    "Created V{$nextVersion} for asset {$assetId}"
    );  

        // Notify admins and project managers
    $assetStmt = $pdo->prepare("
        SELECT asset_title
        FROM assets
        WHERE id = ?
    ");
    $assetStmt->execute([$assetId]);
    $assetRow = $assetStmt->fetch();

    createReviewNotifications(
        $pdo,
        $assetRow['asset_title'] ?? 'Untitled Asset',
        $nextVersion
    );

    echo json_encode([
        "success" => true,
        "version" => [
            "id" => $versionId,
            "n" => $nextVersion,
            "status" => "For Review",
            "notes" => $notes,
            "by" => $uploadedBy,
            "date" => date('Y-m-d H:i:s')
        ]
    ], JSON_UNESCAPED_UNICODE);

    exit();
}

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

        createAuditLog(
        $pdo,
        'Created',
        'Asset',
        "Created asset {$assetId} - {$title}"
        );

        $initialVersion = null;
        try {
            $versionId = 'v' . bin2hex(random_bytes(6));
            $stmtVer = $pdo->prepare("INSERT INTO asset_versions (id, asset_id, version_no, status, notes, uploaded_by) VALUES (?, ?, 1, 'For Review', ?, ?)");
            $stmtVer->execute([$versionId, $assetId, $notes, $uploadedBy]);
            $initialVersion = [
                "id" => $versionId, "n" => 1, "status" => "For Review",
                "notes" => $notes, "by" => $uploadedBy, "date" => date('Y-m-d H:i:s')
            ];
        } catch (Exception $eVer) {
            error_log("ASSET VERSION ERROR: " . $eVer->getMessage());
        }

        createReviewNotifications(
            $pdo,
            $title,
            1
        );

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

    if ($method === 'PUT') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!$input) {
        ob_clean();
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "No JSON payload received."
        ]);
        exit();
    }

    $assetId = $input['asset_id'] ?? null;
    $versionNo = $input['version'] ?? null;
    $status = $input['status'] ?? null;
    $approvedBy = $input['approved_by'] ?? null;

    if (!$assetId || !$versionNo || !$status) {
        ob_clean();
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "error" => "Asset ID, version, and status are required."
        ]);
        exit();
    }

    $stmt = $pdo->prepare("
        UPDATE asset_versions
        SET status = ?, approved_by = ?
        WHERE asset_id = ? AND version_no = ?
    ");

    $stmt->execute([$status, $approvedBy, $assetId, $versionNo]);

    createAuditLog(
    $pdo,
    $status === 'Approved' || $status === 'Final' ? 'Approved' : 'Rejected',
    'Asset Version',
    "{$status} V{$versionNo} for asset {$assetId}"
    );

    ob_clean();
    echo json_encode([
        "success" => true,
        "message" => "Asset status updated successfully."
    ]);
    exit();
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