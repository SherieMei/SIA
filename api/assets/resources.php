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

$host = '127.0.0.1';
$db   = 'Atlas';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed.'
    ]);
    exit;
}

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated.'
    ]);
    exit;
}

$currentUser = $_SESSION['user'];
$role = $currentUser['role'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {
        if ($role === 'client') {

            $stmt = $pdo->prepare("
                SELECT
                    r.id,
                    r.project_id,
                    r.category,
                    r.description,
                    r.cost,
                    r.hours,
                    r.logged_by,
                    r.created_at
                FROM resources r
                INNER JOIN projects p
                    ON r.project_id = p.id
                WHERE p.client_id = ?
                ORDER BY r.id DESC
            ");

            $stmt->execute([
                $currentUser['id']
            ]);

        } else {

            $stmt = $pdo->query("
                SELECT
                    id,
                    project_id,
                    category,
                    description,
                    cost,
                    hours,
                    logged_by,
                    created_at
                FROM resources
                ORDER BY id DESC
            ");
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
        SELECT id, name
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

    $resourceId = 'r' . bin2hex(random_bytes(6));
    try {

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