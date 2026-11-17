<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

try {
    app_config();
    app_start();
    $admin = app_require_super_admin();
    $pdo = app_db();
    $action = $_GET['action'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'overview') {
            $periodDays = in_array((int) ($_GET['days'] ?? 90), [7, 30, 90, 365], true) ? (int) ($_GET['days'] ?? 90) : 90;
            $users = $pdo->query(
                "SELECT COUNT(*) AS total,
                        SUM(account_status = 'active') AS active,
                        SUM(account_status = 'suspended') AS suspended,
                        SUM(account_status = 'banned') AS banned,
                        SUM(account_status = 'locked') AS locked
                 FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.role_key <> 'super_admin'"
            )->fetch();
            $roles = $pdo->query(
                'SELECT r.role_key, COUNT(u.id) AS total FROM roles r
                 LEFT JOIN users u ON u.role_id = r.id
                 WHERE r.role_key <> \'super_admin\' GROUP BY r.id, r.role_key'
            )->fetchAll();
            $verification = $pdo->query(
                "SELECT verification_status, COUNT(*) AS total FROM users
                 WHERE role_id <> (SELECT id FROM roles WHERE role_key = 'super_admin')
                 GROUP BY verification_status"
            )->fetchAll();
            $reports = $pdo->query('SELECT status, COUNT(*) AS total FROM account_reports GROUP BY status')->fetchAll();
            $complaints = $pdo->query('SELECT status, COUNT(*) AS total FROM complaints GROUP BY status')->fetchAll();
            $reviews = $pdo->query('SELECT COUNT(*) AS total, ROUND(AVG(rating), 2) AS average FROM platform_reviews WHERE status <> \'hidden\'')->fetch();
            $visitors = $pdo->query(
                "SELECT COALESCE(SUM(visit_count), 0) AS visits,
                        COUNT(DISTINCT visitor_hash) AS unique_visitors,
                    COALESCE(SUM(IF(visit_date = CURRENT_DATE(), visit_count, 0)), 0) AS today,
                    COALESCE(SUM(IF(visit_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY), visit_count, 0)), 0) AS last_7_days,
                        COALESCE(SUM(IF(visit_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 29 DAY), visit_count, 0)), 0) AS last_30_days,
                        COALESCE(SUM(IF(visit_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 89 DAY), visit_count, 0)), 0) AS last_90_days,
                        COALESCE(SUM(IF(visit_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 364 DAY), visit_count, 0)), 0) AS last_12_months,
                        COUNT(DISTINCT IF(authenticated_user_id IS NOT NULL, visitor_hash, NULL)) AS connected_visitors,
                        COUNT(DISTINCT IF(authenticated_user_id IS NULL, visitor_hash, NULL)) AS anonymous_visitors
                  FROM visitor_analytics"
            )->fetch();
              $chartQuery = $pdo->prepare(
                 "SELECT visit_date, SUM(visit_count) AS visits, COUNT(DISTINCT visitor_hash) AS visitors
                  FROM visitor_analytics WHERE visit_date >= DATE_SUB(CURRENT_DATE(), INTERVAL :days DAY)
                  GROUP BY visit_date ORDER BY visit_date"
              );
              $chartQuery->bindValue('days', $periodDays, PDO::PARAM_INT);
              $chartQuery->execute();
              $chart = $chartQuery->fetchAll();
              $signupsQuery = $pdo->prepare(
                 "SELECT DATE(u.created_at) AS period, COUNT(*) AS total
                  FROM users u INNER JOIN roles r ON r.id = u.role_id
                  WHERE r.role_key <> 'super_admin' AND u.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL :days DAY)
                  GROUP BY DATE(u.created_at) ORDER BY period"
              );
              $signupsQuery->bindValue('days', $periodDays, PDO::PARAM_INT);
              $signupsQuery->execute();
              $signups = $signupsQuery->fetchAll();
              $activity = $pdo->query(
                 "SELECT DATE(created_at) AS period, COUNT(*) AS total
                  FROM account_reports WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 89 DAY)
                  GROUP BY DATE(created_at) ORDER BY period"
              )->fetchAll();
            app_json([
                'users' => array_map('intval', $users),
                'roles' => $roles,
                'verification' => $verification,
                'reports' => $reports,
                'complaints' => $complaints,
                'platformReviews' => $reviews,
                'visitors' => $visitors,
                'visitorChart' => $chart,
                'signupsChart' => $signups,
                'reportsChart' => $activity,
            ]);
        }

        if ($action === 'users') {
            $page = max(1, (int) ($_GET['page'] ?? 1));
            $limit = min(100, max(10, (int) ($_GET['limit'] ?? 25)));
            $offset = ($page - 1) * $limit;
            $search = trim((string) ($_GET['q'] ?? ''));
            $role = trim((string) ($_GET['role'] ?? ''));
            $status = trim((string) ($_GET['status'] ?? ''));
            $dateFrom = trim((string) ($_GET['from'] ?? ''));
            $dateTo = trim((string) ($_GET['to'] ?? ''));
            $conditions = ["r.role_key <> 'super_admin'"];
            $parameters = [];
            if ($search !== '') {
                $conditions[] = '(u.first_name LIKE :search_first OR u.last_name LIKE :search_last OR u.email LIKE :search_email OR CAST(u.id AS CHAR) = :user_id)';
                $parameters['search_first'] = '%' . $search . '%';
                $parameters['search_last'] = '%' . $search . '%';
                $parameters['search_email'] = '%' . $search . '%';
                $parameters['user_id'] = $search;
            }
            if ($role !== '') {
                $selectedRoles = array_values(array_intersect(explode(',', $role), ['client', 'trainer', 'veterinarian', 'shop']));
                if ($selectedRoles) {
                    $roleParameters = [];
                    foreach ($selectedRoles as $index => $selectedRole) {
                        $parameter = 'role_' . $index;
                        $roleParameters[] = ':' . $parameter;
                        $parameters[$parameter] = $selectedRole;
                    }
                    $conditions[] = 'r.role_key IN (' . implode(', ', $roleParameters) . ')';
                }
            }
            if ($status !== '' && in_array($status, ['active', 'suspended', 'banned', 'locked'], true)) {
                $conditions[] = 'u.account_status = :status';
                $parameters['status'] = $status;
            }
            foreach (['from' => $dateFrom, 'to' => $dateTo] as $bound => $date) {
                if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                    $conditions[] = 'u.created_at ' . ($bound === 'from' ? '>=' : '<=') . ' :' . $bound;
                    $parameters[$bound] = $bound === 'to' ? $date . ' 23:59:59' : $date . ' 00:00:00';
                }
            }
            $sort = ($_GET['sort'] ?? 'newest') === 'oldest' ? 'ASC' : 'DESC';
            $where = implode(' AND ', $conditions);
            $count = $pdo->prepare("SELECT COUNT(*) FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE {$where}");
            $count->execute($parameters);
            $query = $pdo->prepare(
                "SELECT u.id, u.first_name, u.last_name, u.email, u.phone, r.role_key,
                        u.account_status, u.verification_status, u.created_at
                 FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE {$where}
                 ORDER BY u.created_at {$sort} LIMIT {$limit} OFFSET {$offset}"
            );
            $query->execute($parameters);
            app_json(['items' => $query->fetchAll(), 'page' => $page, 'limit' => $limit, 'total' => (int) $count->fetchColumn()]);
        }

        if ($action === 'profile') {
            $profileId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$profileId) {
                app_json(['error' => 'Identifiant invalide.'], 422);
            }
            $query = $pdo->prepare(
                "SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.account_status, u.verification_status,
                        u.created_at, u.last_login_at, r.role_key
                 FROM users u INNER JOIN roles r ON r.id = u.role_id
                 WHERE u.id = :id AND r.role_key <> 'super_admin'"
            );
            $query->execute(['id' => $profileId]);
            $profileUser = $query->fetch();
            if (!$profileUser) {
                app_json(['error' => 'Compte introuvable.'], 404);
            }
            $profileTable = [
                'client' => 'client_profiles',
                'trainer' => 'trainer_profiles',
                'veterinarian' => 'veterinarian_profiles',
                'shop' => 'shop_profiles',
            ][$profileUser['role_key']] ?? null;
            $profileData = null;
            if ($profileTable) {
                $profileQuery = $pdo->prepare('SELECT * FROM `' . $profileTable . '` WHERE user_id = :id');
                $profileQuery->execute(['id' => $profileId]);
                $profileData = $profileQuery->fetch() ?: null;
            }
            $documents = $pdo->prepare('SELECT id, document_type, original_name, mime_type, size_bytes, review_status, created_at FROM professional_documents WHERE user_id = :id ORDER BY created_at DESC');
            $documents->execute(['id' => $profileId]);
            $actions = $pdo->prepare('SELECT action_type, reason, starts_at, ends_at, reversed_at, reversal_reason FROM account_actions WHERE user_id = :id ORDER BY created_at DESC');
            $actions->execute(['id' => $profileId]);
            app_json(['user' => $profileUser, 'profile' => $profileData, 'documents' => $documents->fetchAll(), 'actions' => $actions->fetchAll()]);
        }

        if ($action === 'reports') {
            $query = $pdo->query(
                'SELECT r.id, r.reference_code, r.reason, r.description, r.status, r.created_at,
                        reporter.id AS reporter_id, reporter.first_name AS reporter_first_name, reporter.last_name AS reporter_last_name,
                        target.id AS target_id, target.first_name AS target_first_name, target.last_name AS target_last_name,
                        target.email AS target_email, target_roles.role_key AS target_role
                 FROM account_reports r
                 INNER JOIN users reporter ON reporter.id = r.reporter_id
                 INNER JOIN users target ON target.id = r.reported_user_id
                 INNER JOIN roles target_roles ON target_roles.id = target.role_id
                 ORDER BY r.created_at DESC LIMIT 200'
            );
            app_json(['items' => $query->fetchAll()]);
        }

        if ($action === 'complaints') {
            $query = $pdo->query(
                'SELECT c.id, c.reference_code, c.subject, c.description, c.status, c.resolution_note, c.created_at,
                        u.id AS user_id, u.first_name, u.last_name, u.email, r.role_key
                 FROM complaints c INNER JOIN users u ON u.id = c.user_id
                 INNER JOIN roles r ON r.id = u.role_id ORDER BY c.created_at DESC LIMIT 200'
            );
            app_json(['items' => $query->fetchAll()]);
        }

        if ($action === 'reviews') {
            $query = $pdo->query(
                'SELECT p.id, p.rating, p.comment, p.status, p.admin_reply, p.created_at,
                        u.id AS user_id, u.first_name, u.last_name, r.role_key
                 FROM platform_reviews p INNER JOIN users u ON u.id = p.user_id
                 INNER JOIN roles r ON r.id = u.role_id ORDER BY p.created_at DESC LIMIT 200'
            );
            app_json(['items' => $query->fetchAll()]);
        }

        if ($action === 'notifications') {
            $query = $pdo->query('SELECT id, event_type, reference_type, reference_id, title, summary, read_at, created_at FROM admin_notifications ORDER BY created_at DESC LIMIT 100');
            app_json(['items' => $query->fetchAll()]);
        }

        if ($action === 'activity') {
            $query = $pdo->query(
                'SELECT l.id, l.action_type, l.target_type, l.target_id, l.details, l.created_at,
                        u.email AS admin_email
                 FROM admin_activity_logs l INNER JOIN users u ON u.id = l.admin_id
                 ORDER BY l.created_at DESC LIMIT 200'
            );
            app_json(['items' => $query->fetchAll()]);
        }

        if ($action === 'evidence') {
            $evidenceId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$evidenceId) {
                app_json(['error' => 'Preuve introuvable.'], 404);
            }
            $query = $pdo->prepare('SELECT original_name, storage_key, mime_type FROM complaint_evidence WHERE id = :id');
            $query->execute(['id' => $evidenceId]);
            $evidence = $query->fetch();
            $storageDirectory = realpath((string) (app_config()['private_storage'] ?? ''));
            $filePath = $storageDirectory ? realpath($storageDirectory . DIRECTORY_SEPARATOR . basename((string) ($evidence['storage_key'] ?? ''))) : false;
            if (!$evidence || !$filePath || !str_starts_with(strtolower($filePath), strtolower($storageDirectory . DIRECTORY_SEPARATOR))) {
                app_json(['error' => 'Preuve introuvable.'], 404);
            }
            header('Content-Type: ' . $evidence['mime_type']);
            header('Content-Length: ' . filesize($filePath));
            header('Content-Disposition: attachment; filename="' . rawurlencode($evidence['original_name']) . '"');
            readfile($filePath);
            exit;
        }

        if ($action === 'professional-document') {
            $documentId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$documentId) {
                app_json(['error' => 'Document introuvable.'], 404);
            }
            $query = $pdo->prepare('SELECT original_name, storage_key, mime_type FROM professional_documents WHERE id = :id');
            $query->execute(['id' => $documentId]);
            $document = $query->fetch();
            $storageDirectory = realpath((string) (app_config()['private_storage'] ?? ''));
            $filePath = $storageDirectory ? realpath($storageDirectory . DIRECTORY_SEPARATOR . basename((string) ($document['storage_key'] ?? ''))) : false;
            if (!$document || !$filePath || !str_starts_with(strtolower($filePath), strtolower($storageDirectory . DIRECTORY_SEPARATOR))) {
                app_json(['error' => 'Document introuvable.'], 404);
            }
            header('Content-Type: ' . $document['mime_type']);
            header('Content-Length: ' . filesize($filePath));
            header('Content-Disposition: attachment; filename="' . rawurlencode($document['original_name']) . '"');
            readfile($filePath);
            exit;
        }

        app_json(['error' => 'Action inconnue.'], 404);
    }

    app_require_method('POST');
    $input = app_json_input();
    app_require_csrf($input);
    $userId = filter_var($input['userId'] ?? null, FILTER_VALIDATE_INT);

    if ($action === 'sanction' && $userId) {
        $type = $input['type'] ?? '';
        $reason = trim((string) ($input['reason'] ?? ''));
        $durationHours = isset($input['durationHours']) ? max(1, min(8760, (int) $input['durationHours'])) : null;
        if (!in_array($type, ['suspend', 'ban', 'lock'], true) || $reason === '') {
            app_json(['error' => 'Action ou motif invalide.'], 422);
        }

        $pdo->beginTransaction();
        try {
            $userQuery = $pdo->prepare('SELECT id FROM users WHERE id = :id AND id <> :admin_id FOR UPDATE');
            $userQuery->execute(['id' => $userId, 'admin_id' => $admin['id']]);
            if (!$userQuery->fetchColumn()) {
                $pdo->rollBack();
                app_json(['error' => 'Compte introuvable ou action interdite.'], 404);
            }
            $endsAt = $durationHours === null ? null : (new DateTimeImmutable('+' . $durationHours . ' hours'))->format('Y-m-d H:i:s');
            $insert = $pdo->prepare(
                'INSERT INTO account_actions (user_id, admin_id, action_type, reason, ends_at)
                 VALUES (:user_id, :admin_id, :type, :reason, :ends_at)'
            );
            $insert->execute(['user_id' => $userId, 'admin_id' => $admin['id'], 'type' => $type, 'reason' => $reason, 'ends_at' => $endsAt]);
            $status = ['suspend' => 'suspended', 'ban' => 'banned', 'lock' => 'locked'][$type];
            $pdo->prepare('UPDATE users SET account_status = :status WHERE id = :id')->execute(['status' => $status, 'id' => $userId]);
            $pdo->prepare('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = :id AND revoked_at IS NULL')->execute(['id' => $userId]);
            $log = $pdo->prepare(
                'INSERT INTO admin_activity_logs (admin_id, action_type, target_type, target_id, details)
                 VALUES (:admin_id, :action_type, \'user\', :target_id, :details)'
            );
            $log->execute(['admin_id' => $admin['id'], 'action_type' => $type, 'target_id' => $userId, 'details' => json_encode(['reason' => $reason, 'endsAt' => $endsAt], JSON_THROW_ON_ERROR)]);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
        app_json(['ok' => true]);
    }

    if ($action === 'restore' && $userId) {
        $reason = trim((string) ($input['reason'] ?? ''));
        if ($reason === '') {
            app_json(['error' => 'Le motif de réactivation est obligatoire.'], 422);
        }
        $pdo->beginTransaction();
        $active = $pdo->prepare(
            "SELECT id FROM account_actions WHERE user_id = :id AND action_type IN ('suspend', 'ban', 'lock')
             AND reversed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE"
        );
        $active->execute(['id' => $userId]);
        $actionId = $active->fetchColumn();
        if (!$actionId) {
            $pdo->rollBack();
            app_json(['error' => 'Aucune sanction active à lever.'], 409);
        }
        $pdo->prepare('UPDATE account_actions SET reversed_at = NOW(), reversed_by = :admin, reversal_reason = :reason WHERE id = :id')
            ->execute(['admin' => $admin['id'], 'reason' => $reason, 'id' => $actionId]);
        $remaining = $pdo->prepare(
            "SELECT action_type FROM account_actions WHERE user_id = :id AND action_type IN ('suspend', 'ban', 'lock')
             AND reversed_at IS NULL AND (ends_at IS NULL OR ends_at > NOW()) ORDER BY created_at DESC"
        );
        $remaining->execute(['id' => $userId]);
        $remainingActions = $remaining->fetchAll(PDO::FETCH_COLUMN);
        $nextStatus = in_array('ban', $remainingActions, true) ? 'banned'
            : (in_array('lock', $remainingActions, true) ? 'locked'
                : (in_array('suspend', $remainingActions, true) ? 'suspended' : 'active'));
        $pdo->prepare('UPDATE users SET account_status = :status WHERE id = :id AND id <> :admin_id')
            ->execute(['status' => $nextStatus, 'id' => $userId, 'admin_id' => $admin['id']]);
        $pdo->prepare(
            "INSERT INTO admin_activity_logs (admin_id, action_type, target_type, target_id, details)
             VALUES (:admin, 'restore', 'user', :target, :details)"
        )->execute(['admin' => $admin['id'], 'target' => $userId, 'details' => json_encode(['reason' => $reason, 'sanctionId' => (int) $actionId], JSON_THROW_ON_ERROR)]);
        $pdo->commit();
        app_json(['ok' => true]);
    }

    if ($action === 'verification' && $userId) {
        $status = $input['status'] ?? '';
        $reason = trim((string) ($input['reason'] ?? ''));
        if (!in_array($status, ['pending', 'review', 'verified', 'rejected', 'incomplete'], true) || $reason === '') {
            app_json(['error' => 'Statut ou motif obligatoire invalide.'], 422);
        }
        $pdo->beginTransaction();
        $current = $pdo->prepare('SELECT verification_status FROM users WHERE id = :id FOR UPDATE');
        $current->execute(['id' => $userId]);
        $previousStatus = $current->fetchColumn();
        if ($previousStatus === false) {
            $pdo->rollBack();
            app_json(['error' => 'Compte introuvable.'], 404);
        }
        $pdo->prepare('UPDATE users SET verification_status = :status WHERE id = :id')->execute(['status' => $status, 'id' => $userId]);
        $pdo->prepare(
            'INSERT INTO verification_history (user_id, admin_id, previous_status, new_status, reason)
             VALUES (:user_id, :admin_id, :previous_status, :new_status, :reason)'
        )->execute(['user_id' => $userId, 'admin_id' => $admin['id'], 'previous_status' => $previousStatus, 'new_status' => $status, 'reason' => $reason]);
        $pdo->prepare(
            "INSERT INTO admin_activity_logs (admin_id, action_type, target_type, target_id, details)
             VALUES (:admin, 'verification', 'user', :target, :details)"
        )->execute(['admin' => $admin['id'], 'target' => $userId, 'details' => json_encode(['status' => $status, 'reason' => $reason], JSON_THROW_ON_ERROR)]);
        $pdo->commit();
        app_json(['ok' => true]);
    }

    if ($action === 'report-status') {
        $reportId = filter_var($input['reportId'] ?? null, FILTER_VALIDATE_INT);
        $status = $input['status'] ?? '';
        $reason = trim((string) ($input['reason'] ?? ''));
        if (!$reportId || !in_array($status, ['pending', 'reviewing', 'more_info', 'resolved', 'rejected', 'closed'], true) || $reason === '') {
            app_json(['error' => 'Dossier, statut et motif sont requis.'], 422);
        }
        $pdo->beginTransaction();
        $statement = $pdo->prepare('UPDATE account_reports SET status = :status, resolution_note = :reason, assigned_admin_id = :admin WHERE id = :id');
        $statement->execute(['status' => $status, 'reason' => $reason, 'admin' => $admin['id'], 'id' => $reportId]);
        if (!$statement->rowCount()) {
            $pdo->rollBack();
            app_json(['error' => 'Signalement introuvable.'], 404);
        }
        $pdo->prepare(
            "INSERT INTO admin_activity_logs (admin_id, action_type, target_type, target_id, details)
             VALUES (:admin, 'report_status', 'report', :target, :details)"
        )->execute(['admin' => $admin['id'], 'target' => $reportId, 'details' => json_encode(['status' => $status, 'reason' => $reason], JSON_THROW_ON_ERROR)]);
        $pdo->commit();
        app_json(['ok' => true]);
    }

    if ($action === 'complaint-status') {
        $complaintId = filter_var($input['complaintId'] ?? null, FILTER_VALIDATE_INT);
        $status = $input['status'] ?? '';
        $reason = trim((string) ($input['reason'] ?? ''));
        if (!$complaintId || !in_array($status, ['pending', 'reviewing', 'more_info', 'resolved', 'rejected', 'closed'], true) || $reason === '') {
            app_json(['error' => 'Dossier, statut et motif sont requis.'], 422);
        }
        $pdo->beginTransaction();
        $statement = $pdo->prepare('UPDATE complaints SET status = :status, resolution_note = :reason, assigned_admin_id = :admin WHERE id = :id');
        $statement->execute(['status' => $status, 'reason' => $reason, 'admin' => $admin['id'], 'id' => $complaintId]);
        if (!$statement->rowCount()) {
            $pdo->rollBack();
            app_json(['error' => 'Réclamation introuvable.'], 404);
        }
        $pdo->prepare(
            "INSERT INTO admin_activity_logs (admin_id, action_type, target_type, target_id, details)
             VALUES (:admin, 'complaint_status', 'complaint', :target, :details)"
        )->execute(['admin' => $admin['id'], 'target' => $complaintId, 'details' => json_encode(['status' => $status, 'reason' => $reason], JSON_THROW_ON_ERROR)]);
        $pdo->commit();
        app_json(['ok' => true]);
    }

    if ($action === 'review-moderate') {
        $reviewId = filter_var($input['reviewId'] ?? null, FILTER_VALIDATE_INT);
        $status = $input['status'] ?? '';
        $reply = trim((string) ($input['reply'] ?? ''));
        if (!$reviewId || !in_array($status, ['reviewing', 'answered', 'hidden', 'resolved'], true) || ($status === 'answered' && $reply === '')) {
            app_json(['error' => 'Avis, statut ou réponse invalide.'], 422);
        }
        $pdo->beginTransaction();
        $statement = $pdo->prepare(
            'UPDATE platform_reviews SET status = :status, admin_reply = :reply,
             replied_by = :admin, replied_at = IF(:answered = 1, NOW(), replied_at) WHERE id = :id'
        );
        $statement->execute(['status' => $status, 'reply' => $reply ?: null, 'admin' => $admin['id'], 'answered' => $status === 'answered' ? 1 : 0, 'id' => $reviewId]);
        if (!$statement->rowCount()) {
            $pdo->rollBack();
            app_json(['error' => 'Avis introuvable.'], 404);
        }
        $pdo->prepare(
            "INSERT INTO admin_activity_logs (admin_id, action_type, target_type, target_id, details)
             VALUES (:admin, 'review_moderate', 'review', :target, :details)"
        )->execute(['admin' => $admin['id'], 'target' => $reviewId, 'details' => json_encode(['status' => $status], JSON_THROW_ON_ERROR)]);
        $pdo->commit();
        app_json(['ok' => true]);
    }

    if ($action === 'notification-read') {
        $notificationId = filter_var($input['notificationId'] ?? null, FILTER_VALIDATE_INT);
        if (!$notificationId) {
            app_json(['error' => 'Notification invalide.'], 422);
        }
        $pdo->prepare('UPDATE admin_notifications SET read_at = NOW() WHERE id = :id')->execute(['id' => $notificationId]);
        app_json(['ok' => true]);
    }

    app_json(['error' => 'Action inconnue ou paramètres invalides.'], 404);
} catch (Throwable $exception) {
    error_log('[MASTER OF DOG ADMIN] ' . get_class($exception) . ': ' . $exception->getMessage());
    app_json(['error' => 'Service temporairement indisponible.'], 503);
}