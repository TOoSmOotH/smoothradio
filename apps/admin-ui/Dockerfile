FROM node:20-alpine

WORKDIR /app

RUN adduser -D -u 1001 appuser

COPY --chown=appuser:appuser apps/admin-ui/dist ./dist
COPY --chown=appuser:appuser apps/admin-ui/package.json ./package.json

EXPOSE 3001

CMD ["npm", "run", "preview"]
