<?php
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


/* =========================================================
   GET PROJECTS
   ========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    if ($_SESSION['user']['role'] === 'client') {

        // Client can ONLY see projects assigned to their account
        $stmt = $pdo->prepare("
            SELECT
                id,
                name,
                client,
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

        // Admin / Producer / Project Manager can see all projects
        $stmt = $pdo->query("
            SELECT
                id,
                name,
                client,
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
    /* =========================================================
   AUTO UPDATE COMPLETED PROJECTS
   ========================================================= */

foreach ($projects as $p) {

    $checkStmt = $pdo->prepare("
        SELECT
            COUNT(*) AS total_assets,
            SUM(
                CASE
                    WHEN av.status IN ('Approved', 'Final')
                    THEN 1
                    ELSE 0
                END
            ) AS completed_assets
        FROM assets a
        LEFT JOIN asset_versions av
            ON av.asset_id = a.id
            AND av.version_no = (
                SELECT MAX(version_no)
                FROM asset_versions
                WHERE asset_id = a.id
            )
        WHERE a.project_id = ?
    ");

    $checkStmt->execute([$p['id']]);
    $check = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (
        $check &&
        $check['total_assets'] > 0 &&
        $check['total_assets'] == $check['completed_assets'] &&
        $p['status'] !== 'Completed'
    ) {

        $updateStmt = $pdo->prepare("
            UPDATE projects
            SET status = 'Completed'
            WHERE id = ?
        ");

        $updateStmt->execute([$p['id']]);

    }
}

    echo json_encode([
        'success' => true,
        'projects' => array_map(function ($p) {

            $p['pm'] = $p['project_manager_id'];
            $p['team'] = [];

            return $p;

        }, $projects)

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
    $client = trim($in['client'] ?? '');
    $deadline = $in['deadline'] ?? null;
    $clientId = $in['client_id'] ?? null;
    $budget = (float)($in['budget'] ?? 0);

    // Logged-in user becomes the producer
    $producer = $_SESSION['user']['full_name']
        ?? $_SESSION['user']['name']
        ?? '';

    if (!$name || !$client) {

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
    "Created project {$id} - {$name}"
    );


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
            "Marked project {$id} as Completed"
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

    createAuditLog(
        $pdo,
        'Updated',
        'Project',
        "Updated project {$id} - {$name}"
    );

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