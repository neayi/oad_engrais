# Compile le SCSS et les règles publicodes, puis sert public/ avec nginx non root sur 8080.
# Épingler des versions précises en production.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY scss/ scss/
COPY regles/ regles/
COPY scripts/ scripts/
RUN mkdir -p public/assets/css public/data && npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
COPY --from=build /app/public/assets/css/style.css /usr/share/nginx/html/assets/css/style.css
COPY --from=build /app/public/data/regles.json /usr/share/nginx/html/data/regles.json
COPY --from=build /app/public/assets/vendor/ /usr/share/nginx/html/assets/vendor/
EXPOSE 8080
