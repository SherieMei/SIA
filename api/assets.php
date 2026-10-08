<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

function store_asset_upload(array $upload): array
{
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return ['path' => null, 'error' => null];
    }
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_INI_SIZE) {
        return ['path' => null, 'error' => 'Files must be ' . ini_get('upload_max_filesize') . ' or smaller.'];
    }
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['path' => null, 'error' => 'The file could not be uploaded. Please try again.'];
    }
    if (($upload['size'] ?? 0) > 100 * 1024 * 1024) {
        return ['path' => null, 'error' => 'Files must be 100 MB or smaller.'];
    }
    if (!isset($upload['tmp_name']) || !is_uploaded_file($upload['tmp_name'])) {
        return ['path' => null, 'error' => 'The uploaded file is invalid.'];
    }

    $allowedTypes = [
        'avif' => ['image/avif'],
        'gif' => ['image/gif'],
        'jpeg' => ['image/jpeg'],
        'jpg' => ['image/jpeg'],
        'png' => ['image/png'],
        'webp' => ['image/webp'],
        'mp4' => ['video/mp4'],
        'mov' => ['video/quicktime'],
        'ogv' => ['video/ogg'],
        'ogg' => ['video/ogg', 'audio/ogg', 'application/ogg'],
        'webm' => ['video/webm', 'audio/webm'],
        'mp3' => ['audio/mpeg'],
        'wav' => ['audio/wav', 'audio/x-wav'],
        'm4a' => ['audio/mp4', 'audio/x-m4a'],
        'aac' => ['audio/aac'],
        'flac' => ['audio/flac', 'audio/x-flac'],
        'oga' => ['audio/ogg', 'application/ogg'],
        'json' => ['application/json', 'text/plain'],
        'pdf' => ['application/pdf'],
        'doc' => ['application/msword', 'application/x-ole-storage'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'rtf' => ['application/rtf', 'text/rtf'],
        'odt' => ['application/vnd.oasis.opendocument.text', 'application/zip'],
        'txt' => ['text/plain'],
        'csv' => ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
        'tsv' => ['text/tab-separated-values', 'text/plain'],
        'xls' => ['application/vnd.ms-excel', 'application/x-ole-storage'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
        'ods' => ['application/vnd.oasis.opendocument.spreadsheet', 'application/zip'],
        'ppt' => ['application/vnd.ms-powerpoint', 'application/x-ole-storage'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
        'odp' => ['application/vnd.oasis.opendocument.presentation', 'application/zip']
    ];
    $extension = strtolower(pathinfo((string)($upload['name'] ?? ''), PATHINFO_EXTENSION));
    if (!isset($allowedTypes[$extension])) {
        return ['path' => null, 'error' => 'Choose a supported image, video, audio, PDF, Office, OpenDocument, JSON, or text file.'];
    }

    $fileInfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $fileInfo->file($upload['tmp_name']);
    if (
        !in_array($mimeType, $allowedTypes[$extension], true)
    ) {
        return ['path' => null, 'error' => 'The selected file type does not match its contents.'];
    }
    if ($extension === 'json') {
        $json = file_get_contents($upload['tmp_name']);
        if ($json === false || json_decode($json) === null && json_last_error() !== JSON_ERROR_NONE) {
            return ['path' => null, 'error' => 'The selected JSON file is not valid JSON.'];
        }
    }

    $uploadDirectory = __DIR__ . '/../uploads/assets';
    if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
        return ['path' => null, 'error' => 'The upload folder is unavailable.'];
    }
    try {
        $fileName = bin2hex(random_bytes(16)) . '.' . $extension;
    } catch (Throwable $error) {
        error_log('Asset upload filename generation failed: ' . $error->getMessage());
        return ['path' => null, 'error' => 'Could not prepare the uploaded file.'];
    }

    if (!move_uploaded_file($upload['tmp_name'], $uploadDirectory . '/' . $fileName)) {
        error_log('Could not move uploaded asset into: ' . $uploadDirectory);
        return ['path' => null, 'error' => 'The server could not save the uploaded file. Check write access for uploads/assets.'];
    }

    return [
        'path' => api_app_base_path() . '/uploads/assets/' . $fileName,
        'error' => null
    ];
}

function sync_animation_shot_workflow(PDO $pdo, $assetId, string $status, $userId): void
{
    $assetStmt = $pdo->prepare("
        SELECT asset_type
        FROM assets
        WHERE id = ?
        LIMIT 1
    ");
    $assetStmt->execute([$assetId]);
    if ($assetStmt->fetchColumn() !== 'Animation Scene') {
        return;
    }

    $workflowStmt = $pdo->prepare("
        INSERT INTO animation_shot_workflow
            (asset_id, workflow_status, task_notes, updated_by)
        VALUES (?, ?, '', ?)
        ON DUPLICATE KEY UPDATE
            workflow_status = VALUES(workflow_status),
            updated_by = VALUES(updated_by)
    ");
    $workflowStmt->execute([$assetId, $status, $userId]);
}

function update_animation_shot_workflow(PDO $pdo, $assetId, string $status, $userId): void
{
    $workflowStmt = $pdo->prepare("
        UPDATE animation_shot_workflow w
        INNER JOIN assets a ON a.id = w.asset_id
        SET w.workflow_status = ?, w.updated_by = ?
        WHERE w.asset_id = ? AND a.asset_type = 'Animation Scene'
    ");
    $workflowStmt->execute([$status, $userId, $assetId]);
}

try {


    require_once __DIR__ . '/../config/database.php';
    $pdo = atlas_database_connection();

    require_once __DIR__ . '/../includes/api_auth.php';
    $currentUser = api_require_user($pdo);
    $method = $_SERVER['REQUEST_METHOD'];


    /* =========================================================
       CREATE REVIEW NOTIFICATIONS
       ========================================================= */

    function createReviewNotifications($pdo, $assetTitle, $versionNo)
    {
        try {

            $stmt = $pdo->query("
                SELECT id
                FROM app_users
                WHERE role IN ('admin', 'project_manager')
            ");

            $users = $stmt->fetchAll();

            $notify = $pdo->prepare("
                INSERT INTO notifications
                (user_id, title, message, type, is_read)
                VALUES (?, ?, ?, ?, 0)
            ");

            foreach ($users as $user) {

                $notify->execute([
                    $user['id'],
                    'New Asset for Review',
                    "A new version (V{$versionNo}) of '{$assetTitle}' is waiting for review.",
                    'asset_review'
                ]);

            }

        } catch (Exception $e) {
            // Notification failure should not stop asset creation.
        }
    }


    /* =========================================================
       CREATE AUDIT LOG
       ========================================================= */

function createAuditLog(
    $pdo,
    $action,
    $entity = null,
    $details = null,
    $projectId = null,
    $clientId = null
)
{
    try {

        $userId = $_SESSION['user']['id'] ?? null;

        if ($projectId && !$clientId) {

            $projectStmt = $pdo->prepare("
                SELECT client_id
                FROM projects
                WHERE id = ?
                LIMIT 1
            ");

            $projectStmt->execute([
                $projectId
            ]);

            $projectRow = $projectStmt->fetch(PDO::FETCH_ASSOC);

            $clientId = $projectRow['client_id'] ?? null;
        }

        $stmt = $pdo->prepare("
            INSERT INTO audit_logs
            (
                user_id,
                project_id,
                client_id,
                action,
                entity,
                detail
            )
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $userId,
            $projectId,
            $clientId,
            $action,
            $entity,
            $details
        ]);

    } catch (Exception $e) {
        // Audit failure should not stop the main operation.
    }
}
function getAssetProjectInfo($pdo, $assetId)
{
    try {

        $stmt = $pdo->prepare("
            SELECT
                a.project_id,
                a.asset_title,
                a.external_link,
                p.client_id,
                p.name AS project_name
            FROM assets a
            LEFT JOIN projects p
                ON p.id = a.project_id
            WHERE a.id = ?
            LIMIT 1
        ");

        $stmt->execute([
            $assetId
        ]);

        return $stmt->fetch(PDO::FETCH_ASSOC);

    } catch (Exception $e) {

        return false;
    }
}

    /* =========================================================
       RETURN CURRENT ASSET STATE
       ========================================================= */
/* =========================================================
   CREATE USER NOTIFICATION
   ========================================================= */

function createUserNotification(
    $pdo,
    $userId,
    $title,
    $message,
    $type = 'general'
)
{
    if (!$userId) {
        return;
    }

    try {

        $stmt = $pdo->prepare("
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                type,
                is_read
            )
            VALUES (?, ?, ?, ?, 0)
        ");

        $stmt->execute([
            $userId,
            $title,
            $message,
            $type
        ]);

    } catch (Exception $e) {

        error_log(
            'Notification error: ' .
            $e->getMessage()
        );
    }
}


/* =========================================================
   NOTIFY ADMIN / PROJECT MANAGER
   ========================================================= */

function notifyManagement(
    $pdo,
    $title,
    $message,
    $type = 'general'
)
{
    try {

        $currentUserId =
            $_SESSION['user']['id'] ?? null;

        $stmt = $pdo->query("
            SELECT id
            FROM app_users
            WHERE role IN (
                'admin',
                'project_manager'
            )
        ");

        $users =
            $stmt->fetchAll(
                PDO::FETCH_ASSOC
            );

        foreach ($users as $user) {

            if (
                $currentUserId &&
                (string)$user['id'] === (string)$currentUserId
            ) {
                continue;
            }

            createUserNotification(
                $pdo,
                $user['id'],
                $title,
                $message,
                $type
            );
        }

    } catch (Exception $e) {

        error_log(
            'Management notification error: ' .
            $e->getMessage()
        );
    }
}
    function respondWithState($pdo, $extraData = [])
    {
        global $currentUser;

        $assetIds = api_scoped_asset_ids($pdo, $currentUser);
        [$assetScope, $assetParams] = api_asset_scope_sql($assetIds);
        $stmt = $pdo->prepare("
            SELECT a.*
            FROM assets a
            WHERE 1 = 1{$assetScope}
            ORDER BY a.id DESC
        ");
        $stmt->execute($assetParams);

        $rawAssets = $stmt->fetchAll();

        $commentsByAsset = [];
        $assetIdsById = array_fill_keys(
            array_map('strval', array_column($rawAssets, 'id')),
            true
        );
        $projectIds = array_values(array_unique(array_filter(
            array_column($rawAssets, 'project_id'),
            static fn($projectId) => $projectId !== null && $projectId !== ''
        )));
        if ($projectIds) {
            $projectPlaceholders = implode(',', array_fill(0, count($projectIds), '?'));
            $commentParams = $projectIds;
            $clientCommentFilter = $currentUser['role'] === 'client'
                ? " AND LOWER(u.role) = 'client' AND al.client_id = ?"
                : '';
            if ($currentUser['role'] === 'client') {
                $commentParams[] = $currentUser['id'];
            }
            $commentStmt = $pdo->prepare("
                SELECT
                    al.id,
                    al.user_id,
                    al.entity,
                    al.detail,
                    al.created_at,
                    u.full_name,
                    u.role
                FROM audit_logs al
                LEFT JOIN app_users u ON u.id = al.user_id
                WHERE al.action = 'Comment'
                  AND al.project_id IN ({$projectPlaceholders})
                  AND al.entity LIKE 'Asset #%'
                  {$clientCommentFilter}
                ORDER BY al.created_at ASC, al.id ASC
            ");
            $commentStmt->execute($commentParams);
            foreach ($commentStmt->fetchAll() as $commentRow) {
                if (!preg_match('/^Asset #(\d+)$/', (string)$commentRow['entity'], $matches)) {
                    continue;
                }
                $commentAssetId = $matches[1];
                if (!isset($assetIdsById[$commentAssetId])) {
                    continue;
                }
                $commentsByAsset[$commentAssetId][] = [
                    'id' => (string)$commentRow['id'],
                    'by' => $commentRow['user_id'],
                    'name' => $commentRow['full_name'] ?? 'Studio member',
                    'role' => strtolower((string)($commentRow['role'] ?? '')),
                    'text' => $commentRow['detail'],
                    'date' => $commentRow['created_at']
                ];
            }
        }

        /* =====================================================
           GET ASSET VERSIONS
           ===================================================== */

        [$versionScope, $versionParams] = api_asset_scope_sql($assetIds, 'asset_id');
        $verStmt = $pdo->prepare("
            SELECT *
            FROM asset_versions
            WHERE 1 = 1{$versionScope}
            ORDER BY asset_id, version_number ASC
        ");
        $verStmt->execute($versionParams);

        $versionsByAsset = [];
        $versionSubmitters = [];
        if ($projectIds) {
            $projectPlaceholders = implode(',', array_fill(0, count($projectIds), '?'));
            $submitterStmt = $pdo->prepare("
                SELECT al.detail, al.entity, al.user_id, u.full_name
                FROM audit_logs al
                LEFT JOIN app_users u ON u.id = al.user_id
                WHERE al.action = 'Created'
                  AND al.entity IN ('Asset', 'Asset Version')
                  AND al.project_id IN ({$projectPlaceholders})
                ORDER BY al.id ASC
            ");
            $submitterStmt->execute($projectIds);
            foreach ($submitterStmt->fetchAll() as $submitterRow) {
                $versionKey = null;
                if (
                    $submitterRow['entity'] === 'Asset' &&
                    preg_match('/^Created asset (\d+) - /', (string)$submitterRow['detail'], $matches)
                ) {
                    $versionKey = $matches[1] . ':1';
                } elseif (
                    $submitterRow['entity'] === 'Asset Version' &&
                    preg_match('/^Created V(\d+) for asset (\d+)$/', (string)$submitterRow['detail'], $matches)
                ) {
                    $versionKey = $matches[2] . ':' . $matches[1];
                }
                if ($versionKey !== null) {
                    $versionSubmitters[$versionKey] = [
                        'id' => $submitterRow['user_id'],
                        'name' => $submitterRow['full_name']
                    ];
                }
            }
        }


        foreach ($verStmt->fetchAll() as $vRow) {
            $submitter = $versionSubmitters[$vRow['asset_id'] . ':' . $vRow['version_number']] ?? null;

            $version = [

                "id" => (int)$vRow['id'],

                "n" => (int)$vRow['version_number'],

                "status" => $vRow['status'],

                "by" => $submitter['id'] ?? null,

                "submitted_by" => $submitter['name'] ?? null,

                "date" => $vRow['created_at']
            ];
            if ($currentUser['role'] !== 'client') {
                $version['notes'] = $vRow['notes'];
            }
            $version['media_url'] = $vRow['version_media_url'] ?? '';
            $version['review_feedback'] = $vRow['review_feedback'] ?? '';
            $versionsByAsset[$vRow['asset_id']][] = $version;
        }


        /* =====================================================
           FORMAT ASSETS FOR FRONTEND
           ===================================================== */

        $assets = [];


        foreach ($rawAssets as $row) {

            $t = $row['asset_title'] ?? '';

            $ty = $row['asset_type'] ?? 'Storyboard';

            $l = $row['external_link'] ?? '';


            $assets[] = [

                "id" => (int)$row['id'],

                "project_id" => $row['project_id'] ?? null,

                "project" => $row['project_id'] ?? null,

                "title" => $t,

                "asset_title" => $t,

                "type" => $ty,

                "asset_type" => $ty,

                "link" => $l,

                "external_link" => $l,

                "preview_url" => $row['preview_url'] ?? null,

                "thumbnail" => $row['thumbnail'] ?? null,

                "file_path" => $row['file_path'] ?? null,

                "created_at" => $row['created_at'] ?? null,

                "due_date" => $row['due_date'] ?? null,

                "versions" => $versionsByAsset[$row['id']] ?? [],

                "comments" => $commentsByAsset[(string)$row['id']] ?? []
            ];
        }


        /* =====================================================
           RESPONSE
           ===================================================== */

        $payload = array_merge(

            [

                "success" => true,

                "status" => "success",

                "state" => [

                    "assets" => $assets,

                    "currentUser" => [

                        "id" => $currentUser['id'],

                        "name" => $currentUser['full_name'],
                        "email" => $currentUser['email'],
                        "role" => $currentUser['role']
                    ]
                ]
            ],

            $extraData
        );


        ob_clean();

        echo json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE
        );

        exit();
    }


    /* =========================================================
       GET
       ========================================================= */

    if (
    $method === 'GET' &&
    ($_GET['action'] ?? '') === 'trash_assets'
) {

    api_require_roles(
        $currentUser,
        ['admin', 'project_manager']
    );

    $stmt = $pdo->query("
        SELECT
            id,
            item_type,
            item_id,
            item_data,
            deleted_at,
            deleted_by
        FROM app_trash
        WHERE item_type = 'asset'
        ORDER BY deleted_at DESC
    ");

    $assets = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

        $assetData = json_decode(
            $row['item_data'],
            true
        );

        if (!is_array($assetData)) {
            continue;
        }

        $assets[] = [
            'trash_id'   => $row['id'],
            'item_id'    => $row['item_id'],
            'deleted_at' => $row['deleted_at'],
            'deleted_by' => $row['deleted_by'],
            'asset'      => $assetData
        ];
    }

    echo json_encode([
        'success' => true,
        'assets' => $assets
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

if ($method === 'GET') {

    respondWithState($pdo);
}

    /* =========================================================
       POST
       ========================================================= */

    if ($method === 'POST') {

        $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
        $input = str_starts_with($contentType, 'multipart/form-data')
            ? $_POST
            : json_decode(file_get_contents('php://input'), true);


        if (!$input) {

            ob_clean();

            if (
                str_starts_with($contentType, 'multipart/form-data') &&
                ($_FILES['asset_file']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_INI_SIZE
            ) {
                http_response_code(413);
                echo json_encode([
                    'success' => false,
                    'error' => 'The selected file exceeds PHP upload_max_filesize (' . ini_get('upload_max_filesize') . ').'
                ]);
                exit();
            }

            $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
            $postMaxSize = trim((string)ini_get('post_max_size'));
            $postMaxUnit = strtolower(substr($postMaxSize, -1));
            $postMaxBytes = (float)$postMaxSize * match ($postMaxUnit) {
                'g' => 1024 ** 3,
                'm' => 1024 ** 2,
                'k' => 1024,
                default => 1
            };

            if (
                str_starts_with($contentType, 'multipart/form-data') &&
                $contentLength > 0 &&
                $postMaxBytes > 0 &&
                $contentLength > $postMaxBytes
            ) {
                http_response_code(413);
                echo json_encode([
                    'success' => false,
                    'error' => 'The upload exceeds the server request limit of ' . $postMaxSize . '. Choose a smaller file or increase PHP post_max_size.'
                ]);
                exit();
            }

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "error" => str_starts_with($contentType, 'multipart/form-data')
                    ? 'The upload form data could not be read. Check PHP upload limits and try again.'
                    : 'No JSON payload received.'
            ]);

            exit();
        }

        $action = $input['action'] ?? '';
        if ($action === 'comment') {
            api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator', 'client']);
        } elseif ($action === 'update_status') {
            api_require_roles($currentUser, ['client']);
        } elseif ($action === 'version') {
            api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator']);
        } elseif ($action === 'delete_asset' || $action === 'recover_asset') {
            api_require_roles($currentUser, ['admin', 'project_manager']);
        } elseif ($action !== '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Unknown asset action.'
            ]);
            exit;
        } else {
            api_require_roles($currentUser, ['admin', 'project_manager', 'editor', 'animator']);
        }

        if ($action === 'comment') {
            $assetId = $input['asset_id'] ?? null;
            $commentText = trim((string)($input['comment'] ?? ''));
            if (!$assetId || $commentText === '' || strlen($commentText) > 10000) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Asset ID and feedback (up to 10,000 bytes) are required.'
                ]);
                exit;
            }
            if (!api_can_access_asset($pdo, $currentUser, $assetId)) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => 'You do not have permission to comment on this asset.'
                ]);
                exit;
            }
            $assetInfoStmt = $pdo->prepare("
                SELECT a.asset_title, a.project_id, p.client_id
                FROM assets a
                INNER JOIN projects p ON p.id = a.project_id
                WHERE a.id = ?
                LIMIT 1
            ");
            $assetInfoStmt->execute([$assetId]);
            $assetInfo = $assetInfoStmt->fetch();
            if (!$assetInfo) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'error' => 'Asset not found.'
                ]);
                exit;
            }
            $insertCommentStmt = $pdo->prepare("
                INSERT INTO audit_logs
                    (user_id, project_id, client_id, action, entity, detail)
                VALUES (?, ?, ?, 'Comment', ?, ?)
            ");
            $insertCommentStmt->execute([
                $currentUser['id'],
                $assetInfo['project_id'],
                $assetInfo['client_id'],
                'Asset #' . $assetId,
                $commentText
            ]);
            $comment = [
                'id' => (string)$pdo->lastInsertId(),
                'by' => $currentUser['id'],
                'name' => $currentUser['full_name'],
                'role' => $currentUser['role'],
                'text' => $commentText,
                'date' => date('Y-m-d H:i:s')
            ];
            echo json_encode([
                'success' => true,
                'comment' => $comment
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $rawProject =
            $input['project_id']
            ?? $input['projectId']
            ?? $input['project']
            ?? null;


        $title = trim(
            $input['title']
            ?? $input['asset_title']
            ?? ''
        );


        $type =
            $input['type']
            ?? $input['asset_type']
            ?? 'Storyboard';

        $sequenceId = $input['sequence_id'] ?? null;
        $assignedEditorForSequence = null;
        if (!empty($sequenceId) && $currentUser['role'] === 'editor') {
            $assignedEditorForSequence = $currentUser['id'];
        }
        $assignedAnimatorForShot = null;
        if ($currentUser['role'] === 'animator' && $type === 'Animation Scene') {
            $assignedAnimatorForShot = $currentUser['id'];
        }


        $link =
            $input['link']
            ?? $input['external_link']
            ?? '';


        $notes =
            $input['notes']
            ?? '';

        $dueDate =
            $input['due_date']
            ?? null;

                /* =====================================================
           DELETE ASSET
           ===================================================== */

        if (($input['action'] ?? '') === 'delete_asset') {

            $assetId = $input['asset_id'] ?? null;

            if (!$assetId) {
                http_response_code(400);

                echo json_encode([
                    'success' => false,
                    'error' => 'Asset ID is required.'
                ]);

                exit;
            }

            if (!api_can_access_asset($pdo, $currentUser, $assetId)) {
                http_response_code(403);

                echo json_encode([
                    'success' => false,
                    'error' => 'You do not have permission to delete this asset.'
                ]);

                exit;
            }

            $assetStmt = $pdo->prepare("
                SELECT *
                FROM assets
                WHERE id = ?
                LIMIT 1
            ");

            $assetStmt->execute([
                $assetId
            ]);

            $asset = $assetStmt->fetch(PDO::FETCH_ASSOC);

            if (!$asset) {
                http_response_code(404);

                echo json_encode([
                    'success' => false,
                    'error' => 'Asset not found.'
                ]);

                exit;
            }

            try {

                $pdo->beginTransaction();

                $trashStmt = $pdo->prepare("
                    INSERT INTO app_trash
                    (
                        item_type,
                        item_id,
                        item_data,
                        deleted_by
                    )
                    VALUES (?, ?, ?, ?)
                ");

                $trashStmt->execute([
                    'asset',
                    $asset['id'],
                    json_encode(
                        $asset,
                        JSON_UNESCAPED_UNICODE
                    ),
                    $currentUser['id'] ?? null
                ]);

                $deleteStmt = $pdo->prepare("
                    DELETE FROM assets
                    WHERE id = ?
                ");

                $deleteStmt->execute([
                    $assetId
                ]);

                createAuditLog(
                    $pdo,
                    'Deleted',
                    'Asset',
                    "Moved asset {$assetId} - {$asset['asset_title']} to Trash",
                    $asset['project_id'] ?? null
                );

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'message' => 'Asset moved to Trash.'
                ], JSON_UNESCAPED_UNICODE);

                exit;

            } catch (Throwable $e) {

                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }

                error_log(
                    'Delete asset error: ' .
                    $e->getMessage()
                );

                http_response_code(500);

                echo json_encode([
                    'success' => false,
                    'error' => 'Unable to delete asset.',
                    'message' => $e->getMessage()
                ]);

                exit;
            }
        }

        /* =====================================================
   RECOVER ASSET
   ===================================================== */

if (($input['action'] ?? '') === 'recover_asset') {

    $trashId = $input['trash_id'] ?? null;

    if (!$trashId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Trash ID is required.'
        ]);
        exit;
    }

    try {

        $trashStmt = $pdo->prepare("
            SELECT *
            FROM app_trash
            WHERE id = ?
              AND item_type = 'asset'
            LIMIT 1
        ");

        $trashStmt->execute([$trashId]);

        $trash = $trashStmt->fetch(PDO::FETCH_ASSOC);

        if (!$trash) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Deleted asset not found.'
            ]);
            exit;
        }

        $asset = json_decode(
            $trash['item_data'],
            true
        );

        if (!is_array($asset)) {
            throw new Exception(
                'Invalid asset data in Trash.'
            );
        }

        $pdo->beginTransaction();

        $restoreStmt = $pdo->prepare("
            INSERT INTO assets
            (
                id,
                project_id,
                asset_title,
                asset_type,
                assigned_to,
                assigned_editor,
                assigned_animator,
                due_date,
                external_link,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $restoreStmt->execute([
            $asset['id'],
            $asset['project_id'] ?? null,
            $asset['asset_title'] ?? null,
            $asset['asset_type'] ?? null,
            $asset['assigned_to'] ?? null,
            $asset['assigned_editor'] ?? null,
            $asset['assigned_animator'] ?? null,
            $asset['due_date'] ?? null,
            $asset['external_link'] ?? null,
            $asset['created_at'] ?? null
        ]);

        $deleteTrashStmt = $pdo->prepare("
            DELETE FROM app_trash
            WHERE id = ?
              AND item_type = 'asset'
        ");

        $deleteTrashStmt->execute([
            $trashId
        ]);

        createAuditLog(
            $pdo,
            'Recovered',
            'Asset',
            "Recovered asset {$asset['id']} - {$asset['asset_title']}",
            $asset['project_id'] ?? null
        );

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Asset recovered successfully.'
        ], JSON_UNESCAPED_UNICODE);

        exit;

    } catch (Throwable $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log(
            'Recover asset error: ' .
            $e->getMessage()
        );

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'error' => 'Unable to recover asset.',
            'message' => $e->getMessage()
        ]);

        exit;
    }
}


        /* =====================================================
           UPDATE STATUS
           ===================================================== */

        if (($input['action'] ?? '') === 'update_status') {

            $assetId =
                $input['asset_id']
                ?? null;


            $status =
                $input['status']
                ?? null;

            if (!in_array($status, ['For Review', 'Approved', 'Revision Requested', 'Rejected', 'Final'], true)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Invalid asset status.'
                ]);
                exit;
            }

            if (!$assetId || !$status) {

                ob_clean();

                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "error" => "Asset ID and status are required."
                ]);

                exit();
            }
            $reviewFeedbackValue=$input['comment']??'';
            if(!is_string($reviewFeedbackValue)){
                http_response_code(400);
                echo json_encode([
                    'success'=>false,
                    'error'=>'Review feedback must be text.'
                ]);
                exit;
            }
            $reviewFeedback=trim($reviewFeedbackValue);
            if(strlen($reviewFeedback)>10000){
                http_response_code(400);
                echo json_encode([
                    'success'=>false,
                    'error'=>'Review feedback must be 10,000 bytes or less.'
                ]);
                exit;
            }
            if ($currentUser['role'] === 'client') {
                $latestClientStatusStmt = $pdo->prepare("
                    SELECT status
                    FROM asset_versions
                    WHERE asset_id = ?
                    ORDER BY version_number DESC
                    LIMIT 1
                ");
                $latestClientStatusStmt->execute([$assetId]);
                $latestClientStatus = $latestClientStatusStmt->fetchColumn();
                if (
                    !in_array($status, ['Approved', 'Revision Requested', 'Rejected'], true) ||
                    $latestClientStatus !== 'For Review' ||
                    !api_can_access_asset($pdo, $currentUser, $assetId)
                ) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'error' => 'You may only decide once on the latest version awaiting review assigned to your account.'
                    ]);
                    exit;
                }
            }


            /*
             * Update the newest version of this asset.
             */

            $stmt = $pdo->prepare("
                UPDATE asset_versions
                SET status = ?, review_feedback = ?
                WHERE asset_id = ?
                AND version_number = (
                    SELECT max_version
                    FROM (
                        SELECT MAX(version_number) AS max_version
                        FROM asset_versions
                        WHERE asset_id = ?
                    ) AS latest
                )
            ");


            $stmt->execute([
                $status,
                $reviewFeedback,
                $assetId,
                $assetId
            ]);
            update_animation_shot_workflow(
                $pdo,
                $assetId,
                in_array($status, ['Approved', 'Final'], true)
                    ? 'Completed'
                    : 'Revision Required',
                $currentUser['id']
            );


           $assetInfo =
    getAssetProjectInfo(
        $pdo,
        $assetId
    );

$actionName =
    $status === 'Approved'
    || $status === 'Final'
        ? 'Approved'
        : (
            $status === 'Revision Requested'
                ? 'Revision Requested'
                : 'Updated'
        );

createAuditLog(
    $pdo,
    $actionName,
    'Asset Version',
    "{$status} for asset {$assetId}",
    $assetInfo['project_id'] ?? null,
    $assetInfo['client_id'] ?? null
);
$actorName =
    $_SESSION['user']['full_name']
    ?? $_SESSION['user']['name']
    ?? 'A user';

$assetTitle =
    $assetInfo['asset_title']
    ?? "Asset {$assetId}";

if (
    $status === 'Approved'
    ||
    $status === 'Final'
) {

    notifyManagement(
        $pdo,
        'Asset Approved',
        "{$actorName} approved '{$assetTitle}'.",
        'asset_approved'
    );

}
elseif (
    $status === 'Revision Requested'
) {

    notifyManagement(
        $pdo,
        'Revision Requested',
        "{$actorName} requested revisions for '{$assetTitle}'.",
        'revision_requested'
    );

}


            ob_clean();

            echo json_encode([
                "success" => true,
                "status" => $status
            ]);

            exit();
        }


        /* =====================================================
           CREATE NEW VERSION
           ===================================================== */

        if (($input['action'] ?? '') === 'version') {

            $assetId =
                $input['asset_id']
                ?? null;


            if (!$assetId) {

                ob_clean();

                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "error" => "Asset ID is required."
                ]);

                exit();
            }
            if (!api_can_access_asset($pdo, $currentUser, $assetId)) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => 'You do not have permission to update this asset.'
                ]);
                exit;
            }
            if ($currentUser['role'] === 'animator') {
                $assignedShotStmt = $pdo->prepare("
                    SELECT a.id
                    FROM assets a
                    INNER JOIN projects p ON p.id = a.project_id
                    WHERE a.id = ?
                      AND a.asset_type = 'Animation Scene'
                      AND (
                          a.assigned_animator = ?
                          OR (
                              a.assigned_animator IS NULL
                              AND p.animator_id = ?
                          )
                      )
                    LIMIT 1
                ");
                $assignedShotStmt->execute([
                    $assetId,
                    $currentUser['id'],
                    $currentUser['id']
                ]);
                if (!$assignedShotStmt->fetchColumn()) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Animators can only submit versions for their assigned Animation Scene assets.'
                    ]);
                    exit;
                }
            } elseif ($currentUser['role'] === 'editor') {
                $sequenceCutStmt = $pdo->prepare("
                    SELECT a.id
                    FROM assets a
                    INNER JOIN editor_sequences s ON s.cut_asset_id = a.id
                    INNER JOIN asset_versions latest
                        ON latest.asset_id = a.id
                       AND latest.version_number = (
                           SELECT MAX(newest.version_number)
                           FROM asset_versions newest
                           WHERE newest.asset_id = a.id
                       )
                    WHERE a.id = ?
                      AND a.asset_type = 'Render'
                      AND a.assigned_editor = ?
                      AND s.editor_id = ?
                      AND latest.status = 'Revision Requested'
                    LIMIT 1
                ");
                $sequenceCutStmt->execute([
                    $assetId,
                    $currentUser['id'],
                    $currentUser['id']
                ]);
                if (!$sequenceCutStmt->fetchColumn()) {
                    http_response_code(403);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Editors can only submit versions for their own sequence cuts.'
                    ]);
                    exit;
                }
            }
            if ($currentUser['role'] === 'animator') {
                $shotStatusStmt = $pdo->prepare("
                    SELECT
                        a.asset_type,
                        w.workflow_status,
                        latest.status AS review_status
                    FROM assets a
                    LEFT JOIN animation_shot_workflow w ON w.asset_id = a.id
                    LEFT JOIN (
                        SELECT av.asset_id, av.status
                        FROM asset_versions av
                        INNER JOIN (
                            SELECT asset_id, MAX(version_number) AS version_number
                            FROM asset_versions
                            GROUP BY asset_id
                        ) newest ON newest.asset_id = av.asset_id
                            AND newest.version_number = av.version_number
                    ) latest ON latest.asset_id = a.id
                    WHERE a.id = ? AND a.asset_type = 'Animation Scene'
                    LIMIT 1
                ");
                $shotStatusStmt->execute([$assetId]);
                $shotState = $shotStatusStmt->fetch(PDO::FETCH_ASSOC);
                if (
                    $shotState &&
                    (
                        $shotState['workflow_status'] === 'For Review' ||
                        $shotState['review_status'] === 'For Review'
                    )
                ) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'error' => 'This animation shot is waiting for client review. Submit another version after the client makes a decision.'
                    ]);
                    exit;
                }
            }

            $versionMediaLink = trim((string)$link);
            if (isset($_FILES['asset_file'])) {
                if (
                    ($_FILES['asset_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE &&
                    $versionMediaLink !== ''
                ) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Use either an external link or an attached file, not both.'
                    ]);
                    exit;
                }
                $storedUpload = store_asset_upload($_FILES['asset_file']);
                if ($storedUpload['error']) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => $storedUpload['error']
                    ]);
                    exit;
                }
                if ($storedUpload['path']) {
                    $versionMediaLink = $storedUpload['path'];
                }
            }

            /* Get latest version number */

            $stmt = $pdo->prepare("

                SELECT
                    MAX(version_number) AS latest_version

                FROM asset_versions

                WHERE asset_id = ?

            ");


            $stmt->execute([
                $assetId
            ]);


            $row =
                $stmt->fetch();


            $nextVersion =
                ((int)($row['latest_version'] ?? 0)) + 1;


            /* Insert version */

            $stmt = $pdo->prepare("

                INSERT INTO asset_versions

                (
                    asset_id,
                    version_number,
                    status,
                    notes,
                    version_media_url,
                    review_feedback
                )

                VALUES (?, ?, ?, ?, ?, '')

            ");


            $stmt->execute([
                $assetId,

                $nextVersion,

                'For Review',

                $notes,

                $versionMediaLink
            ]);
            if ($currentUser['role'] === 'animator') {
                sync_animation_shot_workflow(
                    $pdo,
                    $assetId,
                    'For Review',
                    $currentUser['id']
                );
                if ($versionMediaLink !== '') {
                    $playblastStmt = $pdo->prepare("
                        INSERT INTO animation_shot_progress
                            (asset_id, playblast_url, updated_by)
                        SELECT id, ?, ?
                        FROM assets
                        WHERE id = ? AND asset_type = 'Animation Scene'
                        ON DUPLICATE KEY UPDATE
                            playblast_url = VALUES(playblast_url),
                            updated_by = VALUES(updated_by)
                    ");
                    $playblastStmt->execute([
                        $versionMediaLink,
                        $currentUser['id'],
                        $assetId
                    ]);
                }
            }

            if ($versionMediaLink !== '') {
                $updateMediaStmt = $pdo->prepare("
                    UPDATE assets
                    SET external_link = ?
                    WHERE id = ?
                ");
                $updateMediaStmt->execute([$versionMediaLink, $assetId]);
            }

            /* Get auto-generated version ID */

            $versionId =
                (int)$pdo->lastInsertId();


$assetInfo =
    getAssetProjectInfo(
        $pdo,
        $assetId
    );

createAuditLog(
    $pdo,
    'Created',
    'Asset Version',
    "Created V{$nextVersion} for asset {$assetId}",
    $assetInfo['project_id'] ?? null,
    $assetInfo['client_id'] ?? null
);
$currentUserId =
    $_SESSION['user']['id'] ?? null;

$clientId =
    $assetInfo['client_id'] ?? null;

if (
    $clientId &&
    (string)$clientId !== (string)$currentUserId
) {

    createUserNotification(
        $pdo,
        $clientId,
        'New Asset Version',
        "Version V{$nextVersion} of '{$assetInfo['asset_title']}' was submitted.",
        'asset_version'
    );
}


            /* Get asset title */

            $assetStmt = $pdo->prepare("

                SELECT asset_title

                FROM assets

                WHERE id = ?

            ");


            $assetStmt->execute([
                $assetId
            ]);


            $assetRow =
                $assetStmt->fetch();


            createReviewNotifications(
                $pdo,
                $assetRow['asset_title']
                    ?? 'Untitled Asset',
                $nextVersion
            );


            ob_clean();

            echo json_encode([

                "success" => true,

                "link" => $versionMediaLink !== ''
                    ? $versionMediaLink
                    : ($assetInfo['external_link'] ?? ''),

                "version" => [

                    "id" => $versionId,

                    "n" => $nextVersion,

                    "status" => "For Review",

                    "notes" => $notes,

                    "by" => null,

                    "date" => date(
                        'Y-m-d H:i:s'
                    )
                ]

            ], JSON_UNESCAPED_UNICODE);

            exit();
        }


        /* =====================================================
           CREATE NEW ASSET
           ===================================================== */

        if ($currentUser['role'] === 'animator') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'Animators submit versions of assigned Animation Scene assets through Studio Galeria.'
            ]);
            exit;
        }
        if ($currentUser['role'] === 'editor' && ($type !== 'Render' || empty($sequenceId))) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'Editors submit final Render cuts from their saved Sequence Editor drafts.'
            ]);
            exit;
        }

        if (empty($title)) {

            ob_clean();

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "error" => "Title is required."
            ]);

            exit();
        }
        if (!api_can_access_project($pdo, $currentUser, $rawProject)) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error' => 'You do not have permission to manage assets for this project.'
            ]);
            exit;
        }
        if ($sequenceId !== null && $sequenceId !== '') {
            $sequenceId = filter_var($sequenceId, FILTER_VALIDATE_INT);
            if (!$sequenceId || $currentUser['role'] !== 'editor') {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => 'Only the assigned editor can submit a cut for their sequence.'
                ]);
                exit;
            }
            $sequenceStmt = $pdo->prepare("
                SELECT id, cut_asset_id
                FROM editor_sequences
                WHERE id = ? AND editor_id = ? AND project_id = ?
                LIMIT 1
            ");
            $sequenceStmt->execute([$sequenceId, $currentUser['id'], $rawProject]);
            $sequenceForCut = $sequenceStmt->fetch(PDO::FETCH_ASSOC);
            if (!$sequenceForCut) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => 'The selected sequence is not assigned to you or does not match this project.'
                ]);
                exit;
            }
            if ($sequenceForCut['cut_asset_id'] !== null) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error' => 'This sequence already has a submitted cut. Use Revise cut after the client requests changes.'
                ]);
                exit;
            }
            $hasCutFile = isset($_FILES['asset_file']) &&
                ($_FILES['asset_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
            if (
                $type !== 'Render' ||
                (!$hasCutFile && trim((string)$link) === '')
            ) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Submit a Render cut with a file or external media link.'
                ]);
                exit;
            }
        }

        if ($dueDate !== null && $dueDate !== '') {
            $parsedDueDate = DateTimeImmutable::createFromFormat('!Y-m-d', (string)$dueDate);
            $dateErrors = DateTimeImmutable::getLastErrors();
            if (
                !$parsedDueDate ||
                ($dateErrors && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0)) ||
                $parsedDueDate->format('Y-m-d') !== $dueDate ||
                $parsedDueDate->format('Y-m-d') < date('Y-m-d')
            ) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Due date must be today or a future date.'
                ]);
                exit;
            }
        } else {
            $dueDate = null;
        }

        if (isset($_FILES['asset_file'])) {
            if (
                ($_FILES['asset_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE &&
                trim((string)$link) !== ''
            ) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Use either an external link or an attached file, not both.'
                ]);
                exit;
            }
            $storedUpload = store_asset_upload($_FILES['asset_file']);
            if ($storedUpload['error']) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => $storedUpload['error']
                ]);
                exit;
            }
            if ($storedUpload['path']) {
                $link = $storedUpload['path'];
            }
        }

        /*
         * IMPORTANT:
         *
         * assets.id is INT AUTO_INCREMENT.
         *
         * We DO NOT manually create an ID.
         */

        $stmt = $pdo->prepare("

            INSERT INTO assets

            (
                project_id,
                asset_title,
                asset_type,
                assigned_editor,
                assigned_animator,
                external_link,
                due_date
            )

            VALUES (?, ?, ?, ?, ?, ?, ?)

        ");


        $stmt->execute([

            $rawProject,

            $title,

            $type,

            $assignedEditorForSequence,

            $assignedAnimatorForShot,

            $link,

            $dueDate

        ]);


        /*
         * Get the ID automatically generated by MySQL.
         */

        $assetId =
            (int)$pdo->lastInsertId();


createAuditLog(
    $pdo,
    'Created',
    'Asset',
    "Created asset {$assetId} - {$title}",
    $rawProject
);
$assetProjectInfo =
    getAssetProjectInfo(
        $pdo,
        $assetId
    );

$currentUserId =
    $_SESSION['user']['id'] ?? null;

$clientId =
    $assetProjectInfo['client_id'] ?? null;

if (
    $clientId &&
    (string)$clientId !== (string)$currentUserId
) {

    createUserNotification(
        $pdo,
        $clientId,
        'New Asset Submitted',
        "A new {$type} asset '{$title}' was submitted to your project.",
        'asset_created'
    );
}

        /* =====================================================
           CREATE INITIAL VERSION
           ===================================================== */

        $initialVersion = null;


        try {

            $stmtVer = $pdo->prepare("

                INSERT INTO asset_versions

                (
                    asset_id,
                    version_number,
                    status,
                    notes,
                    version_media_url,
                    review_feedback
                )

                VALUES (?, 1, 'For Review', ?, ?, '')

            ");


            $stmtVer->execute([

                $assetId,

                $notes,

                $link

            ]);


            $versionId =
                (int)$pdo->lastInsertId();


            $initialVersion = [

                "id" => $versionId,

                "n" => 1,

                "status" => "For Review",

                "notes" => $notes,

                "media_url" => $link,

                "review_feedback" => "",

                "by" => null,

                "date" => date(
                    'Y-m-d H:i:s'
                )
            ];


            createReviewNotifications(
                $pdo,
                $title,
                1
            );


        } catch (Exception $eVer) {

            /*
             * Asset was already created.
             * Version creation failure should not
             * destroy the asset.
             */
        }

        if ($currentUser['role'] === 'animator' && $type === 'Animation Scene') {
            sync_animation_shot_workflow(
                $pdo,
                $assetId,
                'For Review',
                $currentUser['id']
            );
        }
        if ($sequenceId) {
            $attachCutStmt = $pdo->prepare("
                UPDATE editor_sequences
                SET cut_asset_id = ?
                WHERE id = ? AND editor_id = ? AND project_id = ?
            ");
            $attachCutStmt->execute([
                $assetId,
                $sequenceId,
                $currentUser['id'],
                $rawProject
            ]);
        }


        /* =====================================================
           RETURN NEW STATE
           ===================================================== */

        respondWithState(

            $pdo,

            [

                "id" => $assetId,

                "asset" => [

                    "id" => $assetId,

                    "project_id" => $rawProject,

                    "title" => $title,

                    "asset_title" => $title,

                    "type" => $type,

                    "asset_type" => $type,

                    "link" => $link,

                    "external_link" => $link,

                    "versions" =>
                        $initialVersion
                            ? [$initialVersion]
                            : []
                ]
            ]
        );
    }


    /* =========================================================
       PUT
       ========================================================= */

    if ($method === 'PUT') {
        api_require_roles($currentUser, ['client']);

        $rawInput =
            file_get_contents('php://input');


        $input =
            json_decode(
                $rawInput,
                true
            );


        if (!$input) {

            ob_clean();

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "error" => "No JSON payload received."
            ]);

            exit();
        }


        $assetId =
            $input['asset_id']
            ?? null;


        $versionNo =
            $input['version']
            ?? $input['version_number']
            ?? null;


        $status =
            $input['status']
            ?? null;
        $reviewFeedbackValue=$input['comment']??'';
        if(!is_string($reviewFeedbackValue)){
            http_response_code(400);
            echo json_encode([
                'success'=>false,
                'error'=>'Review feedback must be text.'
            ]);
            exit;
        }
        $reviewFeedback=trim($reviewFeedbackValue);
        if(strlen($reviewFeedback)>10000){
            http_response_code(400);
            echo json_encode([
                'success'=>false,
                'error'=>'Review feedback must be 10,000 bytes or less.'
            ]);
            exit;
        }


        if (
            !$assetId
            ||
            !$versionNo
            ||
            !$status
        ) {

            ob_clean();

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "error" =>
                    "Asset ID, version, and status are required."
            ]);

            exit();
        }
        if (!in_array($status, ['For Review', 'Approved', 'Revision Requested', 'Rejected', 'Final'], true)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid asset status.'
            ]);
            exit;
        }
        if ($currentUser['role'] === 'client') {
            $latestVersionStmt = $pdo->prepare("
                SELECT MAX(version_number)
                FROM asset_versions
                WHERE asset_id = ?
            ");
            $latestVersionStmt->execute([$assetId]);
            $latestVersionNo = $latestVersionStmt->fetchColumn();
            $latestStatusStmt = $pdo->prepare("
                SELECT status
                FROM asset_versions
                WHERE asset_id = ? AND version_number = ?
                LIMIT 1
            ");
            $latestStatusStmt->execute([$assetId, $latestVersionNo]);
            $latestStatus = $latestStatusStmt->fetchColumn();
            if (
                !in_array($status, ['Approved', 'Revision Requested', 'Rejected'], true) ||
                $latestStatus !== 'For Review' ||
                (string)$versionNo !== (string)$latestVersionNo ||
                !api_can_access_asset($pdo, $currentUser, $assetId)
            ) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => 'You may only decide once on the latest version awaiting review assigned to your account.'
                ]);
                exit;
            }
        }


        $stmt = $pdo->prepare("

            UPDATE asset_versions

            SET status = ?, review_feedback = ?

            WHERE asset_id = ?

            AND version_number = ?

        ");


        $stmt->execute([

            $status,

            $reviewFeedback,

            $assetId,

            $versionNo

        ]);
        if ($currentUser['role'] === 'client') {
            update_animation_shot_workflow(
                $pdo,
                $assetId,
                in_array($status, ['Approved', 'Final'], true)
                    ? 'Completed'
                    : 'Revision Required',
                $currentUser['id']
            );
        }


$assetInfo =
    getAssetProjectInfo(
        $pdo,
        $assetId
    );

$actionName =
    $status === 'Approved'
    || $status === 'Final'
        ? 'Approved'
        : (
            $status === 'Revision Requested'
                ? 'Revision Requested'
                : 'Updated'
        );

createAuditLog(
    $pdo,
    $actionName,
    'Asset Version',
    "{$status} V{$versionNo} for asset {$assetId}",
    $assetInfo['project_id'] ?? null,
    $assetInfo['client_id'] ?? null
);
$actorName =
    $_SESSION['user']['full_name']
    ?? $_SESSION['user']['name']
    ?? 'A user';

$assetTitle =
    $assetInfo['asset_title']
    ?? "Asset {$assetId}";

if (
    $status === 'Approved'
    ||
    $status === 'Final'
) {

    notifyManagement(
        $pdo,
        'Asset Approved',
        "{$actorName} approved '{$assetTitle}' V{$versionNo}.",
        'asset_approved'
    );

}
elseif (
    $status === 'Revision Requested'
) {

    notifyManagement(
        $pdo,
        'Revision Requested',
        "{$actorName} requested revisions for '{$assetTitle}' V{$versionNo}.",
        'revision_requested'
    );

}

        ob_clean();

        echo json_encode([

            "success" => true,

            "message" =>
                "Asset status updated successfully."

        ]);

        exit();
    }


} catch (Exception $e) {

    ob_clean();

    http_response_code(200);

    echo json_encode([

        "success" => false,

        "status" => "error",

        "error" =>
            "Database failure: "
            . $e->getMessage()

    ]);

    exit();
}
?>