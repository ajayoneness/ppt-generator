#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  AI PPT Generator — VPS Deployment Script
#  Domain  : pptx.codeaj.com
#  Repo    : https://github.com/ajayoneness/ppt-generator.git
#  OS      : Ubuntu 20.04 / 22.04 / 24.04
# ═══════════════════════════════════════════════════════════════════
set -e

# ── Config ─────────────────────────────────────────────────────────
DOMAIN="pptx.codeaj.com"
REPO_URL="https://github.com/ajayoneness/ppt-generator.git"
APP_DIR="/var/www/ppt-generator"
APP_PORT=3000
APP_NAME="ppt-generator"
NODE_VERSION=20

# ── Colors ─────────────────────────────────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'
log()  { echo -e "${G}[✓]${N} $1"; }
warn() { echo -e "${Y}[!]${N} $1"; }
err()  { echo -e "${R}[✗]${N} $1"; exit 1; }
step() { echo -e "\n${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}\n${C}  ► $1${N}\n${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

# ── Root check ─────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Run as root:  sudo bash deploy.sh"
fi

echo -e "\n${C}"
cat << 'BANNER'
   ___  _____  ____  ______  ____                           __
  / _ \/  _/ |/_/ /_/ ___/ / ___/__ ___  ___ _______ _____/ /____  ____
 / ___// /_>  </ __/ (_ / / (_ / -_) _ \/ -_) __/ _ `/ __/ __/ _ \/ __/
/_/  /___/_/|_|\__/\___/  \___/\__/_//_/\__/_/  \_,_/\__/\__/\___/_/

  AI PPT Generator · pptx.codeaj.com
BANNER
echo -e "${N}"

# ═══════════════════════════════════════════════════════════════════
step "1 / 9 — System update"
# ═══════════════════════════════════════════════════════════════════
apt-get update -qq

# Detect Ubuntu version for package name differences
UBUNTU_VER=$(lsb_release -rs 2>/dev/null | cut -d. -f1 || echo "22")

# libasound2 was renamed to libasound2t64 in Ubuntu 24.04+
if [[ "$UBUNTU_VER" -ge 24 ]]; then
  LIBASOUND="libasound2t64"
else
  LIBASOUND="libasound2"
fi

apt-get install -y -qq \
  curl wget git unzip software-properties-common \
  build-essential ca-certificates gnupg lsb-release \
  nginx certbot python3-certbot-nginx \
  ffmpeg \
  fonts-liberation libatk-bridge2.0-0 libatk1.0-0 libcups2 \
  libdbus-1-3 libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
  libxss1 libxtst6 xdg-utils "$LIBASOUND" libpangocairo-1.0-0 \
  2>/dev/null || apt-get install -y -qq --fix-missing \
  curl wget git unzip software-properties-common \
  build-essential ca-certificates gnupg lsb-release \
  nginx certbot python3-certbot-nginx \
  ffmpeg \
  fonts-liberation libatk-bridge2.0-0 libatk1.0-0 libcups2 \
  libdbus-1-3 libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
  libxss1 libxtst6 xdg-utils "$LIBASOUND" libpangocairo-1.0-0 \
  2>/dev/null || true
log "System packages installed"

# ═══════════════════════════════════════════════════════════════════
step "2 / 9 — Node.js ${NODE_VERSION} LTS"
# ═══════════════════════════════════════════════════════════════════
if ! command -v node &>/dev/null || [[ $(node -e "process.stdout.write(process.version.split('.')[0].slice(1))") -lt $NODE_VERSION ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
  log "Node.js $(node -v) installed"
else
  log "Node.js $(node -v) already present"
fi

# ═══════════════════════════════════════════════════════════════════
step "3 / 9 — PM2 process manager"
# ═══════════════════════════════════════════════════════════════════
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 --silent
  log "PM2 installed"
else
  log "PM2 already present ($(pm2 -v))"
fi

# ═══════════════════════════════════════════════════════════════════
step "4 / 9 — yt-dlp"
# ═══════════════════════════════════════════════════════════════════
YT_DLP_BIN="/usr/local/bin/yt-dlp"
if ! command -v yt-dlp &>/dev/null; then
  wget -q -O "$YT_DLP_BIN" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
  chmod +x "$YT_DLP_BIN"
  log "yt-dlp installed → $YT_DLP_BIN"
else
  # Update to latest
  yt-dlp -U --quiet 2>/dev/null || true
  log "yt-dlp already present, updated"
fi

# ═══════════════════════════════════════════════════════════════════
step "5 / 9 — Clone / pull repo"
# ═══════════════════════════════════════════════════════════════════
if [[ -d "$APP_DIR/.git" ]]; then
  warn "Repo already exists — pulling latest changes"
  cd "$APP_DIR"
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || warn "git pull failed, continuing with existing code"
else
  git clone "$REPO_URL" "$APP_DIR"
  log "Repo cloned → $APP_DIR"
fi
cd "$APP_DIR"

# ═══════════════════════════════════════════════════════════════════
step "6 / 9 — npm install"
# ═══════════════════════════════════════════════════════════════════
npm install --silent --omit=dev
log "Node dependencies installed"

# Install Puppeteer's bundled Chrome browser (required on VPS)
log "Installing Puppeteer Chrome browser..."
npx puppeteer browsers install chrome 2>/dev/null || \
  node -e "const p=require('puppeteer');if(p.executablePath)console.log('Chrome at:',p.executablePath())" 2>/dev/null || true

# Fallback: install system Chromium if Puppeteer Chrome install failed
if ! npx puppeteer browsers list 2>/dev/null | grep -q "chrome"; then
  warn "Puppeteer bundled Chrome not found — installing system chromium as fallback"
  apt-get install -y -qq chromium-browser 2>/dev/null || apt-get install -y -qq chromium 2>/dev/null || true
fi

# Create output directory
mkdir -p "$APP_DIR/output"
log "Output directory ready"

# ═══════════════════════════════════════════════════════════════════
step "7 / 9 — PM2 app setup"
# ═══════════════════════════════════════════════════════════════════

# Write PM2 ecosystem file
cat > "$APP_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: 'server.js',
    cwd: '${APP_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT}
    },
    error_file: '/var/log/${APP_NAME}/err.log',
    out_file:   '/var/log/${APP_NAME}/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
EOF

mkdir -p "/var/log/${APP_NAME}"

# Stop existing instance if running
pm2 stop "$APP_NAME" 2>/dev/null || true
pm2 delete "$APP_NAME" 2>/dev/null || true

# Start fresh
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save

# Register PM2 to start on server reboot
pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true
pm2 save

log "App running via PM2 on port $APP_PORT"

# ═══════════════════════════════════════════════════════════════════
step "8 / 9 — Nginx reverse proxy"
# ═══════════════════════════════════════════════════════════════════

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}"

cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Increase timeouts for long PPT generation (screenshots + AI)
    proxy_connect_timeout  180s;
    proxy_send_timeout     180s;
    proxy_read_timeout     180s;
    send_timeout           180s;

    # Increase body size for large JSON payloads
    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # SSE: disable buffering so progress events stream in real-time
    location /progress/ {
        proxy_pass             http://127.0.0.1:${APP_PORT};
        proxy_http_version     1.1;
        proxy_set_header       Connection '';
        proxy_set_header       Host \$host;
        proxy_set_header       X-Real-IP \$remote_addr;
        proxy_buffering        off;
        proxy_cache            off;
        chunked_transfer_encoding on;
    }
}
EOF

# Enable site
ln -sf "$NGINX_CONF" "$NGINX_LINK"

# Remove default site if still enabled
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test config
nginx -t
systemctl reload nginx
systemctl enable nginx
log "Nginx configured for $DOMAIN"

# ═══════════════════════════════════════════════════════════════════
step "9 / 9 — SSL certificate (Let's Encrypt)"
# ═══════════════════════════════════════════════════════════════════
warn "Make sure DNS A record for $DOMAIN points to this server's IP before SSL."
echo ""
read -r -p "  Obtain SSL certificate now? [y/N]: " GET_SSL
if [[ "$GET_SSL" =~ ^[Yy]$ ]]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --redirect
  systemctl reload nginx
  log "SSL certificate installed — HTTPS enabled"
else
  warn "Skipped SSL. Run later:  sudo certbot --nginx -d $DOMAIN"
fi

# ═══════════════════════════════════════════════════════════════════
#  DONE
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${G}╔══════════════════════════════════════════════════════╗${N}"
echo -e "${G}║          ✅  Deployment complete!                    ║${N}"
echo -e "${G}╠══════════════════════════════════════════════════════╣${N}"
echo -e "${G}║${N}  URL    : ${C}http://${DOMAIN}${N}"
echo -e "${G}║${N}  App dir: ${C}${APP_DIR}${N}"
echo -e "${G}║${N}  Port   : ${C}${APP_PORT}${N}"
echo -e "${G}║${N}  Logs   : ${C}pm2 logs ${APP_NAME}${N}"
echo -e "${G}║${N}  Status : ${C}pm2 status${N}"
echo -e "${G}║${N}  Restart: ${C}pm2 restart ${APP_NAME}${N}"
echo -e "${G}╚══════════════════════════════════════════════════════╝${N}"
echo ""
echo -e "  ${Y}Login credentials:${N}"
echo -e "  Email    : admin@codeaj.com"
echo -e "  Password : @J@y2263"
echo ""
