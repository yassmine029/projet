FROM node:20-alpine AS build

WORKDIR /app

# ── Arguments de build passés par docker-compose ──────────────
# APP_MODE     : full | segmentation | recalage  (défaut: full)
# AUTH_DISABLED: true | false                    (défaut: false)
# API_BASE_URL : URL du backend                  (défaut: /api)
ARG APP_MODE=full
ARG AUTH_DISABLED=false
ARG API_BASE_URL=/api

# Copie et installation des dépendances
COPY package*.json ./
RUN npm install

# Copie du code source
COPY . .

# Build avec les variables d'environnement Vite
# Les ARG Docker deviennent des VITE_* lus par appConfig.ts
RUN VITE_APP_MODE=${APP_MODE} \
    VITE_AUTH_DISABLED=${AUTH_DISABLED} \
    VITE_API_BASE_URL=${API_BASE_URL} \
    npm run build

# ── Étape 2 : servir le build avec Nginx ──────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
