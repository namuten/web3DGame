#!/bin/bash
# ─── Let's Encrypt SSL 인증서 최초 발급 스크립트 ───
# 배포 서버에서 한 번만 실행하면 됩니다.
# 이후 갱신은 certbot 컨테이너가 자동으로 처리합니다.
#
# 사용법: sudo bash scripts/init-ssl.sh

set -e

DOMAIN="namuten.duckdns.org"
EMAIL="namuten@gmail.com"  # Let's Encrypt 알림용 이메일 (변경 가능)
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== SSL 인증서 발급 스크립트 ==="
echo "도메인: $DOMAIN"
echo "프로젝트: $PROJECT_DIR"
echo ""

# 1. 초기 Nginx 설정으로 교체 (SSL 없이 HTTP만)
echo "[1/5] 초기 Nginx 설정 적용 (HTTP 전용)..."
cp "$PROJECT_DIR/nginx/nginx-init.conf" "$PROJECT_DIR/nginx/nginx.conf.bak"
cp "$PROJECT_DIR/nginx/nginx-init.conf" "$PROJECT_DIR/nginx/active.conf"

# docker-compose에서 active.conf를 마운트하도록 임시 변경
# 실제로는 nginx-init.conf를 nginx.conf 위치에 복사
cp "$PROJECT_DIR/nginx/nginx-init.conf" "$PROJECT_DIR/nginx/nginx.conf"

# 2. 컨테이너 시작 (certbot 제외)
echo "[2/5] Nginx + 앱 컨테이너 시작..."
cd "$PROJECT_DIR"
docker-compose up -d --build nginx-proxy web3d-client web3d-server web3d-admin

# 3. Nginx가 준비될 때까지 대기
echo "[3/5] Nginx 준비 대기 (5초)..."
sleep 5

# 4. Certbot으로 인증서 발급
echo "[4/5] Let's Encrypt 인증서 발급 중..."
docker-compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# 5. 본래 Nginx SSL 설정으로 복원 & 재시작
echo "[5/5] SSL Nginx 설정 적용 및 재시작..."
# nginx.conf.bak에서 원래 SSL 설정 복원
cp "$PROJECT_DIR/nginx/nginx.conf.bak" "$PROJECT_DIR/nginx/nginx.conf"
rm -f "$PROJECT_DIR/nginx/nginx.conf.bak" "$PROJECT_DIR/nginx/active.conf"

# 원래의 SSL nginx.conf를 git에서 복원
cd "$PROJECT_DIR"
git checkout nginx/nginx.conf 2>/dev/null || true

docker-compose up -d --force-recreate nginx-proxy
docker-compose up -d certbot

echo ""
echo "✅ SSL 인증서 발급 완료!"
echo "✅ https://$DOMAIN 으로 접속 가능합니다."
echo ""
echo "인증서는 certbot 컨테이너가 12시간마다 자동 갱신합니다."
