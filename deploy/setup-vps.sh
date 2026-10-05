#!/usr/bin/env bash
# Prepara un VPS Ubuntu 22.04/24.04 para DMT (pensado para Oracle Cloud Always Free, ARM).
# Uso, conectado por SSH al servidor:
#   curl -fsSL https://raw.githubusercontent.com/Zann181/dmt-sistema-v2/master/deploy/setup-vps.sh | bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Zann181/dmt-sistema-v2.git}"
APP_DIR="${APP_DIR:-$HOME/dmt}"

echo "==> 1/5 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> 2/5 Firewall (puertos 80 y 443)"
# Las imágenes Ubuntu de Oracle traen iptables que rechazan todo salvo SSH
if sudo iptables -S INPUT | grep -q REJECT; then
  for port in 80 443; do
    sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null \
      || sudo iptables -I INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null 2>&1 && sudo netfilter-persistent save
fi

echo "==> 3/5 Actualizaciones de seguridad automáticas"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades git openssl >/dev/null

echo "==> 4/5 Código y configuración"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
mkdir -p backups

if [ ! -f .env.production ]; then
  public_ip="$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)"
  domain="${DOMAIN:-$(echo "$public_ip" | tr . -).sslip.io}"
  sed \
    -e "s|^DOMAIN=.*|DOMAIN=$domain|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" \
    -e "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" \
    -e "s|^BOOTSTRAP_ADMIN_SECRET=.*|BOOTSTRAP_ADMIN_SECRET=$(openssl rand -hex 24)|" \
    .env.production.example > .env.production
  chmod 600 .env.production
  echo "    .env.production creado para https://$domain"
  echo "    Completa SMTP_USER / SMTP_PASSWORD / SMTP_FROM con:  nano $APP_DIR/.env.production"
fi

echo "==> 5/5 Arrancando contenedores (la primera compilación tarda unos minutos)"
sudo docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo
echo "Listo. Estado:  sudo docker compose -f docker-compose.prod.yml --env-file .env.production ps"
echo "URL:           https://$(grep '^DOMAIN=' .env.production | cut -d= -f2)"
