<?php
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();
$method=$_SERVER['REQUEST_METHOD'];
$input=json_decode(file_get_contents('php://input'), true) ?? $_POST;
if ($method==='GET') { echo json_encode(['authenticated'=>isset($_SESSION['user']),'user'=>$_SESSION['user']??null]); exit; }
if ($method!=='POST') { http_response_code(405); echo json_encode(['error'=>'Method not allowed']); exit; }
$action=$input['action']??'login';
if ($action==='logout') { $_SESSION = []; if (ini_get('session.use_cookies')) { $params=session_get_cookie_params(); setcookie(session_name(),'',time()-42000,$params['path'],$params['domain'],$params['secure'],$params['httponly']); } session_destroy(); echo json_encode(['success'=>true]); exit; }
if ($action==='login') {
  $email=trim($input['email']??''); $password=$input['password']??'';
  if(!$email||!$password){http_response_code(400);echo json_encode(['error'=>'Email and password are required']);exit;}
  $st=$pdo->prepare('SELECT id,full_name,email,password,role FROM app_users WHERE LOWER(email)=LOWER(?) LIMIT 1'); $st->execute([$email]); $u=$st->fetch();
  if(!$u || !password_verify($password,$u['password'])){http_response_code(401);echo json_encode(['error'=>'Invalid email or password']);exit;}
  unset($u['password']); $_SESSION['user']=$u; echo json_encode(['success'=>true,'user'=>$u]); exit;
}
if ($action==='register') {
  $name=trim($input['name']??''); $email=trim($input['email']??''); $password=$input['password']??''; $role=$input['role']??'viewer';
  $roles=['admin','artist','animator','editor','reviewer','project_manager','client','viewer'];
  if(!$name||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<6||!in_array($role,$roles,true)){http_response_code(400);echo json_encode(['error'=>'Enter valid account details. Password must be at least 6 characters.']);exit;}
  $exists=$pdo->prepare('SELECT id FROM app_users WHERE LOWER(email)=LOWER(?)');$exists->execute([$email]);if($exists->fetch()){http_response_code(409);echo json_encode(['error'=>'An account with that email already exists.']);exit;}
  $id='u'.(int)$pdo->query("SELECT COALESCE(MAX(CAST(SUBSTRING(id,2) AS UNSIGNED)),0)+1 FROM app_users")->fetchColumn();
  $st=$pdo->prepare('INSERT INTO app_users (id,full_name,email,password,role) VALUES (?,?,?,?,?)');$st->execute([$id,$name,$email,password_hash($password,PASSWORD_DEFAULT),$role]);
  $u=['id'=>$id,'full_name'=>$name,'email'=>$email,'role'=>$role]; $_SESSION['user']=$u; echo json_encode(['success'=>true,'user'=>$u]); exit;
}
http_response_code(400); echo json_encode(['error'=>'Unknown action']);
