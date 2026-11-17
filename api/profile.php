<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

function profile_definition(string $role): array
{
    return match ($role) {
        'client' => ['table' => 'client_profiles', 'fields' => ['country', 'city', 'dog_name', 'dog_breed', 'dog_age']],
        'trainer' => ['table' => 'trainer_profiles', 'fields' => ['country', 'city', 'birth_date', 'experience_years', 'specialties', 'qualifications', 'description', 'service_area', 'pricing', 'availability']],
        'veterinarian' => ['table' => 'veterinarian_profiles', 'fields' => ['country', 'city', 'clinic_name', 'clinic_address', 'clinic_phone', 'specialty', 'registration_number', 'qualifications', 'experience_years', 'career_description']],
        'shop' => ['table' => 'shop_profiles', 'fields' => ['country', 'city', 'district', 'shop_name', 'category', 'description', 'business_email', 'business_phone', 'address', 'latitude', 'longitude', 'maps_url', 'opening_hours', 'products', 'services', 'delivery_terms']],
        default => throw new DomainException('Profil non disponible.'),
    };
}

function profile_value(string $field, mixed $value): mixed
{
    if ($value === null || $value === '') {
        return null;
    }
    $jsonFields = ['specialties', 'pricing', 'availability', 'opening_hours', 'products', 'services'];
    if (in_array($field, $jsonFields, true)) {
        $decoded = is_string($value) ? json_decode($value, true) : $value;
        if (!is_array($decoded) && in_array($field, ['specialties', 'services', 'products'], true)) {
            $decoded = array_values(array_filter(array_map('trim', explode(',', (string) $value))));
        }
        if (!is_array($decoded)) {
            throw new DomainException('Format de liste invalide.');
        }
        return json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
    if (in_array($field, ['experience_years'], true)) {
        $number = filter_var($value, FILTER_VALIDATE_INT);
        if ($number === false || $number < 0 || $number > 70) {
            throw new DomainException('Années d’expérience invalides.');
        }
        return $number;
    }
    if (in_array($field, ['latitude', 'longitude'], true)) {
        if (!is_numeric($value)) {
            throw new DomainException('Coordonnées GPS invalides.');
        }
        $number = (float) $value;
        $limit = $field === 'latitude' ? 90 : 180;
        if ($number < -$limit || $number > $limit) {
            throw new DomainException('Coordonnées GPS hors limites.');
        }
        return $number;
    }
    if ($field === 'business_email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
        throw new DomainException('Adresse professionnelle invalide.');
    }
    if ($field === 'maps_url') {
        $url = filter_var($value, FILTER_VALIDATE_URL);
        if (!$url || !in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['https'], true)) {
            throw new DomainException('Le lien cartographique doit être une URL HTTPS valide.');
        }
    }
    $text = trim((string) $value);
    if (mb_strlen($text) > 10000) {
        throw new DomainException('Un champ dépasse la taille maximale.');
    }
    return $text === '' ? null : $text;
}

function profile_store_path(): string
{
    $storageDirectory = (string) (app_config()['private_storage'] ?? '');
    if ($storageDirectory === '') {
        throw new RuntimeException('Stockage privé non configuré.');
    }
    if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0700, true) && !is_dir($storageDirectory)) {
        throw new RuntimeException('Stockage privé indisponible.');
    }
    $realStorage = realpath($storageDirectory);
    $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if (!$realStorage || ($documentRoot && str_starts_with(strtolower($realStorage . DIRECTORY_SEPARATOR), strtolower($documentRoot . DIRECTORY_SEPARATOR)))) {
        throw new RuntimeException('Le stockage doit être situé hors du webroot.');
    }
    return $realStorage;
}

try {
    app_config();
    app_start();
    $user = app_require_user();
    $pdo = app_db();
    $definition = profile_definition($user['role_key']);
    $action = $_GET['action'] ?? '';

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && $action === 'me') {
        $profileQuery = $pdo->prepare('SELECT * FROM `' . $definition['table'] . '` WHERE user_id = :id');
        $profileQuery->execute(['id' => $user['id']]);
        $documents = $pdo->prepare('SELECT id, document_type, original_name, mime_type, size_bytes, review_status, created_at FROM professional_documents WHERE user_id = :id ORDER BY created_at DESC');
        $documents->execute(['id' => $user['id']]);
        app_json(['user' => app_public_user($user), 'profile' => $profileQuery->fetch() ?: new stdClass(), 'documents' => $documents->fetchAll()]);
    }

    app_require_method('POST');
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $isMultipart = str_contains($contentType, 'multipart/form-data');
    $input = $isMultipart ? $_POST : app_json_input();
    app_require_csrf($input);

    if ($action === 'update') {
        $firstName = trim((string) ($input['firstName'] ?? ''));
        $lastName = trim((string) ($input['lastName'] ?? ''));
        $phone = trim((string) ($input['phone'] ?? ''));
        if ($firstName === '' || $lastName === '' || mb_strlen($firstName) > 100 || mb_strlen($lastName) > 100) {
            app_json(['error' => 'Prénom ou nom invalide.'], 422);
        }
        $profileInput = is_array($input['profile'] ?? null) ? $input['profile'] : [];
        $values = [];
        foreach ($definition['fields'] as $field) {
            if (array_key_exists($field, $profileInput)) {
                $values[$field] = profile_value($field, $profileInput[$field]);
            }
        }
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE users SET first_name = :first_name, last_name = :last_name, phone = :phone WHERE id = :id')
            ->execute(['first_name' => $firstName, 'last_name' => $lastName, 'phone' => $phone ?: null, 'id' => $user['id']]);
        if ($values) {
            $columns = array_keys($values);
            $assignments = implode(', ', array_map(static fn(string $field): string => '`' . $field . '` = :' . $field, $columns));
            $parameters = $values + ['id' => $user['id']];
            $pdo->prepare('UPDATE `' . $definition['table'] . '` SET ' . $assignments . ' WHERE user_id = :id')->execute($parameters);
        }
        $pdo->commit();
        app_json(['ok' => true]);
    }

    if ($action === 'document') {
        if ($user['role_key'] === 'client') {
            app_json(['error' => 'Les justificatifs professionnels ne sont pas disponibles pour ce rôle.'], 403);
        }
        $documentType = (string) ($input['document_type'] ?? '');
        $allowedTypes = ['identity', 'passport', 'cv', 'diploma', 'professional_proof', 'profile_photo', 'shop_logo', 'shop_photo', 'product_photo'];
        if (!in_array($documentType, $allowedTypes, true)) {
            app_json(['error' => 'Type de document invalide.'], 422);
        }
        if (!isset($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) {
            app_json(['error' => 'Sélectionnez un document valide.'], 422);
        }
        $file = $_FILES['document'];
        if ($file['size'] < 1 || $file['size'] > 10 * 1024 * 1024) {
            app_json(['error' => 'Le document doit faire moins de 10 Mo.'], 422);
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $extensions = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];
        if (!is_string($mime) || !isset($extensions[$mime])) {
            app_json(['error' => 'Formats autorisés : PDF, JPEG ou PNG.'], 422);
        }
        $storage = profile_store_path();
        $storageKey = bin2hex(random_bytes(24)) . '.' . $extensions[$mime];
        $filePath = $storage . DIRECTORY_SEPARATOR . $storageKey;
        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            app_json(['error' => 'Impossible de stocker le document.'], 503);
        }
        try {
            $pdo->prepare(
                "INSERT INTO professional_documents (user_id, document_type, original_name, storage_key, mime_type, size_bytes, sha256)
                 VALUES (:user_id, :type, :name, :storage_key, :mime, :size, :sha256)"
            )->execute([
                'user_id' => $user['id'], 'type' => $documentType,
                'name' => mb_substr(basename((string) $file['name']), 0, 255),
                'storage_key' => $storageKey, 'mime' => $mime, 'size' => (int) $file['size'],
                'sha256' => hash_file('sha256', $filePath),
            ]);
            $documentId = (int) $pdo->lastInsertId();
            $required = match ($user['role_key']) {
                'trainer' => ['identity', 'professional_proof'],
                'veterinarian' => ['identity', 'cv', 'diploma'],
                'shop' => ['identity'],
            };
            $check = $pdo->prepare('SELECT DISTINCT document_type FROM professional_documents WHERE user_id = :id AND review_status <> \'rejected\'');
            $check->execute(['id' => $user['id']]);
            $present = $check->fetchAll(PDO::FETCH_COLUMN);
            $profileRequirements = match ($user['role_key']) {
                'trainer' => ['city', 'specialties', 'qualifications', 'service_area'],
                'veterinarian' => ['city', 'clinic_name', 'clinic_address', 'specialty', 'qualifications'],
                'shop' => ['city', 'shop_name', 'category', 'address'],
            };
            $profileQuery = $pdo->prepare('SELECT * FROM `' . $definition['table'] . '` WHERE user_id = :id');
            $profileQuery->execute(['id' => $user['id']]);
            $profileValues = $profileQuery->fetch() ?: [];
            $missingFields = array_values(array_filter($profileRequirements, static fn(string $field): bool => empty($profileValues[$field])));
            $missing = array_values(array_unique(array_merge(array_diff($required, $present), $missingFields)));
            $nextStatus = $missing ? 'incomplete' : 'pending';
            $pdo->prepare('UPDATE users SET verification_status = :status WHERE id = :id')->execute(['status' => $nextStatus, 'id' => $user['id']]);
            app_admin_event('verification_request', 'user', (int) $user['id'], 'Documents professionnels reçus', 'Compte ' . $user['id'] . ' · rôle ' . $user['role_key'] . ' · document ' . $documentId);
            app_json(['ok' => true, 'documentId' => $documentId, 'verificationStatus' => $nextStatus, 'missingDocuments' => array_values($missing)], 201);
        } catch (Throwable $exception) {
            @unlink($filePath);
            throw $exception;
        }
    }

    app_json(['error' => 'Action inconnue.'], 404);
} catch (DomainException $exception) {
    app_json(['error' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log('[MASTER OF DOG PROFILE] ' . get_class($exception) . ': ' . $exception->getMessage());
    app_json(['error' => 'Service temporairement indisponible.'], 503);
}