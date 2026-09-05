<?php
require_once "db.php";
header("Content-Type: application/json");
$method = $_SERVER["REQUEST_METHOD"];

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
        $name = $data["name"] ?? "";
        $client = $data["client"] ?? "";
        $status = $data["status"] ?? "";
        $deadline = $data["deadline"] ?? null;
        $project_manager_id = $data["project_manager_id"] ?? null;
        $budget = $data["budget"] ?? 0;

        if (empty($name)) {
            echo json_encode([
                "success" => false,
                "message" => "Project name is required."
            ]);
            exit;
        }

        $stmt = $conn->prepare(
            "INSERT INTO projects
            (name, client, status, deadline, project_manager_id, budget)
            VALUES (?, ?, ?, ?, ?, ?)"
        );

        $stmt->bind_param(
            "ssssid",
            $name,
            $client,
            $status,
            $deadline,
            $project_manager_id,
            $budget
        );

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
        $name = $data["name"] ?? "";
        $client = $data["client"] ?? "";
        $status = $data["status"] ?? "";
        $deadline = $data["deadline"] ?? null;
        $project_manager_id = $data["project_manager_id"] ?? null;
        $budget = $data["budget"] ?? 0;

        if (!$id) {
            echo json_encode([
                "success" => false,
                "message" => "Project ID is required."
            ]);
            exit;
        }

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

$conn->close();
?>