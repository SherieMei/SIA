<?php
// CLI only: exports the app database, including password hashes for Auth migration.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../../config/database.php';
$output = $argv[1] ?? null;
if (!$output) {
    fwrite(STDERR, "Usage: php export.php /private/tmp/atlas-export.json\n");
    exit(1);
}
try {
    $pdo = atlas_database_connection();
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $pdo->beginTransaction();
    $tables = [];
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $quoted = '`' . str_replace('`', '``', $table) . '`';
        $columns = $pdo->query("SHOW COLUMNS FROM $quoted")->fetchAll();
        $primaryKeys = array_column(array_filter($columns, function ($column) {
            return $column['Key'] === 'PRI';
        }), 'Field');
        $tables[$table] = [
            'primaryKeys' => $primaryKeys,
            'rows' => $pdo->query("SELECT * FROM $quoted")->fetchAll()
        ];
    }
    $pdo->commit();
    $json = json_encode([
        'database' => $pdo->query('SELECT DATABASE()')->fetchColumn(),
        'exportedAt' => gmdate('c'),
        'tables' => $tables
    ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
    // Never expose password hashes through an Apache-served directory.
    $parent = realpath(dirname($output));
    $webRoot = realpath(__DIR__ . '/../..');
    if (!$parent || $parent === $webRoot || strpos($parent, $webRoot . DIRECTORY_SEPARATOR) === 0) {
        throw new RuntimeException('Choose an output directory outside the website.');
    }
    $previousMask = umask(0077);
    $handle = fopen($output, 'x');
    umask($previousMask);
    if (!$handle) {
        throw new RuntimeException('Cannot create export (file may already exist).');
    }
    if (fwrite($handle, $json) !== strlen($json)) {
        throw new RuntimeException('Incomplete export write.');
    }
    fclose($handle);
    foreach ($tables as $name => $table) {
        echo $name . ': ' . count($table['rows']) . " rows\n";
    }
    echo "Export saved to $output\n";
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
