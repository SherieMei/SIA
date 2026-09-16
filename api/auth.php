<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/db.php';

if (session_status() === PHP_SESSION_NONE) {
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

        echo json_encode([
            'authenticated' => isset($_SESSION['user']),
            'user' => $_SESSION['user'] ?? null
        ]);

        exit;
    }


    // ----------------------------------------------
    // LOAD REAL REGISTERED USERS
    // FOR QUICK SIGN-IN
    // ----------------------------------------------

    if ($action === 'users') {

        try {

            $stmt = $pdo->query("
                SELECT
                    id,
                    full_name,
                    email,
                    role
                FROM app_users
                ORDER BY created_at DESC, full_name ASC
            ");

            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

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
// LOGOUT
// ==================================================

if ($action === 'logout') {

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


        $_SESSION['user'] = $user;


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
    $role = $input['role'] ?? 'viewer';


    $roles = [
        'admin',
        'artist',
        'animator',
        'editor',
        'reviewer',
        'project_manager',
        'client',
        'viewer'
    ];


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


    if (!in_array($role, $roles, true)) {
        $role = 'viewer';
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