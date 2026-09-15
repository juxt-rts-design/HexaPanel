#!/usr/bin/env bash
# Bootstrap HexaPanel sur un VPS (nginx + PM2 + certbot + panel HTTPS sslip.io)
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")")/.." && pwd)"
cd "$ROOT"

echo "→ HexaPanel install depuis : $ROOT"

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  echo "Lance ce script en user normal (sudo sera demandé)."
  exit 1
fi

detect_ip() {
  if [[ -n "${VPS_IP:-}" ]]; then
    echo "$VPS_IP"
    return
  fi
  curl -4 -fsS --max-time 5 ifconfig.me 2>/dev/null \
    || curl -4 -fsS --max-time 5 icanhazip.com 2>/dev/null \
    || hostname -I | awk '{print $1}'
}

VPS_IP="$(detect_ip | tr -d '[:space:]')"
if [[ -z "$VPS_IP" ]]; then
  echo "Impossible de détecter VPS_IP. Exporte VPS_IP=x.x.x.x"
  exit 1
fi

SSIP="${VPS_IP//./-}"
PANEL_DOMAIN="panel.${SSIP}.sslip.io"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hexapanel.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -hex 8)}"

echo "→ IP: $VPS_IP"
echo "→ Panel: https://$PANEL_DOMAIN"

sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx git curl unzip \
  python3 python3-pip php-cli composer 2>/dev/null || \
sudo apt install -y nginx certbot python3-certbot-nginx git curl unzip \
  python3 python3-pip php-cli

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

command -v pm2 >/dev/null || sudo npm i -g pm2

mkdir -p "$ROOT/data" "$ROOT/apps-data" "$ROOT/data/uploads"

cat > "$ROOT/apps/panel-api/.env" <<EOF
PORT=4040
HOST=127.0.0.1
DATABASE_URL="file:../../../data/hexapanel.db"
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
VPS_IP=$VPS_IP
APPS_ROOT=../../../apps-data
UPLOADS_ROOT=../../../data/uploads
PORT_RANGE_START=5100
PORT_RANGE_END=5999
MAX_ZIP_MB=100
BUILD_TIMEOUT_MS=600000
DEPLOY_DRY_RUN=false
PANEL_WEB_ORIGIN=https://$PANEL_DOMAIN
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

npm install
npm run build -w @hexapanel/shared
npm run db:generate -w @hexapanel/panel-api
npm run db:push -w @hexapanel/panel-api
npm run build

pm2 delete hexapanel-api hexapanel-web 2>/dev/null || true
pm2 start "$ROOT/ecosystem.config.cjs"
pm2 save

sudo tee /etc/nginx/sites-available/hexapanel >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $PANEL_DOMAIN;

    client_max_body_size 120m;

    location /api/ {
        proxy_pass http://127.0.0.1:4040/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:4173/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sfn /etc/nginx/sites-available/hexapanel /etc/nginx/sites-enabled/hexapanel
sudo nginx -t && sudo systemctl reload nginx

sudo ufw allow 80 || true
sudo ufw allow 443 || true

sudo certbot --nginx --agree-tos --register-unsafely-without-email \
  -d "$PANEL_DOMAIN" --non-interactive --redirect || true

sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "OK — HexaPanel"
echo "  URL   : https://$PANEL_DOMAIN"
echo "  Admin : $ADMIN_EMAIL"
echo "  Pass  : $ADMIN_PASSWORD"
echo "  (change le mot de passe après première connexion)"
pm2 status
