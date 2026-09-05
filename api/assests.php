<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once "db.php";
header("Content-Type: application/json; charset=utf-8");
$method = $_SERVER["REQUEST_METHOD"];

try {
    switch ($method) {
        case "GET":

            $project_id = $_GET["project_id"] ?? null;
            if ($project_id) {
                $stmt = $conn->prepare("
                    SELECT *
                    FROM assets
                    WHERE project_id = ?
                    ORDER BY created_at DESC
                ");

                $stmt->bind_param("i", $project_id);
                $stmt->execute();

                $result = $stmt->get_result();
                $assets = [];

                while ($row = $result->fetch_assoc()) {
                    $assets[] = $row;
                }

                echo json_encode([
                    "success" => true,
                    "assets" => $assets
                ]);

                $stmt->close();

            } else {

                $result = $conn->query("
                    SELECT *
                    FROM assets
                    ORDER BY created_at DESC
                ");

                $assets = [];
                while ($row = $result->fetch_assoc()) {
                    $assets[] = $row;
                }

                echo json_encode([
                    "success" => true,
                    "assets" => $assets
                ]);
            }
            break;

        case "POST":

            $data = json_decode(file_get_contents("php://input"), true);
            $project_id = $data["project_id"] ?? null;
            $title = trim($data["title"] ?? "");
            $type = trim($data["type"] ?? "");
            $link = trim($data["link"] ?? "");

            if (!$project_id) {
                echo json_encode([
                    "success" => false,
                    "message" => "Project ID is required."
                ]);
                exit;
            }

            if ($title === "") {
                echo json_encode([
                    "success" => false,
                    "message" => "Asset title is required."
                ]);
                exit;
            }

            $stmt = $conn->prepare("
                INSERT INTO assets
                (project_id, title, type, link)
                VALUES (?, ?, ?, ?)
            ");

            $stmt->bind_param(
                "isss",
                $project_id,
                $title,
                $type,
                $link
            );

            if ($stmt->execute()) {

                echo json_encode([
                    "success" => true,
                    "message" => "Asset created successfully.",
                    "id" => $stmt->insert_id
                ]);

            } else {

                echo json_encode([
                    "success" => false,
                    "message" => "Failed to create asset.",
                    "error" => $stmt->error
                ]);
            }

            $stmt->close();
            break;

        case "DELETE":

            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data["id"] ?? null;
            if (!$id) {
                echo json_encode([
                    "success" => false,
                    "message" => "Asset ID is required."
                ]);
                exit;
            }

            $stmt = $conn->prepare("
                DELETE FROM assets
                WHERE id = ?
            ");

            $stmt->bind_param("i", $id);

            if ($stmt->execute()) {

                echo json_encode([
                    "success" => true,
                    "message" => "Asset deleted successfully."
                ]);

            } else {

                echo json_encode([
                    "success" => false,
                    "message" => "Failed to delete asset.",
                    "error" => $stmt->error
                ]);
            }

            $stmt->close();

            break;


        default:

            echo json_encode([
                "success" => false,
                "message" => "Method not allowed."
            ]);

            break;
    }

} catch (Throwable $e) {

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database/API error.",
        "error" => $e->getMessage()
    ]);
}

$conn->close();
?>