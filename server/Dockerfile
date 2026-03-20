FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# 포트 개방
EXPOSE 3000

# 서버 실행
CMD ["npm", "start"]
