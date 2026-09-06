<?php
/**
 * API INTEGRATION COMPONENT
 * ---------------------------------------------------------------
 * Exposes asset/version data as JSON so the Asset/File Submission
 * form (or any external tool) can send data to the production
 * dashboard through an API, as required in section 6 of the brief.
 *
 * GET  /api/assets.php                 -> list recent asset versions
 * GET  /api/assets.php?project_id=1    -> filter by project
 * POST /api/assets.php {status update} -> simulate an external system
 *      pushing a status change (used by the ERP/Production Resource
 *      integration example).
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

if (!current_user()) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $projectId = $_GET['project_id'] ?? null;

    $sql = "SELECT v.id, v.version_no, v.status, v.uploaded_at, a.asset_title, a.asset_type,
                   p.id AS project_id, p.title AS project_title
            FROM asset_versions v
            JOIN assets a ON a.id = v.asset_id
            JOIN scenes s ON s.id = a.scene_id
            JOIN projects p ON p.id = s.project_id";
    $params = [];
    if ($projectId) {
        $sql .= " WHERE p.id = ?";
        $params[] = $projectId;
    }
    $sql .= " ORDER BY v.uploaded_at DESC LIMIT 100";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    log_integration_event('API', 'assets_fetched', json_encode(['project_id' => $projectId]));
    echo json_encode(['data' => $stmt->fetchAll()]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $versionId = (int) ($input['version_id'] ?? 0);
    $status = $input['status'] ?? '';
    $allowed = ['pending','for_review','approved','rejected','revision_requested','final'];

    if (!$versionId || !in_array($status, $allowed, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'version_id and a valid status are required']);
        exit;
    }

    $pdo->prepare("UPDATE asset_versions SET status = ? WHERE id = ?")->execute([$status, $versionId]);
    log_audit('status_update', 'asset_version', $versionId, "Status pushed via API to {$status}");
    log_integration_event('API', 'external_status_update', json_encode(['version_id' => $versionId, 'status' => $status]));

    echo json_encode(['success' => true, 'version_id' => $versionId, 'status' => $status]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
