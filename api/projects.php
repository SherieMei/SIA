<?php
require_once "db.php";
header("Content-Type: application/json; charset=utf-8");
$method = $_SERVER["REQUEST_METHOD"];

try {
    switch ($method) {
        case "GET":
            $sql = "SELECT * FROM projects ORDER BY deadline ASC";
            $result = $conn->query($sql);
            $projects = [];
            if ($result) {
                while ($row = $result->fetch_assoc()) {
                    $projects[] = $row;
                }
            }

            echo json_encode($projects);
            break;


        case "POST":
            $data = json_decode(file_get_contents("php://input"), true);
            $name = trim($data["name"] ?? "");
            $client = trim($data["client"] ?? "");
            $status = $data["status"] ?? "Pre-Production";
            $deadline = $data["deadline"] ?? null;
            $project_manager_id = $data["project_manager_id"] ?? null;
            $budget = (float)($data["budget"] ?? 0);

            if ($name === "") {
                echo json_encode([
                    "success" => false,
                    "message" => "Project name is required."
                ]);
                exit;
            }

            if ($client === "") {
                echo json_encode([
                    "success" => false,
                    "message" => "Client is required."
                ]);
                exit;
            }

            if ($deadline === "") {
                $deadline = null;
            }

            $budget = (float)($data["budget"] ?? 0);

            if ($deadline === "") {
                $deadline = null;
            }

            if ($project_manager_id === null) {

                $stmt = $conn->prepare(
                    "INSERT INTO projects
                    (name, client, status, deadline, project_manager_id, budget)
                    VALUES (?, ?, ?, ?, NULL, ?)"
                );

            if (!$stmt) {
            throw new Exception($conn->error);
            }

            $stmt->bind_param(
            "ssssd",
            $name,
            $client,
            $status,
            $deadline,
            $budget
            );

        } else {
            $project_manager_id = (int)$project_manager_id;

            $stmt = $conn->prepare(
                "INSERT INTO projects
                (name, client, status, deadline, project_manager_id, budget)
                VALUES (?, ?, ?, ?, ?, ?)"
            );

        if (!$stmt) {
            throw new Exception($conn->error);
        }

        $stmt->bind_param(
            "sssssd",
            $name,
            $client,
            $status,
            $deadline,
            $project_manager_id,
            $budget
        );
    }
            if ($stmt->execute()) {
                echo json_encode([
                    "success" => true,
                    "message" => "Project created successfully.",
                    "id" => $stmt->insert_id
                ]);

            } else {
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to create project.",
                    "error" => $stmt->error
                ]);
            }

            $stmt->close();
            break;

        case "PUT":

            $data = json_decode(file_get_contents("php://input"), true);
            $id = $data["id"] ?? null;
            $name = trim($data["name"] ?? "");
            $client = trim($data["client"] ?? "");
            $status = $data["status"] ?? "Pre-Production";
            $deadline = $data["deadline"] ?? null;
            $project_manager_id = $data["project_manager_id"] ?? null;
            $budget = (float)($data["budget"] ?? 0);

            if (!$id) {
                echo json_encode([
                    "success" => false,
                    "message" => "Project ID is required."
                ]);
                exit;
            }

            if ($deadline === "") {
                $deadline = null;
            }

            $project_manager_id = (int)$project_manager_id;
            $stmt = $conn->prepare(
                "UPDATE projects
                 SET name = ?,
                     client = ?,
                     status = ?,
                     deadline = ?,
                     project_manager_id = ?,
                     budget = ?
                 WHERE id = ?"
            );

            if (!$stmt) {
                throw new Exception($conn->error);
            }

            $stmt->bind_param(
                "ssssidi",
                $name,
                $client,
                $status,
                $deadline,
                $project_manager_id,
                $budget,
                $id
            );

            if ($stmt->execute()) {
                echo json_encode([
                    "success" => true,
                    "message" => "Project updated successfully."
                ]);

            } else {
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to update project.",
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
                    "message" => "Project ID is required."
                ]);
                exit;
            }

            $stmt = $conn->prepare(
                "DELETE FROM projects WHERE id = ?"
            );
            if (!$stmt) {
                throw new Exception($conn->error);
            }

            $stmt->bind_param("i", $id);
            if ($stmt->execute()) {
                echo json_encode([
                    "success" => true,
                    "message" => "Project deleted successfully."
                ]);

            } else {
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to delete project.",
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