<?php
declare(strict_types=1);

$smtpEnabled = getenv('MASTER_DOG_SMTP_ENABLED') === '1';

return [
    'dsn' => getenv('MASTER_DOG_DSN') ?: 'mysql:host=127.0.0.1;port=3306;dbname=master_of_dog;charset=utf8mb4',
    'db_user' => getenv('MASTER_DOG_DB_USER') ?: 'master_of_dog_app',
    'db_password' => getenv('MASTER_DOG_DB_PASSWORD') ?: '',
    'app_key' => getenv('MASTER_DOG_APP_KEY') ?: '',
    'admin_email' => getenv('MASTER_DOG_ADMIN_EMAIL') ?: '',
    'public_url' => rtrim(getenv('MASTER_DOG_PUBLIC_URL') ?: 'http://localhost/MASTER%20OF%20DOG/MASTER-OF-DOG-WEB', '/'),
    'private_storage' => getenv('MASTER_DOG_PRIVATE_STORAGE') ?: dirname(__DIR__, 4) . '/private/master-of-dog/uploads',
    'analytics_enabled' => getenv('MASTER_DOG_ANALYTICS_ENABLED') === '1',
    'smtp' => [
        'enabled' => $smtpEnabled,
        'host' => getenv('MASTER_DOG_SMTP_HOST') ?: '',
        'port' => (int) (getenv('MASTER_DOG_SMTP_PORT') ?: 587),
        'secure' => getenv('MASTER_DOG_SMTP_SECURE') ?: 'tls',
        'username' => getenv('MASTER_DOG_SMTP_USERNAME') ?: '',
        'password' => getenv('MASTER_DOG_SMTP_PASSWORD') ?: '',
        'from' => getenv('MASTER_DOG_SMTP_FROM') ?: '',
        'from_name' => getenv('MASTER_DOG_SMTP_FROM_NAME') ?: 'MASTER of DOG',
    ],
];