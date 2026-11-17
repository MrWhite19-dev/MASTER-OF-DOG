#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="${APP_ROOT}"
LOG_FILE="${APP_ROOT}/deploy/deploy.log"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-change-me}"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

if [ ! -d "${REPO_DIR}/.git" ]; then
  log "Erreur : le dépôt Git n’existe pas dans ${REPO_DIR}."
  exit 1
fi

cd "$REPO_DIR"

log "Vérification de l’état du dépôt"
git fetch --all --prune

git checkout "$TARGET_BRANCH"
git pull --ff-only origin "$TARGET_BRANCH"

log "Correction des permissions"
find "${REPO_DIR}" -type d -exec chmod 755 {} +
find "${REPO_DIR}" -type f -exec chmod 644 {} +
chmod 700 "${REPO_DIR}/private" 2>/dev/null || true
chmod 600 "${REPO_DIR}/private/config.php" 2>/dev/null || true
chmod 700 "${REPO_DIR}/private/uploads" 2>/dev/null || true

log "Déploiement terminé avec succès"
