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

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode([
        'error' => 'Not authenticated'
    ]);
    exit;
}

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

    if ($_SESSION['user']['role'] === 'client') {

        // Client can only see projects assigned to their account
        $stmt = $pdo->prepare("
            SELECT
                id,
                name,
                client,
                client_id,
                producer,
                status,
                deadline,
                budget,
                pm AS project_manager_id
            FROM projects
            WHERE client_id = ?
            ORDER BY created_at DESC
        ");

        $stmt->execute([
            $_SESSION['user']['id']
        ]);

    } else {

        // Admin / Project Manager can see all projects
        $stmt = $pdo->query("
            SELECT
                id,
                name,
                client,
                client_id,
                producer,
                status,
                deadline,
                budget,
                pm AS project_manager_id
            FROM projects
            ORDER BY created_at DESC
        ");
    }


    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);


    echo json_encode([
        'success' => true,

        'projects' => array_map(
            function ($p) {

                $p['pm'] =
                    $p['project_manager_id'];

                $p['team'] = [];

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

    $in = json_decode(
        file_get_contents('php://input'),
        true
    ) ?? [];

$name = trim($in['name'] ?? '');
$deadline = $in['deadline'] ?? null;
$clientId = trim($in['client_id'] ?? '');
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
    $producer = $_SESSION['user']['full_name']
        ?? $_SESSION['user']['name']
        ?? '';
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


    /* Logged-in user as project manager */

    $projectManager = $_SESSION['user']['id'] ?? null;


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
            budget
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            'project_manager_id' => $projectManager
        ]
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

/* =========================================================
   UPDATE PROJECT
   ========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {

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


/* =========================================================
   CHECK PRESENT / MISSING ASSET TYPES
   ========================================================= */

$presentTypes = [];

foreach ($assetRows as $asset) {

    if (!empty($asset['asset_type'])) {
        $presentTypes[] =
            $asset['asset_type'];
    }
}

$presentTypes =
    array_values(
        array_unique($presentTypes)
    );

$missingTypes =
    array_values(
        array_diff(
            $requiredAssetTypes,
            $presentTypes
        )
    );


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
   40% = required asset types
   20% = reviewed/resolved assets
   40% = budget usage
   ========================================================= */

$assetTypeProgress =
    (
        count($presentTypes) /
        count($requiredAssetTypes)
    ) * 40;


$reviewProgress = 0;

if ($totalAssets > 0) {

    $reviewProgress =
        (
            $resolvedAssets /
            $totalAssets
        ) * 20;
}


$budgetProgress = 0;

if ($projectBudget > 0) {

    $budgetRatio =
        min(
            1,
            $totalSpent / $projectBudget
        );

    $budgetProgress =
        $budgetRatio * 40;
}


$progress =
    round(
        $assetTypeProgress +
        $reviewProgress +
        $budgetProgress
    );


/* =========================================================
   FINAL COMPLETION RULE
   ========================================================= */

$canFinish =
    count($missingTypes) === 0 &&
    count($pendingAssets) === 0 &&
    $projectBudget > 0 &&
    $totalSpent >= $projectBudget;


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
            implode(', ', $missingTypes);
    }

    if (count($pendingAssets) > 0) {

        $problems[] =
            count($pendingAssets) .
            ' asset(s) still need review or revision.';
    }

    if (
        $projectBudget > 0 &&
        $totalSpent < $projectBudget
    ) {

        $remaining =
            $projectBudget - $totalSpent;

        $problems[] =
            'Budget remaining: PHP ' .
            number_format(
                $remaining,
                2
            );
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