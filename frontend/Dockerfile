# Dockerfile - frontend Angular (build avec Node, serve avec nginx)
# Build :  docker build -t eventify/frontend:latest .
# Run   :  docker run -p 4200:8080 eventify/frontend:latest

# ─── Stage 1 : build Angular ───
FROM node:20-alpine AS builder

WORKDIR /app

# Installation des deps (legacy-peer-deps pour la compat CoreUI)
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Build de l'app (output : dist/coreui-free-angular-admin-template/browser)
COPY . .
RUN npm run build

# ─── Stage 2 : runtime nginx (image non-root, idéal OpenShift) ───
FROM nginxinc/nginx-unprivileged:alpine

# Conf nginx custom (SPA fallback + proxy /api -> api-gateway)
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers buildés
COPY --from=builder --chown=nginx:nginx /app/dist/coreui-free-angular-admin-template/browser /usr/share/nginx/html

EXPOSE 8080

# L'image nginx-unprivileged tourne deja en non-root sur 8080
