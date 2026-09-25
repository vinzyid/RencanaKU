<?php

/**
 * Restore database PostgreSQL dari file backup .sql yang dibuat backup-db.php.
 * Pemakaian: php restore-db.php storage/backups/backup_db_YYYYmmdd_HHMMSS.sql
 *
 * PERINGATAN: script ini menghapus tabel yang ada lalu membuat ulang dari backup.
 */

$root = __DIR__;

if (!isset($argv[1]) || !is_file($argv[1])) {
    fwrite(STDERR, "Pemakaian: php restore-db.php <file_backup.sql>\n");
    fwrite(STDERR, "Contoh : php restore-db.php storage/backups/backup_db_20260919_132820.sql\n");
    exit(1);
}

$file = $argv[1];
$env = parseEnv($root . DIRECTORY_SEPARATOR . '.env');

$host   = $env['DB_HOST'] ?? '127.0.0.1';
$port   = $env['DB_PORT'] ?? '5432';
$dbname = $env['DB_DATABASE'] ?? 'postgres';
$user   = $env['DB_USERNAME'] ?? 'postgres';
$pass   = $env['DB_PASSWORD'] ?? '';

$dsn = "pgsql:host={$host};port={$port};dbname={$dbname};sslmode=" . ($env['DB_SSLMODE'] ?? 'prefer');

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (Throwable $e) {
    fwrite(STDERR, "Gagal konek ke database: {$e->getMessage()}\n");
    exit(1);
}

echo "Menjalankan restore dari: {$file}\n";
echo "Target: {$host}:{$port}/{$dbname}\n";

$sql = file_get_contents($file);
if ($sql === false) {
    fwrite(STDERR, "Tidak bisa membaca file backup.\n");
    exit(1);
}

try {
    $pdo->exec($sql);
} catch (Throwable $e) {
    fwrite(STDERR, "Restore gagal: {$e->getMessage()}\n");
    exit(1);
}

echo "Restore selesai.\n";

function parseEnv(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException("File .env tidak ditemukan");
    }

    $result = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
            $value = substr($value, 1, -1);
        }
        $result[$key] = $value;
    }

    return $result;
}
