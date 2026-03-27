#!/bin/bash
set -e

DOMAIN="namuten.duckdns.org"
EMAIL="${1:?사용법: bash scripts/init-ssl.sh your@email.com}"

# ── 실패 시 nginx-init 자동 정리 ──
cleanup() {
  echo ""
  echo "정리 중: nginx-init 컨테이너 중단..."
  docker stop nginx-init 2>/dev/null && docker rm nginx-init 2>/dev/null || true
}
trap cleanup EXIT

echo "======================================"
echo " Let's Encrypt 인증서 초기 발급 스크립트"
echo " 도메인: $DOMAIN"
echo " 이메일: $EMAIL"
echo "======================================"

# 스크립트 위치 기준으로 프로젝트 루트 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "=== 0. DuckDNS IP 확인 ==="
RESOLVED_IP=$(dig +short "$DOMAIN" | tail -1)
echo "  $DOMAIN → $RESOLVED_IP"
echo "  서버 공인 IP와 일치하는지 확인하세요. 다르면 Ctrl+C로 중단."
sleep 3

echo ""
echo "=== 1. 기존 컨테이너 중단 ==="
docker-compose down || true

echo ""
echo "=== 2. /var/www/certbot 디렉토리 생성 ==="
mkdir -p /var/www/certbot
mkdir -p /etc/letsencrypt

echo ""
echo "=== 3. nginx-init 임시 시작 (HTTP only, port 80) ==="
docker run -d --name nginx-init \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "/var/www/certbot:/var/www/certbot" \
  nginx:stable-alpine

echo "nginx-init 기동 대기 (3초)..."
sleep 3

echo ""
echo "=== 4. 인증서 발급 ==="
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email

# cleanup trap이 nginx-init을 정리함 (Step 5)

echo ""
echo "=== 5. 전체 스택 HTTPS로 실행 ==="
trap - EXIT  # 정상 완료이므로 trap 해제 후 명시적 cleanup
cleanup
docker-compose up -d --build

echo ""
echo "======================================"
echo " 완료! https://$DOMAIN 접속 확인하세요"
echo "======================================"
