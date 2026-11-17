<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/app/bootstrap.php';
$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (!is_file($autoload)) {
    fwrite(STDERR, "PHPMailer absent. Exécutez composer install.\n");
    exit(2);
}
require_once $autoload;

$processed = 0;
while ($processed < 50) {
    $pdo = null;
    $row = null;
    try {
        $config = app_config();
        if (empty($config['smtp']['enabled'])) {
            fwrite(STDERR, "SMTP non activé; la file n’a pas été modifiée.\n");
            exit(3);
        }
        $pdo = app_db();
        $pdo->beginTransaction();
        $query = $pdo->query(
            "SELECT id, recipient, encrypted_payload, attempts FROM email_notifications
             WHERE status IN ('queued', 'failed') AND next_attempt_at <= NOW() AND attempts < 8
             ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED"
        );
        $row = $query->fetch();
        if (!$row) {
            $pdo->commit();
            break;
        }
        $pdo->prepare("UPDATE email_notifications SET status = 'sending', attempts = attempts + 1 WHERE id = :id")
            ->execute(['id' => $row['id']]);
        $pdo->commit();

        $packed = base64_decode($row['encrypted_payload'], true);
        $nonceSize = SODIUM_CRYPTO_SECRETBOX_NONCEBYTES;
        if ($packed === false || strlen($packed) <= $nonceSize) {
            throw new RuntimeException('Contenu de notification invalide.');
        }
        $key = hash('sha256', (string) $config['app_key'], true);
        $payloadJson = sodium_crypto_secretbox_open(substr($packed, $nonceSize), substr($packed, 0, $nonceSize), $key);
        $payload = $payloadJson === false ? null : json_decode($payloadJson, true);
        if (!is_array($payload)) {
            throw new RuntimeException('Contenu de notification illisible.');
        }

        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = (string) $config['smtp']['host'];
        $mail->Port = (int) $config['smtp']['port'];
        $mail->SMTPAuth = true;
        $mail->Username = (string) $config['smtp']['username'];
        $mail->Password = (string) $config['smtp']['password'];
        $mail->SMTPSecure = $config['smtp']['secure'] === 'smtps'
            ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
            : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom((string) $config['smtp']['from'], (string) $config['smtp']['from_name']);
        $mail->addAddress($row['recipient']);
        $mail->Subject = (string) ($payload['subject'] ?? 'Notification MASTER of DOG');
        $title = htmlspecialchars((string) ($payload['title'] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $summary = htmlspecialchars((string) ($payload['summary'] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $actionUrl = (string) ($payload['action_url'] ?? '');
        $action = '';
        if ($actionUrl !== '' && str_starts_with($actionUrl, (string) $config['public_url'] . '/')) {
            $action = '<p><a href="' . htmlspecialchars($actionUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">Consulter MASTER of DOG</a></p>';
        }
        $mail->isHTML(true);
        $mail->Body = '<h1>' . $title . '</h1><p>' . nl2br($summary, false) . '</p>' . $action;
        $mail->AltBody = (string) ($payload['title'] ?? '') . "\n\n" . (string) ($payload['summary'] ?? '') . ($actionUrl ? "\n" . $actionUrl : '');
        $mail->send();
        $pdo->prepare("UPDATE email_notifications SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE id = :id")
            ->execute(['id' => $row['id']]);
        $processed++;
    } catch (Throwable $exception) {
        if ($pdo instanceof PDO && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($pdo instanceof PDO && $row) {
            $attempts = min(8, (int) $row['attempts'] + 1);
            $delayMinutes = min(1440, 2 ** $attempts);
            $nextAttempt = (new DateTimeImmutable('+' . $delayMinutes . ' minutes'))->format('Y-m-d H:i:s');
            $status = $attempts >= 8 ? 'failed' : 'queued';
            $pdo->prepare('UPDATE email_notifications SET status = :status, attempts = :attempts, next_attempt_at = :next_attempt, last_error = :error WHERE id = :id')
                ->execute(['status' => $status, 'attempts' => $attempts, 'next_attempt' => $nextAttempt, 'error' => mb_substr($exception->getMessage(), 0, 1000), 'id' => $row['id']]);
        }
        error_log('[MASTER OF DOG MAIL] ' . get_class($exception) . ': ' . $exception->getMessage());
        break;
    }
}

fwrite(STDOUT, "Notifications envoyées: {$processed}.\n");