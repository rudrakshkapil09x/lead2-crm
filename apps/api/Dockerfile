FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace apps/api --include-workspace-root
COPY apps/api ./apps/api
RUN npm run build --workspace apps/api && npm prune --omit=dev --workspace apps/api --include-workspace-root
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/api/db ./db
USER node
EXPOSE 4000
CMD ["node","dist/main.js"]
