<?php
declare(strict_types=1);

function app_config(): array
{
    static $config;
    if (isset($config)) {
        return $config;
    }

    $configPath = getenv('MASTER_DOG_CONFIG') ?: dirname(__DIR__, 4) . '/private/master-of-dog/config.php';
    if (!is_file($configPath)) {
        throw new RuntimeException('Backend configuration is missing.');
    }

    $loaded = require $configPath;
    if (!is_array($loaded)) {
        throw new RuntimeException('Backend configuration is invalid.');
    }

    foreach (['dsn', 'db_user', 'db_password', 'app_key'] as $required) {
        if (!array_key_exists($required, $loaded)) {
            throw new RuntimeException('Backend configuration is incomplete.');
        }
    }

    if (strlen((string) $loaded['app_key']) < 32) {
        throw new RuntimeException('Backend application key is too short.');
    }

    $config = $loaded;
    return $config;
}

function app_db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $pdo = new PDO(app_config()['dsn'], app_config()['db_user'], app_config()['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function app_start(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    header('X-Frame-Options: DENY');

    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('MASTERDOGSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_start();
}

function app_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function app_require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        header('Allow: ' . strtoupper($method));
        app_json(['error' => 'Méthode non autorisée.'], 405);
    }
}

function app_json_input(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        app_json(['error' => 'Corps JSON invalide.'], 400);
    }

    return $data;
}

function app_csrf_token(): string
{
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function app_require_csrf(?array $input = null): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($input['csrf_token'] ?? '');
    if (!is_string($provided) || !isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $provided)) {
        app_json(['error' => 'Jeton de sécurité invalide. Rechargez la page et réessayez.'], 419);
    }
}

function app_current_user(): ?array
{
    $userId = filter_var($_SESSION['user_id'] ?? null, FILTER_VALIDATE_INT);
    $sessionHash = $_SESSION['session_hash'] ?? '';
    if (!$userId || !is_string($sessionHash) || $sessionHash === '') {
        return null;
    }
    app_expire_suspensions((int) $userId);

    $statement = app_db()->prepare(
        "SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.account_status,
                u.verification_status, r.role_key
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         INNER JOIN user_sessions s ON s.user_id = u.id
         WHERE u.id = :user_id AND s.session_hash = :session_hash
           AND s.revoked_at IS NULL AND s.expires_at > NOW()
         LIMIT 1"
    );
    $statement->execute(['user_id' => $userId, 'session_hash' => $sessionHash]);
    $user = $statement->fetch();

    if (!$user || $user['account_status'] !== 'active') {
        app_revoke_session();
        return null;
    }

    return $user;
}

function app_require_user(): array
{
    $user = app_current_user();
    if (!$user) {
        app_json(['error' => 'Connexion requise.'], 401);
    }

    return $user;
}

function app_require_super_admin(): array
{
    $user = app_require_user();
    if ($user['role_key'] !== 'super_admin') {
        app_json(['error' => 'Accès réservé au super administrateur.'], 403);
    }

    return $user;
}

function app_public_user(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'name' => trim($user['first_name'] . ' ' . $user['last_name']),
        'firstName' => $user['first_name'],
        'lastName' => $user['last_name'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'role' => $user['role_key'],
        'accountStatus' => $user['account_status'],
        'profileStatus' => $user['verification_status'],
    ];
}

function app_create_session(int $userId): void
{
    session_regenerate_id(true);
    $sessionHash = hash('sha256', session_id());
    $expiresAt = (new DateTimeImmutable('+8 hours'))->format('Y-m-d H:i:s');
    $statement = app_db()->prepare(
        'INSERT INTO user_sessions (session_hash, user_id, expires_at) VALUES (:hash, :user_id, :expires_at)'
    );
    $statement->execute(['hash' => $sessionHash, 'user_id' => $userId, 'expires_at' => $expiresAt]);
    $_SESSION['user_id'] = $userId;
    $_SESSION['session_hash'] = $sessionHash;
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function app_revoke_session(): void
{
    $sessionHash = $_SESSION['session_hash'] ?? '';
    if (is_string($sessionHash) && $sessionHash !== '') {
        $statement = app_db()->prepare('UPDATE user_sessions SET revoked_at = NOW() WHERE session_hash = :hash AND revoked_at IS NULL');
        $statement->execute(['hash' => $sessionHash]);
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function app_queue_email(string $recipient, string $type, ?string $referenceCode, array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $key = hash('sha256', (string) app_config()['app_key'], true);
    $encrypted = base64_encode($nonce . sodium_crypto_secretbox($json, $nonce, $key));
    $statement = app_db()->prepare(
        'INSERT INTO email_notifications (recipient, event_type, reference_code, encrypted_payload)
         VALUES (:recipient, :event_type, :reference_code, :payload)'
    );
    $statement->execute([
        'recipient' => $recipient,
        'event_type' => $type,
        'reference_code' => $referenceCode,
        'payload' => $encrypted,
    ]);
}

function app_admin_event(string $type, string $referenceType, ?int $referenceId, string $title, string $summary): void
{
    $pdo = app_db();
    $statement = $pdo->prepare(
        'INSERT INTO admin_notifications (event_type, reference_type, reference_id, title, summary)
         VALUES (:event_type, :reference_type, :reference_id, :title, :summary)'
    );
    $statement->execute([
        'event_type' => $type,
        'reference_type' => $referenceType,
        'reference_id' => $referenceId,
        'title' => mb_substr($title, 0, 200),
        'summary' => mb_substr($summary, 0, 1000),
    ]);

    $recipient = (string) (app_config()['admin_email'] ?? '');
    if ($recipient === '' || empty(app_config()['smtp']['enabled'])) {
        return;
    }

    app_queue_email($recipient, $type, $referenceId === null ? null : $referenceType . '-' . $referenceId, [
        'subject' => '[MASTER OF DOG] ' . $title,
        'title' => $title,
        'summary' => $summary,
        'reference_type' => $referenceType,
        'reference_id' => $referenceId,
        'created_at' => gmdate(DATE_ATOM),
    ]);
}

function app_expire_suspensions(?int $onlyUserId = null): void
{
        $pdo = app_db();
    $query = "SELECT id, user_id FROM account_actions WHERE action_type IN ('suspend', 'ban', 'lock')
              AND reversed_at IS NULL AND ends_at IS NOT NULL AND ends_at <= NOW()";
    $parameters = [];
    if ($onlyUserId !== null) {
        $query .= ' AND user_id = :user_id';
        $parameters['user_id'] = $onlyUserId;
    }
    $select = $pdo->prepare($query);
    $select->execute($parameters);
    $expiredActions = $select->fetchAll();
    foreach ($expiredActions as $action) {
        $pdo->beginTransaction();
        $pdo->prepare(
            "UPDATE account_actions SET reversed_at = NOW(), reversal_reason = 'Expiration automatique'
             WHERE id = :id AND reversed_at IS NULL"
        )->execute(['id' => $action['id']]);
        $active = $pdo->prepare(
            "SELECT action_type FROM account_actions WHERE user_id = :user_id
             AND action_type IN ('suspend', 'ban', 'lock') AND reversed_at IS NULL
             AND (ends_at IS NULL OR ends_at > NOW()) ORDER BY created_at DESC"
        );
        $active->execute(['user_id' => $action['user_id']]);
        $actions = $active->fetchAll(PDO::FETCH_COLUMN);
        $status = in_array('ban', $actions, true) ? 'banned'
            : (in_array('lock', $actions, true) ? 'locked'
                : (in_array('suspend', $actions, true) ? 'suspended' : 'active'));
        $pdo->prepare('UPDATE users SET account_status = :status WHERE id = :id')
            ->execute(['status' => $status, 'id' => $action['user_id']]);
        $pdo->commit();
    }
}