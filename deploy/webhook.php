<?php
declare(strict_types=1);

$secret = getenv('MASTER_DOG_WEBHOOK_SECRET') ?: 'change-me';
$projectRoot = dirname(__DIR__);
$deployScript = __DIR__ . '/deploy.sh';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['ok' => false, 'error' => 'Méthode non autorisée.']);
    exit;
}

$payload = file_get_contents('php://input');
$header = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);

if ($secret === 'change-me' || !hash_equals($expected, $header)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Signature invalide.']);
    exit;
}

if (!is_file($deployScript)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Script de déploiement introuvable.']);
    exit;
}

$command = escapeshellcmd($deployScript) . ' >> ' . escapeshellarg($projectRoot . '/deploy/deploy.log') . ' 2>&1';
$result = 0;
$output = [];
exec($command, $output, $result);

if ($result !== 0) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Déploiement échoué.', 'output' => implode("\n", $output)]);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => true, 'message' => 'Déploiement déclenché avec succès.']);
