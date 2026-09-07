<?php
header('Access-Control-Allow-Origin: http://127.0.0.1:5501');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['error'=>'Not authenticated']); exit; }
$row = $pdo->query("SELECT state_json FROM app_state WHERE id=1")->fetch();
$state = $row ? json_decode($row['state_json'], true) : [];
if (!is_array($state)) $state=[];
$state['currentUser'] = $_SESSION['user'];
echo json_encode(['success'=>true,'state'=>$state], JSON_UNESCAPED_UNICODE);
