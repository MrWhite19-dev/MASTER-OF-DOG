# Backend MASTER of DOG

## État

Le backend PHP/PDO et le schéma MySQL sont installés à côté du frontend existant. Les inscriptions, sessions, dossiers, sanctions et avis utilisent la base `master_of_dog`. Les tables ne contiennent aucun compte de démonstration. Une partie du catalogue public reste encore statique.

## Installation locale WAMP

1. Importer `database/schema.sql` dans MySQL depuis le répertoire du projet :

   ```text
   mysql --user=root --skip-password < database/schema.sql
   ```

2. Appliquer les migrations dans l’ordre :

   ```text
   mysql --user=root --skip-password < database/migrations/002_admin_analytics_email.sql
   mysql --user=root --skip-password < database/migrations/003_auth_tokens.sql
   ```

3. Créer le compte MySQL applicatif et la configuration privée par le script CLI :

   ```text
   php bin/install_backend.php
   ```

   Par défaut, le script utilise l’utilisateur local `root` sans mot de passe pour l’installation WAMP. Pour une instance MySQL protégée, définir `MASTER_DOG_SETUP_DB_USER` et `MASTER_DOG_SETUP_DB_PASSWORD` dans l’environnement CLI avant de le lancer. Il génère un secret aléatoire pour l’utilisateur SQL dédié, accorde uniquement `SELECT`, `INSERT`, `UPDATE` et `DELETE` sur `master_of_dog`, puis conserve la configuration sous `C:/wamp64/private/master-of-dog/config.php`. Il refuse de remplacer une configuration ou un utilisateur existant.

4. Copier `config/config.example.php` hors du webroot, vers `C:/wamp64/private/master-of-dog/config.php`. Définir les variables d’environnement Apache suivantes (et leurs équivalents dans la session CLI utilisée pour les commandes) :

   - `MASTER_DOG_CONFIG=C:/wamp64/private/master-of-dog/config.php`
   - La configuration générée contient l’utilisateur SQL applicatif et une clé aléatoire ; aucune de ces valeurs ne doit être copiée dans le dépôt.
   - `MASTER_DOG_PRIVATE_STORAGE=C:/wamp64/private/master-of-dog/uploads`
   - `MASTER_DOG_ADMIN_EMAIL` avec la boîte de réception du propriétaire

   Ne placez aucun vrai secret dans le dépôt, un fichier accessible depuis le navigateur ou un ticket de support.

5. Installer PHPMailer avec Composer depuis le dossier du projet :

   ```text
   composer install --no-dev --classmap-authoritative
   ```

6. Pour activer l’envoi SMTP, configurer `MASTER_DOG_SMTP_ENABLED=1`, `MASTER_DOG_SMTP_HOST`, `MASTER_DOG_SMTP_PORT`, `MASTER_DOG_SMTP_SECURE`, `MASTER_DOG_SMTP_USERNAME`, `MASTER_DOG_SMTP_PASSWORD`, `MASTER_DOG_SMTP_FROM` et `MASTER_DOG_SMTP_FROM_NAME`. Sans SMTP activé, les notifications restent dans la file MySQL et aucun e-mail n’est envoyé.

7. Créer le premier super-administrateur depuis un terminal privé. Saisir l’adresse et le mot de passe dans les variables d’environnement CLI, puis exécuter :

   ```text
   php bin/create_super_admin.php
   ```

   Le script refuse de créer un second super-administrateur. Il n’existe aucune inscription admin publique. Utiliser un mot de passe unique d’au moins 14 caractères et effacer les variables CLI après l’opération.

8. Accéder au site depuis l’URL WAMP existante. Les endpoints PHP doivent être servis sous `api/`; `app/`, `bin/`, `config/` et `database/` sont interdits en accès HTTP par leurs `.htaccess`.

## E-mails

Une fois PHPMailer et SMTP configurés, traiter la file avec une tâche planifiée Windows appelant `php bin/process_email_queue.php`. Le worker n’inclut pas les justificatifs ni les mots de passe dans les messages. Les secrets SMTP ne sont jamais exposés au JavaScript.

## Portée actuelle et points de déploiement

- Les profils professionnels sont privés jusqu’à validation admin. Les pièces doivent résider dans `MASTER_DOG_PRIVATE_STORAGE`, qui doit rester hors du webroot.
- Le stockage des preuves de signalement et de réclamation accepte JPEG, PNG et PDF, jusqu’à 10 Mo.
- Google OAuth, la signature de contrats et leur export PDF, le choix d’adresse Google Maps, les services de paiement et la politique finale de conservation/suppression ne sont pas activés par cette livraison.
- Le suivi analytique doit rester désactivé tant que le consentement et la configuration serveur ne sont pas définis (`MASTER_DOG_ANALYTICS_ENABLED`).
- Les tests d’intégration de bout en bout doivent être exécutés après configuration d’un compte MySQL applicatif et de la configuration privée. Les actions super-admin doivent toujours être vérifiées sur un déploiement HTTPS.