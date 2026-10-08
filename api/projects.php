<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $origin === 'http://127.0.0.1:5501' ||
    $origin === 'http://localhost:5501' ||
    $origin === 'http://localhost'
) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/api_auth.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$currentUser = api_require_user($pdo);

/* =========================================================
   AUDIT LOG
   ========================================================= */

function createAuditLog(
    $pdo,
    $action,
    $entity = null,
    $details = null,
    $projectId = null,
    $clientId = null
) {

    try {

        $userId =
            $_SESSION['user']['id'] ?? null;


        if ($projectId && !$clientId) {

            $clientStmt = $pdo->prepare("
                SELECT client_id
                FROM projects
                WHERE id = ?
                LIMIT 1
            ");

            $clientStmt->execute([
                $projectId
            ]);

            $projectRow =
                $clientStmt->fetch(PDO::FETCH_ASSOC);

            $clientId =
                $projectRow['client_id'] ?? null;
        }


        $stmt = $pdo->prepare("
            INSERT INTO audit_logs
            (
                user_id,
                project_id,
                client_id,
                action,
                entity,
                detail
            )
            VALUES (?, ?, ?, ?, ?, ?)
        ");


        $stmt->execute([
            $userId,
            $projectId,
            $clientId,
            $action,
            $entity,
            $details
        ]);

    } catch (Exception $e) {

        error_log(
            'Audit log error: ' .
            $e->getMessage()
        );

    }
}
/* =========================================================
   CREATE USER NOTIFICATION
   ========================================================= */

function createUserNotification(
    $pdo,
    $userId,
    $title,
    $message,
    $type = 'general'
)
{
    if (!$userId) {
        return;
    }

    try {

        $stmt = $pdo->prepare("
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                type,
                is_read
            )
            VALUES (?, ?, ?, ?, 0)
        ");

        $stmt->execute([
            $userId,
            $title,
            $message,
            $type
        ]);

    } catch (Exception $e) {

        error_log(
            'Notification error: ' .
            $e->getMessage()
        );
    }
}

/* =========================================================
   GET PROJECTS
   ========================================================= */


if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $role = $currentUser['role'];
    $userId = $currentUser['id'];

    api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator', 'client']);

    $selectFields = $role === 'client' ? "
        p.id,
        p.name,
        p.status,
        p.deadline
    " : "
        p.id,
        p.name,
        p.client,
        p.client_id,
        p.producer,
        p.status,
        p.deadline,
        p.budget,
        p.pm AS project_manager_id,
        p.artist_id AS editor_id,
        p.artist_id,
        p.animator_id
    ";

    if ($role === 'client') {

        $stmt = $pdo->prepare("
            SELECT $selectFields
            FROM projects p
            WHERE p.client_id = ?
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$userId]);

    } elseif ($role === 'editor') {

        $stmt = $pdo->prepare("
            SELECT DISTINCT $selectFields
            FROM projects p
            WHERE p.artist_id = ?
               OR EXISTS (
                    SELECT 1
                    FROM assets a
                    WHERE a.project_id = p.id
                      AND a.assigned_editor = ?
               )
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$userId, $userId]);

    } elseif ($role === 'animator') {

        $stmt = $pdo->prepare("
            SELECT DISTINCT $selectFields
            FROM projects p
            WHERE p.animator_id = ?
               OR EXISTS (
                    SELECT 1
                    FROM assets a
                    WHERE a.project_id = p.id
                      AND a.assigned_animator = ?
               )
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$userId, $userId]);

    } elseif ($role === 'project_manager') {

        $stmt = $pdo->prepare("
            SELECT $selectFields
            FROM projects p
            WHERE p.pm = ?
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$userId]);

    } else {

        // Administrators can view all projects.
        $stmt = $pdo->query("
            SELECT $selectFields
            FROM projects p
            ORDER BY p.created_at DESC
        ");
    }

    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'projects' => array_map(
            function ($p) {
                if (!array_key_exists('project_manager_id', $p)) {
                    return $p;
                }
                $p['pm'] = $p['project_manager_id'];
                $p['team'] = array_values(array_filter([
                    $p['project_manager_id'] ?? null,
                    $p['editor_id'] ?? null,
                    $p['animator_id'] ?? null
                ], static function ($memberId) {
                    return $memberId !== null && $memberId !== '';
                }));
                return $p;
            },
            $projects
        )
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

/* =========================================================
   CREATE PROJECT
   ========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    api_require_roles($currentUser, ['admin', 'project_manager']);

    $in = json_decode(
        file_get_contents('php://input'),
        true
    ) ?? [];

    if (($in['action'] ?? '') === 'assign_team') {
        $projectId = trim((string)($in['project_id'] ?? ''));
        if (!$projectId || !api_can_access_project($pdo, $currentUser, $projectId)) {
            http_response_code($projectId ? 403 : 400);
            echo json_encode([
                'success' => false,
                'message' => $projectId
                    ? 'You do not have permission to manage this project.'
                    : 'Project ID is required.'
            ]);
            exit;
        }

        $currentProjectStmt = $pdo->prepare('SELECT pm, client_id, client FROM projects WHERE id = ? LIMIT 1');
        $currentProjectStmt->execute([$projectId]);
        $currentProject = $currentProjectStmt->fetch(PDO::FETCH_ASSOC);
        if (!$currentProject) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Project not found.']);
            exit;
        }

        $projectManager = $currentUser['role'] === 'project_manager'
            ? $currentUser['id']
            : trim((string)($in['project_manager_id'] ?? $currentProject['pm'] ?? ''));
        $editorId = trim((string)($in['editor_id'] ?? ''));
        $animatorId = trim((string)($in['animator_id'] ?? ''));
        $clientId = trim((string)($in['client_id'] ?? $currentProject['client_id'] ?? ''));
        foreach ([
            [$projectManager, 'project_manager', 'Project Manager', true],
            [$editorId, 'editor', 'Editor', false],
            [$animatorId, 'animator', 'Animator', false],
            [$clientId, 'client', 'Client', false]
        ] as [$assigneeId, $requiredRole, $label, $required]) {
            if ($assigneeId === '') {
                if ($required) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => "Please assign a {$label}."]);
                    exit;
                }
                continue;
            }
            $assigneeStmt = $pdo->prepare("
                SELECT id FROM app_users
                WHERE id = ? AND role = ?
                LIMIT 1
            ");
            $assigneeStmt->execute([$assigneeId, $requiredRole]);
            if (!$assigneeStmt->fetchColumn()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => "Selected {$label} account is invalid."]);
                exit;
            }
        }

        $clientName = $currentProject['client'];
        if ($clientId !== '') {
            $clientNameStmt = $pdo->prepare("
                SELECT full_name FROM app_users
                WHERE id = ? AND role = 'client'
                LIMIT 1
            ");
            $clientNameStmt->execute([$clientId]);
            $clientName = $clientNameStmt->fetchColumn();
        } else {
            $clientName = '';
        }

        $updateStmt = $pdo->prepare("
            UPDATE projects
            SET pm = ?, artist_id = ?, animator_id = ?, client_id = ?, client = ?
            WHERE id = ?
        ");
        $updateStmt->execute([
            $projectManager,
            $editorId ?: null,
            $animatorId ?: null,
            $clientId ?: null,
            $clientName,
            $projectId
        ]);

        echo json_encode([
            'success' => true,
            'project' => [
                'id' => $projectId,
                'pm' => $projectManager,
                'project_manager_id' => $projectManager,
                'editor_id' => $editorId ?: null,
                'artist_id' => $editorId ?: null,
                'animator_id' => $animatorId ?: null,
                'client_id' => $clientId ?: null,
                'client' => $clientName,
                'team' => array_values(array_filter([
                    $projectManager,
                    $editorId ?: null,
                    $animatorId ?: null,
                    $clientId ?: null
                ]))
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

$name = trim($in['name'] ?? '');
$deadline = $in['deadline'] ?? null;
$clientId = trim($in['client_id'] ?? '');
$editorId = trim((string)($in['editor_id'] ?? $in['artist_id'] ?? ''));
$animatorId = trim((string)($in['animator_id'] ?? ''));
$budget = (float)($in['budget'] ?? 0);
if ($budget < 5000 || $budget > 999999) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Budget must be between PHP 5,000 and PHP 999,999.'
    ]);

    exit;
}
/* -----------------------------------------
   VALIDATE SELECTED CLIENT ACCOUNT
   ----------------------------------------- */

if (!$clientId) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Please select a client.'
    ]);

    exit;
}


$clientStmt = $pdo->prepare("
    SELECT
        id,
        full_name
    FROM app_users
    WHERE id = ?
      AND role = 'client'
    LIMIT 1
");


$clientStmt->execute([
    $clientId
]);


$clientUser =
    $clientStmt->fetch(
        PDO::FETCH_ASSOC
    );


if (!$clientUser) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Selected client account is invalid.'
    ]);

    exit;
}


/*
 * Do not trust the client name sent by JavaScript.
 * Get the real name from app_users.
 */

$client =
    $clientUser['full_name'];

    // Logged-in user becomes the producer
    $producer = $currentUser['full_name'] ?? '';
if (!$name || !$clientId || !$client) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Project name and client are required.'
    ]);

    exit;
}


    /* Generate next project ID */

    $stmt = $pdo->query("
        SELECT id
        FROM projects
        ORDER BY CAST(SUBSTRING(id, 2) AS UNSIGNED) DESC
        LIMIT 1
    ");

    $last = $stmt->fetch(PDO::FETCH_ASSOC);

    $nextNumber = 1;

    if (
        $last &&
        preg_match('/^p(\d+)$/', $last['id'], $match)
    ) {
        $nextNumber = (int)$match[1] + 1;
    }

    $id = 'p' . $nextNumber;


    $projectManager = $currentUser['role'] === 'project_manager'
        ? $currentUser['id']
        : trim((string)($in['project_manager_id'] ?? $in['pm'] ?? ''));
    $assignees = [
        [$projectManager, 'project_manager', 'Project Manager', true],
        [$editorId, 'editor', 'Editor', false],
        [$animatorId, 'animator', 'Animator', false]
    ];
    foreach ($assignees as [$assigneeId, $requiredRole, $label, $required]) {
        if ($assigneeId === '') {
            if ($required) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => "Please assign a {$label}."
                ]);
                exit;
            }
            continue;
        }

        $assigneeStmt = $pdo->prepare("
            SELECT id
            FROM app_users
            WHERE id = ?
              AND role = ?
            LIMIT 1
        ");
        $assigneeStmt->execute([$assigneeId, $requiredRole]);
        if (!$assigneeStmt->fetchColumn()) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Selected {$label} account is invalid."
            ]);
            exit;
        }
    }


    /* Insert project */

    $stmt = $pdo->prepare("
        INSERT INTO projects
        (
            id,
            name,
            client,
            client_id,
            producer,
            status,
            deadline,
            pm,
            artist_id,
            animator_id,
            budget
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $id,
        $name,
        $client,
        $clientId,
        $producer,
        'Pre-Production',
        $deadline ?: null,
        $projectManager,
        $editorId ?: null,
        $animatorId ?: null,
        $budget
    ]);

createAuditLog(
    $pdo,
    'Created',
    'Project',
    "Created project {$id} - {$name}",
    $id,
    $clientId
);
/* =========================================================
   AUDIT LOG — BUDGET CHANGE
   ========================================================= */

$currentUserId =
    $_SESSION['user']['id'] ?? null;

if (
    $clientId &&
    (string)$clientId !== (string)$currentUserId
) {

    createUserNotification(
        $pdo,
        $clientId,
        'New Project Assigned',
        "You have been assigned to the project '{$name}'.",
        'project_assigned'
    );
}


    /* Return created project */

    echo json_encode([
        'success' => true,
        'project' => [
            'id' => $id,
            'name' => $name,
            'client' => $client,
            'client_id' => $clientId,
            'producer' => $producer,
            'status' => 'Pre-Production',
            'deadline' => $deadline,
            'budget' => $budget,
            'project_manager_id' => $projectManager,
            'pm' => $projectManager,
            'editor_id' => $editorId ?: null,
            'animator_id' => $animatorId ?: null,
            'team' => array_values(array_filter([
                $projectManager,
                $editorId ?: null,
                $animatorId ?: null
            ]))
        ]
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

/* =========================================================
   UPDATE PROJECT
   ========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    api_require_roles($currentUser, ['admin', 'project_manager']);

    $in = json_decode(
        file_get_contents('php://input'),
        true
    ) ?? [];

    $id = $in['id'] ?? null;
    $name = trim($in['name'] ?? '');
    $client = trim($in['client'] ?? '');
    $deadline = $in['deadline'] ?? null;
    $clientId = $in['client_id'] ?? null;
    $producer = $in['producer'] ?? '';
    $status = $in['status'] ?? 'Pre-Production';
    $projectManager = $in['pm'] ?? $in['project_manager_id'] ?? null;
    $budget = (float)($in['budget'] ?? 0);
    if (!$id) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Project ID is required.'
        ]);
        exit;
    }
    if (!api_can_access_project($pdo, $currentUser, $id)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'You do not have permission to manage this project.'
        ]);
        exit;
    }
    if ($currentUser['role'] === 'project_manager') {
        $projectManager = $currentUser['id'];
    }
    $oldProjectStmt = $pdo->prepare("
    SELECT budget
    FROM projects
    WHERE id = ?
    LIMIT 1
");

$oldProjectStmt->execute([
    $id
]);

$oldProject = $oldProjectStmt->fetch(PDO::FETCH_ASSOC);

$oldBudget = $oldProject
    ? (float)$oldProject['budget']
    : 0;

// Mark project as Completed
if (($in['status'] ?? '') === 'Completed') {

    if (!$id) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' => 'Project ID is required.'
        ]);

        exit;
    }


 /* =========================================================
   CHECK PROJECT PROGRESS BEFORE COMPLETING
   ========================================================= */

$projectStmt = $pdo->prepare("
    SELECT budget
    FROM projects
    WHERE id = ?
    LIMIT 1
");

$projectStmt->execute([$id]);

$projectRow =
    $projectStmt->fetch(PDO::FETCH_ASSOC);

if (!$projectRow) {

    http_response_code(404);

    echo json_encode([
        'success' => false,
        'message' => 'Project not found.'
    ]);

    exit;
}

$projectBudget =
    (float)($projectRow['budget'] ?? 0);

/* =========================================================
   REQUIRED ASSET TYPES
   ========================================================= */

$requiredAssetTypes = [
    'Storyboard',
    'Animatic',
    'Character Sheet',
    'Background Asset',
    'Animation Scene',
    'Render',
    'Audio',
    'Design Draft'
];


/* =========================================================
   GET PROJECT ASSETS + LATEST STATUS
   ========================================================= */

$assetStmt = $pdo->prepare("
    SELECT
        a.id,
        a.asset_type,
        (
            SELECT av.status
            FROM asset_versions av
            WHERE av.asset_id = a.id
            ORDER BY av.version_number DESC
            LIMIT 1
        ) AS latest_status
    FROM assets a
    WHERE a.project_id = ?
");

$assetStmt->execute([$id]);

$assetRows =
    $assetStmt->fetchAll(PDO::FETCH_ASSOC);

$presentTypes = [];
foreach ($assetRows as $asset) {
    $type = strtolower(trim((string)($asset['asset_type'] ?? '')));
    if ($type !== '') {
        $presentTypes[$type] = true;
    }
}

$missingTypes = array_values(array_filter(
    $requiredAssetTypes,
    static fn($type) => !isset($presentTypes[strtolower($type)])
));


/* =========================================================
   CHECK ASSET REVIEW STATUS
   ========================================================= */

$pendingAssets = [];
$resolvedAssets = 0;

foreach ($assetRows as $asset) {

    $latestStatus =
        $asset['latest_status'] ?? '';

    if (
        $latestStatus === 'For Review' ||
        $latestStatus === 'Revision Requested'
    ) {

        $pendingAssets[] = $asset;

    }

    if (
        $latestStatus === 'Approved' ||
        $latestStatus === 'Final' ||
        $latestStatus === 'Rejected'
    ) {

        $resolvedAssets++;
    }
}

$totalAssets =
    count($assetRows);


/* =========================================================
   CHECK RESOURCE COST
   ========================================================= */

$resourceStmt = $pdo->prepare("
    SELECT
        COALESCE(SUM(cost), 0) AS total_spent
    FROM resources
    WHERE project_id = ?
");

$resourceStmt->execute([$id]);

$resourceData =
    $resourceStmt->fetch(PDO::FETCH_ASSOC);

$totalSpent =
    (float)($resourceData['total_spent'] ?? 0);


/* =========================================================
   CALCULATE PROGRESS
   60% = required asset types present
   40% = reviewed/resolved assets
   ========================================================= */
$assetTypeProgress =
    (
        (count($requiredAssetTypes) - count($missingTypes)) /
        count($requiredAssetTypes)
    ) * 60;

$reviewProgress = 0;

if ($totalAssets > 0) {

    $reviewProgress =
        (
            $resolvedAssets /
            $totalAssets
        ) * 40;
}


$progress =
    round(
        $assetTypeProgress +
        $reviewProgress
    );


/* =========================================================
   FINAL COMPLETION RULE
   ========================================================= */

$canFinish =
    count($missingTypes) === 0 &&
    $totalAssets > 0 &&
    count($pendingAssets) === 0 &&
    $resolvedAssets === $totalAssets;


if ($canFinish) {

    $progress = 100;

} else {

    $progress =
        min(
            $progress,
            99
        );
}


/* =========================================================
   BLOCK COMPLETION + SHOW WHAT IS MISSING
   ========================================================= */

if (!$canFinish) {

    $problems = [];

    if (count($missingTypes) > 0) {
        $problems[] =
            'Missing asset types: ' .
            implode(', ', $missingTypes) . '.';
    }

    if ($totalAssets === 0) {
        $problems[] = 'Add at least one asset to this project before finishing it.';
    }

    if (count($pendingAssets) > 0 || $resolvedAssets !== $totalAssets) {
        $problems[] =
            'All project assets must have a resolved review status before finishing.';
    }

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'progress' => $progress,
        'missing_asset_types' => $missingTypes,
        'pending_assets' => count($pendingAssets),
        'budget' => $projectBudget,
        'spent' => $totalSpent,
        'message' =>
            implode(' ', $problems)
    ], JSON_UNESCAPED_UNICODE);

    exit;
}
    /* =========================================================
       COMPLETE PROJECT
       ========================================================= */

    $stmt = $pdo->prepare("
        UPDATE projects
        SET status = 'Completed'
        WHERE id = ?
    ");

    $stmt->execute([$id]);


    createAuditLog(
        $pdo,
        'Completed',
        'Project',
        "Marked project {$id} as Completed",
        $id
    );


    echo json_encode([
        'success' => true,
        'message' => 'Project marked as Completed.'
    ], JSON_UNESCAPED_UNICODE);


    exit;
}
    if (!$id || !$name || !$client) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Project ID, name, and client are required.'
        ]);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE projects
        SET
            name = ?,
            client = ?,
            client_id = ?,
            producer = ?,
            status = ?,
            deadline = ?,
            pm = ?,
            budget = ?
        WHERE id = ?
    ");

    $stmt->execute([
        $name,
        $client,
        $clientId,
        $producer,
        $status,
        $deadline ?: null,
        $projectManager,
        $budget,
        $id
    ]);
$projectAction =
    $status === 'Completed'
        ? 'Completed'
        : 'Updated';

$projectDetail =
    $status === 'Completed'
        ? "Marked project {$id} - {$name} as Completed"
        : "Updated project {$id} - {$name}";

createAuditLog(
    $pdo,
    $projectAction,
    'Project',
    $projectDetail,
    $id,
    $clientId
);
if ($oldBudget != $budget) {

    $oldBudgetFormatted = number_format($oldBudget, 2);
    $newBudgetFormatted = number_format($budget, 2);

    createAuditLog(
        $pdo,
        'Updated',
        'Project Budget',
        "Changed budget for {$name} from PHP {$oldBudgetFormatted} to PHP {$newBudgetFormatted}",
        $id,
        $clientId
    );
}

$currentUserId =
    $_SESSION['user']['id'] ?? null;

if (
    $clientId &&
    (string)$clientId !== (string)$currentUserId
) {

    if ($status === 'Completed') {

        createUserNotification(
            $pdo,
            $clientId,
            'Project Completed',
            "Your project '{$name}' has been marked as completed.",
            'project_completed'
        );

    } else {

        createUserNotification(
            $pdo,
            $clientId,
            'Project Updated',
            "Your project '{$name}' was updated.",
            'project_updated'
        );

    }
}

    echo json_encode([
        'success' => true,
        'message' => 'Project updated successfully.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

http_response_code(405);

echo json_encode([
    'error' => 'Method not allowed'
]);