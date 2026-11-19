# RencanaKU — image Docker produksi (satu domain: React SPA + API Laravel).
#
# Tiga tahap:
#   1. vendor : dependensi Composer untuk backend/
#   2. spa    : build React (frontend/) dengan Vite -> /app/spa
#   3. app    : FrankenPHP menyajikan SPA + meneruskan /api, /oauth, /up ke Laravel
#
# Kredensial tidak ditanam ke image; semuanya dibaca dari .env.production saat runtime.

# --- 1. Dependensi Composer ------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist \
    --no-interaction \
    --ignore-platform-reqs

# --- 2. Frontend React -----------------------------------------------------
FROM node:22-bookworm-slim AS spa
WORKDIR /spa
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Kosong = frontend memanggil /api di domain yang sama (rencanaku.biz.id/api).
ENV VITE_API_URL=
RUN npm run build

# --- 3. Aplikasi -----------------------------------------------------------
FROM dunglas/frankenphp:1-php8.3-bookworm

# pdo_pgsql untuk Supabase, gd untuk dompdf (ekspor PDF), intl untuk format tanggal.
RUN install-php-extensions \
    pdo_pgsql \
    intl \
    zip \
    gd \
    bcmath \
    opcache \
    pcntl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/php.ini /usr/local/etc/php/conf.d/99-rencanaku.ini
COPY docker/Caddyfile /etc/caddy/Caddyfile

WORKDIR /app

COPY --from=vendor /app/vendor ./vendor
COPY backend/ ./
COPY --from=spa /spa/dist /app/spa

# storage/ dibuang lewat .dockerignore, jadi direktori kerjanya dibuat ulang di sini.
RUN mkdir -p \
        storage/logs \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/app/public \
        bootstrap/cache \
    && composer dump-autoload --optimize --no-dev --classmap-authoritative \
    && php artisan package:discover --ansi \
    && chmod -R ug+rw storage bootstrap/cache

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]
