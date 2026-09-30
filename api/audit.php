<?php

ob_start();

ini_set('display_errors', 0);
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');


try {

    $host = '127.0.0.1';
    $db   = 'Atlas';
    $user = 'root';
    $pass = '';

    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );


    /* =========================================================
       CHECK LOGIN
       ========================================================= */

    if (!isset($_SESSION['user'])) {

        ob_clean();

        http_response_code(401);

        echo json_encode([
            'success' => false,
            'error' => 'Not authenticated.'
        ]);

        exit();
    }


    $currentUserId =
        $_SESSION['user']['id'] ?? null;

    $currentRole =
        $_SESSION['user']['role'] ?? 'viewer';


    /* =========================================================
       CLIENT AUDIT LOG
       Only records connected to the client's projects
       ========================================================= */

    if ($currentRole === 'client') {

        $stmt = $pdo->prepare("
            SELECT
                al.id,
                al.user_id,
                al.project_id,
                al.client_id,
                al.action,
                al.entity,
                al.detail,
                al.created_at,
                COALESCE(
                    u.full_name,
                    'System'
                ) AS user_name,
                p.name AS project_name
            FROM audit_logs al

            LEFT JOIN app_users u
                ON u.id = al.user_id

            LEFT JOIN projects p
                ON p.id = al.project_id

            WHERE al.client_id = ?

            ORDER BY
                al.created_at DESC,
                al.id DESC
        ");

        $stmt->execute([
            $currentUserId
        ]);

    }


    /* =========================================================
       ADMIN / PROJECT MANAGER AUDIT LOG
       Can see all records
       ========================================================= */

    elseif (
        $currentRole === 'admin'
        ||
        $currentRole === 'project_manager'
    ) {

        $stmt = $pdo->query("
            SELECT
                al.id,
                al.user_id,
                al.project_id,
                al.client_id,
                al.action,
                al.entity,
                al.detail,
                al.created_at,
                COALESCE(
                    u.full_name,
                    'System'
                ) AS user_name,
                p.name AS project_name
            FROM audit_logs al

            LEFT JOIN app_users u
                ON u.id = al.user_id

            LEFT JOIN projects p
                ON p.id = al.project_id

            ORDER BY
                al.created_at DESC,
                al.id DESC
        ");

    }


    /* =========================================================
       OTHER ROLES
       ========================================================= */

    else {

        ob_clean();

        http_response_code(403);

        echo json_encode([
            'success' => false,
            'error' => 'You do not have permission to view audit logs.'
        ]);

        exit();
    }


    $rows = $stmt->fetchAll();

    $auditLogs = [];


    foreach ($rows as $row) {

        $auditLogs[] = [

            'id' =>
                (int)$row['id'],

            'user_id' =>
                $row['user_id'],

            'project_id' =>
                $row['project_id'],

            'client_id' =>
                $row['client_id'],

            'by' =>
                $row['user_name'],

            'action' =>
                $row['action'],

            'entity' =>
                $row['entity'],

            'detail' =>
                $row['detail'],

            'project_name' =>
                $row['project_name'],

            'date' =>
                $row['created_at']

        ];

    }


    ob_clean();

    echo json_encode(
        [
            'success' => true,
            'auditLogs' => $auditLogs
        ],
        JSON_UNESCAPED_UNICODE
    );

    exit();


} catch (Exception $e) {

    ob_clean();

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' =>
            'Database failure: ' .
            $e->getMessage()
    ]);

    exit();
}

?>