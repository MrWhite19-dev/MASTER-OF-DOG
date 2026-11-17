# Pack de déploiement final MASTER OF DOG

## Contenu
- `.github/workflows/deploy.yml`
- `deploy/production-setup.sh`
- `deploy/deploy.sh`
- `deploy/webhook.php`

## 1. Copier dans le dépôt Git
Le dossier `deploy/` doit être placé dans le dépôt Git.

## 2. Ajouter les secrets GitHub
Dans GitHub, créer les secrets suivants :
- `SSH_HOST`
- `SSH_USERNAME`
- `SSH_PRIVATE_KEY`

## 3. Déploiement automatique
À chaque `push` sur `main`, le workflow GitHub Actions se connecte au VPS et met à jour le site.

## 4. Déploiement manuel
```bash
bash /var/www/masterofdog/current/MASTER-OF-DOG-WEB/deploy/deploy.sh
```

## 5. Webhook
Configurer le webhook GitHub sur :
```text
https://masterofdog.fr/deploy/webhook.php
```

## 6. Sécurité
- conserver les secrets dehors du dépôt
- garder le fichier `config.php` hors du dossier public
- utiliser un domaine HTTPS
- ne jamais exposer les credentials MySQL / SMTP

## 7. Vérification
```bash
curl -I https://masterofdog.fr
```

Ensuite vérifier :
- inscription
- connexion
- admin
- dashboard
- auto-update
