# Compile le SCSS, puis sert public/ avec nginx non root sur 8080.
# Épingler des versions précises en production.
FROM node:22-alpine AS css
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY scss/ scss/
RUN mkdir -p public/assets/css && npm run build:css

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
COPY --from=css /app/public/assets/css/style.css /usr/share/nginx/html/assets/css/style.css
EXPOSE 8080
