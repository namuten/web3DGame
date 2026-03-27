# HTTPS (Let's Encrypt) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** namuten.duckdns.org 에 Let's Encrypt HTTPS를 적용하고 GitHub Actions 자동배포와 연동

**Architecture:** nginx-proxy 컨테이너가 SSL을 종료하고 내부 서비스로 라우팅. 인증서는 호스트 `/etc/letsencrypt`에 저장하여 재배포 시에도 유지. 최초 1회 수동 init 후 certbot이 자동 갱신.

**Tech Stack:** Docker, docker-compose, nginx:stable-alpine, certbot/certbot, Node.js, TypeScript, Vite

**Spec:** `docs/superpowers/specs/2026-03-27-https-letsencrypt-design.md`

---

## 파일 맵

| 파일 | 작업 |
|---|---|
| `docker-compose.yml` | 수정 - nginx-proxy + certbot 추가, ports → expose |
| `nginx/nginx.conf` | 신규 생성 - HTTPS 리버스 프록시 |
| `nginx/nginx-init.conf` | 신규 생성 - HTTP only (init용) |
| `scripts/init-ssl.sh` | 신규 생성 - 최초 인증서 발급 스크립트 |
| `client/src/network/socket.ts` | 수정 line 20 - fallback URL |
| `admin/src/api.ts` | 수정 line 1 - fallback URL |
| `admin/src/mapApi.ts` | 수정 line 1 - fallback URL |
| `admin/src/termApi.ts` | 수정 line 1 - fallback URL |
| `admin/vite.config.ts` | 수정 - base: '/admin/' 추가 |
| `client/.env.example` | 수정 - URL 업데이트 |
| `admin/.env.example` | 수정 - URL 업데이트 |

---

## Task 1: docker-compose.yml — nginx-proxy + certbot 추가

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: docker-compose.yml 전체 교체**

```yaml
version: '3.3'

services:
  # ─── Nginx Reverse Proxy (SSL 종료) ───
  nginx-proxy:
    image: nginx:stable-alpine
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - web3d-client
      - web3d-server
      - web3d-admin
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ─── Certbot (Let's Encrypt 인증서 자동 갱신) ───
  certbot:
    image: certbot/certbot
    container_name: certbot
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /etc/letsencrypt:/etc/letsencrypt
      - /var/www/certbot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot --quiet --deploy-hook \"docker exec nginx-proxy nginx -s reload\"; sleep 12h & wait $${!}; done'"
    restart: always

  web3d-client:
    build: ./client
    container_name: web3d-client
    expose:
      - "80"
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  web3d-server:
    build: ./server
    container_name: web3d-server
    expose:
      - "3000"
    environment:
      - PORT=3000
      - DB_HOST=220.85.41.214
      - DB_PORT=3306
      - DB_NAME=twdb
      - DB_USER=twuser
      - DB_PASSWORD=${DB_PASSWORD}
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  web3d-admin:
    build: ./admin
    container_name: web3d-admin
    expose:
      - "80"
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

- [ ] **Step 2: 검증 - YAML 문법 확인**

```bash
docker-compose config
```
Expected: 오류 없이 전체 설정 출력

- [ ] **Step 3: 커밋**

```bash
git add docker-compose.yml
git commit -m "feat: docker-compose에 nginx-proxy + certbot 추가"
```

---

## Task 2: nginx/nginx.conf — HTTPS 리버스 프록시

**Files:**
- Create: `nginx/nginx.conf`

- [ ] **Step 1: nginx 디렉토리 확인**

```bash
ls nginx/
```
디렉토리가 없으면 생성: `mkdir nginx`

- [ ] **Step 2: nginx/nginx.conf 생성**

```nginx
# ─── HTTPS Nginx Reverse Proxy ───

upstream client {
    server web3d-client:80;
}

upstream server {
    server web3d-server:3000;
}

upstream admin {
    server web3d-admin:80;
}

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name namuten.duckdns.org;

    # Certbot ACME 챌린지 경로
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 나머지는 HTTPS로 리다이렉트
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 서버
server {
    listen 443 ssl;
    server_name namuten.duckdns.org;

    ssl_certificate     /etc/letsencrypt/live/namuten.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/namuten.duckdns.org/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # ─── 게임 클라이언트 ───
    location / {
        proxy_pass http://client;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ─── WebSocket (Socket.IO) ───
    location /socket.io/ {
        proxy_pass http://server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # ─── API 서버 ───
    location /api/ {
        proxy_pass http://server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ─── Admin 패널 ───
    location /admin/ {
        proxy_pass http://admin/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 3: nginx 문법 검증 (로컬 Docker)**

```bash
docker run --rm -v $(pwd)/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx:stable-alpine nginx -t 2>&1 | grep -v "ssl_certificate"
```
Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`
(ssl 인증서 경로 오류는 로컬에서 무시)

- [ ] **Step 4: 커밋**

```bash
git add nginx/nginx.conf
git commit -m "feat: nginx HTTPS 리버스 프록시 설정 추가"
```

---

## Task 3: nginx/nginx-init.conf — HTTP only (init 전용)

**Files:**
- Create: `nginx/nginx-init.conf`

- [ ] **Step 1: nginx/nginx-init.conf 생성**

```nginx
# ─── init-ssl.sh 전용 - 인증서 최초 발급용 HTTP only nginx ───
# 이 파일은 init-ssl.sh 에서만 사용. 일반 배포에는 사용 안 함.

server {
    listen 80;
    server_name namuten.duckdns.org;

    # Certbot ACME 챌린지
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'init-ssl in progress';
        add_header Content-Type text/plain;
    }
}
```

- [ ] **Step 2: 커밋**

```bash
git add nginx/nginx-init.conf
git commit -m "feat: nginx-init.conf - 인증서 초기 발급용 HTTP 설정 추가"
```

---

## Task 4: scripts/init-ssl.sh — 최초 인증서 발급 스크립트

**Files:**
- Create: `scripts/init-ssl.sh`

- [ ] **Step 1: scripts 디렉토리 확인 후 init-ssl.sh 생성**

```bash
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
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x scripts/init-ssl.sh
```

- [ ] **Step 3: 스크립트 실행 인자 검증 테스트**

```bash
bash scripts/init-ssl.sh 2>&1 | head -3
```
Expected: `bash: 1: 사용법: bash scripts/init-ssl.sh your@email.com` (오류 메시지 출력)

- [ ] **Step 4: 커밋**

```bash
git add scripts/init-ssl.sh
git commit -m "feat: Let's Encrypt 인증서 초기 발급 스크립트 추가"
```

---

## Task 5: 클라이언트/어드민 코드 수정 — URL 업데이트

**Files:**
- Modify: `client/src/network/socket.ts:20`
- Modify: `admin/src/api.ts:1`
- Modify: `admin/src/mapApi.ts:1`
- Modify: `admin/src/termApi.ts:1`
- Modify: `admin/vite.config.ts`
- Modify: `client/.env.example`
- Modify: `admin/.env.example`

- [ ] **Step 1: socket.ts fallback URL 변경 (line 20)**

변경 전:
```typescript
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://namuten.duckdns.org:3000';
```
변경 후:
```typescript
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://namuten.duckdns.org';
```

- [ ] **Step 2: admin/src/api.ts fallback URL 변경 (line 1)**

변경 전:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://220.85.41.214:3000';
```
변경 후:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'https://namuten.duckdns.org';
```

- [ ] **Step 3: admin/src/mapApi.ts fallback URL 변경 (line 1)**

변경 전:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://namuten.duckdns.org:3000';
```
변경 후:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'https://namuten.duckdns.org';
```

- [ ] **Step 4: admin/src/termApi.ts fallback URL 변경 (line 1)**

변경 전:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://220.85.41.214:3000';
```
변경 후:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'https://namuten.duckdns.org';
```

- [ ] **Step 5: admin/vite.config.ts — base 추가**

변경 전:
```typescript
export default defineConfig({
  server: { port: 5174 },
});
```
변경 후:
```typescript
export default defineConfig({
  base: '/admin/',
  server: { port: 5174 },
});
```

- [ ] **Step 6: .env.example 파일 업데이트**

`client/.env.example`:
```
VITE_SERVER_URL=https://namuten.duckdns.org
```

`admin/.env.example`:
```
VITE_API_URL=https://namuten.duckdns.org
```

- [ ] **Step 7: 커밋**

```bash
git add client/src/network/socket.ts \
        admin/src/api.ts admin/src/mapApi.ts admin/src/termApi.ts \
        admin/vite.config.ts \
        client/.env.example admin/.env.example
git commit -m "feat: API/WebSocket URL을 HTTPS로 업데이트"
```

---

## Task 6: GitHub Actions 배포

**Files:** 없음 (deploy.yml 변경 불필요)

- [ ] **Step 1: main 브랜치에 push**

```bash
git push origin main
```

- [ ] **Step 2: GitHub Actions 진행 확인**

`https://github.com/namuten/web3DGame/actions` 에서 워크플로우 확인
- `Deploy to GitHub Pages` → `deploy` job (GitHub Pages 빌드)
- `deploy-to-server` job (SSH → `docker-compose up --build`)

Expected: 두 job 모두 녹색 체크

- [ ] **Step 3: 서버 컨테이너 상태 확인 (SSH)**

```bash
# 서버 SSH 접속 후
docker ps
```
Expected: `nginx-proxy`, `certbot`, `web3d-client`, `web3d-server`, `web3d-admin` 5개 컨테이너 실행 중

- [ ] **Step 4: nginx 시작 실패 확인 (예상)**

이 시점에서 nginx-proxy는 `/etc/letsencrypt/live/namuten.duckdns.org/fullchain.pem` 파일이 없어 **시작 실패함** → 정상. Task 7에서 인증서 발급 후 해결됨.

```bash
docker logs nginx-proxy 2>&1 | tail -5
```
Expected: `cannot load certificate` 오류 (인증서 없어서 정상적으로 실패)

---

## Task 7: 서버 SSH 접속 — init-ssl.sh 실행 (수동, 최초 1회)

> ⚠️ **이 Task는 서버에 직접 SSH 접속해서 실행합니다.**

- [ ] **Step 1: 서버 SSH 접속**

```bash
ssh <user>@<server-ip>
cd ~/nagee/web3DGame
```

- [ ] **Step 2: 최신 코드 확인**

```bash
git log --oneline -3
```
Expected: Task 6에서 push한 커밋들이 보여야 함

- [ ] **Step 3: init-ssl.sh 실행**

```bash
bash scripts/init-ssl.sh your@email.com
```
Expected 순서:
1. 기존 컨테이너 중단
2. nginx-init 시작 (`docker ps`로 확인 가능)
3. certbot 인증서 발급 (DuckDNS DNS 확인 → ACME 챌린지 통과)
4. nginx-init 중단
5. 전체 스택 HTTPS로 기동

완료 메시지: `완료! https://namuten.duckdns.org 접속 확인하세요`

- [ ] **Step 4: 컨테이너 전체 실행 확인**

```bash
docker ps
```
Expected: 5개 컨테이너 모두 `Up` 상태

- [ ] **Step 5: HTTPS 동작 확인**

```bash
curl -I https://namuten.duckdns.org
```
Expected: `HTTP/2 200`

```bash
curl -I http://namuten.duckdns.org
```
Expected: `HTTP/1.1 301 Moved Permanently` + `Location: https://...`

---

## Task 8: 최종 검증

- [ ] **Step 1: 게임 접속**

브라우저에서 `https://namuten.duckdns.org` 접속
Expected: Three.js 게임 화면 로딩, 자물쇠 아이콘(HTTPS) 표시

- [ ] **Step 2: WebSocket 연결 확인**

게임에서 플레이어 이름 입력 후 접속
Expected: 다른 플레이어 동기화 동작, 채팅 동작

- [ ] **Step 3: Admin 패널 확인**

`https://namuten.duckdns.org/admin/` 접속
Expected: Admin 페이지 로딩

- [ ] **Step 4: GitHub Actions 재배포 테스트**

더미 커밋 후 push:
```bash
git commit --allow-empty -m "test: HTTPS 배포 자동화 검증"
git push origin main
```
Expected: Actions 완료 후에도 `https://namuten.duckdns.org` 정상 접속 (인증서 유지)

- [ ] **Step 5: certbot 갱신 dry-run 검증**

```bash
# 서버 SSH 접속 후
docker exec certbot certbot renew --dry-run
```
Expected: `Congratulations, all simulated renewals succeeded`
이 단계가 통과해야 90일 후 자동 갱신 + nginx reload가 정상 작동함

- [ ] **Step 6: 더미 커밋 제거**

```bash
git revert HEAD --no-edit
git push origin main
```
