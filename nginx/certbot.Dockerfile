FROM certbot/certbot

# deploy-hook에서 nginx-proxy 컨테이너를 reload하려면 docker CLI가 필요함
RUN apk add --no-cache docker-cli
