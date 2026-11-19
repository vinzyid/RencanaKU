#!/bin/sh
#
# Entrypoint container RencanaKU.
#
#   (tanpa argumen)   -> web: cache, migrasi, lalu FrankenPHP
#   <perintah lain>   -> worker (queue/scheduler): cache konfigurasi lalu jalankan perintah itu
#
# Migrasi hanya dikerjakan container web supaya worker tidak ikut balapan.
set -e

# FrankenPHP membaca port dari variabel PORT di docker/Caddyfile.
export PORT="${PORT:-8080}"

# bootstrap/cache ada di dalam image (tidak dibagi), jadi aman di tiap container.
php artisan config:cache
php artisan route:cache || echo "Peringatan: route:cache gagal, rute tetap jalan tanpa cache." >&2
php artisan event:cache

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

php artisan view:clear >/dev/null 2>&1 || true
php artisan view:cache >/dev/null 2>&1 || true

php artisan migrate --force

exec frankenphp run --config /etc/caddy/Caddyfile --adapter caddyfile
