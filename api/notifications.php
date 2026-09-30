<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';


if (!current_user()) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'error' => 'Not authenticated'
    ]);

    exit;
}


$user = current_user();

$userId = $user['id'];

$action = $_GET['action'] ?? 'list';


/* =========================================================
   UNREAD COUNT
   ========================================================= */

if ($action === 'unread_count') {

    echo json_encode([
        'success' => true,
        'unread' => unread_notification_count($userId)
    ]);

    exit;
}


/* =========================================================
   MARK ONE AS READ
   ========================================================= */

if ($action === 'mark_read') {

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    $notificationId =
        $input['id'] ?? null;


    if (!$notificationId) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Notification ID is required.'
        ]);

        exit;
    }


    $stmt = $pdo->prepare("
        UPDATE notifications

        SET is_read = 1

        WHERE id = ?
        AND user_id = ?
    ");


    $stmt->execute([
        $notificationId,
        $userId
    ]);


    echo json_encode([
        'success' => true
    ]);

    exit;
}


/* =========================================================
   MARK ALL AS READ
   ========================================================= */

if ($action === 'mark_all_read') {

    $stmt = $pdo->prepare("
        UPDATE notifications

        SET is_read = 1

        WHERE user_id = ?
    ");


    $stmt->execute([
        $userId
    ]);


    echo json_encode([
        'success' => true
    ]);

    exit;
}


/* =========================================================
   LIST NOTIFICATIONS
   ========================================================= */

$stmt = $pdo->prepare("
    SELECT
        id,
        user_id,
        title,
        message,
        type,
        is_read,
        created_at

    FROM notifications

    WHERE user_id = ?

    ORDER BY
        created_at DESC,
        id DESC

    LIMIT 50
");


$stmt->execute([
    $userId
]);


$rows =
    $stmt->fetchAll(
        PDO::FETCH_ASSOC
    );


$notifications = [];


foreach ($rows as $row) {

    $notifications[] = [

        'id' =>
            (int)$row['id'],

        'user_id' =>
            $row['user_id'],

        'title' =>
            $row['title'],

        'message' =>
            $row['message'],

        'text' =>
            $row['message'],

        'type' =>
            $row['type'],

        'is_read' =>
            (int)$row['is_read'],

        'read' =>
            (bool)$row['is_read'],

        'created_at' =>
            $row['created_at'],

        'date' =>
            $row['created_at']

    ];
}


echo json_encode(
    [
        'success' => true,
        'data' => $notifications
    ],
    JSON_UNESCAPED_UNICODE
);

exit;

?>