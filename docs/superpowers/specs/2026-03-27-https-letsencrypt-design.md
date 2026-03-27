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
  → scripts/init-ssl.sh 실행
    1. docker-compose down (기존 컨테이너 중단, 80포트 해제)
    2. nginx-init 임시 컨테이너 실행 (HTTP only, port 80)
    3. certbot --webroot 로 인증서 발급 (/etc/letsencrypt 저장)
    4. nginx-init 컨테이너 중단
    5. docker-compose up -d --build (HTTPS nginx로 전체 스택 실행)
```

### 이후 배포 (자동)
```
GitHub Actions push to main
  → SSH: git reset --hard origin/main
  → SSH: docker-compose up -d --build --force-recreate
  ← nginx가 /etc/letsencrypt 마운트해서 HTTPS로 정상 기동
  ← certbot 컨테이너 12시간마다 갱신 체크
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
  └── 12시간마다 인증서 갱신 체크
```

---

## 4. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `docker-compose.yml` | nginx-proxy + certbot 서비스 추가, client/server/admin ports → expose |
| `nginx/nginx.conf` | HTTPS 리버스 프록시 설정 |
| `nginx/nginx-init.conf` | HTTP only (ACME 챌린지용 임시 설정) |
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
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
  - /var/www/certbot:/var/www/certbot:ro
```
- Docker named volume 대신 호스트 경로 직접 마운트
- `docker-compose down/up` 시에도 인증서 유지
- init 스크립트와 docker-compose가 동일 경로 공유

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
EMAIL="$1"  # 인수로 이메일 전달

# 1. 기존 컨테이너 중단
docker-compose down

# 2. nginx-init 임시 실행
docker run -d --name nginx-init \
  -p 80:80 \
  -v $(pwd)/nginx/nginx-init.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /var/www/certbot:/var/www/certbot \
  nginx:stable-alpine

sleep 3  # nginx 기동 대기

# 3. certbot으로 인증서 발급
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d $DOMAIN \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email

# 4. nginx-init 중단
docker stop nginx-init && docker rm nginx-init

# 5. 전체 스택 HTTPS로 실행
export DB_PASSWORD=${DB_PASSWORD}
docker-compose up -d --build
```

사용법: `bash scripts/init-ssl.sh your@email.com`

---

## 7. 성공 기준

- [ ] `https://namuten.duckdns.org` 접속 시 게임 로딩
- [ ] `http://namuten.duckdns.org` 접속 시 HTTPS로 리다이렉트
- [ ] WebSocket (Socket.IO) 멀티플레이어 정상 동작
- [ ] `/admin/` 관리 패널 접속 가능
- [ ] GitHub Actions push 후 자동 배포 정상 동작
- [ ] 인증서 만료 전 자동 갱신 (certbot 컨테이너)
