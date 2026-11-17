<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

try {
    app_config();
    app_start();
    $action = $_GET['action'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'csrf') {
        app_json(['csrfToken' => app_csrf_token()]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'me') {
        $user = app_current_user();
        app_json(['user' => $user ? app_public_user($user) : null]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'verify-email') {
        $token = (string) ($_GET['token'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            app_json(['error' => 'Lien de vérification invalide ou expiré.'], 400);
        }
        $pdo = app_db();
        $pdo->beginTransaction();
        $tokenQuery = $pdo->prepare(
            'SELECT id, user_id FROM email_verification_tokens WHERE token_hash = :hash AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE'
        );
        $tokenQuery->execute(['hash' => hash('sha256', $token)]);
        $verification = $tokenQuery->fetch();
        if (!$verification) {
            $pdo->rollBack();
            app_json(['error' => 'Lien de vérification invalide ou expiré.'], 400);
        }
        $pdo->prepare('UPDATE email_verification_tokens SET consumed_at = NOW() WHERE id = :id')->execute(['id' => $verification['id']]);
        $pdo->prepare('UPDATE users SET email_verified_at = NOW() WHERE id = :id')->execute(['id' => $verification['user_id']]);
        $pdo->commit();
        header('Location: ../pages/connexion.html?email_verified=1', true, 303);
        exit;
    }

    app_require_method('POST');
    $input = app_json_input();
    app_require_csrf($input);
    $pdo = app_db();

    if ($action === 'register') {
        $role = $input['role'] ?? '';
        $allowedRoles = ['client', 'trainer', 'veterinarian', 'shop'];
        $firstName = trim((string) ($input['firstName'] ?? ''));
        $lastName = trim((string) ($input['lastName'] ?? ''));
        $email = mb_strtolower(trim((string) ($input['email'] ?? '')));
        $phone = trim((string) ($input['phone'] ?? ''));
        $password = (string) ($input['password'] ?? '');

        if (!in_array($role, $allowedRoles, true)) {
            app_json(['error' => 'Type de compte invalide.'], 422);
        }
        if ($firstName === '' || $lastName === '' || strlen($firstName) > 100 || strlen($lastName) > 100) {
            app_json(['error' => 'Prénom ou nom invalide.'], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
            app_json(['error' => 'Adresse e-mail invalide.'], 422);
        }
        if ($password !== (string) ($input['passwordConfirm'] ?? '') || strlen($password) < 10 || strlen($password) > 4096) {
            app_json(['error' => 'Les mots de passe doivent correspondre et contenir au moins 10 caractères.'], 422);
        }

        $profile = is_array($input['profile'] ?? null) ? $input['profile'] : [];
        $pdo->beginTransaction();
        try {
            $roleStatement = $pdo->prepare('SELECT id FROM roles WHERE role_key = :role');
            $roleStatement->execute(['role' => $role]);
            $roleId = $roleStatement->fetchColumn();
            if (!$roleId) {
                throw new RuntimeException('Role configuration is missing.');
            }

            $insertUser = $pdo->prepare(
                "INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, verification_status)
                 VALUES (:role_id, :first_name, :last_name, :email, :phone, :password_hash, :verification_status)"
            );
            $insertUser->execute([
                'role_id' => $roleId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'phone' => $phone !== '' ? $phone : null,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'verification_status' => $role === 'client' ? 'new' : 'incomplete',
            ]);
            $userId = (int) $pdo->lastInsertId();

            $verificationToken = bin2hex(random_bytes(32));
            $verificationInsert = $pdo->prepare(
                'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
                 VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 24 HOUR))'
            );
            $verificationInsert->execute(['user_id' => $userId, 'token_hash' => hash('sha256', $verificationToken)]);

            if ($role === 'client') {
                $profileStatement = $pdo->prepare(
                    'INSERT INTO client_profiles (user_id, country, city, dog_name, dog_breed, dog_age, profile_data)
                     VALUES (:user_id, :country, :city, :dog_name, :dog_breed, :dog_age, :profile_data)'
                );
                $profileStatement->execute([
                    'user_id' => $userId,
                    'country' => trim((string) ($profile['country'] ?? '')) ?: null,
                    'city' => trim((string) ($profile['city'] ?? '')) ?: null,
                    'dog_name' => trim((string) ($profile['dogName'] ?? '')) ?: null,
                    'dog_breed' => trim((string) ($profile['dogBreed'] ?? '')) ?: null,
                    'dog_age' => trim((string) ($profile['dogAge'] ?? '')) ?: null,
                    'profile_data' => json_encode([], JSON_THROW_ON_ERROR),
                ]);
            } elseif ($role === 'trainer') {
                $profileStatement = $pdo->prepare(
                    'INSERT INTO trainer_profiles (user_id, country, city, birth_date, experience_years, specialties, qualifications, description, service_area)
                     VALUES (:user_id, :country, :city, :birth_date, :experience, :specialties, :qualifications, :description, :service_area)'
                );
                $profileStatement->execute([
                    'user_id' => $userId,
                    'country' => trim((string) ($profile['country'] ?? '')) ?: null,
                    'city' => trim((string) ($profile['city'] ?? '')) ?: null,
                    'birth_date' => trim((string) ($profile['birthDate'] ?? '')) ?: null,
                    'experience' => isset($profile['experience']) && $profile['experience'] !== '' ? max(0, min(70, (int) $profile['experience'])) : null,
                    'specialties' => json_encode(array_values(array_filter(array_map('trim', explode(',', (string) ($profile['specialties'] ?? ''))))), JSON_THROW_ON_ERROR),
                    'qualifications' => trim((string) ($profile['qualifications'] ?? '')) ?: null,
                    'description' => trim((string) ($profile['professionalDescription'] ?? '')) ?: null,
                    'service_area' => trim((string) ($profile['serviceArea'] ?? '')) ?: null,
                ]);
            } elseif ($role === 'veterinarian') {
                $profileStatement = $pdo->prepare(
                    'INSERT INTO veterinarian_profiles (user_id, country, city, clinic_name, clinic_address, specialty, qualifications, experience_years)
                     VALUES (:user_id, :country, :city, :clinic_name, :clinic_address, :specialty, :qualifications, :experience)'
                );
                $profileStatement->execute([
                    'user_id' => $userId,
                    'country' => trim((string) ($profile['country'] ?? '')) ?: null,
                    'city' => trim((string) ($profile['city'] ?? '')) ?: null,
                    'clinic_name' => trim((string) ($profile['businessName'] ?? '')) ?: null,
                    'clinic_address' => trim((string) ($profile['businessAddress'] ?? '')) ?: null,
                    'specialty' => trim((string) ($profile['specialty'] ?? '')) ?: null,
                    'qualifications' => trim((string) ($profile['qualifications'] ?? '')) ?: null,
                    'experience' => isset($profile['experience']) && $profile['experience'] !== '' ? max(0, min(70, (int) $profile['experience'])) : null,
                ]);
            } else {
                $profileStatement = $pdo->prepare(
                    'INSERT INTO shop_profiles (user_id, country, city, district, shop_name, category, description, address)
                     VALUES (:user_id, :country, :city, :district, :shop_name, :category, :description, :address)'
                );
                $profileStatement->execute([
                    'user_id' => $userId,
                    'country' => trim((string) ($profile['country'] ?? '')) ?: null,
                    'city' => trim((string) ($profile['city'] ?? '')) ?: null,
                    'district' => trim((string) ($profile['district'] ?? '')) ?: null,
                    'shop_name' => trim((string) ($profile['businessName'] ?? '')) ?: null,
                    'category' => trim((string) ($profile['specialty'] ?? '')) ?: null,
                    'description' => trim((string) ($profile['professionalDescription'] ?? '')) ?: null,
                    'address' => trim((string) ($profile['businessAddress'] ?? '')) ?: null,
                ]);
            }

            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($exception instanceof PDOException && $exception->getCode() === '23000') {
                app_json(['error' => 'Un compte existe déjà pour cette adresse e-mail.'], 409);
            }
            throw $exception;
        }

        if ($role !== 'client') {
            app_admin_event('professional_registration', 'user', $userId, 'Nouveau dossier professionnel', 'Nouvelle inscription ' . $role . ' · compte ' . $userId);
        }
        if (!empty(app_config()['smtp']['enabled'])) {
            app_queue_email($email, 'email_verification', 'user-' . $userId, [
                'subject' => 'Vérifiez votre adresse e-mail MASTER of DOG',
                'title' => 'Vérification de votre adresse e-mail',
                'summary' => 'Confirmez votre adresse avant de poursuivre.',
                'action_url' => app_config()['public_url'] . '/api/auth.php?action=verify-email&token=' . $verificationToken,
            ]);
        }

        app_create_session($userId);
        $userStatement = $pdo->prepare(
            'SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.account_status, u.verification_status, r.role_key
             FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = :id'
        );
        $userStatement->execute(['id' => $userId]);
        $user = $userStatement->fetch();
        app_json(['user' => app_public_user($user)], 201);
    }

    if ($action === 'login') {
        app_expire_suspensions();
        $email = mb_strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            app_json(['error' => 'Adresse e-mail ou mot de passe incorrect.'], 401);
        }

        $key = app_config()['app_key'];
        $identifierHash = hash_hmac('sha256', $email, $key);
        $ipHash = hash_hmac('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''), $key);
        $attemptQuery = $pdo->prepare(
            'SELECT COUNT(*) FROM login_attempts WHERE (identifier_hash = :identifier OR ip_hash = :ip) AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)'
        );
        $attemptQuery->execute(['identifier' => $identifierHash, 'ip' => $ipHash]);
        if ((int) $attemptQuery->fetchColumn() >= 10) {
            app_json(['error' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
        }

        $insertAttempt = $pdo->prepare('INSERT INTO login_attempts (identifier_hash, ip_hash) VALUES (:identifier, :ip)');
        $insertAttempt->execute(['identifier' => $identifierHash, 'ip' => $ipHash]);
        $userQuery = $pdo->prepare(
            'SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.password_hash, u.account_status,
                    u.verification_status, r.role_key
             FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.email = :email LIMIT 1'
        );
        $userQuery->execute(['email' => $email]);
        $user = $userQuery->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            app_json(['error' => 'Adresse e-mail ou mot de passe incorrect.'], 401);
        }
        if ($user['account_status'] !== 'active') {
            app_json(['error' => 'Ce compte ne peut pas se connecter. Contactez le support.'], 403);
        }

        $pdo->beginTransaction();
        $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id')->execute(['id' => $user['id']]);
        $pdo->prepare('DELETE FROM login_attempts WHERE identifier_hash = :identifier')->execute(['identifier' => $identifierHash]);
        $pdo->commit();
        app_create_session((int) $user['id']);
        unset($user['password_hash']);
        app_json(['user' => app_public_user($user)]);
    }

    if ($action === 'logout') {
        app_revoke_session();
        app_json(['ok' => true]);
    }

    if ($action === 'forgot-password') {
        $email = mb_strtolower(trim((string) ($input['email'] ?? '')));
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $query = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
            $query->execute(['email' => $email]);
            $userId = $query->fetchColumn();
            if ($userId && !empty(app_config()['smtp']['enabled'])) {
                $token = bin2hex(random_bytes(32));
                $pdo->prepare('UPDATE password_reset_tokens SET consumed_at = NOW() WHERE user_id = :id AND consumed_at IS NULL')->execute(['id' => $userId]);
                $insert = $pdo->prepare(
                    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                     VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 1 HOUR))'
                );
                $insert->execute(['user_id' => $userId, 'token_hash' => hash('sha256', $token)]);
                app_queue_email($email, 'password_reset', 'user-' . $userId, [
                    'subject' => 'Réinitialisation du mot de passe MASTER of DOG',
                    'title' => 'Réinitialisation du mot de passe',
                    'summary' => 'Le lien expire dans une heure.',
                    'action_url' => app_config()['public_url'] . '/pages/mot-de-passe-oublie.html?token=' . $token,
                ]);
            }
        }
        app_json(['ok' => true, 'message' => 'Si cette adresse est associée à un compte, un e-mail sera envoyé.']);
    }

    if ($action === 'reset-password') {
        $token = (string) ($input['token'] ?? '');
        $password = (string) ($input['password'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $token) || strlen($password) < 10 || strlen($password) > 4096 || $password !== (string) ($input['passwordConfirm'] ?? '')) {
            app_json(['error' => 'Jeton invalide ou mots de passe non conformes.'], 422);
        }
        $pdo->beginTransaction();
        $query = $pdo->prepare('SELECT id, user_id FROM password_reset_tokens WHERE token_hash = :hash AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE');
        $query->execute(['hash' => hash('sha256', $token)]);
        $reset = $query->fetch();
        if (!$reset) {
            $pdo->rollBack();
            app_json(['error' => 'Lien invalide ou expiré. Demandez une nouvelle réinitialisation.'], 400);
        }
        $pdo->prepare('UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = :id')->execute(['id' => $reset['id']]);
        $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id')->execute(['hash' => password_hash($password, PASSWORD_DEFAULT), 'id' => $reset['user_id']]);
        $pdo->prepare('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = :id AND revoked_at IS NULL')->execute(['id' => $reset['user_id']]);
        $pdo->commit();
        app_json(['ok' => true, 'message' => 'Mot de passe modifié. Vous pouvez vous connecter.']);
    }

    app_json(['error' => 'Action inconnue.'], 404);
} catch (Throwable $exception) {
    error_log('[MASTER OF DOG] ' . get_class($exception) . ': ' . $exception->getMessage());
    app_json(['error' => 'Service temporairement indisponible.'], 503);
}