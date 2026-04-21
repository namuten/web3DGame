#!/bin/bash

# 터미널에서 Ctrl+C 입력 시 백그라운드로 실행된 모든 프로세스를 종료합니다.
trap "kill 0" SIGINT

echo "🚀 게임 서버 구동 중 (Port 3000)..."
(cd server && npm run dev) &

echo "🚀 게임 클라이언트 구동 중 (Port 5173)..."
(cd client && npm run dev) &

echo "🚀 어드민 페이지 구동 중 (Port 5174)..."
(cd admin && npm run dev) &

echo "--------------------------------------------------------"
echo "✅ 모든 서비스가 실행되었습니다!"
echo "📍 Client: http://localhost:5173/"
echo "📍 Admin:  http://localhost:5174/admin/"
echo "⛔ 종료하려면 터미널에서 [Ctrl+C]를 누르세요."
echo "--------------------------------------------------------"

# 백그라운드 프로세스들이 종료될 때까지 대기합니다.
wait
