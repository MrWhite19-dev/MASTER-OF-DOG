#!/bin/bash
set -euo pipefail

DOMAIN="masterofdog.fr"
APP_PATH="/var/www/masterofdog"
PROJECT_DIR="${APP_PATH}/current"
PUBLIC_DIR="${PROJECT_DIR}/MASTER-OF-DOG-WEB"
PRIVATE_DIR="${APP_PATH}/private"
UPLOAD_DIR="${PRIVATE_DIR}/uploads"
LOG_DIR="${APP_PATH}/logs"
DB_NAME="master_of_dog"
DB_USER="prod_user"
DB_PASSWORD="MotDePasseTresFort123!"
ADMIN_EMAIL="admin@masterofdog.fr"
ADMIN_PASSWORD="MotDePasseUltraFort2026!"

apt update
apt upgrade -y
apt install -y apache2 mysql-server php php-mysql php-cli php-json php-curl php-xml unzip git curl certbot python3-certbot-apache

a2enmod rewrite ssl headers

mkdir -p "${PRIVATE_DIR}" "${UPLOAD_DIR}" "${LOG_DIR}" "${PROJECT_DIR}"
chown -R www-data:www-data "${APP_PATH}"
chmod -R 755 "${APP_PATH}"

mysql -u root <<MYSQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL

cat > "${PRIVATE_DIR}/config.php" <<PHP
<?php
declare(strict_types=1);

return [
    'dsn' => 'mysql:host=localhost;dbname=master_of_dog;port=3306;charset=utf8mb4',
    'db_user' => 'prod_user',
    'db_password' => 'MotDePasseTresFort123!',
    'app_key' => 'cle_secrete_tres_longue_et_aleatoire_1234567890abcdef',
    'admin_email' => 'admin@masterofdog.fr',
    'public_url' => 'https://masterofdog.fr',
    'private_storage' => '/var/www/masterofdog/private/uploads',
    'analytics_enabled' => false,
    'smtp' => [
        'enabled' => true,
        'host' => 'smtp.your-provider.com',
        'port' => 587,
        'secure' => 'tls',
        'username' => 'smtp-user@your-provider.com',
        'password' => 'smtp-password',
        'from' => 'no-reply@masterofdog.fr',
        'from_name' => 'MASTER of DOG',
    ],
];
PHP
chmod 600 "${PRIVATE_DIR}/config.php"
chown www-data:www-data "${PRIVATE_DIR}/config.php"

if [ -d "${PUBLIC_DIR}" ]; then
    mysql -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < "${PUBLIC_DIR}/database/schema.sql"
    export MASTER_DOG_ADMIN_EMAIL="${ADMIN_EMAIL}"
    export MASTER_DOG_ADMIN_PASSWORD="${ADMIN_PASSWORD}"
    php "${PUBLIC_DIR}/bin/create_super_admin.php"
fi

cat > /etc/apache2/sites-available/masterofdog.conf <<APACHE
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}
    Redirect permanent / https://${DOMAIN}/
</VirtualHost>

<VirtualHost *:443>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}

    DocumentRoot ${PUBLIC_DIR}

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/${DOMAIN}/privkey.pem

    <Directory ${PUBLIC_DIR}>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    Alias /deploy ${PUBLIC_DIR}/deploy
    <Directory ${PUBLIC_DIR}/deploy>
        Options FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/masterofdog-error.log
    CustomLog ${APACHE_LOG_DIR}/masterofdog-access.log combined
</VirtualHost>
APACHE

a2ensite masterofdog.conf
a2dissite 000-default.conf
systemctl reload apache2

certbot --apache -d "${DOMAIN}" -d "www.${DOMAIN}"

cat > "${PUBLIC_DIR}/.htaccess" <<HTACCESS
Options -Indexes
ServerSignature Off

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} !=on
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
    RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]

    RewriteRule ^(app|bin|private|deploy|\.git|\.env)/ - [F,L]

    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_headers.c>
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
    Header always set Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
</IfModule>

<FilesMatch "\.(env|ini|log|sql|bak)$">
    Require all denied
</FilesMatch>
HTACCESS

cat > "${PUBLIC_DIR}/deploy/deploy.sh" <<DEPLOY
#!/bin/bash
set -euo pipefail

APP_ROOT="${PUBLIC_DIR}"
LOG_FILE="${PUBLIC_DIR}/deploy/deploy.log"

log() {
  echo "[\$(date -u +'%Y-%m-%dT%H:%M:%SZ')] \$*" | tee -a "\$LOG_FILE"
}

cd "\$APP_ROOT"
log "Vérification du dépôt Git"
git fetch --all --prune
git checkout main
git pull --ff-only origin main

log "Réparation des permissions"
find "\$APP_ROOT" -type d -exec chmod 755 {} +
find "\$APP_ROOT" -type f -exec chmod 644 {} +
chmod 700 /var/www/masterofdog/private
chmod 700 /var/www/masterofdog/private/uploads
chmod 600 /var/www/masterofdog/private/config.php 2>/dev/null || true

log "Déploiement terminé"
DEPLOY
chmod +x "${PUBLIC_DIR}/deploy/deploy.sh"

cat > "${PUBLIC_DIR}/deploy/webhook.php" <<WEBHOOK
<?php
declare(strict_types=1);

$secret = getenv('MASTER_DOG_WEBHOOK_SECRET') ?: 'remplace-par-une-cle-secrete';
$deployScript = __DIR__ . '/deploy.sh';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Méthode non autorisée.']);
    exit;
}

$body = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$expected = 'sha256=' . hash_hmac('sha256', $body, $secret);

if (!hash_equals($expected, $signature)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Signature invalide.']);
    exit;
}

if (!is_file($deployScript)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Script introuvable.']);
    exit;
}

exec(escapeshellcmd($deployScript) . ' >> ' . escapeshellarg(__DIR__ . '/deploy.log') . ' 2>&1', $output, $status);

if ($status !== 0) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Déploiement échoué.']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => true, 'message' => 'Déploiement déclenché.']);
WEBHOOK

cat > /etc/php/8.4/apache2/php.ini <<PHPINI
display_errors = Off
log_errors = On
error_log = /var/log/php/masterofdog-error.log
expose_php = Off
session.cookie_httponly = 1
session.cookie_secure = 1
session.use_strict_mode = 1
session.use_only_cookies = 1
PHPINI

systemctl restart apache2

echo "==> Installation terminée"
echo "==> Vérifiez DNS + certificat SSL"
echo "==> Testez : https://${DOMAIN}/pages/connexion.html"
