FROM node:20-alpine

WORKDIR /app

RUN adduser -D -u 1001 appuser

COPY --chown=appuser:appuser apps/worker/dist ./dist
COPY --chown=appuser:appuser packages/shared/dist ./node_modules/@smoothradio/shared
COPY --chown=appuser:appuser packages/database/dist ./node_modules/@smoothradio/database  
COPY --chown=appuser:appuser packages/crypto/dist ./node_modules/@smoothradio/crypto

USER appuser

CMD ["node", "dist/index.js"]
