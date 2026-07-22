FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .

ARG MYAPP_WEB_API_BASE_URL=""
ENV MYAPP_WEB_API_BASE_URL=${MYAPP_WEB_API_BASE_URL}
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max_old_space_size=4096
ENV PROGRESS=none

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV MYAPP_WEB_UPSTREAM=http://frontend:8080

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
