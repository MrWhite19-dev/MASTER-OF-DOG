# Déploiement automatique MASTER OF DOG

## Objectif
Ce dossier permet de déclencher un déploiement automatique après un push Git et de mettre à jour le site sans intervention manuelle.

## Fichiers
- `deploy.sh` : met à jour le dépôt local et réapplique les permissions.
- `webhook.php` : endpoint HTTP qui reçoit un webhook GitHub/GitLab/Bitbucket.

## 1. Préparer le dépôt
Le site est supposé être déployé dans un dossier Git avec la branche `main`.

## 2. Récupérer le script sur le serveur
Copier le dossier `deploy/` sur le serveur et le placer dans le dossier racine du projet.

## 3. Déployer manuellement
```bash
cd /var/www/masterofdog/current/MASTER-OF-DOG-WEB
bash deploy/deploy.sh
```

## 4. Déploiement automatisé via webhook
### Sur le serveur
Configurer une variable d’environnement ou modifier la valeur par défaut dans `webhook.php` :
```bash
export MASTER_DOG_WEBHOOK_SECRET="une-cle-secrete-très-longue"
```

### Sur GitHub
1. Aller dans le dépôt GitHub.
2. Ouvrir Settings > Webhooks.
3. Ajouter un webhook.
4. URL :
```text
https://masterofdog.fr/deploy/webhook.php
```
5. Secret : la même valeur que `MASTER_DOG_WEBHOOK_SECRET`.
6. Choisir `application/json`.
7. Déclencher sur `push`.

### Exemple de script de test
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(printf '%s' '{"ref":"refs/heads/main"}' | openssl dgst -sha256 -hmac 'une-cle-secrete-très-longue' -binary | xxd -p -c 256)" \
  https://masterofdog.fr/deploy/webhook.php
```

## 5. Mise à jour périodique via cron (alternative)
Ajouter une ligne dans le crontab :
```bash
*/5 * * * * /var/www/masterofdog/current/MASTER-OF-DOG-WEB/deploy/deploy.sh >> /var/www/masterofdog/current/MASTER-OF-DOG-WEB/deploy/deploy.log 2>&1
```

## 6. Bonnes pratiques
- Ne jamais publier le secret dans le code source.
- Séparer le dossier public et le dossier privé.
- Vérifier que le fichier de configuration production reste hors du dossier public.
- Garder la branche `main` propre.
- Tester le déploiement sur un environnement de test avant production.
