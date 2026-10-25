# Demo image: the unified-api UI served by nginx, which forwards API calls to a
# unified-api instance. The production path is different: the unified-api
# image builds this same UI in and serves it itself (server.ui.assets_dir).

FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/client/package.json packages/client/
COPY packages/ui/package.json packages/ui/
COPY apps/unified-api/package.json apps/unified-api/
RUN npm ci --no-audit --no-fund
COPY packages/ packages/
COPY apps/ apps/
RUN npm run build

FROM nginx:1.29-alpine
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/apps/unified-api/dist /usr/share/nginx/html
ENV UNIFIED_API_URL=http://unified-api:8182 \
    UNIFIED_API_KEY="" \
    UI_READ_ONLY=false
EXPOSE 8080
