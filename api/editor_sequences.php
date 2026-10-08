<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/api_auth.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$currentUser = api_require_user($pdo);
api_require_roles($currentUser, ['editor']);

function editor_sequence_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $projectStmt = $pdo->prepare("
            SELECT DISTINCT p.id, p.name
            FROM projects p
            WHERE p.artist_id = ?
               OR EXISTS (
                    SELECT 1
                    FROM assets a
                    WHERE a.project_id = p.id
                      AND a.assigned_editor = ?
               )
            ORDER BY p.name
        ");
        $projectStmt->execute([$currentUser['id'], $currentUser['id']]);
        $projects = $projectStmt->fetchAll(PDO::FETCH_ASSOC);
        $projectIds = array_column($projects, 'id');
        if (!$projectIds) {
            editor_sequence_response(200, [
                'success' => true,
                'projects' => [],
                'library' => [],
                'sequences' => []
            ]);
        }
        $assetIds = api_scoped_asset_ids($pdo, $currentUser);
        [$assetScope, $assetParams] = api_asset_scope_sql($assetIds, 'a.id');

        $projectPlaceholders = implode(',', array_fill(0, count($projectIds), '?'));
        $libraryStmt = $pdo->prepare("
            SELECT
                a.id AS asset_id,
                a.project_id,
                a.asset_title AS title,
                a.asset_type AS type,
                a.external_link,
                latest.status
            FROM assets a
            INNER JOIN (
                SELECT asset_id, MAX(version_number) AS version_number
                FROM asset_versions
                GROUP BY asset_id
            ) newest ON newest.asset_id = a.id
            INNER JOIN asset_versions latest
                ON latest.asset_id = newest.asset_id
               AND latest.version_number = newest.version_number
            WHERE a.project_id IN ({$projectPlaceholders})
              AND a.asset_type IN ('Animation Scene', 'Audio')
              AND latest.status IN ('Approved', 'Final')
              {$assetScope}
            ORDER BY a.project_id, a.asset_type, a.asset_title
        ");
        $libraryStmt->execute(array_merge($projectIds, $assetParams));

        [$cutScope, $cutParams] = api_asset_scope_sql($assetIds, 'cut.id');
        $sequenceStmt = $pdo->prepare("
            SELECT
                s.id,
                s.project_id,
                p.name AS project_name,
                s.title,
                s.notes,
                CASE WHEN cut.id IS NULL THEN NULL ELSE s.cut_asset_id END AS cut_asset_id,
                cut.asset_title AS cut_title,
                cut_version.status AS cut_status,
                s.updated_at
            FROM editor_sequences s
            INNER JOIN projects p ON p.id = s.project_id
            LEFT JOIN assets cut ON cut.id = s.cut_asset_id{$cutScope}
            LEFT JOIN (
                SELECT av.asset_id, av.status
                FROM asset_versions av
                INNER JOIN (
                    SELECT asset_id, MAX(version_number) AS version_number
                    FROM asset_versions
                    GROUP BY asset_id
                ) newest ON newest.asset_id = av.asset_id
                    AND newest.version_number = av.version_number
            ) cut_version ON cut_version.asset_id = cut.id
            WHERE s.editor_id = ?
              AND s.project_id IN ({$projectPlaceholders})
            ORDER BY s.updated_at DESC, s.id DESC
        ");
        $sequenceStmt->execute(array_merge($cutParams, [$currentUser['id']], $projectIds));
        $sequences = $sequenceStmt->fetchAll(PDO::FETCH_ASSOC);

        if ($sequences) {
            $sequenceIds = array_column($sequences, 'id');
            $sequencePlaceholders = implode(',', array_fill(0, count($sequenceIds), '?'));
            $itemsStmt = $pdo->prepare("
                SELECT
                    item.sequence_id,
                    item.item_order,
                    a.id AS asset_id,
                    a.project_id,
                    a.asset_title AS title,
                    a.asset_type AS type,
                    a.external_link,
                    latest.status
                FROM editor_sequence_items item
                INNER JOIN assets a ON a.id = item.asset_id
                INNER JOIN (
                    SELECT asset_id, MAX(version_number) AS version_number
                    FROM asset_versions
                    GROUP BY asset_id
                ) newest ON newest.asset_id = a.id
                INNER JOIN asset_versions latest
                    ON latest.asset_id = newest.asset_id
                   AND latest.version_number = newest.version_number
                WHERE item.sequence_id IN ({$sequencePlaceholders})
                  {$assetScope}
                ORDER BY item.sequence_id, item.item_order
            ");
            $itemsStmt->execute(array_merge($sequenceIds, $assetParams));
            $itemsBySequence = [];
            foreach ($itemsStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
                $itemsBySequence[(string)$item['sequence_id']][] = $item;
            }
            foreach ($sequences as &$sequence) {
                $sequence['items'] = $itemsBySequence[(string)$sequence['id']] ?? [];
            }
            unset($sequence);
        }

        editor_sequence_response(200, [
            'success' => true,
            'projects' => $projects,
            'library' => $libraryStmt->fetchAll(PDO::FETCH_ASSOC),
            'sequences' => $sequences
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        editor_sequence_response(405, [
            'success' => false,
            'error' => 'GET or POST method required.'
        ]);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        editor_sequence_response(400, [
            'success' => false,
            'error' => 'Invalid JSON payload.'
        ]);
    }

    $action = $input['action'] ?? 'save';
    if ($action === 'delete') {
        $sequenceId = filter_var($input['sequence_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$sequenceId) {
            editor_sequence_response(400, [
                'success' => false,
                'error' => 'A valid sequence ID is required.'
            ]);
        }
        $deleteStmt = $pdo->prepare("
            DELETE FROM editor_sequences
            WHERE id = ? AND editor_id = ?
        ");
        $deleteStmt->execute([$sequenceId, $currentUser['id']]);
        if (!$deleteStmt->rowCount()) {
            editor_sequence_response(404, [
                'success' => false,
                'error' => 'Sequence not found or not assigned to you.'
            ]);
        }
        editor_sequence_response(200, ['success' => true]);
    }

    if ($action !== 'save') {
        editor_sequence_response(400, [
            'success' => false,
            'error' => 'Unknown sequence action.'
        ]);
    }

    $projectIdValue = $input['project_id'] ?? '';
    $titleValue = $input['title'] ?? '';
    $notesValue = $input['notes'] ?? '';
    if (!is_string($projectIdValue) || !is_string($titleValue) || !is_string($notesValue)) {
        editor_sequence_response(400, [
            'success' => false,
            'error' => 'Project, title, and notes must be text values.'
        ]);
    }
    $projectId = trim($projectIdValue);
    $title = trim($titleValue);
    $notes = trim($notesValue);
    $items = $input['items'] ?? null;
    $sequenceId = empty($input['sequence_id'])
        ? null
        : filter_var($input['sequence_id'], FILTER_VALIDATE_INT);

    if (
        $projectId === '' ||
        $title === '' ||
        strlen($title) > 255 ||
        strlen($notes) > 10000 ||
        !is_array($items) ||
        count($items) > 500 ||
        ($input['sequence_id'] ?? null) !== null && !$sequenceId
    ) {
        editor_sequence_response(400, [
            'success' => false,
            'error' => 'Provide a project, sequence title, valid item list, and notes no longer than 10,000 bytes.'
        ]);
    }

    if (!api_can_access_project($pdo, $currentUser, $projectId)) {
        editor_sequence_response(403, [
            'success' => false,
            'error' => 'You do not have access to this project.'
        ]);
    }

    $assetIds = [];
    foreach ($items as $assetIdValue) {
        $assetId = filter_var($assetIdValue, FILTER_VALIDATE_INT);
        if (!$assetId || $assetId < 1) {
            editor_sequence_response(400, [
                'success' => false,
                'error' => 'The sequence contains an invalid asset ID.'
            ]);
        }
        $assetIds[] = $assetId;
    }
    $uniqueAssetIds = array_values(array_unique($assetIds));
    if ($uniqueAssetIds) {
        foreach ($uniqueAssetIds as $assetId) {
            if (!api_can_access_asset($pdo, $currentUser, $assetId)) {
                editor_sequence_response(403, [
                    'success' => false,
                    'error' => 'A sequence item is not assigned to your account.'
                ]);
            }
        }
        $assetPlaceholders = implode(',', array_fill(0, count($uniqueAssetIds), '?'));
        $approvedItemsStmt = $pdo->prepare("
            SELECT a.id
            FROM assets a
            INNER JOIN (
                SELECT asset_id, MAX(version_number) AS version_number
                FROM asset_versions
                GROUP BY asset_id
            ) newest ON newest.asset_id = a.id
            INNER JOIN asset_versions latest
                ON latest.asset_id = newest.asset_id
               AND latest.version_number = newest.version_number
            WHERE a.project_id = ?
              AND a.id IN ({$assetPlaceholders})
              AND a.asset_type IN ('Animation Scene', 'Audio')
              AND latest.status IN ('Approved', 'Final')
        ");
        $approvedItemsStmt->execute(array_merge([$projectId], $uniqueAssetIds));
        if (count($approvedItemsStmt->fetchAll(PDO::FETCH_COLUMN)) !== count($uniqueAssetIds)) {
            editor_sequence_response(400, [
                'success' => false,
                'error' => 'Sequences can only include approved animation scenes or audio assets from the selected project.'
            ]);
        }
    }

    $pdo->beginTransaction();
    if ($sequenceId) {
        $ownedSequenceStmt = $pdo->prepare("
            SELECT id
            FROM editor_sequences
            WHERE id = ? AND editor_id = ? AND project_id = ?
            LIMIT 1
        ");
        $ownedSequenceStmt->execute([$sequenceId, $currentUser['id'], $projectId]);
        if (!$ownedSequenceStmt->fetchColumn()) {
            $pdo->rollBack();
            editor_sequence_response(404, [
                'success' => false,
                'error' => 'Sequence not found or not assigned to you in this project.'
            ]);
        }
        $saveStmt = $pdo->prepare("
            UPDATE editor_sequences
            SET title = ?, notes = ?
            WHERE id = ? AND editor_id = ?
        ");
        $saveStmt->execute([$title, $notes, $sequenceId, $currentUser['id']]);
        $pdo->prepare('DELETE FROM editor_sequence_items WHERE sequence_id = ?')
            ->execute([$sequenceId]);
    } else {
        $saveStmt = $pdo->prepare("
            INSERT INTO editor_sequences (project_id, editor_id, title, notes)
            VALUES (?, ?, ?, ?)
        ");
        $saveStmt->execute([$projectId, $currentUser['id'], $title, $notes]);
        $sequenceId = (int)$pdo->lastInsertId();
    }

    if ($assetIds) {
        $insertItemStmt = $pdo->prepare("
            INSERT INTO editor_sequence_items (sequence_id, asset_id, item_order)
            VALUES (?, ?, ?)
        ");
        foreach ($assetIds as $position => $assetId) {
            $insertItemStmt->execute([$sequenceId, $assetId, $position + 1]);
        }
    }
    $pdo->commit();

    editor_sequence_response(200, [
        'success' => true,
        'sequence_id' => $sequenceId,
        'message' => 'Sequence saved.'
    ]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Editor sequence workflow error: ' . $error->getMessage());
    editor_sequence_response(500, [
        'success' => false,
        'error' => 'Could not load or save editor sequences. Check that the production role workflow migration has been applied.'
    ]);
}
