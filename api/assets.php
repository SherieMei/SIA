<?php

header('Content-Type: application/json');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

if (!current_user()) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Not authenticated'
    ]);
    exit;
}

/* ============================================================
   GET METHOD: FETCH ALL ASSETS & DEPENDENCIES FOR FRONTEND
   ============================================================ */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Fetch projects for drop-downs
        $projStmt = $pdo->query("SELECT id, name FROM projects ORDER BY name ASC");
        $projects = $projStmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch assets mapped to expected front-end structure
        $assetStmt = $pdo->query("
            SELECT 
                a.id, 
                a.project_id AS project, 
                a.asset_title AS title, 
                a.asset_type AS type, 
                a.external_link AS link, 
                a.created_at
            FROM assets a
            ORDER BY a.created_at DESC
        ");
        $assets = $assetStmt->fetchAll(PDO::FETCH_ASSOC);

        // Map versions to each asset
        foreach ($assets as &$asset) {
            $vStmt = $pdo->prepare("
                SELECT 
                    id, 
                    version_no AS n, 
                    status, 
                    notes, 
                    uploaded_by AS `by`, 
                    DATE_FORMAT(created_at, '%Y-%m-%d') AS date
                FROM asset_versions
                WHERE asset_id = ?
                ORDER BY version_no ASC
            ");
            $vStmt->execute([$asset['id']]);
            $versions = $vStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fallback if no version records exist
            if (empty($versions)) {
                $versions = [[
                    'id' => 'v1',
                    'n' => 1,
                    'status' => 'Approved',
                    'notes' => '',
                    'by' => null,
                    'date' => date('Y-m-d')
                ]];
            }

            $asset['versions'] = $versions;
        }

        echo json_encode([
            'success'  => true,
            'assets'   => $assets,
            'projects' => $projects
        ]);

    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => $e->getMessage()
        ]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? 'create';

/* ============================================================
   UPDATE ASSET STATUS / REVIEW
   ============================================================ */
if ($action === 'update_status') {
    $assetId = trim($input['asset_id'] ?? '');
    $status  = trim($input['status'] ?? '');
    $comment = trim($input['comment'] ?? '');

    if (!$assetId || !$status) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Asset ID and status are required.'
        ]);
        exit;
    }

    try {
        $user = current_user();
        $userId = $user['id'] ?? null;

        $pdo->beginTransaction();

        /* Get the latest version ID first to avoid MySQL update limit syntax issues */
        $vFind = $pdo->prepare("
            SELECT id FROM asset_versions 
            WHERE asset_id = ? 
            ORDER BY version_no DESC LIMIT 1
        ");
        $vFind->execute([$assetId]);
        $latestV = $vFind->fetchColumn();

        if ($latestV) {
            $updateStmt = $pdo->prepare("
                UPDATE asset_versions
                SET status = ?
                WHERE id = ?
            ");
            $updateStmt->execute([$status, $latestV]);
        }

        if ($comment !== '') {
            $commentId = 'c' . bin2hex(random_bytes(6));
            $commentStmt = $pdo->prepare("
                INSERT INTO comments (id, asset_id, user_id, comment_text, created_at)
                VALUES (?, ?, ?, ?, NOW())
            ");
            $commentStmt->execute([$commentId, $assetId, $userId, $comment]);
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'status'  => $status
        ]);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => $e->getMessage()
        ]);
    }
    exit;
}

/* ============================================================
   ADD COMMENT TO ASSET
   ============================================================ */
if ($action === 'add_comment') {
    $assetId = trim($input['asset_id'] ?? '');
    $text    = trim($input['text'] ?? '');

    if (!$assetId || !$text) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Asset ID and comment text are required.'
        ]);
        exit;
    }

    try {
        $user = current_user();
        $userId = $user['id'] ?? null;

        $commentId = 'c' . bin2hex(random_bytes(6));
        $stmt = $pdo->prepare("
            INSERT INTO comments (id, asset_id, user_id, comment_text, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$commentId, $assetId, $userId, $text]);

        echo json_encode([
            'success' => true,
            'comment' => [
                'id'   => $commentId,
                'by'   => $userId,
                'text' => $text,
                'date' => date('Y-m-d')
            ]
        ]);

    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error'   => $e->getMessage()
        ]);
    }
    exit;
}

/* ============================================================
   CREATE NEW VERSION
   ============================================================ */
if ($action === 'version') {
    $assetId = trim($input['asset_id'] ?? '');
    $notes   = trim($input['notes'] ?? '');

    if (!$assetId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Asset ID is required.'
        ]);
        exit;
    }

    try {
        $user = current_user();
        $userId = $user['id'] ?? null;

        $assetCheck = $pdo->prepare("SELECT id FROM assets WHERE id = ? LIMIT 1");
        $assetCheck->execute([$assetId]);

        if (!$assetCheck->fetch()) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Asset not found: ' . $assetId
            ]);
            exit;
        }

        $versionQuery = $pdo->prepare("SELECT MAX(version_no) FROM asset_versions WHERE asset_id = ?");
        $versionQuery->execute([$assetId]);

        $currentVersion = (int)$versionQuery->fetchColumn();
        $newVersion = $currentVersion + 1;

        $versionId = 'v' . bin2hex(random_bytes(6));

        $versionStmt = $pdo->prepare("
            INSERT INTO asset_versions
                (id, asset_id, version_no, status, notes, uploaded_by)
            VALUES
                (?, ?, ?, 'For Review', ?, ?)
        ");

        $versionStmt->execute([
            $versionId,
            $assetId,
            $newVersion,
            $notes ?: null,
            $userId
        ]);

        echo json_encode([
            'success' => true,
            'version' => [
                'id' => $versionId,
                'n' => $newVersion,
                'status' => 'For Review',
                'notes' => $notes,
                'by' => $userId,
                'date' => date('Y-m-d')
            ]
        ]);

    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

/* ============================================================
   CREATE NEW ASSET
   ============================================================ */
$projectId = trim($input['project_id'] ?? '');
$title     = trim($input['title'] ?? '');
$type      = trim($input['type'] ?? '');
$link      = trim($input['external_link'] ?? '');
$notes     = trim($input['notes'] ?? '');

if (!$projectId || !$title || !$type) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Project, title, and asset type are required.'
    ]);
    exit;
}

try {
    $pdo->beginTransaction();

    $id = 'a' . bin2hex(random_bytes(6));

    $stmt = $pdo->prepare("
        INSERT INTO assets
            (id, project_id, scene_id, asset_title, asset_type, external_link)
        VALUES
            (?, ?, NULL, ?, ?, ?)
    ");

    $stmt->execute([
        $id,
        $projectId,
        $title,
        $type,
        $link ?: null
    ]);

    $versionId = 'v' . bin2hex(random_bytes(6));
    $user = current_user();
    $userId = $user['id'] ?? null;

    $versionStmt = $pdo->prepare("
        INSERT INTO asset_versions
            (id, asset_id, version_no, status, notes, uploaded_by)
        VALUES
            (?, ?, 1, 'For Review', ?, ?)
    ");

    $versionStmt->execute([
        $versionId,
        $id,
        $notes ?: null,
        $userId
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'asset' => [
            'id' => $id,
            'project' => $projectId,
            'title' => $title,
            'type' => $type,
            'link' => $link,
            'versions' => [
                [
                    'id' => $versionId,
                    'n' => 1,
                    'status' => 'For Review',
                    'notes' => $notes,
                    'by' => $userId,
                    'date' => date('Y-m-d')
                ]
            ]
        ]
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}