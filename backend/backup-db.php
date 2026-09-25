<?php

/**
 * Backup penuh database PostgreSQL (struktur + data) tanpa perlu pg_dump.
 * Pemakaian: php backup-db.php
 * Hasil: storage/backups/backup_db_YYYYmmdd_HHMMSS.sql
 */

$root = __DIR__;

try {
    $env = parseEnv($root . DIRECTORY_SEPARATOR . '.env');
} catch (Throwable $e) {
    fwrite(STDERR, "Gagal membaca .env: {$e->getMessage()}\n");
    exit(1);
}

$host   = $env['DB_HOST'] ?? '127.0.0.1';
$port   = $env['DB_PORT'] ?? '5432';
$dbname = $env['DB_DATABASE'] ?? 'postgres';
$user   = $env['DB_USERNAME'] ?? 'postgres';
$pass   = $env['DB_PASSWORD'] ?? '';

$outDir = $root . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'backups';
if (!is_dir($outDir)) {
    mkdir($outDir, 0775, true);
}

$timestamp = date('Ymd_His');
$outFile   = $outDir . DIRECTORY_SEPARATOR . "backup_db_{$timestamp}.sql";

$dsn = "pgsql:host={$host};port={$port};dbname={$dbname};sslmode=" . ($env['DB_SSLMODE'] ?? 'prefer');

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (Throwable $e) {
    fwrite(STDERR, "Gagal konek ke database: {$e->getMessage()}\n");
    exit(1);
}

$fh = fopen($outFile, 'w');
if ($fh === false) {
    fwrite(STDERR, "Tidak bisa menulis file backup.\n");
    exit(1);
}

fwrite($fh, "-- Backup database {$dbname}\n");
fwrite($fh, "-- Dibuat: " . date('c') . "\n");
fwrite($fh, "-- Sumber: {$host}:{$port}/{$dbname}\n\n");
fwrite($fh, "SET statement_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\n\n");

$tables = $pdo->query(
    "SELECT schemaname, tablename
     FROM pg_tables
     WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
     ORDER BY schemaname, tablename"
)->fetchAll(PDO::FETCH_ASSOC);

if (!$tables) {
    fwrite($fh, "-- Tidak ada tabel ditemukan.\n");
    fclose($fh);
    echo "Backup selesai (database kosong): {$outFile}\n";
    exit(0);
}

$schemas = $pdo->query(
    "SELECT nspname
     FROM pg_namespace
     WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pgbouncer')
       AND nspname NOT LIKE 'pg_temp%'
       AND nspname NOT LIKE 'pg_toast_temp%'
     ORDER BY nspname"
)->fetchAll(PDO::FETCH_COLUMN);

foreach ($schemas as $schema) {
    fwrite($fh, "CREATE SCHEMA IF NOT EXISTS \"{$schema}\";\n");
}
fwrite($fh, "\n");

foreach ($tables as $t) {
    $schema = $t['schemaname'];
    $table  = $t['tablename'];
    $quoted = "\"{$schema}\".\"{$table}\"";

    fwrite($fh, "-- ----------------------------\n");
    fwrite($fh, "-- Tabel: {$schema}.{$table}\n");
    fwrite($fh, "-- ----------------------------\n");
    fwrite($fh, "DROP TABLE IF EXISTS {$quoted} CASCADE;\n");

    fwrite($fh, buildCreateTable($pdo, $schema, $table) . "\n\n");

    $stmt = $pdo->query("SELECT * FROM {$quoted}");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $columns = $stmt->columnCount();
    $columnNames = [];
    for ($i = 0; $i < $columns; $i++) {
        $meta = $stmt->getColumnMeta($i);
        $columnNames[] = '"' . $meta['name'] . '"';
    }

    if ($rows) {
        foreach ($rows as $row) {
            $values = [];
            foreach ($row as $value) {
                if ($value === null) {
                    $values[] = 'NULL';
                } elseif (is_bool($value)) {
                    $values[] = $value ? 'TRUE' : 'FALSE';
                } elseif (is_int($value) || is_float($value)) {
                    $values[] = (string) $value;
                } else {
                    $values[] = $pdo->quote((string) $value);
                }
            }
            fwrite($fh, "INSERT INTO {$quoted} (" . implode(', ', $columnNames) . ") VALUES (" . implode(', ', $values) . ");\n");
        }
    }

    fwrite($fh, "\n");
}

fclose($fh);

$size = number_format(filesize($outFile) / 1024, 1);
echo "Backup selesai: {$outFile} ({$size} KB, " . count($tables) . " tabel)\n";

/**
 * Membangun statement CREATE TABLE + index + constraint untuk satu tabel.
 */
function buildCreateTable(PDO $pdo, string $schema, string $table): string
{
    $ident = "\"{$schema}\".\"{$table}\"";

    $cols = $pdo->prepare(
        "SELECT column_name, data_type, udt_name, character_maximum_length,
                numeric_precision, numeric_scale, column_default, is_nullable
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position"
    );
    $cols->execute([$schema, $table]);
    $columns = $cols->fetchAll(PDO::FETCH_ASSOC);

    $defs = [];
    $pkColumns = [];

    $pkStmt = $pdo->prepare(
        "SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = ? AND tc.table_name = ?
         ORDER BY kcu.ordinal_position"
    );
    $pkStmt->execute([$schema, $table]);
    foreach ($pkStmt->fetchAll(PDO::FETCH_COLUMN) as $c) {
        $pkColumns[] = '"' . $c . '"';
    }

    foreach ($columns as $col) {
        $line = '"' . $col['column_name'] . '" ' . mapType($col);

        if ($col['column_default'] !== null) {
            $line .= ' DEFAULT ' . $col['column_default'];
        }

        if ($col['is_nullable'] === 'NO') {
            $line .= ' NOT NULL';
        }

        $defs[] = $line;
    }

    if ($pkColumns) {
        $defs[] = 'PRIMARY KEY (' . implode(', ', $pkColumns) . ')';
    }

    $sql = "CREATE TABLE {$ident} (\n    " . implode(",\n    ", $defs) . "\n);";

    $idxStmt = $pdo->prepare(
        "SELECT indexdef
         FROM pg_indexes
         WHERE schemaname = ? AND tablename = ?
           AND indexname NOT IN (
               SELECT conname FROM pg_constraint
               WHERE conrelid = to_regclass(?) AND contype IN ('p', 'u')
           )"
    );
    $idxStmt->execute([$schema, $table, "{$schema}.{$table}"]);
    foreach ($idxStmt->fetchAll(PDO::FETCH_COLUMN) as $indexdef) {
        $sql .= "\n" . $indexdef . ";";
    }

    return $sql;
}

/**
 * Memetakan tipe kolom PostgreSQL ke tipe yang bisa di-restore.
 */
function mapType(array $col): string
{
    $type = $col['data_type'];

    if ($type === 'character varying') {
        return $col['character_maximum_length'] !== null
            ? 'varchar(' . $col['character_maximum_length'] . ')'
            : 'varchar';
    }

    if ($type === 'character') {
        return $col['character_maximum_length'] !== null
            ? 'char(' . $col['character_maximum_length'] . ')'
            : 'char';
    }

    if ($type === 'numeric' && $col['numeric_precision'] !== null) {
        $scale = $col['numeric_scale'] ?? 0;
        return 'numeric(' . $col['numeric_precision'] . ', ' . $scale . ')';
    }

    if ($type === 'USER-DEFINED') {
        return $col['udt_name'];
    }

    if ($type === 'ARRAY') {
        return $col['udt_name'];
    }

    return $type;
}

/**
 * Parser .env sederhana untuk membaca kredensial DB.
 */
function parseEnv(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException("File .env tidak ditemukan");
    }

    $result = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (!str_contains($line, '=')) {
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
