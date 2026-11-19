# Deploy RencanaKU ke VPS

RencanaKU dipasang memakai Docker + Caddy di VPS yang sama dengan LexiScan dan VinzyPlay:

- satu domain `https://rencanaku.biz.id` melayani frontend React **dan** API Laravel
  (`/api`, `/oauth`, `/up` diteruskan ke Laravel, sisanya ke SPA);
- container web hanya mendengarkan `127.0.0.1:8082` (8080 = LexiScan, 8081 = VinzyPlay);
- konfigurasi Caddy-nya terpisah di `/etc/caddy/sites/rencanaku.caddy`.

Database tetap di **Supabase**. Di VPS hanya ada container dan volume `storage` (sesi, cache, log).

| Container             | Tugas                                                         |
|-----------------------|---------------------------------------------------------------|
| `rencanaku-web`       | SPA React + API Laravel (FrankenPHP), menjalankan migrasi     |
| `rencanaku-queue`     | memproses chat dengan AI (job `ProcessProjectMessage`)        |
| `rencanaku-scheduler` | tugas harian (hapus token login kedaluwarsa)                  |

> Tanpa container `queue`, chat akan terus "sedang memproses" karena AI dikerjakan di antrean.

---

## 1. DNS (di panel domain rencanaku.biz.id)

| Type | Name  | Value              |
|------|-------|--------------------|
| A    | `@`   | `<IP_PUBLIK_VPS>`  |
| A    | `www` | `<IP_PUBLIK_VPS>`  |

`www` otomatis dialihkan ke `rencanaku.biz.id`. Cek dari VPS: `dig +short rencanaku.biz.id` harus membalas IP VPS.
Port 80 & 443 sudah terbuka karena dipakai situs lain.

## 2. OAuth (kalau login Google/GitHub dipakai)

**Google Cloud Console** → OAuth Client RencanaKU:

- Authorized JavaScript origins: `https://rencanaku.biz.id`
- Authorized redirect URIs: `https://rencanaku.biz.id/oauth/google/callback`

**GitHub** → Settings → Developer settings → OAuth Apps:

- Homepage URL: `https://rencanaku.biz.id`
- Authorization callback URL: `https://rencanaku.biz.id/oauth/github/callback`

URI `localhost` boleh tetap ada supaya development di laptop masih jalan.

## 3. Pemasangan pertama (sekali saja)

```bash
ssh ubuntu@<IP_PUBLIK_VPS>

git clone https://github.com/vinzyid/RencanaKU.git ~/rencanaku
cd ~/rencanaku
bash deploy/setup-vps.sh          # tekan Enter untuk rencanaku.biz.id
nano .env.production              # isi DB_*, GRIPHUB_API_KEY, GOOGLE_*, GITHUB_*, MAIL_*, ADMIN_EMAILS
./deploy.sh
```

> Repo privat? Saat `git clone` diminta password, masukkan GitHub Personal Access Token.

Buat akun admin produksi (isi `ADMIN_SEED_EMAIL` & `ADMIN_SEED_PASSWORD` dulu, lalu):

```bash
docker compose exec web php artisan db:seed --class=AdminUserSeeder --force
```

`setup-vps.sh` tidak menyentuh situs lain: ia hanya menambah `/etc/caddy/sites/rencanaku.caddy`
(dan baris `import /etc/caddy/sites/*.caddy` kalau belum ada, dengan cadangan `.bak-*`), lalu
memvalidasi konfigurasi sebelum Caddy dimuat ulang. Kalau tidak valid, site RencanaKU dibatalkan.

## 4. Update berikutnya

Di laptop: commit & push ke `main`. Lalu di VPS:

```bash
cd ~/rencanaku && ./deploy.sh
```

Skrip ini menarik kode, build image (React + Laravel), menjalankan migrasi, mengganti container,
menunggu sampai situs merespons, lalu me-restart worker AI.

---

## Perintah harian (dari `~/rencanaku`)

| Tujuan            | Perintah                                         |
|-------------------|--------------------------------------------------|
| Log situs         | `docker compose logs -f web`                     |
| Log AI / antrean  | `docker compose logs -f queue`                   |
| Status            | `docker compose ps`                              |
| Artisan           | `docker compose exec web php artisan <perintah>` |
| Restart           | `docker compose restart`                         |
| **Habis ubah `.env.production`** | `docker compose up -d --force-recreate` |
| Log Laravel       | `docker compose exec web tail -50 storage/logs/laravel.log` |

## Pemecahan masalah

**Chat tidak pernah selesai "memproses"** — worker antrean mati atau kunci AI salah. Cek `docker compose logs --tail=100 queue`.
Kalau semua provider gagal, RencanaKU jatuh ke mesin lokal (hasil lebih sederhana) — pastikan `GRIPHUB_API_KEY` terisi.

**Perubahan `.env.production` tidak berpengaruh** — `docker compose restart` tidak membaca ulang berkas env. Jalankan `docker compose up -d --force-recreate` (atau `./deploy.sh`).

**Halaman 404 saat refresh di `/app/...`** — seharusnya tidak terjadi (fallback ke `index.html` ada di `docker/Caddyfile`). Kalau terjadi, image lama masih jalan: `./deploy.sh`.

**Error CORS di console browser** — `CORS_ALLOWED_ORIGINS` harus `https://rencanaku.biz.id` (tanpa `/` di akhir), lalu recreate container.

**Login Google "redirect_uri_mismatch"** — redirect URI di Google Cloud Console belum sama persis dengan `https://rencanaku.biz.id/oauth/google/callback`.

**HTTPS gagal / sertifikat tidak terbit** — pastikan A record sudah benar (`dig +short rencanaku.biz.id`), lalu lihat `sudo journalctl -u caddy -n 50 --no-pager`.

**502 Bad Gateway** — container web belum siap atau mati: `docker compose logs --tail=100 web`.

**Gagal konek database** — pakai host *Session Pooler* Supabase (port 5432, `DB_USERNAME=postgres.<project-ref>`), bukan host direct yang hanya IPv6.

**Email reset password tidak terkirim** — `MAIL_PASSWORD` harus App Password 16 huruf **tanpa spasi**. Cek `docker compose logs web` dan log Laravel.

**Build kehabisan memori (`Killed`)** — build React + Composer cukup berat; tambahkan swap 2 GB:
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Keamanan

- `.env.production` tidak pernah di-commit (sudah di `.gitignore`) dan diset `chmod 600`.
- `APP_DEBUG=false` di produksi.
- Port `8082` hanya terbuka di localhost; jangan dibuka di Security Group.
- Akun admin produksi memakai password kuat, bukan password dari seeder lokal.
