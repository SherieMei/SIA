<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}
header('Content-Type: application/json; charset=utf-8');

try {
    $host = '127.0.0.1';
    $db   = 'Atlas';
    $user = 'root';
    $pass = '';

    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    require_once __DIR__ . '/../includes/api_auth.php';
    $currentUser = api_require_user($pdo);
    api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator', 'client']);
    $assetIds = api_scoped_asset_ids($pdo, $currentUser);
    [$assetScope, $assetParams] = api_asset_scope_sql($assetIds, 'a.id');
    $stmt = $pdo->prepare("
        SELECT a.*
        FROM assets a
        WHERE 1 = 1{$assetScope}
        ORDER BY a.id DESC
    ");
    $stmt->execute($assetParams);

$rawAssets = $stmt->fetchAll();

    // Group asset_versions by asset_id so each asset can carry its own version history —
    // the client always expects `versions` to be an array (see js/shared.js withVersions()).
    [$versionScope, $versionParams] = api_asset_scope_sql($assetIds, 'asset_id');
    $clientVersionFilter = $currentUser['role'] === 'client'
        ? ' AND version_no = (SELECT MAX(latest.version_no) FROM asset_versions latest WHERE latest.asset_id = asset_versions.asset_id)'
        : '';
    $verStmt = $pdo->prepare("
        SELECT *
        FROM asset_versions
        WHERE 1 = 1{$versionScope}{$clientVersionFilter}
        ORDER BY asset_id, version_no ASC
    ");
    $verStmt->execute($versionParams);
    $versionsByAsset = [];
    foreach ($verStmt->fetchAll() as $vRow) {
        $versionsByAsset[$vRow['asset_id']][] = [
            "id"     => $vRow['id'],
            "n"      => (int)$vRow['version_no'],
            "status" => $vRow['status'],
            "by"     => $currentUser['role'] === 'client' ? null : $vRow['uploaded_by'],
            "date"   => $vRow['uploaded_at']
        ];
        if ($currentUser['role'] !== 'client') {
            $versionsByAsset[$vRow['asset_id']][count($versionsByAsset[$vRow['asset_id']]) - 1]['notes'] = $vRow['notes'];
        }
    }

    $assets = [];
    foreach ($rawAssets as $row) {
        $t = $row['asset_title'] ?? $row['title'] ?? '';
        $ty = $row['asset_type'] ?? $row['type'] ?? 'Storyboard';
        $l = $row['external_link'] ?? $row['link'] ?? '';

        $assets[] = [
            "id"            => $row['id'],
            "project_id"    => $row['project_id'] ?? null,
            "project"       => $row['project_id'] ?? null,
            "title"         => $t,
            "asset_title"   => $t,
            "type"          => $ty,
            "asset_type"    => $ty,
            "link"          => $l,
            "external_link" => $l,
            "created_at"    => $row['created_at'] ?? date('Y-m-d H:i:s'),
            "versions"      => $versionsByAsset[$row['id']] ?? []
        ];
    }

    $notificationStmt = $pdo->prepare("
    SELECT 
    id,
    user_id,
    title,
    message AS text,
    type,
    is_read AS `read`,
    created_at AS date
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
");

$notificationStmt->execute([$currentUser['id']]);
$notifications = $notificationStmt->fetchAll();


// =========================================================
// LOAD AUDIT LOGS FROM DATABASE
// =========================================================

$auditRole = $currentUser['role'];
if ($auditRole === 'client') {
    $auditLog = [];
} else {
    $auditWhere = '';
    $auditParams = [];
    if ($auditRole === 'project_manager') {
        $auditWhere = 'WHERE al.project_id IN (SELECT id FROM projects WHERE pm = ?)';
        $auditParams[] = $currentUser['id'];
    } elseif ($auditRole === 'editor' || $auditRole === 'animator') {
        $assignmentColumn = $auditRole === 'editor' ? 'assigned_editor' : 'assigned_animator';
        $auditWhere = "WHERE EXISTS (SELECT 1 FROM assets a WHERE a.project_id = al.project_id AND a.{$assignmentColumn} = ?)";
        $auditParams[] = $currentUser['id'];
    } elseif ($auditRole !== 'admin') {
        api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator', 'client']);
    }

$auditStmt = $pdo->prepare("
    SELECT
        al.id,
        al.action,
        al.entity,
        al.detail,
        al.created_at AS date,
        COALESCE(u.full_name, 'System') AS `by`
    FROM audit_logs al
    LEFT JOIN app_users u
        ON al.user_id = u.id
    {$auditWhere}
    ORDER BY al.created_at ASC, al.id ASC
");
$auditStmt->execute($auditParams);

$auditLog = $auditStmt->fetchAll();
}


// =========================================================
// BOOTSTRAP STATE
// =========================================================

$state = [
    "assets" => $assets,
    "notifications" => $notifications,
    "auditLog" => $auditLog
];

    $state["currentUser"] = $currentUser;

    ob_clean();
    echo json_encode([
        "success" => true,
        "status"  => "success",
        "state"   => $state
    ]);
    exit();

} catch (Exception $e) {
    ob_clean();
    echo json_encode([
        "success" => false,
        "status"  => "error",
        "error"   => $e->getMessage()
    ]);
    exit();
}
?>