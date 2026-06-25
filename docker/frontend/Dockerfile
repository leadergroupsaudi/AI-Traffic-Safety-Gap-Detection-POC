# ─────────────────────────────────────────────────────────────
# Stage 1 — Node build
# ─────────────────────────────────────────────────────────────
FROM node:20.20.2-alpine AS builder

WORKDIR /app

# Copy only package manifests first (layer-cache friendly)
COPY frontend/package*.json ./

RUN npm ci

# Copy full frontend source and build
COPY frontend/ .
RUN npm run build
# Output: /app/dist

# ─────────────────────────────────────────────────────────────
# Stage 2 — nginx static server (non-root, port 8080)
# ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Copy custom nginx config (non-root, port 8080)
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy compiled React app
COPY --from=builder /app/dist /usr/share/nginx/html

# Give nginx user ownership of html dir and writable tmp paths
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && mkdir -p /tmp/client_body_temp /tmp/proxy_temp /tmp/fastcgi_temp \
                /tmp/uwsgi_temp /tmp/scgi_temp \
    && chown -R nginx:nginx /tmp/client_body_temp /tmp/proxy_temp \
                            /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
