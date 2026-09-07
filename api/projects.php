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
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['error'=>'Not authenticated']); exit; }
function load_state($pdo){$r=$pdo->query('SELECT state_json FROM app_state WHERE id=1')->fetch();$s=$r?json_decode($r['state_json'],true):[];return is_array($s)?$s:[];}
function save_state($pdo,$s){$s['currentUser']=null;$j=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);$q=$pdo->prepare('INSERT INTO app_state (id,state_json) VALUES (1,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)');$q->execute([$j]);}
if($_SERVER['REQUEST_METHOD']==='GET'){
    $stmt = $pdo->query("
        SELECT
            id,
            name,
            client,
            status,
            deadline,
            budget,
            pm AS project_manager_id
        FROM projects
        ORDER BY created_at DESC
    ");

    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
    'success' => true,
    'projects' => array_map(function($p) {

        $p['pm'] = $p['project_manager_id'];
        $p['team'] = [];

        return $p;

    }, $projects)
], JSON_UNESCAPED_UNICODE);

    exit;
}
if($_SERVER['REQUEST_METHOD']==='POST'){
    $in = json_decode(file_get_contents('php://input'), true) ?? [];

    $name = trim($in['name'] ?? '');
    $client = trim($in['client'] ?? '');
    $deadline = $in['deadline'] ?? null;
    $budget = (float)($in['budget'] ?? 0);

    if(!$name || !$client){
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Project name and client are required.'
        ]);
        exit;
    }

    $stmt = $pdo->query("
        SELECT id
        FROM projects
        ORDER BY CAST(SUBSTRING(id, 2) AS UNSIGNED) DESC
        LIMIT 1
    ");

    $last = $stmt->fetch(PDO::FETCH_ASSOC);

    $nextNumber = 1;

    if($last && preg_match('/^p(\d+)$/', $last['id'], $match)){
        $nextNumber = (int)$match[1] + 1;
    }

    $id = 'p' . $nextNumber;

    $projectManager = $_SESSION['user']['id'] ?? null;

    $stmt = $pdo->prepare("
        INSERT INTO projects
        (id, name, client, status, deadline, pm, budget)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $id,
        $name,
        $client,
        'Pre-Production',
        $deadline ?: null,
        $projectManager,
        $budget
    ]);

    echo json_encode([
        'success' => true,
        'project' => [
            'id' => $id,
            'name' => $name,
            'client' => $client,
            'status' => 'Pre-Production',
            'deadline' => $deadline,
            'budget' => $budget,
            'project_manager_id' => $projectManager
        ]
    ], JSON_UNESCAPED_UNICODE);

    exit;
}
http_response_code(405);echo json_encode(['error'=>'Method not allowed']);
