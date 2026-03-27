# 배포 가이드

## 인프라 구조

```
인터넷
  ↓ HTTP(80) → HTTPS(443) 리다이렉트
  ↓ HTTPS(443)
nginx-proxy (nginx:stable-alpine)
  ├── /           → web3d-client:80   (Three.js 게임)
  ├── /socket.io/ → web3d-server:3000 (WebSocket)
  ├── /api/       → web3d-server:3000 (REST API)
  └── /admin/     → web3d-admin:80    (관리 패널)

certbot (certbot/certbot)
  └── 12시간마다 인증서 갱신 체크 + nginx 자동 reload
```

- **도메인:** namuten.duckdns.org (DuckDNS)
- **서버:** Ubuntu, Docker + docker-compose
- **인증서:** Let's Encrypt (호스트 `/etc/letsencrypt` 저장)
- **DB:** 외부 MySQL (220.85.41.214:3306)

---

## 자동 배포 (GitHub Actions)

`main` 브랜치에 push 하면 자동으로 실행됩니다.

**워크플로우 순서:**
1. `deploy` job — client 빌드 → GitHub Pages 배포
2. `deploy-to-server` job — SSH 접속 → 서버 업데이트

**서버에서 실행되는 명령:**
```bash
cd ~/nagee/web3DGame
git fetch origin main
git reset --hard origin/main
export DB_PASSWORD=${{ secrets.DB_PASSWORD }}
docker-compose up -d --build --force-recreate
```

**GitHub Secrets 필요 항목:**
| Secret | 설명 |
|---|---|
| `SSH_HOST` | 서버 IP |
| `SSH_USER` | SSH 사용자명 |
| `SSH_PASSWORD` | SSH 비밀번호 |
| `DB_PASSWORD` | MySQL 비밀번호 |

---

## 서버 환경 설정

### .env 파일 (서버에만 존재, git 미포함)
```bash
# ~/nagee/web3DGame/.env
DB_PASSWORD=실제비밀번호
```
> ⚠️ 이 파일은 서버에 직접 만들어야 합니다. git에 올라가지 않습니다.
> GitHub Actions는 Secrets에서 DB_PASSWORD를 주입하지만,
> 수동으로 docker-compose 실행 시 이 파일이 없으면 DB 연결 실패합니다.

---

## 최초 서버 세팅 (신규 서버 or 인증서 없을 때)

### 1. 코드 배포
main 브랜치에 push → GitHub Actions 자동 실행
(이 시점에서 nginx-proxy는 인증서 없어서 시작 실패 — 정상)

### 2. .env 파일 생성
```bash
ssh user@server
cd ~/nagee/web3DGame
echo "DB_PASSWORD=실제비밀번호" > .env
```

### 3. Let's Encrypt 인증서 발급 (최초 1회)
```bash
bash scripts/init-ssl.sh your@email.com
```

**스크립트 동작 순서:**
1. DuckDNS IP 확인 (서버 IP와 일치하는지 3초 대기)
2. 기존 컨테이너 중단
3. nginx-init 임시 실행 (HTTP only, port 80)
4. certbot으로 인증서 발급 → `/etc/letsencrypt` 저장
5. nginx-init 중단
6. 전체 스택 HTTPS로 기동

> ⚠️ 실패 시 nginx-init은 자동 정리됩니다 (trap EXIT)

### 4. 동작 확인
```bash
# 컨테이너 상태
docker ps

# HTTPS 확인
curl -I https://namuten.duckdns.org   # 200 OK
curl -I http://namuten.duckdns.org    # 301 Moved

# certbot 갱신 테스트
docker exec certbot certbot renew --dry-run
```

---

## 인증서 갱신

자동으로 처리됩니다. certbot 컨테이너가 12시간마다 체크하고, 갱신 성공 시 nginx를 자동 reload 합니다.

수동으로 갱신하려면:
```bash
docker exec certbot certbot renew --force-renewal
docker exec nginx-proxy nginx -s reload
```

---

## 트러블슈팅

### nginx-proxy가 시작 안 됨
```bash
docker logs nginx-proxy --tail 20
```
- `cannot load certificate` → 인증서 없음. `init-ssl.sh` 실행 필요
- 정상이면 `/etc/letsencrypt/live/namuten.duckdns.org/` 존재 확인:
  ```bash
  ls /etc/letsencrypt/live/namuten.duckdns.org/
  ```

### DB 연결 실패 (Access denied, using password: NO)
`.env` 파일이 없거나 `DB_PASSWORD`가 비어 있음:
```bash
cd ~/nagee/web3DGame
echo "DB_PASSWORD=실제비밀번호" > .env
docker-compose up -d --force-recreate web3d-server
```

### 브라우저에서 HTTPS 경고 (혼합 콘텐츠)
- 브라우저 캐시 문제일 가능성 높음 → `Ctrl+Shift+Delete` 캐시 삭제
- 시크릿 창에서 재접속으로 확인

### 특정 컨테이너만 재빌드
```bash
docker-compose up -d --build --no-deps --force-recreate web3d-client
docker-compose up -d --build --no-deps --force-recreate web3d-server
docker-compose up -d --build --no-deps --force-recreate web3d-admin
```

### 전체 재시작
```bash
docker-compose down
docker-compose up -d --build
```
> ⚠️ 인증서는 호스트 `/etc/letsencrypt`에 저장되어 있어 재시작해도 유지됩니다.

---

## 롤백

문제가 생겼을 때:
```bash
# 특정 커밋으로 롤백
git revert <문제-커밋-hash> --no-edit
git push origin main
# → GitHub Actions가 자동 배포
```

또는 서버에서 직접:
```bash
cd ~/nagee/web3DGame
git reset --hard <이전-커밋-hash>
docker-compose up -d --build --force-recreate
```

---

## 주요 파일 위치

| 파일 | 설명 |
|---|---|
| `docker-compose.yml` | 전체 서비스 구성 |
| `nginx/nginx.conf` | HTTPS 리버스 프록시 설정 |
| `nginx/nginx-init.conf` | 인증서 최초 발급용 (init-ssl.sh 전용) |
| `scripts/init-ssl.sh` | 인증서 최초 발급 스크립트 |
| `.github/workflows/deploy.yml` | GitHub Actions 배포 워크플로우 |
| `/etc/letsencrypt/` | 인증서 저장 경로 (서버 호스트) |
| `~/nagee/web3DGame/.env` | DB 비밀번호 (서버에만 존재) |
