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
api_require_roles($currentUser, ['animator']);

try {
    $assetIds = api_scoped_asset_ids($pdo, $currentUser);
    [$assetScope, $assetParams] = api_asset_scope_sql($assetIds, 'a.id');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare("
            SELECT
                a.id AS asset_id,
                a.asset_title AS title,
                a.asset_type AS type,
                a.project_id,
                a.due_date,
                a.external_link AS asset_media_url,
                p.name AS project_name,
                COALESCE(s.stage, 'Blocking') AS stage,
                COALESCE(s.progress, 0) AS progress,
                COALESCE(s.playblast_url, '') AS playblast_url,
                s.updated_at AS progress_updated_at,
                CASE
                    WHEN latest.status = 'For Review' THEN 'For Review'
                    WHEN latest.status IN ('Approved', 'Final') THEN 'Completed'
                    WHEN latest.status IN ('Revision Requested', 'Rejected') THEN 'Revision Required'
                    ELSE COALESCE(w.workflow_status, 'Not Started')
                END AS workflow_status,
                COALESCE(w.task_notes, '') AS task_notes,
                latest.status AS review_status,
                latest.notes AS review_notes,
                latest.version_number,
                feedback.detail AS latest_feedback,
                feedback.created_at AS feedback_at
            FROM assets a
            INNER JOIN projects p ON p.id = a.project_id
            LEFT JOIN animation_shot_progress s ON s.asset_id = a.id
            LEFT JOIN animation_shot_workflow w ON w.asset_id = a.id
            LEFT JOIN (
                SELECT av.asset_id, av.status, av.notes, av.version_number
                FROM asset_versions av
                INNER JOIN (
                    SELECT asset_id, MAX(version_number) AS version_number
                    FROM asset_versions
                    GROUP BY asset_id
                ) newest ON newest.asset_id = av.asset_id
                    AND newest.version_number = av.version_number
            ) latest ON latest.asset_id = a.id
            LEFT JOIN (
                SELECT al.entity, al.detail, al.created_at
                FROM audit_logs al
                INNER JOIN (
                    SELECT entity, MAX(id) AS id
                    FROM audit_logs
                    WHERE action = 'Comment'
                    GROUP BY entity
                ) newest_comment ON newest_comment.id = al.id
            ) feedback ON feedback.entity = CONCAT('Asset #', a.id)
            WHERE a.asset_type = 'Animation Scene'
              AND latest.status = 'Revision Requested'
              AND (
                  a.assigned_animator = ?
                  OR (
                      a.assigned_animator IS NULL
                      AND p.animator_id = ?
                  )
              ){$assetScope}
            ORDER BY p.name, a.asset_title
        ");
        $stmt->execute(array_merge(
            [$currentUser['id'], $currentUser['id']],
            $assetParams
        ));
        echo json_encode([
            'success' => true,
            'shots' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'GET or POST method required.']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload.']);
        exit;
    }

    $assetId = filter_var($input['asset_id'] ?? null, FILTER_VALIDATE_INT);
    $stage = $input['stage'] ?? '';
    $progress = filter_var($input['progress'] ?? null, FILTER_VALIDATE_INT);
    $playblastValue = $input['playblast_url'] ?? '';
    $playblastUrl = is_string($playblastValue) ? trim($playblastValue) : '';
    $workflowStatus = $input['workflow_status'] ?? 'In Progress';
    $taskNotesValue = $input['task_notes'] ?? '';
    $taskNotes = is_string($taskNotesValue) ? trim($taskNotesValue) : '';
    $validStages = ['Blocking', 'Spline', 'Polish', 'Ready for Review'];
    $validWorkflowStatuses = [
        'Not Started',
        'In Progress',
        'For Review',
        'Revision Required',
        'Completed'
    ];

    if (
        !$assetId ||
        !is_string($stage) ||
        !in_array($stage, $validStages, true) ||
        !is_string($workflowStatus) ||
        !in_array($workflowStatus, $validWorkflowStatuses, true) ||
        !is_string($playblastValue) ||
        !is_string($taskNotesValue) ||
        $progress === false ||
        $progress < 0 ||
        $progress > 100 ||
        strlen($playblastUrl) > 2048 ||
        strlen($taskNotes) > 10000
    ) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Provide a valid shot, animation stage, progress (0–100), and playblast link.']);
        exit;
    }

    if (
        $playblastUrl !== '' &&
        !preg_match('~^https?://~i', $playblastUrl) &&
        !preg_match('~^/SIA/uploads/assets/[A-Za-z0-9._-]+$~', $playblastUrl)
    ) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Playblast link must use HTTP(S) or an uploaded SIA asset path.']);
        exit;
    }

    if (!api_can_access_asset($pdo, $currentUser, $assetId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You are not assigned to this shot.']);
        exit;
    }

    $assetStmt = $pdo->prepare("
        SELECT a.id
        FROM assets a
        INNER JOIN projects p ON p.id = a.project_id
        WHERE a.id = ?
          AND a.asset_type = 'Animation Scene'
          AND (
              a.assigned_animator = ?
              OR (
                  a.assigned_animator IS NULL
                  AND p.animator_id = ?
              )
          )
        LIMIT 1
    ");
    $assetStmt->execute([
        $assetId,
        $currentUser['id'],
        $currentUser['id']
    ]);
    if (!$assetStmt->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Assigned animation scene not found.']);
        exit;
    }

    $currentWorkflowStmt = $pdo->prepare("
        SELECT
            w.workflow_status,
            latest.status AS review_status
        FROM assets a
        LEFT JOIN animation_shot_workflow w ON w.asset_id = a.id
        LEFT JOIN (
            SELECT av.asset_id, av.status
            FROM asset_versions av
            INNER JOIN (
                SELECT asset_id, MAX(version_number) AS version_number
                FROM asset_versions
                GROUP BY asset_id
            ) newest ON newest.asset_id = av.asset_id
                AND newest.version_number = av.version_number
        ) latest ON latest.asset_id = a.id
        WHERE a.id = ? AND a.asset_type = 'Animation Scene'
        LIMIT 1
    ");
    $currentWorkflowStmt->execute([$assetId]);
    $currentWorkflow = $currentWorkflowStmt->fetch(PDO::FETCH_ASSOC);
    $currentReviewStatus = $currentWorkflow['review_status'] ?? null;
    $currentWorkflowStatus = $currentWorkflow['workflow_status'] ?? 'Not Started';
    if ($currentReviewStatus === 'For Review') {
        $currentWorkflowStatus = 'For Review';
    } elseif (in_array($currentReviewStatus, ['Approved', 'Final'], true)) {
        $currentWorkflowStatus = 'Completed';
    } elseif (in_array($currentReviewStatus, ['Revision Requested', 'Rejected'], true)) {
        $currentWorkflowStatus = 'Revision Required';
    }
    if (in_array($currentWorkflowStatus, ['For Review', 'Completed'], true)) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'error' => 'This shot is locked while it is awaiting or has completed review.'
        ]);
        exit;
    }
    if (
        $workflowStatus === 'Completed' ||
        $workflowStatus === 'For Review' ||
        (
            $workflowStatus === 'Revision Required' &&
            $currentWorkflowStatus !== 'Revision Required'
        )
    ) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Review and completion statuses are set by the asset approval workflow.'
        ]);
        exit;
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare("
        INSERT INTO animation_shot_progress
            (asset_id, stage, progress, playblast_url, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            stage = VALUES(stage),
            progress = VALUES(progress),
            playblast_url = VALUES(playblast_url),
            updated_by = VALUES(updated_by)
    ");
    $stmt->execute([
        $assetId,
        $stage,
        $progress,
        $playblastUrl,
        $currentUser['id']
    ]);
    $workflowStmt = $pdo->prepare("
        INSERT INTO animation_shot_workflow
            (asset_id, workflow_status, task_notes, updated_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            workflow_status = VALUES(workflow_status),
            task_notes = VALUES(task_notes),
            updated_by = VALUES(updated_by)
    ");
    $workflowStmt->execute([
        $assetId,
        $workflowStatus,
        $taskNotes,
        $currentUser['id']
    ]);
    $pdo->commit();

    $savedStmt = $pdo->prepare("
        SELECT
            s.stage,
            s.progress,
            s.playblast_url,
            s.updated_at AS progress_updated_at,
            w.workflow_status,
            w.task_notes,
            latest.status AS review_status,
            latest.notes AS review_notes,
            latest.version_number
        FROM animation_shot_progress s
        INNER JOIN animation_shot_workflow w ON w.asset_id = s.asset_id
        LEFT JOIN (
            SELECT av.asset_id, av.status, av.notes, av.version_number
            FROM asset_versions av
            INNER JOIN (
                SELECT asset_id, MAX(version_number) AS version_number
                FROM asset_versions
                GROUP BY asset_id
            ) newest ON newest.asset_id = av.asset_id
                AND newest.version_number = av.version_number
        ) latest ON latest.asset_id = s.asset_id
        WHERE s.asset_id = ?
    ");
    $savedStmt->execute([$assetId]);
    echo json_encode([
        'success' => true,
        'shot' => array_merge(['asset_id' => $assetId], $savedStmt->fetch(PDO::FETCH_ASSOC))
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Animation shot tracker error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not load or save the animation shot tracker. Check that its database migration has been applied.']);
}
