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


    require_once __DIR__ . '/../config/database.php';
    $pdo = atlas_database_connection();

    require_once __DIR__ . '/../includes/api_auth.php';
    $currentUser = api_require_user($pdo);
    api_require_roles($currentUser, ['admin', 'project_manager', 'editor']);
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

    if (array_key_exists('rows', $data)) {
        $rows = $data['rows'];
    } elseif (!$data) {
        $rows = [];
    } elseif ($data && array_keys($data) === range(0, count($data) - 1)) {
        $rows = $data;
    } else {
        $rows = [$data];
    }

    if (!is_array($rows) || !$rows) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Provide at least one CSV or JSON data row.'
        ]);

        exit;
    }

    $userId =
        $currentUser['id'];

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
        "EXTRACT — read {$totalRows} row(s) from CSV or JSON input.";

    $pdo->beginTransaction();

    foreach ($rows as $row) {
        if (!is_array($row)) {
            $skippedRows++;
            continue;
        }

        $titleValue = $row['title'] ?? $row['asset'] ?? '';
        $projectValue = $row['project'] ?? '';
        if (
            (!is_string($titleValue) && !is_numeric($titleValue)) ||
            (!is_string($projectValue) && !is_numeric($projectValue))
        ) {
            $skippedRows++;
            continue;
        }

        $title = trim((string)$titleValue);

        $projectName =
            trim((string)$projectValue);

        $typeValue = $row['type'] ?? '';
        $type = is_string($typeValue) ? trim($typeValue) : '';

        $assigneeValue = $row['assignee'] ?? '';
        $assignee = is_string($assigneeValue) ? trim($assigneeValue) : '';

        $dueDateValue = $row['duedate'] ?? '';
        $dueDate = is_string($dueDateValue) ? trim($dueDateValue) : '';


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
    LIMIT 1
");

$projectStmt->execute([
    $projectName,
    $projectName
]);

        $project =
            $projectStmt->fetch(
                PDO::FETCH_ASSOC
            );

        if (!$project) {

            $skippedRows++;

            continue;
        }

        if (!api_can_access_project($pdo, $currentUser, $project['id'])) {
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
                notes,
                version_media_url
            )
            VALUES (?, 1, 'For Review', ?, '')
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
        "TRANSFORM — validated required fields and asset types; skipped {$skippedRows} row(s) with missing fields, unknown projects, or projects outside your assignments.";

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
        'CSV / JSON Import',
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