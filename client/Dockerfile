# Build stage
FROM node:20-alpine as build-stage

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# Production stage (Nginx)
FROM nginx:stable-alpine as production-stage

# 빌드된 정적 파일을 Nginx 경로로 복사
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 80번 포트 개방
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
