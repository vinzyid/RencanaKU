#!/usr/bin/env bash
#
# deploy.sh — perbarui RencanaKU di VPS dengan satu perintah.
#
#   cd ~/rencanaku && ./deploy.sh
#
# Langkah: tarik kode terbaru -> build image (React + Laravel) -> ganti container
# -> tunggu sehat -> restart worker AI.
# Data utama ada di Supabase, jadi aman diulang kapan saja.
#
# Prasyarat sekali saja: bash deploy/setup-vps.sh, lalu isi .env.production.

set -euo pipefail

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$1" >&2; exit 1; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

command -v docker >/dev/null 2>&1 || die "Docker belum terpasang. Jalankan: bash deploy/setup-vps.sh"
[ -f .env.production ] || die ".env.production belum ada. Jalankan: bash deploy/setup-vps.sh"
grep -qE '^APP_KEY=.+' .env.production || die "APP_KEY di .env.production masih kosong."
grep -qE '^DB_HOST=.+' .env.production || die "DB_HOST di .env.production masih kosong."
grep -qE '^DB_PASSWORD=.+' .env.production || die "DB_PASSWORD di .env.production masih kosong."

DC="docker compose"
docker info >/dev/null 2>&1 || DC="sudo docker compose"

# 1. Kode terbaru.
if [ -d .git ]; then
  info "Menarik kode terbaru"
  BEFORE=$(git rev-parse --short HEAD)
  git pull --ff-only
  AFTER=$(git rev-parse --short HEAD)
  [ "$BEFORE" = "$AFTER" ] && ok "Sudah versi terbaru ($AFTER)" || ok "Diperbarui $BEFORE -> $AFTER"
fi

# 2. Build image (frontend React + backend Laravel).
info "Membangun image"
$DC build --pull web

# 3. Ganti container (migrasi database jalan otomatis di container web).
info "Menjalankan ulang container"
$DC up -d --remove-orphans

# 4. Tunggu sampai situs sehat.
info "Menunggu situs siap"
for i in $(seq 1 40); do
  if curl -fsS -o /dev/null http://127.0.0.1:8082/up; then
    ok "API merespons"
    break
  fi
  if [ "$i" -eq 40 ]; then
    $DC logs --tail=60 web
    die "Situs belum merespons setelah 2 menit. Lihat log di atas."
  fi
  sleep 3
done
curl -fsS -o /dev/null http://127.0.0.1:8082/ && ok "Frontend React tersaji" || \
  printf '\033[1;33m  !\033[0m Halaman utama belum terbuka; cek: %s logs --tail=60 web\n' "$DC"

# 5. Worker antrean (AI) memuat ulang kode baru.
$DC exec -T web php artisan queue:restart >/dev/null 2>&1 || true

# 6. Bersihkan image lama.
docker image prune -f >/dev/null 2>&1 || sudo docker image prune -f >/dev/null 2>&1 || true

echo
$DC ps
echo
DOMAIN=$(grep -E '^APP_URL=' .env.production | cut -d= -f2-)
ok "Deploy selesai: $DOMAIN"
echo "   Log web:    $DC logs -f web"
echo "   Log AI:     $DC logs -f queue"
