<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

try {
    app_config();
    $enabled = !empty(app_config()['analytics_enabled']);
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && ($_GET['action'] ?? '') === 'status') {
        app_json(['enabled' => $enabled]);
    }
    if (!$enabled) {
        http_response_code(204);
        exit;
    }

    app_start();
    app_require_method('POST');
    $input = app_json_input();
    app_require_csrf($input);
    $path = (string) ($input['path'] ?? '');
    $parsedPath = parse_url($path, PHP_URL_PATH);
    if (!is_string($parsedPath) || strlen($parsedPath) > 500 || !str_starts_with($parsedPath, '/')) {
        app_json(['error' => 'Chemin de page invalide.'], 422);
    }

    $visitorId = $_COOKIE['MASTERDOGVISITOR'] ?? '';
    if (!is_string($visitorId) || !preg_match('/^[a-f0-9]{64}$/', $visitorId)) {
        $visitorId = bin2hex(random_bytes(32));
        setcookie('MASTERDOGVISITOR', $visitorId, [
            'expires' => time() + 60 * 60 * 24 * 30,
            'path' => '/',
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
    $key = (string) app_config()['app_key'];
    $visitorHash = hash_hmac('sha256', $visitorId, $key);
    $routeHash = hash_hmac('sha256', $parsedPath, $key);
    $userId = (int) ($_SESSION['user_id'] ?? 0) ?: null;
    $pdo = app_db();
    $statement = $pdo->prepare(
        'INSERT INTO visitor_analytics (visitor_hash, visit_date, route_hash, authenticated_user_id)
         VALUES (:visitor, CURRENT_DATE(), :route, :user_id)
         ON DUPLICATE KEY UPDATE
           visit_count = visit_count + IF(updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE), 1, 0),
           authenticated_user_id = COALESCE(VALUES(authenticated_user_id), authenticated_user_id)'
    );
    $statement->execute(['visitor' => $visitorHash, 'route' => $routeHash, 'user_id' => $userId]);
    app_json(['ok' => true]);
} catch (Throwable $exception) {
    error_log('[MASTER OF DOG ANALYTICS] ' . get_class($exception) . ': ' . $exception->getMessage());
    app_json(['error' => 'Statistiques temporairement indisponibles.'], 503);
}