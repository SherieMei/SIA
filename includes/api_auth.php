<?php

function api_authenticated_user(PDO $pdo)
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $userId = $_SESSION['user_id'] ?? ($_SESSION['user']['id'] ?? null);
    if (!$userId) {
        return null;
    }

    $stmt = $pdo->prepare("
        SELECT id, full_name, email, role
        FROM app_users
        WHERE id = ?
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || empty($user['role'])) {
        return null;
    }

    $user['role'] = strtolower(trim($user['role']));
    $user['name'] = $user['full_name'];
    $_SESSION['user'] = $user;
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['name'] = $user['full_name'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role'] = $user['role'];

    return $user;
}

function api_require_user(PDO $pdo)
{
    $user = api_authenticated_user($pdo);
    if ($user) {
        return $user;
    }

    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Not authenticated.'
    ]);
    exit;
}

function api_require_roles(array $user, array $roles)
{
    if (in_array($user['role'] ?? '', $roles, true)) {
        return;
    }

    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'You do not have permission to perform this action.'
    ]);
    exit;
}

function api_scoped_asset_ids(PDO $pdo, array $user)
{
    $role = $user['role'] ?? '';
    $userId = $user['id'] ?? null;

    if ($role === 'admin') {
        return null;
    }

    $assignmentColumn = [
        'editor' => 'a.assigned_editor',
        'animator' => 'a.assigned_animator'
    ][$role] ?? null;

    if ($assignmentColumn) {
        $stmt = $pdo->prepare("
            SELECT DISTINCT a.id
            FROM assets a
            WHERE {$assignmentColumn} = ?
               OR a.project_id IN (
                    SELECT p.id
                    FROM projects p
                    WHERE p." . ($role === 'editor' ? 'artist_id' : 'animator_id') . " = ?
               )
        ");
        $stmt->execute([$userId, $userId]);
    } elseif ($role === 'project_manager') {
        $stmt = $pdo->prepare("
            SELECT a.id
            FROM assets a
            INNER JOIN projects p ON p.id = a.project_id
            WHERE p.pm = ?
        ");
        $stmt->execute([$userId]);
    } elseif ($role === 'client') {
        $stmt = $pdo->prepare("
            SELECT a.id
            FROM assets a
            INNER JOIN projects p ON p.id = a.project_id
            WHERE p.client_id = ?
        ");
        $stmt->execute([$userId]);
    } else {
        return [];
    }

    return array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function api_asset_scope_sql($assetIds, $column = 'a.id')
{
    if ($assetIds === null) {
        return ['', []];
    }
    if (!$assetIds) {
        return [' AND 1 = 0', []];
    }

    return [
        " AND {$column} IN (" . implode(',', array_fill(0, count($assetIds), '?')) . ')',
        $assetIds
    ];
}

function api_can_access_project(PDO $pdo, array $user, $projectId)
{
    if (($user['role'] ?? '') === 'admin') {
        return true;
    }

    $conditions = [
        'project_manager' => 'pm',
        'client' => 'client_id'
    ];

    if (isset($conditions[$user['role'] ?? ''])) {
        $column = $conditions[$user['role']];
        $stmt = $pdo->prepare("SELECT id FROM projects WHERE id = ? AND {$column} = ? LIMIT 1");
        $stmt->execute([$projectId, $user['id']]);
        return (bool)$stmt->fetchColumn();
    }

    $assignmentColumn = [
        'editor' => 'assigned_editor',
        'animator' => 'assigned_animator'
    ][$user['role'] ?? ''] ?? null;
    if (!$assignmentColumn) {
        return false;
    }

    $stmt = $pdo->prepare("
        SELECT p.id
        FROM projects p
        WHERE p.id = ?
          AND p." . ($user['role'] === 'editor' ? 'artist_id' : 'animator_id') . " = ?
        UNION
        SELECT a.id
        FROM assets a
        WHERE a.project_id = ?
          AND a.{$assignmentColumn} = ?
        LIMIT 1
    ");
    $stmt->execute([$projectId, $user['id'], $projectId, $user['id']]);
    return (bool)$stmt->fetchColumn();
}

function api_can_access_asset(PDO $pdo, array $user, $assetId)
{
    $assetIds = api_scoped_asset_ids($pdo, $user);
    return $assetIds === null || in_array((string)$assetId, $assetIds, true);
}
