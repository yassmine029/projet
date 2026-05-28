FROM node:20-alpine AS build

WORKDIR /app

# Copie et installation des dépendances (OBLIGATOIRE)
COPY package*.json ./
RUN npm install

# Copie du code et build de production
COPY . .
RUN VITE_API_BASE_URL=/api npm run build

# Étape 2 : servir le build avec Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
