#!/usr/bin/env bash
# Сборка и выкладка сайта на обычный хостинг по SSH.
#
#   SITE_URL=https://мастерская.рф \
#   DEPLOY_HOST=u123456@ssh.hosting.ru \
#   DEPLOY_PATH=/home/u123456/public_html \
#   ./scripts/deploy.sh
#
# Ключи ssh должны быть уже настроены: пароль скрипт не спрашивает.
# Проверить, что именно уедет, ничего не меняя:  ./scripts/deploy.sh --dry-run

set -euo pipefail

: "${SITE_URL:?нужен SITE_URL — иначе canonical и sitemap уйдут на заглушку}"
: "${DEPLOY_HOST:?нужен DEPLOY_HOST, например u123456@ssh.hosting.ru}"
: "${DEPLOY_PATH:?нужен DEPLOY_PATH, например /home/u123456/public_html}"

DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

echo "→ сборка для ${SITE_URL}"
SITE_URL="$SITE_URL" npm run build

echo "→ проверка доступности"
npm run a11y

# Хвостовой слэш у источника обязателен: без него rsync положит папку
# внутрь целевой, а не её содержимое.
echo "→ выкладка на ${DEPLOY_HOST}:${DEPLOY_PATH}"
rsync -avz --delete $DRY \
  --exclude '.DS_Store' \
  --exclude 'admin/' \
  dist/ "${DEPLOY_HOST}:${DEPLOY_PATH}/"

if [ -n "$DRY" ]; then
  echo "✓ пробный прогон, на сервере ничего не изменилось"
else
  echo "✓ готово: ${SITE_URL}"
fi
