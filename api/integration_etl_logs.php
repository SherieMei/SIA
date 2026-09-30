<?php

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $origin === 'http://127.0.0.1:5501' ||
    $origin === 'http://localhost:5501' ||
    $origin === 'http://localhost'
) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

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

    if (!isset($_SESSION['user'])) {

        http_response_code(401);

        echo json_encode([
            'success' => false,
            'error' => 'Not authenticated.'
        ]);

        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

        http_response_code(405);

        echo json_encode([
            'success' => false,
            'error' => 'POST method required.'
        ]);

        exit;
    }

    $data = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Invalid JSON payload.'
        ]);

        exit;
    }

    $rows = $data['rows'] ?? [];

    if (!is_array($rows)) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Invalid ETL rows.'
        ]);

        exit;
    }

    $userId =
        $_SESSION['user']['id'] ?? null;

    $validTypes = [
        'Storyboard',
        'Animatic',
        'Character Sheet',
        'Background Asset',
        'Animation Scene',
        'Render',
        'Audio',
        'Design Draft'
    ];

    $totalRows = count($rows);

    $loadedRows = 0;

    $skippedRows = 0;

    $createdAssets = [];

    $details = [];

    $details[] =
        "EXTRACT — read {$totalRows} row(s) from source file.";

    $pdo->beginTransaction();

    foreach ($rows as $row) {

        $title =
            trim($row['title'] ?? '');

        $projectName =
            trim($row['project'] ?? '');

        $type =
            trim($row['type'] ?? '');

        $assignee =
            trim($row['assignee'] ?? '');

        $dueDate =
            trim($row['duedate'] ?? '');


        /* ==============================================
           REQUIRED FIELDS
           ============================================== */

        if (
            $title === '' ||
            $projectName === ''
        ) {

            $skippedRows++;

            continue;
        }


        /* ==============================================
           FIND PROJECT
           ============================================== */

$projectStmt = $pdo->prepare("
    SELECT
        id,
        name,
        client_id
    FROM projects
    WHERE id = ?
       OR LOWER(REPLACE(TRIM(name), ' ', '')) =
          LOWER(REPLACE(TRIM(?), ' ', ''))
       OR LOWER(name) LIKE LOWER(?)
    LIMIT 1
");

$projectStmt->execute([
    $projectName,
    $projectName,
    '%' . $projectName . '%'
]);

        $project =
            $projectStmt->fetch(
                PDO::FETCH_ASSOC
            );

        if (!$project) {

            $skippedRows++;

            continue;
        }


        /* ==============================================
           NORMALIZE TYPE
           ============================================== */

        if (
            !in_array(
                $type,
                $validTypes,
                true
            )
        ) {

            $type = 'Design Draft';
        }


        /* ==============================================
           INSERT ASSET
           ============================================== */

        $assetStmt = $pdo->prepare("
            INSERT INTO assets
            (
                project_id,
                asset_title,
                asset_type,
                external_link
            )
            VALUES (?, ?, ?, ?)
        ");

        $assetStmt->execute([
            $project['id'],
            $title,
            $type,
            ''
        ]);

        $assetId =
            (int)$pdo->lastInsertId();


        /* ==============================================
           CREATE VERSION 1
           ============================================== */

        $notes = 'Imported via ETL';

        if ($assignee !== '') {

            $notes .=
                ' — assignee: ' .
                $assignee;
        }

        if ($dueDate !== '') {

            $notes .=
                ', due ' .
                $dueDate;
        }


        $versionStmt = $pdo->prepare("
            INSERT INTO asset_versions
            (
                asset_id,
                version_number,
                status,
                notes
            )
            VALUES (?, 1, 'For Review', ?)
        ");

        $versionStmt->execute([
            $assetId,
            $notes
        ]);


        /* ==============================================
           RETURN CREATED ASSET
           ============================================== */

        $createdAssets[] = [

            'id' =>
                $assetId,

            'project_id' =>
                $project['id'],

            'project' =>
                $project['id'],

            'title' =>
                $title,

            'asset_title' =>
                $title,

            'type' =>
                $type,

            'asset_type' =>
                $type,

            'link' =>
                '',

            'external_link' =>
                '',

            'versions' => [
                [
                    'n' => 1,
                    'status' => 'For Review',
                    'notes' => $notes
                ]
            ]
        ];

        $loadedRows++;
    }


    /* ==============================================
       ETL DETAILS
       ============================================== */

    $details[] =
        "TRANSFORM — validated required fields, normalized asset types, and matched project names ({$skippedRows} row(s) skipped).";

    $details[] =
        "LOAD — inserted {$loadedRows} new asset record(s), each with Version 1 and status For Review.";


    /* ==============================================
       SAVE ETL LOG
       ============================================== */

    $id =
        'etl_' .
        bin2hex(
            random_bytes(6)
        );

    $stmt = $pdo->prepare("
        INSERT INTO integration_etl_logs
        (
            id,
            user_id,
            source,
            total_rows,
            loaded_rows,
            skipped_rows,
            status,
            details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $id,
        $userId,
        'CSV Import',
        $totalRows,
        $loadedRows,
        $skippedRows,
        'Completed',
        implode("\n", $details)
    ]);

    $pdo->commit();


    echo json_encode([
        'success' => true,

        'id' =>
            $id,

        'total_rows' =>
            $totalRows,

        'loaded_rows' =>
            $loadedRows,

        'skipped_rows' =>
            $skippedRows,

        'details' =>
            $details,

        'assets' =>
            $createdAssets

    ], JSON_UNESCAPED_UNICODE);

    exit;


} catch (Exception $e) {

    if (
        isset($pdo) &&
        $pdo->inTransaction()
    ) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);

    exit;
}