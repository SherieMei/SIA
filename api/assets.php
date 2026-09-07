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

        /* Make sure the asset exists in the database */
        $assetCheck = $pdo->prepare("
            SELECT id
            FROM assets
            WHERE id = ?
        LIMIT 1
        ");

        $assetCheck->execute([$assetId]);

        if (!$assetCheck->fetch()) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Asset not found: ' . $assetId
            ]);
            exit;
        }

        /* Get current highest version number */
        $versionQuery = $pdo->prepare("
            SELECT MAX(version_no)
            FROM asset_versions
            WHERE asset_id = ?
        ");

        $versionQuery->execute([$assetId]);

        $currentVersion = (int)$versionQuery->fetchColumn();
        $newVersion = $currentVersion + 1;

        /* Create new version */
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

    /*
     * Start transaction.
     * Both the asset and its first version must save together.
     */
    $pdo->beginTransaction();

    /* ============================================================
       CREATE ASSET
       ============================================================ */

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

    /* ============================================================
       CREATE FIRST VERSION (v1)
       ============================================================ */

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

    /* ============================================================
       SAVE BOTH
       ============================================================ */

    $pdo->commit();

    /* ============================================================
       RETURN DATA TO JAVASCRIPT
       ============================================================ */

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

    /* ============================================================
       ROLLBACK IF ANYTHING FAILS
       ============================================================ */

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}