# HTTPS (Let's Encrypt) 적용 설계 문서

**날짜:** 2026-03-27
**도메인:** namuten.duckdns.org
**서버:** Ubuntu + Docker
**배포:** GitHub Actions (SSH → docker-compose)

---

## 1. 목표

- HTTP → HTTPS 리다이렉트 적용
- Let's Encrypt 인증서 발급 및 자동 갱신
- 기존 GitHub Actions 배포 파이프라인 변경 없음

---

## 2. 전체 흐름

### 최초 1회 (수동)
```
서버 SSH 접속
  → scripts/init-ssl.sh your@email.com 실행
    1. docker-compose down (기존 컨테이너 중단, 80포트 해제)
    2. nginx-init 임시 컨테이너 단독 실행 (HTTP only, port 80 바인딩)
    3. certbot --webroot 로 인증서 발급 (/etc/letsencrypt 호스트 경로에 저장)
    4. nginx-init 컨테이너 중단 및 제거
    5. docker-compose up -d --build (HTTPS nginx로 전체 스택 실행)
```

### 이후 배포 (자동)
```
GitHub Actions push to main
  → SSH: git reset --hard origin/main
  → SSH: docker-compose up -d --build --force-recreate
  ← nginx가 /etc/letsencrypt 마운트해서 HTTPS로 정상 기동
  ← certbot 컨테이너 12시간마다 갱신 체크 후 nginx reload
```

---

## 3. 아키텍처

```
인터넷
  ↓ (80 → 443 리다이렉트)
  ↓ (443 HTTPS)
nginx-proxy (nginx:stable-alpine)
  ├── /           → web3d-client:80  (Three.js 게임)
  ├── /socket.io/ → web3d-server:3000 (WebSocket, timeout 300s)
  ├── /api/       → web3d-server:3000 (REST API)
  └── /admin/     → web3d-admin:80   (관리 패널)

certbot (certbot/certbot)
  └── 12시간마다 인증서 갱신 체크 후 nginx-proxy reload
```

---

## 4. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `docker-compose.yml` | nginx-proxy + certbot 서비스 추가, client/server/admin ports → expose |
| `nginx/nginx.conf` | HTTPS 리버스 프록시 설정 |
| `nginx/nginx-init.conf` | HTTP only (ACME 챌린지용 임시 설정, init 스크립트 전용) |
| `scripts/init-ssl.sh` | 최초 1회 실행 init 스크립트 |
| `client/src/network/socket.ts` | fallback URL → `https://namuten.duckdns.org` |
| `admin/src/api.ts` | fallback URL → `https://namuten.duckdns.org` |
| `admin/src/mapApi.ts` | fallback URL → `https://namuten.duckdns.org` |
| `admin/src/termApi.ts` | fallback URL → `https://namuten.duckdns.org` |
| `admin/vite.config.ts` | `base: '/admin/'` 추가 |
| `client/.env.example` | URL → `https://namuten.duckdns.org` |
| `admin/.env.example` | URL → `https://namuten.duckdns.org` |

**변경 없는 파일:** `.github/workflows/deploy.yml`

---

## 5. 핵심 기술 결정

### 인증서 저장: 호스트 bind mount
```yaml
# docker-compose.yml nginx-proxy 볼륨
- /etc/letsencrypt:/etc/letsencrypt:ro
- /var/www/certbot:/var/www/certbot:ro
```
- Docker named volume 대신 **호스트 경로** 직접 마운트
- `docker-compose down/up` 재배포 시 인증서 유지
- init 스크립트와 docker-compose가 동일 경로(`/etc/letsencrypt`) 공유
- 주의: `docker-compose down -v`는 해당 없음 (named volume 미사용)

### certbot 갱신 후 nginx reload
```bash
# certbot 컨테이너 entrypoint
while :; do
  certbot renew --webroot -w /var/www/certbot --quiet \
    --deploy-hook "docker exec nginx-proxy nginx -s reload"
  sleep 12h & wait $!
done
```
갱신 성공 시 nginx-proxy에 reload 신호 전송 → 새 인증서 즉시 적용

> **필수:** certbot 컨테이너는 `docker exec` 실행을 위해 Docker socket을 마운트해야 함
> ```yaml
> volumes:
>   - /var/run/docker.sock:/var/run/docker.sock:ro
>   - /etc/letsencrypt:/etc/letsencrypt
>   - /var/www/certbot:/var/www/certbot
> ```
> 소켓 마운트 없으면 deploy-hook이 실패해도 에러가 출력되지 않으므로 주의

### init 스크립트: 독립 컨테이너 방식 (파일 변조 없음)
```bash
# nginx-init 단독 실행 (docker-compose 네트워크와 무관)
docker run -d --name nginx-init \
  -p 80:80 \
  -v $(pwd)/nginx/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /var/www/certbot:/var/www/certbot \
  nginx:stable-alpine
```
- `nginx.conf`를 덮어쓰지 않음 → 파일 변조/복원 과정 없음
- compose 네트워크 외부에서 실행되므로 다른 서비스 불필요

### WebSocket 타임아웃 연장
```nginx
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```
게임 특성상 장시간 연결 유지 필요

### admin base URL
```typescript
// vite.config.ts
base: '/admin/'
```
nginx `/admin/` 경로로 서빙하므로 빌드 시 base 경로 일치 필요

---

## 6. init-ssl.sh 상세

```bash
#!/bin/bash
set -e

DOMAIN="namuten.duckdns.org"
EMAIL="${1:?사용법: bash scripts/init-ssl.sh your@email.com}"

echo "=== 1. 기존 컨테이너 중단 ==="
docker-compose down

echo "=== 2. nginx-init 임시 시작 (HTTP only) ==="
docker run -d --name nginx-init \
  -p 80:80 \
  -v "$(pwd)/nginx/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "/var/www/certbot:/var/www/certbot" \
  nginx:stable-alpine

sleep 3  # nginx 기동 대기

echo "=== 3. 인증서 발급 ==="
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email

echo "=== 4. nginx-init 중단 ==="
docker stop nginx-init && docker rm nginx-init

echo "=== 5. 전체 스택 HTTPS로 실행 ==="
docker-compose up -d --build

echo "=== 완료: https://$DOMAIN ==="
```

**사용법:** `bash scripts/init-ssl.sh your@email.com`

**실패 시 롤백:**
```bash
docker stop nginx-init 2>/dev/null; docker rm nginx-init 2>/dev/null
docker-compose up -d --build  # 기존 HTTP 스택으로 재기동
```

---

## 7. 성공 기준

- [ ] `https://namuten.duckdns.org` 접속 시 게임 로딩
- [ ] `http://namuten.duckdns.org` 접속 시 HTTPS로 리다이렉트
- [ ] WebSocket (Socket.IO) 멀티플레이어 정상 동작
- [ ] `https://namuten.duckdns.org/admin/` 관리 패널 접속 가능
- [ ] GitHub Actions push 후 자동 배포 정상 동작
- [ ] 인증서 갱신 후 nginx 자동 reload (deploy-hook)
