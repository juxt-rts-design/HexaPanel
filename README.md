# HexaPanel

Panneau d'hébergement multi-comptes pour VPS : déploie des sites / apps (static, Node, Python, PHP) via **GitHub** ou **upload ZIP**, puis expose un lien HTTPS `https://{slug}.{IP}.sslip.io` (nginx + PM2 + certbot).

## Prérequis VPS

- Debian / Ubuntu
- Accès sudo
- Ports 80 / 443 ouverts

## Install rapide

```bash
git clone <ton-repo> HexaPanel && cd HexaPanel
chmod +x scripts/install-vps.sh
./scripts/install-vps.sh
```

Le script installe Node, nginx, certbot, PM2, build le panel, crée l’admin, et configure `https://panel.{IP}.sslip.io`.

Variables utiles avant install :

```bash
export VPS_IP=x.x.x.x
export ADMIN_EMAIL=toi@mail.com
export ADMIN_PASSWORD='mot-de-passe-fort'
```

## Dev local

```bash
npm install
npm run build -w @hexapanel/shared
npm run db:generate -w @hexapanel/panel-api
npm run db:push -w @hexapanel/panel-api
npm run dev          # API :4040 + UI :5173
# ou séparément : npm run dev:api / npm run dev:web
```

Le `.gitignore` n’exclut que `node_modules` / builds / logs. Les `.env`, SQLite et configs partent avec le repo (prévu pour un **repo privé**).

Par défaut `DEPLOY_DRY_RUN=true` : nginx / PM2 apps / certbot sont simulés (configs écrites sous `apps-data/.nginx-dry`).

Compte admin seed : `admin@hexapanel.local` / `admin123456` (voir `apps/panel-api/.env`).

## Utilisation

1. Crée un compte (ou connecte-toi en admin).
2. **Nouvelle app** → colle un lien `https://github.com/...` **ou** envoie un ZIP.
3. HexaPanel clone/extrait, détecte le runtime, build, démarre PM2 si besoin, écrit nginx, lance certbot.
4. Ouvre `https://{slug}.{IP}.sslip.io`.

## Structure

- `apps/panel-api` — API Express + moteur de déploiement
- `apps/panel-web` — UI React
- `packages/shared` — types partagés
- `apps-data/` — sources des apps hébergées
- `data/` — SQLite + uploads
- `scripts/install-vps.sh` — bootstrap VPS

## Prod

Sur le VPS, mets `DEPLOY_DRY_RUN=false` dans `apps/panel-api/.env` (fait automatiquement par le script d’install).
# HexaPanel
