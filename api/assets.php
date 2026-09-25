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

    $method = $_SERVER['REQUEST_METHOD'];


    /* =========================================================
       CREATE REVIEW NOTIFICATIONS
       ========================================================= */

    function createReviewNotifications($pdo, $assetTitle, $versionNo)
    {
        try {

<<<<<<< HEAD
        foreach ($users as $user) {
            error_log("NOTIFICATION INSERT: " . $user['id']);
            
            $notify->execute([
                $user['id'],
                'New Asset for Review',
                "A new version (V{$versionNo}) of '{$assetTitle}' is waiting for review.",
                'asset_review'
            ]);
=======
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
>>>>>>> f150b11 ()
        }
    }


    /* =========================================================
       CREATE AUDIT LOG
       ========================================================= */

    function createAuditLog($pdo, $action, $entity = null, $details = null)
    {
        try {

            $userId = $_SESSION['user']['id'] ?? null;

            $stmt = $pdo->prepare("
                INSERT INTO audit_logs
                (user_id, action, entity, detail)
                VALUES (?, ?, ?, ?)
            ");

            $stmt->execute([
                $userId,
                $action,
                $entity,
                $details
            ]);

        } catch (Exception $e) {
            // Audit failure should not stop the main operation.
        }
    }


    /* =========================================================
       RETURN CURRENT ASSET STATE
       ========================================================= */

    function respondWithState($pdo, $extraData = [])
    {

        $userRole = $_SESSION['user']['role'] ?? '';

        if ($userRole === 'client') {

            $stmt = $pdo->prepare("
                SELECT a.*
                FROM assets a
                INNER JOIN projects p
                    ON a.project_id = p.id
                WHERE p.client_id = ?
                ORDER BY a.id DESC
            ");

            $stmt->execute([
                $_SESSION['user']['id'] ?? 0
            ]);

        } else {

            $stmt = $pdo->query("
                SELECT *
                FROM assets
                ORDER BY id DESC
            ");
        }


        $rawAssets = $stmt->fetchAll();


        /* =====================================================
           GET ASSET VERSIONS
           ===================================================== */

        $verStmt = $pdo->query("
            SELECT *
            FROM asset_versions
            ORDER BY asset_id, version_number ASC
        ");

        $versionsByAsset = [];


        foreach ($verStmt->fetchAll() as $vRow) {

            $versionsByAsset[$vRow['asset_id']][] = [

                "id" => (int)$vRow['id'],

                "n" => (int)$vRow['version_number'],

                "status" => $vRow['status'],

                "notes" => $vRow['notes'],

                "by" => null,

                "date" => $vRow['created_at']
            ];
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

                "created_at" => $row['created_at'] ?? null,

                "versions" => $versionsByAsset[$row['id']] ?? []
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

                        "id" => $_SESSION['user']['id'] ?? 1,

                        "name" =>
                            $_SESSION['user']['full_name']
                            ?? $_SESSION['user']['name']
                            ?? "User"
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

    if ($method === 'GET') {

        respondWithState($pdo);
    }


    /* =========================================================
       POST
       ========================================================= */

    if ($method === 'POST') {

        $rawInput = file_get_contents('php://input');

        $input = json_decode(
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


        $link =
            $input['link']
            ?? $input['external_link']
            ?? '';


        $notes =
            $input['notes']
            ?? '';


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


            if (!$assetId || !$status) {

                ob_clean();

                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "error" => "Asset ID and status are required."
                ]);

                exit();
            }


            /*
             * Update the newest version of this asset.
             */

            $stmt = $pdo->prepare("
                UPDATE asset_versions
                SET status = ?
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
                $assetId,
                $assetId
            ]);


            /* =================================================
               CHECK IF PROJECT IS COMPLETED
               ================================================= */

            if (
                $status === 'Approved'
                ||
                $status === 'Final'
            ) {

                $projectStmt = $pdo->prepare("
                    SELECT project_id
                    FROM assets
                    WHERE id = ?
                ");

                $projectStmt->execute([
                    $assetId
                ]);

                $assetRow = $projectStmt->fetch();


                if ($assetRow) {

                    $projectId =
                        $assetRow['project_id'];


                    $checkStmt = $pdo->prepare("

                        SELECT
                            COUNT(*) AS total,

                            SUM(
                                CASE
                                    WHEN av.status IN ('Approved', 'Final')
                                    THEN 1
                                    ELSE 0
                                END
                            ) AS completed

                        FROM assets a

                        LEFT JOIN (

                            SELECT av1.asset_id, av1.status

                            FROM asset_versions av1

                            INNER JOIN (

                                SELECT
                                    asset_id,
                                    MAX(version_number) AS max_version

                                FROM asset_versions

                                GROUP BY asset_id

                            ) av2

                            ON av1.asset_id = av2.asset_id

                            AND av1.version_number = av2.max_version

                        ) av

                        ON a.id = av.asset_id

                        WHERE a.project_id = ?

                    ");


                    $checkStmt->execute([
                        $projectId
                    ]);


                    $result =
                        $checkStmt->fetch();


                    if (
                        $result
                        &&
                        $result['total'] > 0
                        &&
                        $result['total'] == $result['completed']
                    ) {

                        $updateProject =
                            $pdo->prepare("

                                UPDATE projects

                                SET status = 'Completed'

                                WHERE id = ?

                            ");


                        $updateProject->execute([
                            $projectId
                        ]);
                    }
                }
            }


            createAuditLog(
                $pdo,
                $status === 'Approved' || $status === 'Final'
                    ? 'Approved'
                    : 'Updated',
                'Asset Version',
                "{$status} for asset {$assetId}"
            );


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
                    notes
                )

                VALUES (?, ?, ?, ?)

            ");


            $stmt->execute([

                $assetId,

                $nextVersion,

                'For Review',

                $notes

            ]);


            /* Get auto-generated version ID */

            $versionId =
                (int)$pdo->lastInsertId();


            createAuditLog(
                $pdo,
                'Created',
                'Asset Version',
                "Created V{$nextVersion} for asset {$assetId}"
            );


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

        if (empty($title)) {

            ob_clean();

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "error" => "Title is required."
            ]);

            exit();
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
                external_link
            )

            VALUES (?, ?, ?, ?)

        ");


        $stmt->execute([

            $rawProject,

            $title,

            $type,

            $link

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
            "Created asset {$assetId} - {$title}"
        );

<<<<<<< HEAD
        $initialVersion = null;
        try {
            $versionId = 'v' . bin2hex(random_bytes(6));
            $stmtVer = $pdo->prepare("INSERT INTO asset_versions (id, asset_id, version_no, status, notes, uploaded_by) VALUES (?, ?, 1, 'For Review', ?, ?)");
            $stmtVer->execute([$versionId, $assetId, $notes, $uploadedBy]);
            $initialVersion = [
                "id" => $versionId, "n" => 1, "status" => "For Review",
                "notes" => $notes, "by" => $uploadedBy, "date" => date('Y-m-d H:i:s')
            ];
        } catch (Exception $eVer) {
            error_log("ASSET VERSION ERROR: " . $eVer->getMessage());
        }

        createReviewNotifications(
            $pdo,
            $title,
            1
        );
=======
>>>>>>> f150b11 ()

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
                    notes
                )

                VALUES (?, 1, 'For Review', ?)

            ");


            $stmtVer->execute([

                $assetId,

                $notes

            ]);


            $versionId =
                (int)$pdo->lastInsertId();


            $initialVersion = [

                "id" => $versionId,

                "n" => 1,

                "status" => "For Review",

                "notes" => $notes,

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


        $stmt = $pdo->prepare("

            UPDATE asset_versions

            SET status = ?

            WHERE asset_id = ?

            AND version_number = ?

        ");


        $stmt->execute([

            $status,

            $assetId,

            $versionNo

        ]);


        createAuditLog(
            $pdo,
            (
                $status === 'Approved'
                ||
                $status === 'Final'
            )
                ? 'Approved'
                : 'Updated',
            'Asset Version',
            "{$status} V{$versionNo} for asset {$assetId}"
        );


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