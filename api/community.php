<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

function community_input(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    return str_contains($contentType, 'application/json') ? app_json_input() : $_POST;
}

function community_save_evidence(PDO $pdo, int $userId, ?int $reportId, ?int $complaintId): void
{
    if (!isset($_FILES['proof']) || $_FILES['proof']['error'] === UPLOAD_ERR_NO_FILE) {
        return;
    }
    $file = $_FILES['proof'];
    if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] < 1 || $file['size'] > 10 * 1024 * 1024) {
        app_json(['error' => 'Fichier invalide ou supérieur à 10 Mo.'], 422);
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'application/pdf' => 'pdf'];
    if (!is_string($mime) || !isset($allowed[$mime])) {
        app_json(['error' => 'Formats autorisés : JPEG, PNG ou PDF.'], 422);
    }

    $storageDirectory = (string) (app_config()['private_storage'] ?? '');
    if ($storageDirectory === '') {
        app_json(['error' => 'Stockage privé non configuré.'], 503);
    }
    if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0700, true) && !is_dir($storageDirectory)) {
        app_json(['error' => 'Stockage privé indisponible.'], 503);
    }
    $realStorage = realpath($storageDirectory);
    $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if (!$realStorage || ($documentRoot && str_starts_with(strtolower($realStorage . DIRECTORY_SEPARATOR), strtolower($documentRoot . DIRECTORY_SEPARATOR)))) {
        app_json(['error' => 'Le stockage des preuves doit être situé hors du répertoire public.'], 503);
    }

    $storageKey = bin2hex(random_bytes(24)) . '.' . $allowed[$mime];
    if (!move_uploaded_file($file['tmp_name'], $realStorage . DIRECTORY_SEPARATOR . $storageKey)) {
        app_json(['error' => 'Impossible de conserver la preuve.'], 503);
    }
    $statement = $pdo->prepare(
        'INSERT INTO complaint_evidence (report_id, complaint_id, uploaded_by, original_name, storage_key, mime_type, size_bytes, sha256)
         VALUES (:report_id, :complaint_id, :uploaded_by, :original_name, :storage_key, :mime_type, :size, :sha256)'
    );
    $statement->execute([
        'report_id' => $reportId,
        'complaint_id' => $complaintId,
        'uploaded_by' => $userId,
        'original_name' => mb_substr(basename((string) $file['name']), 0, 255),
        'storage_key' => $storageKey,
        'mime_type' => $mime,
        'size' => (int) $file['size'],
        'sha256' => hash_file('sha256', $realStorage . DIRECTORY_SEPARATOR . $storageKey),
    ]);
}

try {
    app_config();
    app_start();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        app_require_method('POST');
    }
    $input = community_input();
    app_require_csrf($input);
    $user = app_require_user();
    $pdo = app_db();
    $action = $_GET['action'] ?? '';

    if ($action === 'report') {
        $targetId = filter_var($input['targetUserId'] ?? null, FILTER_VALIDATE_INT);
        $reason = trim((string) ($input['reason'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        $reasons = ['Fraude ou arnaque', 'Comportement abusif', 'Harcèlement', 'Faux professionnel', 'Informations mensongères', 'Mauvaise prestation', 'Non-respect d’un contrat', 'Comportement dangereux envers un animal', 'Autre'];
        if (!$targetId || $targetId === (int) $user['id'] || !in_array($reason, $reasons, true) || $description === '' || mb_strlen($description) > 10000) {
            app_json(['error' => 'Compte, motif ou description invalide.'], 422);
        }
        $target = $pdo->prepare(
            "SELECT u.id, u.first_name, u.last_name, r.label AS role_label
             FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = :id AND r.role_key <> 'super_admin'"
        );
        $target->execute(['id' => $targetId]);
        $targetUser = $target->fetch();
        if (!$targetUser) {
            app_json(['error' => 'Compte signalé introuvable.'], 404);
        }
        $reference = 'MOD-R-' . strtoupper(bin2hex(random_bytes(6)));
        $pdo->beginTransaction();
        $insert = $pdo->prepare(
            'INSERT INTO account_reports (reference_code, reporter_id, reported_user_id, reason, description)
             VALUES (:reference, :reporter, :target, :reason, :description)'
        );
        $insert->execute(['reference' => $reference, 'reporter' => $user['id'], 'target' => $targetId, 'reason' => $reason, 'description' => $description]);
        $reportId = (int) $pdo->lastInsertId();
        community_save_evidence($pdo, (int) $user['id'], $reportId, null);
        app_admin_event('account_report', 'report', $reportId, 'Nouveau signalement ' . $reference, $targetUser['role_label'] . ' · ' . $targetUser['first_name'] . ' ' . $targetUser['last_name'] . ' · ' . $reason);
        $pdo->commit();
        app_json(['ok' => true, 'reference' => $reference], 201);
    }

    if ($action === 'complaint') {
        $subject = trim((string) ($input['subject'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        if ($subject === '' || mb_strlen($subject) > 200 || $description === '' || mb_strlen($description) > 10000) {
            app_json(['error' => 'Objet ou description invalide.'], 422);
        }
        $reference = 'MOD-C-' . strtoupper(bin2hex(random_bytes(6)));
        $pdo->beginTransaction();
        $insert = $pdo->prepare('INSERT INTO complaints (reference_code, user_id, subject, description) VALUES (:reference, :user, :subject, :description)');
        $insert->execute(['reference' => $reference, 'user' => $user['id'], 'subject' => $subject, 'description' => $description]);
        $complaintId = (int) $pdo->lastInsertId();
        community_save_evidence($pdo, (int) $user['id'], null, $complaintId);
        app_admin_event('complaint', 'complaint', $complaintId, 'Nouvelle réclamation ' . $reference, $subject);
        $pdo->commit();
        app_json(['ok' => true, 'reference' => $reference], 201);
    }

    if ($action === 'review') {
        $rating = filter_var($input['rating'] ?? null, FILTER_VALIDATE_INT);
        $comment = trim((string) ($input['comment'] ?? ''));
        if (!$rating || $rating < 1 || $rating > 5 || $comment === '' || mb_strlen($comment) > 5000) {
            app_json(['error' => 'La note doit être comprise entre 1 et 5 et le commentaire est obligatoire.'], 422);
        }
        $insert = $pdo->prepare('INSERT INTO platform_reviews (user_id, rating, comment) VALUES (:user, :rating, :comment)');
        $insert->execute(['user' => $user['id'], 'rating' => $rating, 'comment' => $comment]);
        $reviewId = (int) $pdo->lastInsertId();
        app_admin_event('platform_review', 'review', $reviewId, 'Nouvel avis plateforme', 'Note ' . $rating . '/5 · compte ' . $user['id']);
        app_json(['ok' => true], 201);
    }

    app_json(['error' => 'Action inconnue.'], 404);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[MASTER OF DOG COMMUNITY] ' . get_class($exception) . ': ' . $exception->getMessage());
    app_json(['error' => 'Service temporairement indisponible.'], 503);
}