<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['error'=>'Not authenticated']); exit; }
function load_state($pdo){$r=$pdo->query('SELECT state_json FROM app_state WHERE id=1')->fetch();$s=$r?json_decode($r['state_json'],true):[];return is_array($s)?$s:[];}
function save_state($pdo,$s){$s['currentUser']=null;$j=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);$q=$pdo->prepare('INSERT INTO app_state (id,state_json) VALUES (1,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json)');$q->execute([$j]);}
if($_SERVER['REQUEST_METHOD']==='GET'){ $s=load_state($pdo); $out=[]; foreach(($s['projects']??[]) as $p){$out[]=['id'=>preg_replace('/^p/','',$p['id']),'name'=>$p['name']??$p['title']??'','client'=>$p['client']??'','status'=>strtolower(str_replace(' ','_', $p['status']??'planning')),'deadline'=>$p['deadline']??null,'budget'=>$p['budget']??0,'project_manager_id'=>preg_replace('/^u/','',$p['pm']??'')];} echo json_encode($out,JSON_UNESCAPED_UNICODE);exit;}
if($_SERVER['REQUEST_METHOD']==='POST'){
 $in=json_decode(file_get_contents('php://input'),true)??[]; $name=trim($in['name']??'');$client=trim($in['client']??'');if(!$name||!$client){http_response_code(400);echo json_encode(['error'=>'Project name and client are required.']);exit;}
 $s=load_state($pdo);$projects=$s['projects']??[];$max=0;foreach($projects as $p){$max=max($max,(int)preg_replace('/\D/','',$p['id']));}$id='p'.($max+1);$projects[]=['id'=>$id,'name'=>$name,'client'=>$client,'status'=>'Pre-Production','deadline'=>$in['deadline']??null,'pm'=>$_SESSION['user']['id']??null,'team'=>[],'budget'=>(float)($in['budget']??0)];$s['projects']=$projects;save_state($pdo,$s);echo json_encode(['success'=>true,'project'=>$projects[array_key_last($projects)]],JSON_UNESCAPED_UNICODE);exit;
}
http_response_code(405);echo json_encode(['error'=>'Method not allowed']);
