<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();
require_once __DIR__ . '/../includes/api_auth.php';
$user = api_require_user($pdo);
api_require_roles($user, ['admin']);
if ($_SERVER['REQUEST_METHOD']!=='POST') { http_response_code(405); echo json_encode(['error'=>'Method not allowed']); exit; }
$input=json_decode(file_get_contents('php://input'), true) ?? [];
$state=$input['state']??null;
if(!is_array($state)){http_response_code(400);echo json_encode(['error'=>'Invalid state payload']);exit;}
$state['currentUser']=null; $state['users']=$state['users']??[];
$allowedRoles=['admin','project_manager','animator','editor','client'];
$pdo->beginTransaction();
try {
  foreach($state['users'] as $u){
    if(empty($u['id'])||empty($u['name'])||!in_array($u['role']??'', $allowedRoles, true)) continue;
    $email=trim($u['email']??($u['id'].'@local.invalid'));
    $q=$pdo->prepare('SELECT id FROM app_users WHERE id=?');$q->execute([$u['id']]);
    if($q->fetch()) $pdo->prepare('UPDATE app_users SET full_name=?, email=?, role=? WHERE id=?')->execute([$u['name'],$email,$u['role'],$u['id']]);
    else $pdo->prepare('INSERT INTO app_users (id,full_name,email,password,role) VALUES (?,?,?,?,?)')->execute([$u['id'],$u['name'],$email,password_hash('password123',PASSWORD_DEFAULT),$u['role']]);
  }
  $json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  $st=$pdo->prepare('INSERT INTO app_state (id,state_json) VALUES (1,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)');$st->execute([$json]);
  $pdo->commit(); echo json_encode(['success'=>true,'updated_at'=>date('c')]);
} catch(Throwable $e){$pdo->rollBack();http_response_code(500);echo json_encode(['error'=>'Could not save application data','detail'=>$e->getMessage()]);}
