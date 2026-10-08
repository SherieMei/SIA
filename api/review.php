<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

try {
    require_once __DIR__ . '/../config/db.php';
    require_once __DIR__ . '/../includes/api_auth.php';
    $currentUser = api_require_user($pdo);
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST') {
        api_require_roles($currentUser, ['client']);
        $input = json_decode(file_get_contents('php://input'), true);
        $assetId = $input['asset_id'] ?? $input['id'] ?? null;
        $status = $input['status'] ?? 'Approved';

        if (!$assetId || !in_array($status, ['Approved', 'Revision Requested', 'Rejected'], true)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'A valid asset ID and review decision are required.'
            ]);
            exit;
        }

        $latestStmt = $pdo->prepare("
            SELECT av.version_number, av.status
            FROM asset_versions av
            INNER JOIN assets a ON a.id = av.asset_id
            INNER JOIN projects p ON p.id = a.project_id
            WHERE av.asset_id = ?
              AND av.version_number = (
                  SELECT MAX(latest.version_number)
                  FROM asset_versions latest
                  WHERE latest.asset_id = av.asset_id
              )
              AND p.client_id = ?
            LIMIT 1
        ");
        $latestStmt->execute([$assetId, $currentUser['id']]);
        $latest = $latestStmt->fetch(PDO::FETCH_ASSOC);
        if (
            !$latest ||
            $latest['status'] !== 'For Review'
        ) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'You may only decide on the latest asset assigned to your client account.'
            ]);
            exit;
        }

        $stmt = $pdo->prepare("
            UPDATE asset_versions
            SET status = ?
            WHERE asset_id = ?
              AND version_number = ?
        ");
        $stmt->execute([$status, $assetId, $latest['version_number']]);

        echo json_encode([
            'success' => true,
            'status' => $status
        ]);
        exit;
    }

    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'error' => 'Method not allowed.'
        ]);
        exit;
    }

    api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator', 'client']);
    $assetIds = api_scoped_asset_ids($pdo, $currentUser);
    [$scopeSql, $scopeParams] = api_asset_scope_sql($assetIds, 'a.id');
    $notesSelect = $currentUser['role'] === 'client' ? "''" : 'v.notes';
    $stmt = $pdo->prepare("
        SELECT
            a.id,
            a.project_id,
            a.asset_title,
            a.asset_type,
            a.external_link,
            a.created_at,
            v.version_number,
            v.status,
            {$notesSelect} AS notes
        FROM assets a
        LEFT JOIN asset_versions v
            ON v.asset_id = a.id
           AND v.version_number = (
               SELECT MAX(v2.version_number)
               FROM asset_versions v2
               WHERE v2.asset_id = a.id
           )
        WHERE 1 = 1{$scopeSql}
        ORDER BY a.id DESC
    ");
    $stmt->execute($scopeParams);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $assets = [];

    foreach ($rows as $row) {
        $asset = [
            'id' => (int)$row['id'],
            'project_id' => $row['project_id'],
            'title' => $row['asset_title'] ?? 'Untitled',
            'asset_title' => $row['asset_title'] ?? 'Untitled',
            'type' => $row['asset_type'] ?? 'Storyboard',
            'asset_type' => $row['asset_type'] ?? 'Storyboard',
            'link' => $row['external_link'] ?? '',
            'external_link' => $row['external_link'] ?? '',
            'status' => $row['status'] ?? 'For Review',
            'version_number' => (int)($row['version_number'] ?? 1),
            'created_at' => $row['created_at']
        ];
        if ($currentUser['role'] !== 'client') {
            $asset['notes'] = $row['notes'] ?? '';
        }
        $assets[] = $asset;
    }

    ob_clean();
    echo json_encode([
        'success' => true,
        'status' => 'success',
        'assets' => $assets,
        'state' => [
            'assets' => $assets,
            'currentUser' => [
                'id' => $currentUser['id'],
                'name' => $currentUser['full_name'],
                'role' => $currentUser['role']
            ]
        ]
    ]);
    exit;
} catch (Throwable $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'status' => 'error',
        'error' => 'Unable to process the asset review request.'
    ]);
    exit;
}
