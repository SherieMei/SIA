<?php

header('Content-Type: application/json');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $origin === 'http://127.0.0.1:5501' ||
    $origin === 'http://localhost:5501' ||
    $origin === 'http://localhost'
) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../includes/api_auth.php';

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'];

$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    $input = $_POST;
}


// ==================================================
// GET REQUESTS
// ==================================================

if ($method === 'GET') {

    $action = $_GET['action'] ?? 'session';


    // ----------------------------------------------
    // CHECK CURRENT SESSION
    // ----------------------------------------------

    if ($action === 'session') {
        $user = api_authenticated_user($pdo);

        echo json_encode([
            'authenticated' => $user !== null,
            'user' => $user
        ]);

        exit;
    }


    // ----------------------------------------------
    // LOAD REAL REGISTERED USERS
    // FOR QUICK SIGN-IN
    // ----------------------------------------------

    if ($action === 'users') {
        $host = strtolower((string)parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST));
        $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
        $isLocalDevelopment =
            in_array($host, ['localhost', '127.0.0.1', '::1'], true) &&
            in_array($remoteAddress, ['127.0.0.1', '::1'], true);
        $currentUser = null;
        if (!$isLocalDevelopment) {
            $currentUser = api_require_user($pdo);
            api_require_roles($currentUser, ['admin', 'project_manager']);
        }

        try {
            if ($isLocalDevelopment) {
                $stmt = $pdo->query("
                    SELECT id, full_name, email, role
                    FROM app_users
                    ORDER BY created_at DESC, full_name ASC
                ");
            } else {
                $stmt = $pdo->query("
                    SELECT id, full_name, role
                    FROM app_users
                    WHERE role IN ('project_manager', 'editor', 'animator', 'client')
                    ORDER BY full_name ASC
                ");
            }

            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($users as &$user) {
                $user['role'] = strtolower(trim($user['role'] ?? ''));
            }
            unset($user);

            echo json_encode([
                'success' => true,
                'users' => $users
            ]);

            exit;

        } catch (PDOException $e) {

            http_response_code(500);

            echo json_encode([
                'success' => false,
                'error' => 'Unable to load registered accounts.'
            ]);

            exit;
        }
    }


    // ----------------------------------------------
    // UNKNOWN GET ACTION
    // ----------------------------------------------

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'error' => 'Unknown GET action.'
    ]);

    exit;
}


// ==================================================
// ONLY POST REQUESTS BELOW
// ==================================================

if ($method !== 'POST') {

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed.'
    ]);

    exit;
}


$action = $input['action'] ?? 'login';


// ==================================================
// CREATE TEAM MEMBER
// ==================================================

if ($action === 'create_team_member') {

    $currentUser = api_require_user($pdo);
    api_require_roles($currentUser, ['admin']);

    $name = is_string($input['name'] ?? null) ? trim($input['name']) : '';
    $email = is_string($input['email'] ?? null) ? trim($input['email']) : '';
    $password = $input['password'] ?? '';
    $role = is_string($input['role'] ?? null) ? strtolower(trim($input['role'])) : '';
    $allowedRoles = ['admin', 'project_manager', 'animator', 'editor', 'client'];

    if (!$name || strlen($name) > 100 || !preg_match("/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/u", $name)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Enter a valid name.']);
        exit;
    }

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Enter a valid email.']);
        exit;
    }

    if (!is_string($password) || strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters.']);
        exit;
    }

    if (!in_array($role, $allowedRoles, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Choose a valid team role.']);
        exit;
    }

    try {
        $exists = $pdo->prepare('SELECT id FROM app_users WHERE LOWER(email) = LOWER(?) LIMIT 1');
        $exists->execute([$email]);
        if ($exists->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'An account with that email already exists.']);
            exit;
        }

        $nextNumber = $pdo->query("
            SELECT COALESCE(MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)), 0) + 1
            FROM app_users
        ")->fetchColumn();
        $id = 'u' . (int)$nextNumber;
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("
            INSERT INTO app_users (id, full_name, email, password, role)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$id, $name, $email, $hashedPassword, $role]);

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $id,
                'full_name' => $name,
                'email' => $email,
                'role' => $role
            ]
        ]);
        exit;
    } catch (PDOException $e) {
        error_log('Team member creation failed: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Unable to add team member.']);
        exit;
    }
}


// ==================================================
// LOGOUT
// ==================================================

if ($action === 'logout') {

    unset(
        $_SESSION['user_id'],
        $_SESSION['name'],
        $_SESSION['email'],
        $_SESSION['role'],
        $_SESSION['user']
    );
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {

        $params = session_get_cookie_params();

        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    session_destroy();

    echo json_encode([
        'success' => true
    ]);

    exit;
}


// ==================================================
// LOGIN
// ==================================================

if ($action === 'login') {

    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';


    if (!$email || !$password) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Email and password are required.'
        ]);

        exit;
    }


    try {

        $stmt = $pdo->prepare("
            SELECT
                id,
                full_name,
                email,
                password,
                role
            FROM app_users
            WHERE LOWER(email) = LOWER(?)
            LIMIT 1
        ");

        $stmt->execute([
            $email
        ]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);


        if (
            !$user ||
            !password_verify(
                $password,
                $user['password']
            )
        ) {

            http_response_code(401);

            echo json_encode([
                'success' => false,
                'error' => 'Invalid email or password.'
            ]);

            exit;
        }


        unset($user['password']);

        session_regenerate_id(true);
        $user['role'] = strtolower(trim($user['role']));
        $user['name'] = $user['full_name'];
        $_SESSION['user'] = $user;
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['name'] = $user['full_name'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['role'] = $user['role'];


        echo json_encode([
            'success' => true,
            'user' => $user
        ]);

        exit;

    } catch (PDOException $e) {

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'error' => 'Database error.'
        ]);

        exit;
    }
}


// ==================================================
// REGISTER / CREATE ACCOUNT
// ==================================================

if ($action === 'register') {

    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $role = 'client';


    // ----------------------------------------------
    // VALIDATE ACCOUNT
    // ----------------------------------------------

    if (!$name) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Enter your full name.'
        ]);

        exit;
    }


    if (
        !$email ||
        !filter_var($email, FILTER_VALIDATE_EMAIL)
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Enter a valid email.'
        ]);

        exit;
    }


    if (strlen($password) < 6) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'error' => 'Password must be at least 6 characters.'
        ]);

        exit;
    }


    try {

        // ------------------------------------------
        // CHECK DUPLICATE EMAIL
        // ------------------------------------------

        $exists = $pdo->prepare("
            SELECT id
            FROM app_users
            WHERE LOWER(email) = LOWER(?)
            LIMIT 1
        ");

        $exists->execute([
            $email
        ]);


        if ($exists->fetch()) {

            http_response_code(409);

            echo json_encode([
                'success' => false,
                'error' => 'An account with that email already exists.'
            ]);

            exit;
        }


        // ------------------------------------------
        // GENERATE USER ID
        // ------------------------------------------

        $nextNumber = $pdo->query("
            SELECT
                COALESCE(
                    MAX(
                        CAST(
                            SUBSTRING(id, 2)
                            AS UNSIGNED
                        )
                    ),
                    0
                ) + 1
            FROM app_users
        ")->fetchColumn();


        $id = 'u' . (int)$nextNumber;


        // ------------------------------------------
        // HASH PASSWORD
        // ------------------------------------------

        $hashedPassword = password_hash(
            $password,
            PASSWORD_DEFAULT
        );


        // ------------------------------------------
        // SAVE ACCOUNT TO MYSQL
        // ------------------------------------------

        $stmt = $pdo->prepare("
            INSERT INTO app_users
            (
                id,
                full_name,
                email,
                password,
                role
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?
            )
        ");


        $stmt->execute([
            $id,
            $name,
            $email,
            $hashedPassword,
            $role
        ]);


        // ------------------------------------------
        // RETURN NEW ACCOUNT
        // ------------------------------------------

        $user = [
            'id' => $id,
            'full_name' => $name,
            'email' => $email,
            'role' => $role
        ];


        /*
         * IMPORTANT:
         *
         * Do NOT automatically log the user in here.
         *
         * The account is saved to MySQL first.
         * login.js will reload the Quick Sign-In
         * section and show this newly-created account.
         */

        echo json_encode([
            'success' => true,
            'user' => $user
        ]);

        exit;

    } catch (PDOException $e) {

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'error' => 'Unable to create account in the database.'
        ]);

        exit;
    }
}


// ==================================================
// UNKNOWN ACTION
// ==================================================

http_response_code(400);

echo json_encode([
    'success' => false,
    'error' => 'Unknown action.'
]);

exit;