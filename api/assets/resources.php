<?php
header('Content-Type: application/json; charset=utf-8');
session_start();
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $origin === 'http://127.0.0.1:5501' ||
    $origin === 'http://localhost:5501' ||
    $origin === 'http://localhost'
) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}


try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = atlas_database_connection();
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed.'
    ]);
    exit;
}

require_once __DIR__ . '/../../includes/api_auth.php';
$currentUser = api_require_user($pdo);
$role = $currentUser['role'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator']);

    try {
        if ($role === 'admin') {
            $stmt = $pdo->query("
                SELECT id, project_id, category, description, cost, hours, logged_by, created_at
                FROM resources
                ORDER BY id DESC
            ");
        } else {
            $scope = $role === 'project_manager'
                ? 'p.pm = ?'
                : "EXISTS (SELECT 1 FROM assets a WHERE a.project_id = r.project_id AND a." . ($role === 'editor' ? 'assigned_editor' : 'assigned_animator') . ' = ?)';
            $stmt = $pdo->prepare("
                SELECT r.id, r.project_id, r.category, r.description, r.cost, r.hours, r.logged_by, r.created_at
                FROM resources r
                INNER JOIN projects p ON p.id = r.project_id
                WHERE {$scope}
                ORDER BY r.id DESC
            ");
            $stmt->execute([$currentUser['id']]);
        }

        $resources = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'resources' => $resources
        ]);

    } catch (PDOException $e) {

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to fetch resources.',
            'error' => $e->getMessage()
        ]);
    }

    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $allowedRoles = [
        'admin',
        'project_manager'
    ];

    if (!in_array($role, $allowedRoles, true)) {
        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' => 'You do not have permission to add resources.'
        ]);

        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid request data.'
        ]);

        exit;
    }

    $projectId = trim($input['project_id'] ?? '');
    $category = trim($input['category'] ?? '');
    $description = trim($input['description'] ?? '');
    $cost = (float)($input['cost'] ?? 0);
    $hours = (float)($input['hours'] ?? 0);

    if ($projectId === '' || $category === '' || $description === '') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Project, category, and description are required.'
        ]);

        exit;
    }

$projectStmt = $pdo->prepare("
    SELECT
        id,
        name,
        client_id
    FROM projects
    WHERE id = ?
    LIMIT 1
");

    $projectStmt->execute([
        $projectId
    ]);

    $project = $projectStmt->fetch();
    if (!$project) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Project not found.'
        ]);

        exit;
    }
    if (!api_can_access_project($pdo, $currentUser, $projectId)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'You do not have permission to add resources to this project.'
        ]);
        exit;
    }
$resourceId = 'r' . bin2hex(random_bytes(6));

try {

    // Resource + Audit Log must save together
    $pdo->beginTransaction();


    /* =========================================================
       SAVE RESOURCE
       ========================================================= */

    $stmt = $pdo->prepare("
        INSERT INTO resources (
            id,
            project_id,
            category,
            description,
            cost,
            hours,
            logged_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $resourceId,
        $projectId,
        $category,
        $description,
        $cost,
        $hours,
        $currentUser['id']
    ]);


    /* =========================================================
       SAVE TO AUDIT LOG
       ========================================================= */

    $auditStmt = $pdo->prepare("
        INSERT INTO audit_logs (
            user_id,
            project_id,
            client_id,
            action,
            entity,
            detail
        )
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    $auditDetail =
        'Logged ' .
        $category .
        ' resource for project ' .
        $project['name'] .
        ' - ' .
        $description .
        ' | Cost: PHP ' .
        number_format($cost, 2) .
        ' | Hours: ' .
        number_format($hours, 2);


    $auditStmt->execute([
        $currentUser['id'],
        $projectId,
        $project['client_id'],
        'Created',
        'Resource',
        $auditDetail
    ]);


    // Both inserts succeeded
    $pdo->commit();


    echo json_encode([
        'success' => true,
        'message' => 'Resource entry saved.',
        'resource' => [
            'id' => $resourceId,
            'project_id' => $projectId,
            'category' => $category,
            'description' => $description,
            'cost' => $cost,
            'hours' => $hours,
            'logged_by' => $currentUser['id']
        ]
    ]);


} catch (PDOException $e) {

    // If either Resource OR Audit Log fails,
    // cancel both inserts.
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Failed to save resource.',
        'error' => $e->getMessage()
    ]);
}

exit;
}

http_response_code(405);

echo json_encode([
    'success' => false,
    'message' => 'Method not allowed.'
]);