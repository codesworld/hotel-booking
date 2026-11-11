# ---- build stage: compile the React app to static files ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
# vite.config.ts needs BASE_URL only for the dev proxy; any value works for a production build.
RUN BASE_URL=http://unused npx tsc --noEmit && BASE_URL=http://unused npx vite build

# ---- runtime stage: nginx serves the files and proxies /api ----
FROM nginx:1.27-alpine
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
