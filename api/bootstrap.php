<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);
if (session_status() === PHP_SESSION_NONE) session_start();

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

    if (isset($_SESSION['user']) && $_SESSION['user']['role'] === 'client') {
    $stmt = $pdo->prepare("
        SELECT a.*
        FROM assets a
        INNER JOIN projects p ON a.project_id = p.id
        WHERE p.client_id = ?
        ORDER BY a.id DESC
    ");
    $stmt->execute([$_SESSION['user']['id']]);
} else {
    $stmt = $pdo->query("SELECT * FROM assets ORDER BY id DESC");
}

$rawAssets = $stmt->fetchAll();

    // Group asset_versions by asset_id so each asset can carry its own version history —
    // the client always expects `versions` to be an array (see js/shared.js withVersions()).
    $verStmt = $pdo->query("SELECT * FROM asset_versions ORDER BY asset_id, version_no ASC");
    $versionsByAsset = [];
    foreach ($verStmt->fetchAll() as $vRow) {
        $versionsByAsset[$vRow['asset_id']][] = [
            "id"     => $vRow['id'],
            "n"      => (int)$vRow['version_no'],
            "status" => $vRow['status'],
            "notes"  => $vRow['notes'],
            "by"     => $vRow['uploaded_by'],
            "date"   => $vRow['uploaded_at']
        ];
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
    is_read AS read,
    created_at AS date
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    ");

$notificationStmt->execute([$_SESSION['user']['id'] ?? null]);
$notifications = $notificationStmt->fetchAll();

    $state = [
    "assets" => $assets,
    "notifications" => $notifications
];

if (isset($_SESSION['user'])) {
    $state["currentUser"] = $_SESSION['user'];
}

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