#!/usr/bin/env bash
#
# setup-vps.sh — siapkan RencanaKU di VPS (sekali jalan, aman diulang).
#
# Skrip ini:
#   1. Memastikan Docker + Caddy ada (memasang kalau belum)
#   2. Memasang site Caddy RencanaKU di /etc/caddy/sites/ TANPA menimpa Caddyfile
#      yang sudah ada (LexiScan & VinzyPlay tetap jalan)
#   3. Menyiapkan .env.production: APP_URL, CORS, redirect OAuth, APP_KEY
#
# Pakai:
#   cd ~/rencanaku && bash deploy/setup-vps.sh
#   DOMAIN=rencanaku.biz.id bash deploy/setup-vps.sh   # tanpa pertanyaan

set -euo pipefail

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m  !\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$1" >&2; exit 1; }

DEFAULT_DOMAIN="rencanaku.biz.id"
APP_PORT=8082

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  die "Butuh hak root. Jalankan sebagai root atau pasang sudo dulu."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$APP_DIR/docker-compose.yml" ] || die "docker-compose.yml tidak ditemukan di $APP_DIR."

# --- 1. Docker -------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  ok "Docker sudah terpasang ($(docker --version))"
else
  info "Memasang Docker"
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl gnupg git
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker >/dev/null 2>&1 || true
  $SUDO usermod -aG docker "${SUDO_USER:-${USER:-$(id -un)}}" || true
  ok "Docker terpasang (logout lalu login lagi agar 'docker' jalan tanpa sudo)"
fi
docker compose version >/dev/null 2>&1 || $SUDO docker compose version >/dev/null 2>&1 || \
  die "Docker Compose plugin tidak ditemukan. Pasang paket docker-compose-plugin."

# Port aplikasi harus bebas (8080 = LexiScan, 8081 = VinzyPlay).
if command -v ss >/dev/null 2>&1 && $SUDO ss -ltn "( sport = :$APP_PORT )" | grep -q LISTEN; then
  if ! (docker ps 2>/dev/null || $SUDO docker ps) | grep -q rencanaku-web; then
    die "Port $APP_PORT sudah dipakai aplikasi lain. Ganti port di docker-compose.yml & deploy/Caddyfile."
  fi
fi

# --- 2. Caddy --------------------------------------------------------------
if command -v caddy >/dev/null 2>&1; then
  ok "Caddy sudah terpasang"
else
  info "Memasang Caddy"
  $SUDO apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | $SUDO gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  $SUDO apt-get update -y
  $SUDO apt-get install -y caddy
  ok "Caddy terpasang"
fi

# --- 3. Domain -------------------------------------------------------------
DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ] && [ -t 0 ]; then
  printf 'Domain RencanaKU [%s]: ' "$DEFAULT_DOMAIN"
  read -r DOMAIN
fi
DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%/}"; DOMAIN="${DOMAIN#www.}"

# Peringatan dini kalau DNS belum mengarah ke VPS ini (sertifikat HTTPS akan gagal).
PUBLIC_IP=$(curl -fsS -4 --max-time 5 https://api.ipify.org 2>/dev/null || true)
DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
if [ -n "$PUBLIC_IP" ] && [ "$DNS_IP" != "$PUBLIC_IP" ]; then
  warn "DNS $DOMAIN -> ${DNS_IP:-(belum ada)}, IP VPS ini $PUBLIC_IP. Sertifikat HTTPS baru terbit setelah A record benar."
fi

# --- 4. Site Caddy (berdampingan dengan situs lain) -----------------------
info "Memasang site Caddy untuk $DOMAIN"
$SUDO mkdir -p /etc/caddy/sites /var/log/caddy
$SUDO chown caddy:caddy /var/log/caddy 2>/dev/null || true
sed "s/DOMAIN_RENCANAKU/$DOMAIN/g" "$SCRIPT_DIR/Caddyfile" | $SUDO tee /etc/caddy/sites/rencanaku.caddy >/dev/null

MAIN_CADDY=/etc/caddy/Caddyfile
$SUDO touch "$MAIN_CADDY"
if ! $SUDO grep -qE '^[[:space:]]*import[[:space:]]+(/etc/caddy/)?sites/\*' "$MAIN_CADDY"; then
  $SUDO cp "$MAIN_CADDY" "$MAIN_CADDY.bak-$(date +%Y%m%d%H%M%S)"
  printf '\n# Site lain (VinzyPlay, RencanaKU, dst.) — ditambahkan oleh rencanaku/deploy/setup-vps.sh\nimport /etc/caddy/sites/*.caddy\n' \
    | $SUDO tee -a "$MAIN_CADDY" >/dev/null
  ok "Baris 'import /etc/caddy/sites/*.caddy' ditambahkan ke $MAIN_CADDY (cadangan .bak dibuat)"
else
  ok "Caddyfile utama sudah mengimpor sites/"
fi

# Validasi dijalankan sebagai user "caddy". Kalau dijalankan sebagai root, caddy
# validate ikut membuat berkas log milik root, lalu layanan Caddy (user caddy)
# gagal start karena "permission denied" dan SEMUA situs di VPS ikut mati.
CADDY_AS="$SUDO -u caddy"
id caddy >/dev/null 2>&1 || CADDY_AS="$SUDO"
if ! $CADDY_AS caddy validate --config "$MAIN_CADDY" --adapter caddyfile >/dev/null 2>&1; then
  $CADDY_AS caddy validate --config "$MAIN_CADDY" --adapter caddyfile || true
  $SUDO chown -R caddy:caddy /var/log/caddy 2>/dev/null || true
  $SUDO rm -f /etc/caddy/sites/rencanaku.caddy
  die "Konfigurasi Caddy tidak valid; site RencanaKU dibatalkan dan Caddy TIDAK dimuat ulang."
fi
$SUDO chown -R caddy:caddy /var/log/caddy 2>/dev/null || true

if systemctl is-active --quiet caddy; then
  $SUDO systemctl reload caddy
else
  $SUDO systemctl restart caddy
fi
sleep 2
systemctl is-active --quiet caddy || {
  $SUDO journalctl -u caddy -n 20 --no-pager || true
  die "Caddy gagal jalan. Lihat log di atas."
}
ok "Caddy aktif dengan konfigurasi baru (situs lain tetap jalan)"

# --- 5. .env.production ----------------------------------------------------
ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  cp "$SCRIPT_DIR/.env.production.example" "$ENV_FILE"
  ok "Membuat $ENV_FILE dari template"
fi
chmod 600 "$ENV_FILE"
sed -i "s#DOMAIN_RENCANAKU#$DOMAIN#g" "$ENV_FILE"
sed -i "s#^APP_URL=.*#APP_URL=https://$DOMAIN#" "$ENV_FILE"
sed -i "s#^APP_FRONTEND_URL=.*#APP_FRONTEND_URL=https://$DOMAIN#" "$ENV_FILE"
sed -i "s#^CORS_ALLOWED_ORIGINS=.*#CORS_ALLOWED_ORIGINS=https://$DOMAIN#" "$ENV_FILE"
sed -i "s#^GOOGLE_REDIRECT_URI=.*#GOOGLE_REDIRECT_URI=https://$DOMAIN/oauth/google/callback#" "$ENV_FILE"
sed -i "s#^GITHUB_REDIRECT_URI=.*#GITHUB_REDIRECT_URI=https://$DOMAIN/oauth/github/callback#" "$ENV_FILE"

if grep -q '^APP_KEY=$' "$ENV_FILE"; then
  KEY="base64:$(head -c 32 /dev/urandom | base64)"
  sed -i "s#^APP_KEY=\$#APP_KEY=$KEY#" "$ENV_FILE"
  ok "APP_KEY dibuat"
fi
ok "APP_URL = https://$DOMAIN"

# --- Ringkasan -------------------------------------------------------------
MISSING=$(grep -E '^(DB_HOST|DB_USERNAME|DB_PASSWORD|GRIPHUB_API_KEY|MAIL_USERNAME|MAIL_PASSWORD|MAIL_FROM_ADDRESS)=$' "$ENV_FILE" | cut -d= -f1 | tr '\n' ' ' || true)

cat <<EOF

$(printf '\033[1;32mSetup selesai.\033[0m') Langkah berikutnya:

  1. Lengkapi kredensial (salin dari backend/.env di laptop):
       nano $ENV_FILE
EOF
[ -n "$MISSING" ] && printf '     Masih kosong: \033[1;33m%s\033[0m\n' "$MISSING"
cat <<EOF

  2. Jalankan pertama kali (dan setiap update):
       bash $APP_DIR/deploy.sh

  3. Buka https://$DOMAIN
EOF
